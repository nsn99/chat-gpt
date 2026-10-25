// Lightweight time-based particles: emission stays consistent across frame rates.
const worlds=new WeakMap();
export function getParticles(s){if(!worlds.has(s))worlds.set(s,{particles:[],clock:0,seed:0});return worlds.get(s).particles;}
export function advanceEffects(s,dt,vehicles){
  const particles=getParticles(s),world=worlds.get(s);world.clock+=dt;
  for(const p of particles){p.age+=dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;p.vy+=p.kind==='smoke'?.1*dt:0;}
  let i=particles.length;while(i--)if(particles[i].age>=particles[i].life)particles.splice(i,1);
  while(world.clock>=.08){
    world.clock-=.08;
    for(const c of vehicles){
      const center=s.mode==='walk'?s.player:s.car;if(Math.hypot(c.x-center.x,c.z-center.z)>170)continue;
      const sn=Math.sin(c.yaw),cs=Math.cos(c.yaw),speed=Math.abs(c.speed);
      let kind=null;if((c.health??100)<55)kind='smoke';else if(speed>1)kind='exhaust';
      if(kind){
        const n=world.seed++,noise=Math.sin(n*23.71),front=kind==='smoke'?1.3:-2.2;
        particles.push({x:c.x+sn*front+.4*cs,y:kind==='smoke'?1.05:.35,z:c.z+cs*front-.4*sn,vx:.65+noise*.25,vz:.22,vy:kind==='smoke'?.85:.22,age:0,life:kind==='smoke'?5:1.4,size:kind==='smoke'?.3:.15,kind,seed:n});
      }
      if(speed>5&&c.offroad){const n=world.seed++;particles.push({x:c.x-sn*1.8+(n%2?1:-1)*cs,y:.18,z:c.z-cs*1.8,vx:.5-sn*speed*.06,vz:.2-cs*speed*.06,vy:.3,age:0,life:2.4,size:.45,kind:'dust',seed:n});}
    }
  }
  if(particles.length>600)particles.splice(0,particles.length-600);
}
