import {getParticles} from './effects.js';
import {roadX,roadYaw,station,propsForChunk,random,getTraffic,getDebris,wheelAngle,sandDunesForChunk,settlementsNear,ensureVehicles,oasesNear} from './simulation.js';
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
  for(const o of oasesNear(z))if(Math.abs(o.z-z)<range*100){
    const rng=random(Math.round(o.z));
    for(let i=0;i<42;i++){const x=o.x+(rng()-.5)*40,zz=o.z+(rng()-.5)*52,w=2+rng()*5;r.quad([x,.012,zz],[x+w,.012,zz],[x+w,.012,zz+3],[x,.012,zz+3],[.39+rng()*.1,.43,.23]);}
    for(const t of o.trees){
      r.shadow(t.x,t.z,2,2,t.h);r.box(t.x,t.h/2,t.z,.5,t.h,.5,[.36,.29,.18]);
      for(let i=0;i<7;i++){const angle=i*Math.PI*2/7,dx=Math.cos(angle),dz=Math.sin(angle),tip=[t.x+dx*3,t.h-.9,t.z+dz*3],root=[t.x,t.h+.4,t.z];
        r.quad(root,[t.x+dx*1.7-dz*.65,t.h,t.z+dz*1.7+dx*.65],tip,[t.x+dx*1.7+dz*.65,t.h,t.z+dz*1.7-dx*.65],[.25,.36,.17],.8+i*.035);}
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
  for(const site of settlementsNear(z,3))if(Math.abs(site.z-z)<range*100){drawSettlement(r,site,z);if(!(s.looted??[]).includes(site.id)){
    r.box(site.x,.45,site.z-7,.8,.9,.4,[.54,.38,.14]);r.box(site.x,1,site.z-7,.3,.16,.15,[.24,.24,.19]);r.box(site.x+1,.3,site.z-7,.7,.6,.65,[.31,.36,.23]);
  }}
  for(const c of ensureVehicles(s))if(Math.abs(c.z-z)<range*100)drawCar(r,{car:c,time:s.time});
  for(const p of getParticles(s))r.particle(p);
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

}
export function drawCar(r,s,cockpit=false,bodyColor=teal){
  const c=s.car;if(c.type==='bus'){drawBus(r,c,cockpit);return;}if(c.type==='tanker'){drawTanker(r,c,cockpit);return;}bodyColor=c.color??bodyColor;const sn=Math.sin(c.yaw),cs=Math.cos(c.yaw);
  const damage=c.damage??{front:0,rear:0,left:0,right:0},total=Math.max(0,1-(c.health??100)/100);
  const box=(x,y,z,w,h,d,color,turn=0)=>{
    const crush=z>0?damage.front:damage.rear;
    const zz=z*(1-crush*.3),xx=x*(1-(x>0?damage.right:damage.left)*.24);
    r.box(c.x+xx*cs+zz*sn,y+(z>1?crush*.25:0),c.z-xx*sn+zz*cs,w*(1-total*.08),h*(1-total*.12),d*(1-crush*.2),color.map(v=>v*(1-total*.4)),c.yaw+turn);
  };
  if(!cockpit){
    drawPartDetails(r,c);
    r.shadow(c.x,c.z,2,4.3,.4,c.yaw);
    box(0,.78,0,1.9,.65,4.1,bodyColor);box(0,1.24,-.35,1.7,.55,1.9,[.22,.34,.32]);box(0,1.63,-.35,1.85,.13,2.05,bodyColor);
    for(const xx of[-.86,.86])for(const zz of[-1.25,.55])box(xx,1.35,zz,.09,.6,.12,paint);
    box(0,1.2,-1.34,1.6,.48,.04,[.26,.40,.39]);
    for(const side of[-1,1]){box(side*.82,.8,2.08,.32,.2,.08,[.95,.88,.60]);box(side*.75,.85,-2.08,.25,.16,.08,[.65,.19,.1]);}
    if(damage.front>.2){box(.2,1.12,1.3,1.5,.16,1.05,[.38,.40,.31]);box(-.5,.65,1.65,.25,.25,.5,[.15,.18,.16]);}
    if(c.speed<-.05)for(const side of [-1,1])box(side*.45,.85,-2.09,.2,.13,.07,[1,.96,.76]);
    box(0,.52,2.12,1.95,.15,.15,[.55,.54,.44]);box(0,.52,-2.12,1.95,.15,.15,[.55,.54,.44]);
    for(const xx of c.parts&&!c.parts.wheels?[]:[-1,1])for(const zz of[-1.3,1.3]){
      const turn=c.yaw+(zz>0?-wheelAngle(c):0),x=c.x+xx*cs+zz*sn,z=c.z-xx*sn+zz*cs;
      r.wheel(x,.42,z,.39,.26,[.085,.09,.085],turn);r.wheel(x+xx*.14*cs,.42,z-xx*.14*sn,.21,.025,[.38,.38,.34],turn);
    }
    if(c.upgrades?.armor){for(const side of [-1,1])box(side*.98,.8,0,.1,.55,3.4,[.28,.29,.24]);box(0,.8,2.2,2.05,.5,.18,[.27,.28,.24]);}
    if(c.upgrades?.cargo){box(0,1.83,-.4,1.8,.12,2.5,[.19,.23,.19]);box(.3,2.12,-.6,.8,.5,1.2,[.43,.36,.23]);}
    if(c.upgrades?.engine)box(0,1.26,1.2,.6,.3,.6,[.21,.23,.21]);
    // Seams, handles, mirrors, grille and irregular oxide patches on the body.
    for(const side of [-1,1]){
      box(side*1.02,1.27,.63,.22,.16,.32,bodyColor);box(side*.965,.98,-.18,.04,.48,.035,[.15,.18,.16]);
      for(const zz of [-.65,.35])box(side*.97,1.05,zz,.035,.055,.2,[.55,.54,.46]);
      box(side*.96,.54,0,.03,.09,2,[.34,.29,.21]);
    }
    box(0,.78,2.08,.95,.25,.04,[.12,.13,.12]);for(let i=-3;i<=3;i++)box(i*.12,.78,2.11,.025,.22,.02,[.48,.46,.38]);
    const rng=random(Math.round(c.rust?c.rust*100:11));
    for(let i=0;i<Math.round((c.rust??.12)*26);i++){
      const x=(rng()-.5)*1.65,z=(rng()-.5)*3.6,size=.08+rng()*.24;
      box(x,1.115,z,size,.014,size*1.6,[.34+rng()*.12,.16+rng()*.08,.07]);
      const side=i%2?1:-1;box(side*.956,.65+rng()*.34,z,.018,size,size*1.7,[.38,.21,.10]);
    }
    box(0,1.84,-.6,1.3,.35,.9,[.57,.39,.24]);box(-.4,1.83,.2,.6,.28,.5,[.70,.58,.37]);
  }else{
    box(0,.88,1.25,1.9,.24,1.6,teal);box(0,1.12,.48,1.8,.22,.35,[.17,.23,.21]);
    for(const xx of[-.9,.9])box(xx,1.6,.8,.08,1.15,.12,paint);
  }
}

function drawSettlement(r,site,displayZ){
  const wall=[.56,.51,.40],rust=[.38,.22,.12],dark=[.095,.12,.11];
  for(const b of site.buildings){
    r.shadow(b.x,b.z,b.w,b.d,b.h);
    r.box(b.x,.015,b.z,b.w+2,.12,b.d+2,[.48,.43,.34]);
    if(b.kind==='garage'){
      for(const side of [-1,1])r.box(b.x+side*b.w/2,b.h/2,b.z,.45,b.h,b.d,wall);
      r.box(b.x,b.h/2,b.z+b.d/2,b.w,b.h,.45,wall);
      r.box(b.x,b.h-.45,b.z-b.d/2,b.w,.9,.5,rust);
      if(Math.abs(displayZ-b.z)>18)r.box(b.x,b.h,b.z,b.w+.6,.18,b.d+.6,[.36,.33,.27]);
      // Rolled-up shutter with ribbing, oil marks, and shelves inside the bay.
      for(let i=0;i<5;i++)r.box(b.x,b.h-.25-i*.13,b.z-b.d/2-.27,b.w-.6,.07,.06,[.40,.37,.31]);
      r.box(b.x,b.h/2,b.z+b.d/2-.27,3,1.2,.03,[.31,.25,.19]);
      r.box(b.x+2,.09,b.z-1,1.5,.01,2,[.23,.23,.19]);
    }else{
      const h=b.kind==='ruin'?b.h*.75:b.h;
      r.box(b.x,h/2,b.z,b.w,h,b.d,wall);
      if(b.kind==='house'){
        // Gabled roof, with separate slopes catching different light.
        const y=h+.1,top=h+1.9,x=b.x,z=b.z,w=b.w/2+.5,d=b.d/2+.5;
        r.quad([x-w,y,z-d],[x+w,y,z-d],[x+w,top,z],[x-w,top,z],[.36,.27,.19],1.1);
        r.quad([x-w,top,z],[x+w,top,z],[x+w,y,z+d],[x-w,y,z+d],[.30,.23,.17],.85);
        r.box(x+w*.5,h+1.6,z+1,.8,2.6,.8,[.43,.37,.30]);
        for(let j=-4;j<=4;j++)r.box(x+j*1.1,h+.12,z-d,.025,.08,.15,rust);
      }else{
        for(let i=0;i<5;i++)r.box(b.x-b.w/2+i*2.5,h+.4*(i%2),b.z+b.d/2,1.7,.6+(i%2),.6,[.49,.45,.37]);
        r.peak(b.x+b.w/2+1,0,b.z-2,3,1.3,4,[.49,.44,.35]);
      }
      for(const side of [-1,1]){
        const face=b.z+side*(b.d/2+.02);
        for(const offset of [-3,3]){
          r.box(b.x+offset,1.95,face,2.05,1.65,.06,dark);
          for(const q of [-.92,.92])r.box(b.x+offset+q,1.95,face+side*.045,.08,1.75,.08,[.38,.32,.24]);
          // Uneven boards across broken windows.
          r.box(b.x+offset-.25,1.6,face+side*.08,2.3,.22,.12,[.34,.27,.18]);
          r.box(b.x+offset+.3,2.25,face+side*.08,1.65,.18,.12,[.45,.36,.24]);
        }
        r.box(b.x,.98,face,1.45,1.96,.08,[.22,.21,.16]);
        for(let j=0;j<4;j++)r.box(b.x-4+j*2.6,.3+j%2*.18,face+side*.05,1.1,.14,.04,[.38,.34,.26]);
      }
    }
    // Exposed brickwork and vertical weather streaks.
    const rng=random(Math.round(b.z));for(let i=0;i<8;i++){
      const x=b.x+(rng()-.5)*(b.w-.4),h=.3+rng()*.8;
      r.box(x,h*.5,b.z-b.d/2-.06,.4+rng()*.4,h,.02,[.43,.35,.26]);
    }
  }
  for(const b of site.boxes.filter(b=>b.type==='barrel')){
    r.box(b.x,.55,b.z,.7,1.1,.7,rust);for(const y of [.18,.85])r.box(b.x,y,b.z,.74,.07,.74,[.24,.23,.19]);
  }
  // Bent fence posts and loose planks; kept outside the drivable lane.
  for(let i=0;i<7;i++){
    const x=site.x-9+i*2.7,z=site.z-14;
    r.box(x,.7,z,.12,1.4,.12,[.36,.28,.19],i%2*.15);
    if(i%3!==0)r.box(x+1.2,.8,z,2.6,.13,.1,[.39,.31,.21]);
  }
}

function drawTanker(r,c,cockpit){
  const sn=Math.sin(c.yaw),cs=Math.cos(c.yaw),part=(x,y,z,w,h,d,color)=>r.box(c.x+x*cs+z*sn,y,c.z-x*sn+z*cs,w,h,d,color,c.yaw);
  if(cockpit){part(0,1.7,3.3,2.4,.5,1.7,[.39,.37,.29]);return;}
  drawPartDetails(r,c);r.shadow(c.x,c.z,2.5,8.4,1,c.yaw);
  part(0,.65,0,2.3,.45,8.2,[.16,.17,.15]);part(0,1.7,2.7,2.5,2.3,2.6,[.58,.48,.29]);
  part(0,2.24,4.02,2.18,.85,.04,[.17,.26,.25]);part(0,2.7,4.05,.06,1,.04,[.45,.40,.30]);
  for(const side of [-1,1]){part(side*1.26,2.2,2.6,.04,.8,1.5,[.19,.28,.26]);part(side*.86,1.03,4.05,.45,.3,.08,[.97,.88,.62]);}
  const tx=c.x-sn*1.25,tz=c.z-cs*1.25;
  r.wheel(tx,1.95,tz,1.13,5.4,[.65,.62,.51],c.yaw+Math.PI/2);
  for(const zz of [-3.4,.8]){const x=c.x+sn*zz,z=c.z+cs*zz;r.wheel(x,1.95,z,1.16,.12,[.37,.34,.27],c.yaw+Math.PI/2);}
  part(0,3.15,-1,.65,.2,.65,[.27,.28,.23]);part(0,1,-4.3,.35,.35,.4,[.66,.35,.10]);
  for(const side of [-1,1]){
    part(side*1.14,1.92,-1.2,.035,.22,4.7,[.59,.35,.16]);
    for(const zz of c.parts&&!c.parts.wheels?[]:[-2.8,-1.7,2.9]){const x=c.x+side*1.17*cs+sn*zz,z=c.z-side*1.17*sn+cs*zz;r.wheel(x,.53,z,.53,.34,[.09,.10,.09],c.yaw);r.wheel(x+side*.18*cs,.53,z-side*.18*sn,.27,.03,[.37,.36,.31],c.yaw);}
  }
}

function drawBus(r,c,cockpit){
  const sn=Math.sin(c.yaw),cs=Math.cos(c.yaw),part=(x,y,z,w,h,d,color)=>r.box(c.x+x*cs+z*sn,y,c.z-x*sn+z*cs,w,h,d,color,c.yaw);
  if(cockpit){part(0,1.3,4.2,2.4,.4,.6,[.22,.25,.22]);return;}
  drawPartDetails(r,c);r.shadow(c.x,c.z,2.5,10,1,c.yaw);part(0,.8,0,2.5,.7,10,[.50,.37,.18]);part(0,1.55,0,2.4,.8,9.8,[.61,.55,.36]);part(0,2.85,0,2.5,.18,10,[.43,.42,.33]);
  for(const side of [-1,1]){
    for(let z=-4;z<=4;z+=1.6){part(side*1.18,2.2,z,.06,1.05,1.35,[.19,.29,.28]);part(side*1.21,2.22,z-.72,.08,1.18,.1,[.54,.50,.36]);}
    if(c.upgrades?.armor)part(side*1.27,1.35,0,.12,1.3,9.7,[.28,.30,.25]);
    for(const z of c.parts&&!c.parts.wheels?[]:[-3.1,3.4]){r.wheel(c.x+side*1.23*cs+z*sn,.55,c.z-side*1.23*sn+z*cs,.55,.3,[.1,.11,.1],c.yaw);}
    part(side*.85,1.05,5.03,.4,.26,.08,[.96,.88,.65]);
  }
  part(0,2.25,4.96,2.2,1.05,.04,[.18,.29,.28]);part(0,2.25,-4.96,2.2,1.05,.04,[.18,.29,.28]);
  if(c.upgrades?.cargo){part(0,3.02,-1,2.1,.12,4,[.22,.24,.21]);part(0,3.35,-1,1.5,.6,2,[.42,.34,.22]);}
  if(c.upgrades?.engine){part(.7,3.15,-3.8,.5,.55,.7,[.25,.27,.24]);}
  if(c.upgrades?.camper){part(-.45,1.55,-2,1.2,.35,2.5,[.60,.64,.46]);part(.8,1.95,-3,.6,1.4,1,[.59,.47,.31]);part(.6,1.7,.4,.9,.15,1.3,[.63,.50,.33]);}
}

function drawPartDetails(r,c){
  if(!c.parts)return;const sn=Math.sin(c.yaw),cs=Math.cos(c.yaw),heavy=['bus','tanker'].includes(c.type),p=c.parts;
  const box=(x,y,z,w,h,d,color)=>r.box(c.x+x*cs+z*sn,y,c.z-x*sn+z*cs,w,h,d,color,c.yaw);
  const front=heavy?-3.5:1.3,y=heavy?3.05:1.12;
  box(0,y,front,heavy?1.7:1.55,.035,1.2,[.09,.11,.10]);
  if(p.hood)box(0,y+.05,front,1.6,.06,1.25,p.hood.color);
  else if(p.engine){box(0,y+.12,front,.55+p.engine.power*.2,.23,.7,[.34,.37,.35]);for(let i=0;i<4;i++)box(-.25+i*.16,y+.27,front,.09,.07,.55,[.50,.50,.44]);}
  for(const side of [-1,1])box(side*(heavy?1.28:.98),heavy?1.5:.84,heavy?3:0,.035,heavy?1.3:.52,heavy?1.3:1.7,p.doors?p.doors.color:[.08,.10,.09]);
  if(p.radiator)box(0,heavy?1:.73,heavy?4.22:2.23,1,.23,.08,[.40,.42,.38]);
}
