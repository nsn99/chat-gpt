export const VERSION=1, GOAL=3000, TANK=40;
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// Straight garage approach, then alternating smooth hairpin-like zigzags.
export const roadX=z=>{if(z<=70)return 0;const t=(z-70)/95,i=Math.floor(t),u=t-i,e=u*u*(3-2*u);const point=n=>n===0?0:(n%2?48:-48)+Math.sin(n*.7)*16;return point(i)+(point(i+1)-point(i))*e;};
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
    out.push({x,z,size,type:r()<.45?'cactus':'rock'});
  }return out;
}
export function nearbyProps(z){const c=Math.floor(z/100);return [-1,0,1].flatMap(n=>propsForChunk(c+n));}
export function newGame(){return {version:VERSION,car:{x:GARAGE.x,z:GARAGE.z,yaw:0,speed:0,fuel:9,health:100},player:{x:0,z:0,yaw:0},mode:'drive',camera:'chase',odometer:0,furthest:0,time:0,collected:[],won:false};}
export function step(s,input,dt){
  dt=clamp(dt,0,.05);s.time+=dt;const c=s.car;
  if(s.mode==='drive'){
    const offroad=Math.abs(c.x-roadX(c.z))>6;
    let throttle=(input.forward?1:0)-(input.backward?1:0);
    if(c.fuel<=0||c.health<=0)throttle=0;
    const prev={x:c.x,z:c.z};
    const force=throttle*(c.speed*throttle<0?20:8)*(offroad?.55:1);
    c.speed+=force*dt;
    c.speed*=Math.exp(-(input.brake?5:offroad?.55:.15)*dt);
    c.speed=clamp(c.speed,-8,offroad?18:38);
    if(Math.abs(c.speed)<.025)c.speed=0;
    const steering=(input.right?1:0)-(input.left?1:0);
    c.yaw-=steering*c.speed/(5+Math.abs(c.speed)*.3)*.30*dt;
    c.x+=Math.sin(c.yaw)*c.speed*dt;c.z+=Math.cos(c.yaw)*c.speed*dt;
    for(const p of nearbyProps(c.z)){
      const radius=p.type==='rock'?p.size*.75+.9:1.15;
      if(distance(c,p)<radius){
        c.x=prev.x;c.z=prev.z;
        c.health=clamp(c.health-Math.max(0,Math.abs(c.speed)-2)*1.3,0,100);
        c.speed*=-.18;break;
      }
    }
    const id=Math.max(0,Math.round((c.z-70)/350)), stop=station(id);
    if(Math.abs(c.x-(stop.x+6))<6.8 && Math.abs(c.z-stop.z)<5.8){c.x=prev.x;c.z=prev.z;c.health=clamp(c.health-Math.max(0,Math.abs(c.speed)-2)*1.3,0,100);c.speed*=-.18;}
    if(garageBlocked(c.x,c.z,1)){c.x=prev.x;c.z=prev.z;c.health=clamp(c.health-Math.max(0,Math.abs(c.speed)-2),0,100);c.speed*=-.15;}
    const moved=distance(c,prev);s.odometer+=moved;s.furthest=Math.max(s.furthest,c.z);
    c.fuel=clamp(c.fuel-(moved*.003+(throttle!==0?.0015*dt:0)),0,TANK);
    s.won=s.furthest>=GOAL;
  }else{
    const p=s.player;p.yaw-=((input.right?1:0)-(input.left?1:0))*1.7*dt;
    const v=((input.forward?1:0)-(input.backward?1:0))*(input.sprint?7:3.8);
    const nx=p.x+Math.sin(p.yaw)*v*dt,nz=p.z+Math.cos(p.yaw)*v*dt;
    const b=station(Math.max(0,Math.round((nz-70)/350)));
    if(!garageBlocked(nx,nz,.35)&&!(Math.abs(nx-(b.x+6))<6.3&&Math.abs(nz-b.z)<5.3)){p.x=nx;p.z=nz;}
  }
  stepTraffic(s,dt);
}
export function interaction(s){
  if(s.mode==='drive')return Math.abs(s.car.speed)>1?'Сначала остановите машину':'Выйти из машины';
  const id=Math.max(0,Math.round((s.player.z-70)/350)), st=station(id), supply={x:st.x-3,z:st.z-9};
  if(distance(s.player,supply)<4&&!s.collected.includes(id))return 'Забрать запас: +12 л и ремонт';
  if(distance(s.player,s.car)<5)return 'Сесть за руль';
  return '';
}
export function interact(s){
  if(s.mode==='drive'){
    if(Math.abs(s.car.speed)>1)return 'Остановитесь перед выходом';
    const c=s.car;s.mode='walk';c.speed=0;s.player={x:c.x+Math.cos(c.yaw)*3,z:c.z-Math.sin(c.yaw)*3,yaw:c.yaw};return 'Вы вышли из машины';
  }
  const id=Math.max(0,Math.round((s.player.z-70)/350)),st=station(id);
  if(distance(s.player,{x:st.x-3,z:st.z-9})<4&&!s.collected.includes(id)){
    s.collected.push(id);s.car.fuel=clamp(s.car.fuel+12,0,TANK);s.car.health=clamp(s.car.health+35,0,100);return 'Запас доставлен в машину: +12 л, ремонт +35';
  }
  if(distance(s.player,s.car)<5){s.mode='drive';return 'За рулём';}return 'Подойдите к машине или припасам';
}
export function recover(s){
  // A deterministic fallback prevents a fuel/health softlock. Progress is lost.
  const z=Math.max(0,s.car.z-150);s.car={x:roadX(z),z,yaw:roadYaw(z),speed:0,fuel:Math.max(3,s.car.fuel-1),health:Math.max(35,s.car.health-15)};s.mode='drive';
}
export function serialize(s){return JSON.stringify(s);}
export function deserialize(raw){
  try{
    const s=JSON.parse(raw), finite=(v,max)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=max;
    if(!s||s.version!==VERSION||!s.car||!s.player||!['drive','walk'].includes(s.mode)||!['chase','cockpit'].includes(s.camera))return null;
    for(const p of [s.car,s.player])if(!finite(p.x,1e7)||!finite(p.z,1e7)||!finite(p.yaw,1e7))return null;
    if(!finite(s.car.speed,50)||!finite(s.car.fuel,TANK)||s.car.fuel<0||!finite(s.car.health,100)||s.car.health<0)return null;
    if(!finite(s.odometer,1e9)||s.odometer<0||!finite(s.furthest,1e7)||!finite(s.time,1e9)||s.time<0||typeof s.won!=='boolean')return null;
    if(!Array.isArray(s.collected)||s.collected.length>100000||!s.collected.every(n=>Number.isInteger(n)&&n>=0&&n<1e6))return null;
    s.car.speed=0;return s;
  }catch{return null;}
}

