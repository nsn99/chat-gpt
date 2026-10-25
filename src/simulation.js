import {advanceEffects} from './effects.js';
import {moveAgainstBoxes,sweepBox} from './collision.js';
export const VERSION=1, GOAL=3000, TANK=40;
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// Repeating route: long straights, broad bends, then a shorter zigzag section.
const ROUTE_Z=[0,350,550,850,1025,1200,1450,1650,1850,2150,2400];
const ROUTE_X=[0,0,72,72,-44,64,64,0,0,-60,0];
export const roadX=z=>{
  if(z<=70)return 0;
  const t=(z-70)%2400;let i=0;while(t>ROUTE_Z[i+1])i++;
  const u=(t-ROUTE_Z[i])/(ROUTE_Z[i+1]-ROUTE_Z[i]);
  const ease=u*u*u*(u*(u*6-15)+10);
  return ROUTE_X[i]+(ROUTE_X[i+1]-ROUTE_X[i])*ease;
};
export const GARAGE={x:-22,z:-25};
export function garageBlocked(x,z,pad=0){return (Math.abs(x+28)<.35+pad||Math.abs(x+16)<.35+pad)&&z>-34-pad&&z<-15+pad || Math.abs(z+34)<.35+pad&&x>-28-pad&&x<-16+pad;}

