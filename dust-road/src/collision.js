// Continuous sweep of the car's conservative, yaw-dependent footprint.
// Thin obstacles are checked along the whole travelled segment, not only its endpoint.
export function sweepBox(start,end,box,halfX,halfZ){
  const minX=box.x-box.w/2-halfX,maxX=box.x+box.w/2+halfX;
  const minZ=box.z-box.d/2-halfZ,maxZ=box.z+box.d/2+halfZ;
  const dx=end.x-start.x,dz=end.z-start.z;
  if(start.x>minX&&start.x<maxX&&start.z>minZ&&start.z<maxZ){
    const sides=[{v:start.x-minX,nx:-1,nz:0,x:minX-.01,z:start.z},{v:maxX-start.x,nx:1,nz:0,x:maxX+.01,z:start.z},{v:start.z-minZ,nx:0,nz:-1,x:start.x,z:minZ-.01},{v:maxZ-start.z,nx:0,nz:1,x:start.x,z:maxZ+.01}].sort((a,b)=>a.v-b.v);
    const n=sides[0];if(dx*n.nx+dz*n.nz>0)return null;return {t:0,...n};
  }
  let enter=0,exit=1,nx=0,nz=0;
  for(const [p,v,min,max,axis] of [[start.x,dx,minX,maxX,'x'],[start.z,dz,minZ,maxZ,'z']]){
    if(Math.abs(v)<1e-10){if(p<min||p>max)return null;continue;}
    let a=(min-p)/v,b=(max-p)/v,n=-1;if(a>b){[a,b]=[b,a];n=1;}
    if(a>=enter){enter=a;nx=axis==='x'?n:0;nz=axis==='z'?n:0;}exit=Math.min(exit,b);if(enter>exit)return null;
  }
  if(enter<0||enter>1||exit<0||(dx*nx+dz*nz)>=0)return null;
  return {t:enter,nx,nz};
}
export function moveAgainstBoxes(car,end,boxes){
  const width=['bus','tanker'].includes(car.type)?1.25:.99,length=car.type==='bus'?5:car.type==='tanker'?4.2:2.15;
  const halfX=Math.abs(Math.cos(car.yaw))*width+Math.abs(Math.sin(car.yaw))*length;
  const halfZ=Math.abs(Math.sin(car.yaw))*width+Math.abs(Math.cos(car.yaw))*length;
  let hit=null;
  for(const box of boxes){const h=sweepBox(car,end,box,halfX,halfZ);if(h&&(!hit||h.t<hit.t))hit={...h,box};}
  if(!hit)return {x:end.x,z:end.z,hit:null};
  const t=Math.max(0,hit.t-.001);
  return {x:hit.x??car.x+(end.x-car.x)*t+hit.nx*.015,z:hit.z??car.z+(end.z-car.z)*t+hit.nz*.015,hit};
}