// Traffic is transient. Save files retain the trip, not stale AI vehicles.
const trafficWorlds=new WeakMap();
export function getTraffic(s){
  if(!trafficWorlds.has(s)){const cars=Array.from({length:12},(_,id)=>({id,z:40+id*58+Math.max(0,s.car.z-160),dir:id%3===0?-1:1,speed:0,cruise:15+(id%4)*5,lane:id%3===0?3:-3,pass:null,hit:0}));trafficWorlds.set(s,cars);for(const t of cars)placeTraffic(t);}
  return trafficWorlds.get(s);
}
function placeTraffic(t){t.x=roadX(t.z)+t.lane;t.yaw=roadYaw(t.z)+(t.dir<0?Math.PI:0);}
export function stepTraffic(s,dt){
  const cars=getTraffic(s),c=s.car;
  for(const t of cars){
    t.hit=Math.max(0,t.hit-dt);
    if(t.z<c.z-220||t.z>c.z+750||t.z<15){t.z=Math.max(40,c.z+(t.dir<0?580+t.id*10:-180+t.id*8));t.lane=t.dir<0?3:-3;t.pass=null;placeTraffic(t);}
    const slope=Math.tan(roadYaw(t.z));let desired=t.cruise;
    if(t.dir>0){
      const targets=[...cars.filter(o=>o!==t&&o.dir>0),...(Math.abs(c.x-roadX(c.z)+3)<2.4?[{id:-1,z:c.z,speed:Math.max(0,c.speed)}]:[])];
      const ahead=targets.filter(o=>o.z>t.z&&o.z-t.z<65).sort((a,b)=>a.z-b.z)[0];
      const clear=!cars.some(o=>o.dir<0&&o.z>t.z-30&&o.z<t.z+240)&&!cars.some(o=>o!==t&&o.pass!==null&&Math.abs(o.z-t.z)<65);
      if(t.pass===null&&ahead&&ahead.speed<t.cruise-2){if(clear&&ahead.z-t.z<48)t.pass=ahead.id;else desired=Math.min(desired,Math.max(0,(ahead.z-t.z-9)*.7),ahead.speed+2);}
      if(t.pass!==null){const target=t.pass===-1?c:cars.find(o=>o.id===t.pass);if(!target||t.z>target.z+18)t.pass=null;}
      const targetLane=t.pass!==null?3:-3;t.lane+=(targetLane-t.lane)*Math.min(1,dt*1.5);
      // Wait behind the target until the car has moved out of its lane.
      if(ahead&&ahead.z-t.z<10&&Math.abs(t.lane-(ahead.lane??-3))<2)desired=0;
    }
    t.speed+=(desired-t.speed)*Math.min(1,dt*2);
    t.z+=t.dir*t.speed*dt/Math.sqrt(1+slope*slope);placeTraffic(t);
    if(distance(c,t)<2.7&&t.hit===0){c.health=clamp(c.health-Math.max(2,Math.abs(c.speed-t.dir*t.speed)*.6),0,100);c.speed*=-.2;t.speed=0;t.hit=1.5;}
  }
}