export const roadYaw=z=>Math.atan((roadX(z+1)-roadX(z-1))/2);
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function random(seed){let t=seed|0;return ()=>{t+=0x6D2B79F5;let v=Math.imul(t^t>>>15,1|t);v^=v+Math.imul(v^v>>>7,61|v);return ((v^v>>>14)>>>0)/4294967296;};}
export function station(id){const z=70+id*350;return {id,x:roadX(z)+23,z};}
export function propsForChunk(id){
  const r=random(id*913+42), out=[];
  for(let i=0;i<16;i++){
    const z=id*100+r()*100, side=r()<.5?-1:1;
    const x=roadX(z)+side*(15+r()*170), size=1+r()*3;
    if(z>-48&&z<45&&x>-40&&x<12)continue;
    if(Math.abs(z-station(Math.max(0,Math.round((z-70)/350))).z)<28 && side>0 && x-roadX(z)<45)continue;
    if(settlementsNear(z,1).some(p=>Math.abs(z-p.z)<85&&Math.abs(x-p.x)<34)||oasesNear(z).some(o=>Math.abs(z-o.z)<28&&Math.abs(x-o.x)<24))continue;
    out.push({x,z,size,type:r()<.45?'cactus':'rock'});
  }return out;
}
export function nearbyProps(z){const c=Math.floor(z/100);return [-1,0,1].flatMap(n=>propsForChunk(c+n));}
export function newGame(){return {version:VERSION,car:{x:GARAGE.x,z:GARAGE.z,yaw:0,speed:0,fuel:9,health:100},player:{x:0,z:0,yaw:0,health:100,down:0,invulnerable:0,vx:0,vz:0},vehicles:[],discovered:[],inventory:{fuel:0,oil:2,water:4,parts:1},looted:[],mode:'drive',camera:'chase',odometer:0,furthest:0,time:0,collected:[],won:false};}
export function step(s,input,dt){
  dt=clamp(dt,0,.05);s.time+=dt;const c=s.car;ensureVehicles(s);const previousPlayer={...s.player};
  if(s.mode==='drive'){
    const offroad=Math.abs(c.x-roadX(c.z))>6;
    let throttle=(input.forward?1:0)-(input.backward?1:0);
    if(c.fuel<=0||c.health<=0)throttle=0;
    const prev={x:c.x,z:c.z};
    advanceSpeed(c,{...input,throttle},dt,offroad);
    advanceSteering(c,input,dt);
    const end={x:c.x+Math.sin(c.yaw)*c.speed*dt,z:c.z+Math.cos(c.yaw)*c.speed*dt};
    const result=moveAgainstBoxes(c,end,[...obstaclesNear(c.z),...s.vehicles.map(vehicleBox)]);
    c.x=result.x;c.z=result.z;
    if(result.hit){
      const h=result.hit,normalSpeed=Math.abs(c.speed*(Math.sin(c.yaw)*h.nx+Math.cos(c.yaw)*h.nz));
      crash(s,normalSpeed,h.nx,h.nz);c.speed=Math.abs(c.speed)>3?-c.speed*.055:0;
    }
    const moved=distance(c,prev);s.odometer+=moved;s.furthest=Math.max(s.furthest,c.z);
    c.fuel=clamp(c.fuel-(moved*fuelRate(c)+(throttle!==0?.0002*dt:0)),0,TANK);
    advanceMaintenance(c,moved,dt,throttle!==0);
    s.won=false; // Endless route; distance remains a trip statistic.
  }else{
    const p=s.player;p.health??=100;p.down=Math.max(0,(p.down??0)-dt);p.invulnerable=Math.max(0,(p.invulnerable??0)-dt);
    const conscious=p.health>0&&p.down===0;
    if(conscious)p.yaw-=((input.right?1:0)-(input.left?1:0))*1.7*dt;
    const v=conscious?((input.forward?1:0)-(input.backward?1:0))*(input.sprint?7:3.8):0;
    const end={x:p.x+(Math.sin(p.yaw)*v+(p.vx??0))*dt,z:p.z+(Math.cos(p.yaw)*v+(p.vz??0))*dt};
    movePerson(p,end,[...obstaclesNear(p.z),...[s.car,...s.vehicles].map(vehicleBox)]);
    p.vx=(p.vx??0)*Math.exp(-4*dt);p.vz=(p.vz??0)*Math.exp(-4*dt);
  }
  stepTraffic(s,dt,previousPlayer);
  advanceEffects(s,dt,[s.car,...s.vehicles,...getTraffic(s)].map(c=>({...c,offroad:Math.abs(c.x-roadX(c.z))>6})));
  for(const d of getDebris(s)){d.life-=dt;d.x+=d.vx*dt;d.z+=d.vz*dt;d.y=Math.max(.08,d.y+d.vy*dt);d.vy-=9.8*dt;}
  debrisWorlds.set(s,getDebris(s).filter(d=>d.life>0));
}
export function interaction(s){
  if(s.mode==='walk'&&(s.player.health??100)<=0)return 'Эвакуация после наезда';
  if(s.mode==='walk'&&s.player.down>0)return '';
  if(s.mode==='drive')return Math.abs(s.car.speed)>1?'Сначала остановите машину':'Выйти из машины';
  const tanker=nearbyTanker(s);if(tanker)return inventory(s).fuel>=20?'Канистра полна · заправьте машину':`Слить в канистру 5 л · в цистерне ${Math.floor(tanker.cargo)} л`;
  const loot=nearbyLoot(s);if(loot)return 'Забрать канистру и запчасти';
  const service=vehicleService(s);if(service)return service.label;
  const id=Math.max(0,Math.round((s.player.z-70)/350)), st=station(id), supply={x:st.x-3,z:st.z-9};
  if(distance(s.player,supply)<4&&!s.collected.includes(id))return 'Забрать запас: +12 л и ремонт';
  const candidate=nearestVehicle(s);if(candidate)return 'Сесть: '+(candidate.name??'Универсал');
  return '';
}
export function interact(s){
  if(s.mode==='walk'&&(s.player.health??100)<=0){recover(s);return 'Вы эвакуированы. Здоровье восстановлено';}
  if(s.mode==='walk'&&s.player.down>0)return 'Вы сбиты с ног. Дождитесь восстановления';
  if(s.mode==='drive'){
    if(Math.abs(s.car.speed)>1)return 'Остановитесь перед выходом';
    const c=s.car;s.mode='walk';c.speed=0;const exits=[1,-1].map(side=>({x:c.x+Math.cos(c.yaw)*3.3*side,z:c.z-Math.sin(c.yaw)*3.3*side}));
    const blocked=[...obstaclesNear(c.z),...(s.vehicles??[]).map(vehicleBox),...getTraffic(s).map(vehicleBox)];
    const exit=exits.find(p=>!blocked.some(b=>Math.abs(p.x-b.x)<b.w/2+.4&&Math.abs(p.z-b.z)<b.d/2+.4));
    if(!exit){s.mode='drive';return 'Двери заблокированы. Отъедьте от препятствия';}
    s.player={...s.player,...exit,yaw:c.yaw,down:0,vx:0,vz:0};return 'Вы вышли из машины';
  }
  const tanker=nearbyTanker(s);if(tanker){const pack=inventory(s),litres=Math.min(5,20-pack.fuel,tanker.cargo);pack.fuel+=litres;tanker.cargo-=litres;return litres>0?`В канистре ${pack.fuel.toFixed(1)} л. Подойдите к задней части своей машины`:'Канистра полна';}
  const loot=nearbyLoot(s);if(loot){const pack=inventory(s);pack.fuel=Math.min(20,pack.fuel+5);pack.oil=Math.min(10,pack.oil+2);pack.water=Math.min(20,pack.water+4);pack.parts=Math.min(20,pack.parts+1);s.looted.push(loot.id);return 'Найдены бензин, масло, вода и запчасти';}
  const service=vehicleService(s);if(service){const c=service.car,pack=inventory(s);if(service.kind==='fuel'){const amount=Math.min(5,pack.fuel,TANK-c.fuel);pack.fuel-=amount;c.fuel+=amount;return `Заправлено ${amount.toFixed(1)} л`;}
    const oil=Math.min(pack.oil,5-(c.oil??5)),water=Math.min(pack.water,5-(c.water??5));pack.oil-=oil;pack.water-=water;c.oil=(c.oil??5)+oil;c.water=(c.water??5)+water;
    if(c.health<100&&pack.parts>0){pack.parts--;c.health=Math.min(100,c.health+35);if(c.damage)for(const k of Object.keys(c.damage))c.damage[k]=Math.max(0,c.damage[k]-.35);}
    return 'Обслуживание: жидкости долиты, доступные запчасти использованы';
  }
  const id=Math.max(0,Math.round((s.player.z-70)/350)),st=station(id);
  if(distance(s.player,{x:st.x-3,z:st.z-9})<4&&!s.collected.includes(id)){
    s.collected.push(id);s.car.fuel=clamp(s.car.fuel+12,0,TANK);s.car.health=clamp(s.car.health+35,0,100);if(s.car.damage)for(const k of Object.keys(s.car.damage))s.car.damage[k]=Math.max(0,s.car.damage[k]-.35);return 'Запас доставлен в машину: +12 л, ремонт +35';
  }
  const candidate=nearestVehicle(s);if(candidate){
    if(candidate!==s.car){
      const traffic=getTraffic(s),index=traffic.indexOf(candidate);
      if(index>=0)traffic.splice(index,1);
      s.vehicles=s.vehicles.filter(c=>c!==candidate);s.vehicles.push(s.car);
      s.car=candidate;s.car.fuel??=14;s.car.health??=75;s.car.name??='Дорожный седан';s.car.rust??=.25;
    }
    s.car.speed=0;s.mode='drive';return 'За рулём: '+(s.car.name??'Универсал');
  }return 'Подойдите к машине или припасам';
}
export function recover(s){
  // A deterministic fallback prevents a fuel/health softlock. Progress is lost.
  const z=Math.max(0,s.car.z-150);s.player={...s.player,health:100,down:0,invulnerable:0,vx:0,vz:0};s.car={...s.car,x:roadX(z),z,yaw:roadYaw(z),speed:0,fuel:Math.max(3,s.car.fuel-1),health:Math.max(35,s.car.health-15)};s.mode='drive';
}
export function serialize(s){return JSON.stringify(s);}
export function deserialize(raw){
  try{
    const s=JSON.parse(raw), finite=(v,max)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=max;
    if(!s||s.version!==VERSION||!s.car||!s.player||!['drive','walk'].includes(s.mode)||!['chase','cockpit'].includes(s.camera))return null;
    for(const p of [s.car,s.player])if(!finite(p.x,1e7)||!finite(p.z,1e7)||!finite(p.yaw,1e7))return null;
    if(!finite(s.car.speed,MAX_SPEED+1)||!finite(s.car.fuel,TANK)||s.car.fuel<0||!finite(s.car.health,100)||s.car.health<0)return null;
    if(!finite(s.odometer,1e9)||s.odometer<0||!finite(s.furthest,1e7)||!finite(s.time,1e9)||s.time<0||typeof s.won!=='boolean')return null;
    if(!Array.isArray(s.collected)||s.collected.length>100000||!s.collected.every(n=>Number.isInteger(n)&&n>=0&&n<1e6))return null;
    if(s.car.damage&&(!['front','rear','left','right'].every(k=>finite(s.car.damage[k],1)&&s.car.damage[k]>=0)))return null;
    if(s.vehicles!==undefined&&(!Array.isArray(s.vehicles)||s.vehicles.length>10000||!s.vehicles.every(c=>c&&finite(c.x,1e7)&&finite(c.z,1e7)&&finite(c.yaw,1e7)&&finite(c.speed,MAX_SPEED+1)&&finite(c.fuel,TANK)&&c.fuel>=0&&finite(c.health,100)&&c.health>=0&&(!c.damage||['front','rear','left','right'].every(k=>finite(c.damage[k],1)&&c.damage[k]>=0)))))return null;
    if(s.discovered!==undefined&&(!Array.isArray(s.discovered)||s.discovered.length>100000||!s.discovered.every(Number.isInteger)))return null;
    for(const k of ['health','down','invulnerable','vx','vz'])if(s.player[k]!==undefined&&!finite(s.player[k],k==='health'?100:1000))return null;
    for(const c of [s.car,...(s.vehicles??[])]){
      for(const k of ['oil','water','temperature','cargo','rust'])if(c[k]!==undefined&&(!finite(c[k],k==='cargo'?120:k==='temperature'?200:k==='rust'?1:5)||c[k]<0))return null;
      if(c.color!==undefined&&(!Array.isArray(c.color)||c.color.length!==3||!c.color.every(v=>finite(v,1)&&v>=0)))return null;
    }
    if(s.inventory!==undefined&&(!s.inventory||!['fuel','oil','water','parts'].every(k=>finite(s.inventory[k],20)&&s.inventory[k]>=0)))return null;
    if(s.looted!==undefined&&(!Array.isArray(s.looted)||s.looted.length>100000||!s.looted.every(n=>Number.isInteger(n)&&n>=0)))return null;
    for(const c of [s.car,...(s.vehicles??[])])if(c.upgrades!==undefined&&(!c.upgrades||Object.entries(c.upgrades).some(([k,v])=>!['armor','engine','cargo','camper'].includes(k)||typeof v!=='boolean')))return null;
    s.car.speed=0;s.won=false;return s;
  }catch{return null;}
}

