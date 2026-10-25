import {roadX,roadYaw,station,propsForChunk,random,getTraffic,getDebris,wheelAngle,sandDunesForChunk} from './simulation.js';
const sand=[.86,.68,.40], asphalt=[.27,.28,.25], paint=[.82,.76,.56], teal=[.29,.47,.43];
const cache=new Map();
function props(id){if(!cache.has(id))cache.set(id,propsForChunk(id));return cache.get(id);}
export function drawWorld(r,s,displayZ=s.car.z){
  const z=displayZ,base=Math.floor(z/100),range=r.low?4:6;
  r.begin();r.box(roadX(z),-2.05,z,1600,4,1800,sand);
  // Broad low sand dunes and wind ripples outside the drivable roadside area.
  for(let id=base-2;id<=base+range;id++){
    const rng=random(id*41+231);
    for(const dune of sandDunesForChunk(id)){
      const {x,z:dz,w:width,h:height,d:depth,side}=dune;
      const crest=[x+side*width*.12,height,dz];
      const a=[x-width/2,-.08,dz-depth/2],b=[x+width/2,-.08,dz-depth/2],c=[x+width/2,-.08,dz+depth/2],d=[x-width/2,-.08,dz+depth/2];
      for(const [p,q,shade]of [[a,b,.98],[b,c,1.06],[c,d,.91],[d,a,.87]])for(const v of [p,q,crest])r.vertex(v,sand,shade);
      for(let j=0;j<10;j++){
        const rz=id*100+j*10,rx=roadX(rz)+side*(18+rng()*65),length=5+rng()*12;
        r.quad([rx,.006,rz],[rx+length,.006,rz+1],[rx+length,.006,rz+1.18],[rx,.006,rz+.18],[.78,.59,.34]);
      }
    }
  }
  // Geometry is rebuilt from deterministic nearby chunks. Cache stays bounded.
  for(const id of cache.keys())if(Math.abs(id-base)>range+2)cache.delete(id);
  for(let id=base-2;id<=base+range;id++){
    for(let j=0;j<20;j++){
      const a=id*100+j*5,b=a+5,xa=roadX(a),xb=roadX(b);
      r.quad([xa-6,.01,a],[xa+6,.01,a],[xb+6,.01,b],[xb-6,.01,b],asphalt);
      for(const side of[-1,1])r.quad([xa+side*5.5-.08,.025,a],[xa+side*5.5+.08,.025,a],[xb+side*5.5+.08,.025,b],[xb+side*5.5-.08,.025,b],paint);
      if(j%2===0)r.box(roadX(a+2),.035,a+2,.17,.02,4,paint,roadYaw(a+2));
    }
    for(const p of props(id)){
      if(p.type==='rock')r.peak(p.x,0,p.z,p.size*1.8,p.size,p.size*1.6,[.56,.43,.30]);
      else{r.box(p.x,p.size,p.z,.6,p.size*2,.6,[.31,.39,.24]);r.box(p.x-.65,p.size*1.2,p.z,1.1,.42,.43,[.34,.42,.26]);r.box(p.x-1,p.size*1.5,p.z,.38,p.size*.7,.38,[.34,.42,.26]);r.box(p.x+.6,p.size*1.6,p.z,.9,.4,.4,[.34,.42,.26]);}
    }
    const rng=random(id+890);
    for(let j=0;j<3;j++){const mz=id*100+j*50,side=j%2?-1:1;r.peak(roadX(mz)+side*(260+rng()*140),-3,mz,100+rng()*100,10+rng()*20,120,[.83,.65,.39]);}
    const poleZ=id*100+40,px=roadX(poleZ)-12;
    r.box(px,4,poleZ,.25,8,.25,[.27,.25,.19]);r.box(px,7.3,poleZ,3,.2,.2,[.27,.25,.19]);
    // Roadside marker, on a stable interval.
    r.box(roadX(id*100)+8,1,id*100,.18,2,.18,paint);r.box(roadX(id*100)+8,1.9,id*100,.28,.18,.2,[.83,.34,.15]);
  }
  // Open-front starter garage. Cutaway roof near the player preserves chase-camera visibility.
  if(Math.abs(z+25)<600){
    r.box(-22,0,-25,12,.15,18,[.52,.51,.44]);
    r.box(-28,2.5,-25,.5,5,18,[.65,.62,.50]);r.box(-16,2.5,-25,.5,5,18,[.65,.62,.50]);r.box(-22,2.5,-34,12,5,.5,[.58,.58,.48]);
    if(z>5||z<-55)r.box(-22,5.1,-25,13,.3,19,[.31,.39,.34]);
    r.box(-22,4.65,-16,12,.6,.5,[.29,.47,.43]);
    r.box(-26,1,-30,2,2,2,[.42,.34,.24]);r.box(-18,.8,-31,2,1.6,1,[.72,.36,.19]);
    r.quad([-28,.02,-16],[-16,.02,-16],[6,.02,42],[-6,.02,42],[.55,.52,.43]);
  }
  for(const t of getTraffic(s))drawCar(r,{car:t},false,[[.67,.25,.16],[.80,.72,.49],[.26,.37,.54],[.50,.53,.39]][t.id%4]);
  for(const d of getDebris(s))r.box(d.x,d.y,d.z,d.size,d.size,d.size,[.34,.37,.32]);
  const sid=Math.floor((z-70)/350);
  for(let id=Math.max(0,sid-1);id<=sid+2;id++){
    const p=station(id);if(Math.abs(p.z-z)>700)continue;
    r.box(p.x+2,.02,p.z,32,.1,36,[.66,.59,.45]);
    r.box(p.x+6,2,p.z,12,4,10,[.82,.76,.59]);r.box(p.x+6,4.2,p.z,13,.5,11,[.57,.29,.18]);
    r.box(p.x+6,1.65,p.z-5.05,1.8,3.3,.12,[.24,.31,.28]);
    for(const side of[-1,1]){r.box(p.x+6+side*3.6,2.2,p.z-5.09,2.5,1.6,.14,[.22,.38,.37]);r.box(p.x+6+side*3.6,2.2,p.z-5.2,.08,1.65,.1,paint);}
    r.box(p.x-5,3.6,p.z-1,9,.35,15,teal);
    for(const zz of[-7,5])r.box(p.x-8.7,1.8,p.z+zz,.18,3.6,.18,paint);
    for(const zz of[-4,2]){r.box(p.x-5,1,p.z+zz,1,2,.7,paint);r.box(p.x-5,1.45,p.z+zz-.36,.7,.5,.05,[.15,.23,.21]);r.box(p.x-5,.35,p.z+zz,1.2,.7,.9,teal);}
    r.box(p.x-10,4,p.z-15,.2,8,.2,paint);r.box(p.x-10,7,p.z-15,4.2,2,.4,teal);
    if(!s.collected.includes(id)){
      r.box(p.x-3,.5,p.z-9,.7,1,.4,[.88,.39,.12]);r.box(p.x-3,1.07,p.z-9,.3,.2,.15,[.31,.30,.19]);
      r.box(p.x-1.8,.3,p.z-9,.9,.6,.65,[.34,.40,.25]);
      r.peak(p.x-3,2.2+Math.sin(s.time*3)*.15,p.z-9,.5,.7,.5,[.94,.66,.22]);
    }
  }
  if(Math.abs(3000-z)<700){const x=roadX(3000);for(const side of[-1,1])r.box(x+side*7,4,3000,.6,8,.6,teal);r.box(x,7.5,3000,15,1.4,.5,teal);for(let i=-6;i<=6;i+=2)r.box(x+i,7.5,2999.7,1,1.4,.1,paint);}
}
export function drawCar(r,s,cockpit=false,bodyColor=teal){
  const c=s.car,sn=Math.sin(c.yaw),cs=Math.cos(c.yaw);
  const damage=c.damage??{front:0,rear:0,left:0,right:0},total=Math.max(0,1-(c.health??100)/100);
  const box=(x,y,z,w,h,d,color,turn=0)=>{
    const crush=z>0?damage.front:damage.rear;
    const zz=z*(1-crush*.3),xx=x*(1-(x>0?damage.right:damage.left)*.24);
    r.box(c.x+xx*cs+zz*sn,y+(z>1?crush*.25:0),c.z-xx*sn+zz*cs,w*(1-total*.08),h*(1-total*.12),d*(1-crush*.2),color.map(v=>v*(1-total*.4)),c.yaw+turn);
  };
  if(!cockpit){
    box(0,.78,0,1.9,.65,4.1,bodyColor);box(0,1.24,-.35,1.7,.55,1.9,[.22,.34,.32]);box(0,1.63,-.35,1.85,.13,2.05,bodyColor);
    for(const xx of[-.86,.86])for(const zz of[-1.25,.55])box(xx,1.35,zz,.09,.6,.12,paint);
    box(0,1.2,-1.34,1.6,.48,.04,[.26,.40,.39]);
    for(const side of[-1,1]){box(side*.82,.8,2.08,.32,.2,.08,[.95,.88,.60]);box(side*.75,.85,-2.08,.25,.16,.08,[.65,.19,.1]);}
    if(damage.front>.2){box(.2,1.12,1.3,1.5,.16,1.05,[.38,.40,.31]);box(-.5,.65,1.65,.25,.25,.5,[.15,.18,.16]);}
    if(total>.45){for(let i=0;i<4;i++){const lift=((s.time??0)*.9+i*.6)%3;r.box(c.x+sn*1.4+Math.sin(i+lift)*.25,1.3+lift,c.z+cs*1.4,.3+lift*.22,.35+lift*.22,.3+lift*.22,[.31,.32,.29]);}}
    if(c.speed<-.05)for(const side of [-1,1])box(side*.45,.85,-2.09,.2,.13,.07,[1,.96,.76]);
    box(0,.52,2.12,1.95,.15,.15,[.55,.54,.44]);box(0,.52,-2.12,1.95,.15,.15,[.55,.54,.44]);
    for(const xx of[-1,1])for(const zz of[-1.3,1.3]){box(xx,.42,zz,.25,.78,.72,[.12,.14,.13],zz>0?-wheelAngle(c):0);box(xx*1.14,.42,zz,.03,.35,.35,[.55,.54,.44],zz>0?-wheelAngle(c):0);}
    box(0,1.84,-.6,1.3,.35,.9,[.57,.39,.24]);box(-.4,1.83,.2,.6,.28,.5,[.70,.58,.37]);
  }else{
    box(0,.88,1.25,1.9,.24,1.6,teal);box(0,1.12,.48,1.8,.22,.35,[.17,.23,.21]);
    for(const xx of[-.9,.9])box(xx,1.6,.8,.08,1.15,.12,paint);
  }
}