// Traffic is transient. Save files retain the trip, not stale AI vehicles.
const trafficWorlds=new WeakMap();
export function getTraffic(s){
  if(!trafficWorlds.has(s)){const cars=Array.from({length:12},(_,id)=>({id,type:id%5===2?'tanker':'sedan',name:id%5===2?'Бензовоз':'Дорожный седан',cargo:id%5===2?120:0,z:40+id*58+Math.max(0,s.car.z-160),dir:id%3===0?-1:1,speed:0,cruise:15+(id%4)*5,lane:id%3===0?3:-3,pass:null,hit:0,wait:0,avoid:false,horn:0}));trafficWorlds.set(s,cars);for(const t of cars)placeTraffic(t);}
  return trafficWorlds.get(s);
}
function placeTraffic(t){t.x=roadX(t.z)+t.lane;t.yaw=roadYaw(t.z)+(t.dir<0?Math.PI:0);}
export function stepTraffic(s,dt,previousPlayer=s.player){
  const cars=getTraffic(s),c=s.car,center=s.mode==='walk'?s.player:c;
  for(const t of cars){
    t.hit=Math.max(0,t.hit-dt);
    if(t.z<center.z-220||t.z>center.z+750||t.z<15){t.z=Math.max(40,center.z+(t.dir<0?580+t.id*10:-180+t.id*8));t.lane=t.dir<0?3:-3;t.pass=null;t.wait=0;t.avoid=false;placeTraffic(t);}
    placeTraffic(t);const before={x:t.x,z:t.z};
    const slope=Math.tan(roadYaw(t.z));let desired=t.cruise;
    if(t.dir>0){
      const targets=[...cars.filter(o=>o!==t&&o.dir>0),...(Math.abs(c.x-roadX(c.z)+3)<2.4?[{id:-1,z:c.z,speed:Math.max(0,c.speed)}]:[])];
      const ahead=targets.filter(o=>o.z>t.z&&o.z-t.z<65).sort((a,b)=>a.z-b.z)[0];
      const clear=!cars.some(o=>o.dir<0&&o.z>t.z-30&&o.z<t.z+240)&&!cars.some(o=>o!==t&&o.pass!==null&&Math.abs(o.z-t.z)<65);
      if(t.pass===null&&ahead&&ahead.speed<t.cruise-2){if(clear&&ahead.z-t.z<48)t.pass=ahead.id;else desired=Math.min(desired,Math.max(0,(ahead.z-t.z-9)*.7),ahead.speed+2);}
      if(t.pass!==null){const target=t.pass===-1?c:cars.find(o=>o.id===t.pass);if(!target||t.z>target.z+18)t.pass=null;}
      if(!t.avoid){const targetLane=t.pass!==null?3:-3;t.lane+=(targetLane-t.lane)*Math.min(1,dt*1.5);}
      // Wait behind the target until the car has moved out of its lane.
      if(ahead&&ahead.z-t.z<10&&Math.abs(t.lane-(ahead.lane??-3))<2)desired=0;
    }
    const p=s.player,gap=(p.z-t.z)*t.dir;
    const pedestrian=s.mode==='walk'&&gap>-vehicleLength(t)/2-1&&gap<Math.max(48,t.speed*t.speed/12+12)&&Math.abs(p.x-roadX(p.z)-t.lane)<2;
    if(pedestrian&&!t.avoid){
      desired=Math.min(desired,Math.sqrt(Math.max(0,gap-vehicleLength(t)/2-4)*10));
      if(gap<18&&t.speed<2){
        desired=0;t.wait+=dt;
        if(t.wait>.45&&!t.honked){t.horn++;t.honked=true;}
        const detour=(p.x-roadX(p.z))>0?-3:3;
        const clear=!cars.some(o=>o!==t&&Math.abs(o.z-t.z)<110&&Math.abs(o.lane-detour)<2.4)&&![c,...(s.vehicles??[])].some(o=>Math.abs(o.z-t.z)<26&&Math.abs(o.x-roadX(o.z)-detour)<2.7);
        if(t.wait>2.2&&clear){t.avoid=true;t.avoidZ=p.z;t.avoidLane=detour;}
      }
    }else if(!t.avoid){t.wait=0;t.honked=false;}
    if(t.avoid){
      const blocked=cars.some(o=>o!==t&&(o.z-t.z)*t.dir>-8&&(o.z-t.z)*t.dir<65&&Math.abs(o.lane-t.avoidLane)<2.5);
      t.lane+=(t.avoidLane-t.lane)*Math.min(1,dt*1.4);
      desired=Math.min(desired,blocked?0:Math.abs(t.lane-t.avoidLane)>1.2?0:5);
      if((t.z-t.avoidZ)*t.dir>12){t.avoid=false;t.wait=0;t.honked=false;t.pass=null;}
    }else if(t.dir<0)t.lane+=(3-t.lane)*Math.min(1,dt*1.5);
    // Parked traffic brakes before contact; collision remains the last line of defence.
    for(const parked of [c,...(s.vehicles??[])]){
      const ahead=(parked.z-t.z)*t.dir;
      if(ahead>0&&ahead<45&&Math.abs(parked.x-roadX(parked.z)-t.lane)<2.5&&!(parked===c&&s.mode==='drive'))desired=Math.min(desired,Math.sqrt(Math.max(0,ahead-vehicleLength(t)/2-vehicleLength(parked)/2-2)*8));
    }
    t.speed=desired<t.speed?Math.max(desired,t.speed-8*dt):t.speed+(desired-t.speed)*Math.min(1,dt*2);
    t.z+=t.dir*t.speed*dt/Math.sqrt(1+slope*slope);placeTraffic(t);
    if(s.mode==='walk')hitPedestrian(s,t,before,previousPlayer);
    const parkedHit=moveAgainstBoxes({...t,...before},{x:t.x,z:t.z},(s.vehicles??[]).map(vehicleBox));
    if(parkedHit.hit){t.x=parkedHit.x;t.z=parkedHit.z;t.speed=0;}

    const hit=moveAgainstBoxes(c,{x:c.x,z:c.z},[vehicleBox(t)]);
    if(hit.hit){c.x=hit.x;c.z=hit.z;if(t.hit===0){crash(s,Math.abs(c.speed-t.dir*t.speed),hit.hit.nx,hit.hit.nz);c.speed*=-.08;t.speed=0;t.hit=1.5;}}
  }
}

export const MAX_SPEED=75; // 270 km/h. All simulation distances remain metres.
const engines=new WeakMap(),debrisWorlds=new WeakMap();
export function getDebris(s){if(!debrisWorlds.has(s))debrisWorlds.set(s,[]);return debrisWorlds.get(s);}
export function advanceSpeed(c,input,dt,offroad=false){
  let target=input.throttle??((input.forward?1:0)-(input.backward?1:0));
  target=clamp(target,-1,1);
  const engineReady=c.fuel>0&&c.health>0;
  // Opposite pedal is a brake until a complete stop, never an instant gear flip.
  if(input.brake || (target!==0&&c.speed*target<0)){
    const sign=Math.sign(c.speed),rate=input.brake?24:16;
    c.speed=sign*Math.max(0,Math.abs(c.speed)-rate*dt);
    engines.set(c,0);return;
  }
  if(!engineReady)target=0;
  let pedal=engines.get(c)??0;
  if(pedal*target<0)pedal=0;
  pedal+=(target-pedal)*(1-Math.exp(-dt*3.5));engines.set(c,pedal);
  if(!engineReady)pedal=0;
  const reversing=target<0||c.speed<-.01;
  const power=(reversing?4.2:4.8+Math.min(4.2,Math.abs(c.speed)*.12))*(c.type==='tanker'?.55:c.type==='bus'?.62:1)*(c.upgrades?.engine?1.35:1)/(1+(c.upgrades?.armor?.1:0)+(c.upgrades?.camper?.12:0))*(offroad?.6:1)*(.55+.45*c.health/100);
  const drag=.10+.00095*c.speed*c.speed+(offroad?Math.abs(c.speed)*.16:0);
  const v=c.speed+pedal*power*dt;
  c.speed=Math.sign(v)*Math.max(0,Math.abs(v)-drag*dt);
  c.speed=clamp(c.speed,['bus','tanker'].includes(c.type)?-5:-8,['bus','tanker'].includes(c.type)?(c.upgrades?.engine?55:40):MAX_SPEED);
  if(offroad&&c.speed>35)c.speed=Math.max(35,c.speed-9*dt);
  if(target===0&&Math.abs(c.speed)<.01)c.speed=0;
}
const steeringStates=new WeakMap();
export function wheelAngle(c){return steeringStates.get(c)??0;}
export function advanceSteering(c,input,dt){
  const command=clamp(input.steer??((input.right?1:0)-(input.left?1:0)),-1,1);
  const v=Math.abs(c.speed),limit=Math.min(.48,Math.atan(2.7*9/(v*v+36)));
  const target=command*limit,previous=wheelAngle(c);
  let angle=previous+(target-previous)*(1-Math.exp(-dt*(command===0?15:10)));
  angle=clamp(angle,-limit,limit);steeringStates.set(c,angle);
  // Bicycle model. Reverse motion naturally reverses yaw, without reversing the controls.
  c.yaw-=c.speed/2.7*Math.tan(angle)*dt;
}

export function obstaclesNear(z){
  const boxes=[],add=(x,z,w,d,type)=>boxes.push({x,z,w,d,type});
  for(const p of nearbyProps(z))add(p.x,p.z,p.type==='rock'?p.size*1.8:2.5,p.type==='rock'?p.size*1.6:.7,p.type);
  const base=Math.floor(z/100);
  for(let id=base-1;id<=base+1;id++){
    for(const dune of sandDunesForChunk(id))add(dune.x,dune.z,dune.w,dune.d,'dune');
    add(roadX(id*100+40)-12,id*100+40,.3,.3,'pole');add(roadX(id*100)+8,id*100,.3,.3,'marker');
    const rng=random(id+890);for(let j=0;j<3;j++){const mz=id*100+j*50,side=j%2?-1:1;const x=roadX(mz)+side*(260+rng()*140),w=100+rng()*100;rng();add(x,mz,w,120,'hill');}
  }
  const near=Math.floor((z-70)/350);
  for(let id=Math.max(0,near-1);id<=Math.max(0,near+1);id++){
    const p=station(id);add(p.x+6,p.z,12,10,'building');
    for(const zz of [-4,2])add(p.x-5,p.z+zz,1.2,.9,'pump');
    for(const zz of [-7,5])add(p.x-8.7,p.z+zz,.2,.2,'pillar');
    add(p.x-10,p.z-15,.25,.25,'sign');
  }
  for(const o of oasesNear(z))for(const t of o.trees)if(Math.abs(t.z-z)<150)add(t.x,t.z,.6,.6,'tree');
  for(const site of settlementsNear(z,1))for(const b of site.boxes)boxes.push(b);
  if(z>-90&&z<40){add(-28,-25,.5,18,'garage');add(-16,-25,.5,18,'garage');add(-22,-34,12,.5,'garage');add(-26,-30,2,2,'crate');add(-18,-31,2,1,'workbench');}
  return boxes;
}
export function crash(s,speed,nx,nz){
  const c=s.car,loss=clamp((speed-1.5)**2*.075*(c.upgrades?.armor?.6:1),0,100);if(speed<=1.5)return;
  c.health=clamp(c.health-loss,0,100);
  c.damage??={front:0,rear:0,left:0,right:0};
  const front=-(nx*Math.sin(c.yaw)+nz*Math.cos(c.yaw)),side=nx*Math.cos(c.yaw)-nz*Math.sin(c.yaw);
  const part=Math.abs(front)>.5?(front>0?'front':'rear'):(side>0?'left':'right');c.damage[part]=clamp(c.damage[part]+loss/75,0,1);
  if(speed>7){const debris=getDebris(s);for(let i=0;i<8;i++)debris.push({x:c.x-nx,z:c.z-nz,y:.8,vx:nx*(2+i%3)+(i%2?2:-2),vz:nz*(2+i%3),vy:2+i*.3,life:3,size:.08+(i%3)*.05});if(debris.length>64)debris.splice(0,debris.length-64);}
}

export function sandDunesForChunk(id){
  const rng=random(id*41+231),out=[];
  for(const side of [-1,1]){const z=id*100+50,x=roadX(z)+side*(100+rng()*80),w=55+rng()*35,h=3+rng()*5;out.push({x,z,w,h,d:100,side});}
  return out;
}

// The same generated footprints drive rendering and collision, including open garage bays.
export function settlement(id){
  const z=160+id*260,side=id%2===0?-1:1,x=roadX(z)+side*40;
  const buildings=[{x,z,w:11,d:9,h:4.2,kind:'house'},{x:x+side*17,z:z+14,w:10,d:14,h:4.8,kind:'garage'},{x:x-side*3,z:z+38,w:13,d:10,h:3.5,kind:'ruin'}];
  const boxes=[];
  for(const b of buildings){
    if(b.kind==='garage'){
      for(const dx of [-b.w/2,b.w/2])boxes.push({x:b.x+dx,z:b.z,w:.45,d:b.d,type:'abandoned-garage'});
      boxes.push({x:b.x,z:b.z+b.d/2,w:b.w,d:.45,type:'abandoned-garage'});
    }else boxes.push({...b,type:'abandoned-house'});
  }
  for(let i=0;i<3;i++)boxes.push({x:x+side*(8+i*1.1),z:z-7,w:.75,d:.75,type:'barrel'});
  for(let i=0;i<7;i++){boxes.push({x:x-9+i*2.7,z:z-14,w:.12,d:.12,type:'fence'});if(i%3!==0)boxes.push({x:x-9+i*2.7+1.2,z:z-14,w:2.6,d:.1,type:'fence'});}
  return {id,x,z,side,buildings,boxes};
}
export function settlementsNear(z,range=2){const id=Math.floor((z-160)/260);return Array.from({length:range*2+1},(_,n)=>id+n-range).filter(n=>n>=0).map(settlement);}
export const vehicleLength=c=>c.type==='bus'?10:c.type==='tanker'?8.4:4.3;
export function vehicleBox(c){const sn=Math.abs(Math.sin(c.yaw)),cs=Math.abs(Math.cos(c.yaw)),w=['tanker','bus'].includes(c.type)?2.5:2,l=vehicleLength(c);return {x:c.x,z:c.z,w:cs*w+sn*l,d:sn*w+cs*l,type:'parked-car'};}
export function ensureVehicles(s){
  s.vehicles??=[];s.discovered??=[];
  for(const site of settlementsNear(s.mode==='walk'?s.player.z:s.car.z,2)){
    if(s.discovered.includes(site.id))continue;s.discovered.push(site.id);
    const garage=site.buildings[1];
    if(site.id%3===0)s.vehicles.push({id:'bus-'+site.id,type:'bus',name:'Старый автобус',x:roadX(site.z+78)+site.side*18,z:site.z+78,yaw:0,speed:0,fuel:12,health:65,rust:.55});
    if(site.id%2===0)s.vehicles.push({id:'tanker-'+site.id,type:'tanker',name:'Бензовоз',cargo:120,x:site.x-site.side*12,z:site.z+55,yaw:0,speed:0,fuel:18,health:68,rust:.5});
    for(let i=0;i<3;i++)s.vehicles.push({id:'abandoned-'+site.id+'-'+i,name:i===2?'Сгоревший кузов':i?'Ржавый седан':'Гаражный универсал',x:i?site.x-site.side*(i===2?20:13):garage.x,z:i?site.z+(i===2?26:-8):garage.z,yaw:i?-.28*site.side:Math.PI,speed:0,fuel:i===2?0:i?5:16,health:i===2?0:i?38:82,rust:i?.85:.38,color:i?[.48,.24,.12]:[.47,.52,.43],damage:{front:i?.4:0,rear:0,left:i?.2:0,right:0}});
  }
  return s.vehicles;
}
export function nearestVehicle(s){
  ensureVehicles(s);
  return [s.car,...s.vehicles.filter(c=>c.health>0),...getTraffic(s).filter(c=>Math.abs(c.speed)<.5)].filter(c=>distance(s.player,c)<4.5).sort((a,b)=>distance(s.player,a)-distance(s.player,b))[0]??null;
}
function movePerson(p,end,boxes){
  let first=null;for(const box of boxes){const hit=sweepBox(p,end,box,.35,.35);if(hit&&(!first||hit.t<first.t))first=hit;}
  if(!first){p.x=end.x;p.z=end.z;return;}
  const t=Math.max(0,first.t-.001);p.x=first.x??p.x+(end.x-p.x)*t+first.nx*.02;p.z=first.z??p.z+(end.z-p.z)*t+first.nz*.02;
}
export function hitPedestrian(s,t,before,previousPlayer=s.player){
  const p=s.player;if(s.mode!=='walk')return false;
  const sn=Math.sin(t.yaw),cs=Math.cos(t.yaw);
  const local=(person,car)=>({x:(person.x-car.x)*cs-(person.z-car.z)*sn,z:(person.x-car.x)*sn+(person.z-car.z)*cs});
  const from=local(previousPlayer,before),end=local(p,t),box={x:0,z:0,w:['tanker','bus'].includes(t.type)?2.5:2,d:vehicleLength(t)};
  const h=sweepBox(from,end,box,.35,.35);if(!h)return false;
  const nx=h.nx*cs+h.nz*sn,nz=-h.nx*sn+h.nz*cs;
  // Resolve against the final vehicle position, so contact cannot leave the person inside it.
  const lx=h.x??from.x+(end.x-from.x)*h.t+h.nx*.03,lz=h.z??from.z+(end.z-from.z)*h.t+h.nz*.03;
  p.x=t.x+lx*cs+lz*sn;p.z=t.z-lx*sn+lz*cs;
  const speed=Math.abs(t.speed);
  if((p.invulnerable??0)<=0&&speed>1){
    p.health=clamp((p.health??100)-Math.max(3,speed*speed*.23),0,100);
    p.down=speed>3?Math.min(4,.7+speed*.09):0;p.invulnerable=1.2;
    const impulse=Math.min(13,speed*.45);p.vx=nx*impulse;p.vz=nz*impulse;
    t.speed*=.35;t.hit=1.2;
  }
  return true;
}

export function nearbyTanker(s){
  ensureVehicles(s);
  return [s.car,...s.vehicles,...getTraffic(s)].find(c=>c.type==='tanker'&&Math.abs(c.speed)<.5&&c.cargo>0&&distance(s.player,{x:c.x-Math.sin(c.yaw)*4.4,z:c.z-Math.cos(c.yaw)*4.4})<3)??null;
}
export function oasis(id){
  const z=220+id*1040,x=roadX(z)+58,rng=random(id*45+97);
  const trees=Array.from({length:9},()=>({x:x+(rng()-.5)*25,z:z+(rng()-.5)*35,h:4+rng()*3}));
  return {x,z,trees};
}
export function oasesNear(z){const base=Math.round((z-220)/1040);return [base-1,base,base+1].filter(id=>id>=0).map(oasis);}

export const fuelRate=c=>['bus','tanker'].includes(c.type)?.00025:.00008;
export function inventory(s){return s.inventory??={fuel:0,oil:2,water:4,parts:1};}
export function nearbyLoot(s){s.looted??=[];return settlementsNear(s.player.z,1).find(p=>!s.looted.includes(p.id)&&distance(s.player,{x:p.x,z:p.z-7})<2.6)??null;}
export function vehicleService(s){
  const pack=inventory(s);
  for(const c of [s.car,...(s.vehicles??[])]){
    const sn=Math.sin(c.yaw),cs=Math.cos(c.yaw),half=vehicleLength(c)/2;
    if(pack.fuel>0&&c.fuel<TANK&&distance(s.player,c.type==='tanker'?{x:c.x+cs*1.8+sn*2.6,z:c.z-sn*1.8+cs*2.6}:{x:c.x-sn*(half+.6),z:c.z-cs*(half+.6)})<1.8)return {car:c,kind:'fuel',label:`Заправить из канистры · ${pack.fuel.toFixed(1)} л`};
    const needed=((c.oil??5)<4.95&&pack.oil>0)||((c.water??5)<4.95&&pack.water>0)||(c.health<100&&pack.parts>0);
    if(needed&&distance(s.player,{x:c.x+sn*(half+.5),z:c.z+cs*(half+.5)})<1.8)return {car:c,kind:'service',label:`Обслужить · масло ${(c.oil??5).toFixed(1)} · вода ${(c.water??5).toFixed(1)} л`};
  }
  return null;
}
export function advanceMaintenance(c,moved,dt,powered){
  c.oil??=5;c.water??=5;c.temperature??=75;
  if(powered){c.oil=Math.max(0,c.oil-moved*.000003);c.water=Math.max(0,c.water-moved*(c.health<40?.0005:.000004));}
  const target=powered?(c.water<.5?145:85):25;
  c.temperature+=(target-c.temperature)*(1-Math.exp(-dt*.025));
  if(powered&&(c.oil<.1||c.temperature>120))c.health=Math.max(0,c.health-dt*(c.oil<.1?2:.8));
}

export function workshopVehicle(s){
  if(s.mode!=='walk'||s.player.down>0||(s.player.health??100)<=0)return null;
  const garage=distance(s.player,GARAGE)<14?GARAGE:settlementsNear(s.player.z,1).map(site=>site.buildings[1]).find(b=>distance(s.player,b)<13);
  if(!garage)return null;
  return [s.car,...(s.vehicles??[])].filter(c=>distance(c,garage)<26).sort((a,b)=>distance(a,s.player)-distance(b,s.player))[0]??null;
}
export const UPGRADES={armor:{cost:2,label:'Броня',description:'Урон от ударов −40%, разгон немного медленнее'},engine:{cost:3,label:'Двигатель и турбина',description:'Тяга +35%, автобус и бензовоз до 198 км/ч'},cargo:{cost:1,label:'Багажник на крыше',description:'Внешний багажник и ящик с запасами'},camper:{cost:4,label:'Жилой модуль автобуса',description:'Кровать, шкафы и отдых с восстановлением здоровья'}};
export function installUpgrade(s,key){const c=workshopVehicle(s),u=UPGRADES[key],pack=inventory(s);if(!c||!u)return 'Подойдите к машине у гаража';if(key==='camper'&&c.type!=='bus')return 'Жилой модуль устанавливается в автобус';if(c.upgrades?.[key])return 'Уже установлено';if(pack.parts<u.cost)return `Нужно деталей: ${u.cost}`;pack.parts-=u.cost;c.upgrades??={};c.upgrades[key]=true;return 'Установлено: '+u.label;}
export function restInCamper(s){const c=[s.car,...(s.vehicles??[])].find(c=>c.upgrades?.camper&&Math.abs(c.speed)<.5&&distance(c,s.player)<7);if(s.mode!=='walk'||!c)return 'Подойдите к стоящему автобусу с жилым модулем';s.player.health=100;s.player.down=0;s.player.vx=0;s.player.vz=0;return 'Вы отдохнули в доме на колёсах. Здоровье восстановлено';}
