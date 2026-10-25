import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame,step,ensureVehicles,settlement,obstaclesNear,roadX,interact,interaction,recover,serialize,deserialize,getTraffic,advanceSpeed,advanceMaintenance,parkVehicle,vehicleBox} from '../src/simulation.js';
import {moveAgainstBoxes} from '../src/collision.js';
import {ensureParts,removePart,fitPart} from '../src/parts.js';
test('150 settlements keep every building footprint off bends and parked vehicles clear',()=>{
 for(let id=0;id<150;id++){
  const site=settlement(id),s=newGame();s.car.z=site.z;ensureVehicles(s);
  for(const b of site.boxes)for(let z=b.z-b.d/2;z<=b.z+b.d/2;z+=1)assert.ok(Math.abs(b.x-roadX(z))>6+b.w/2,`site ${id}: ${b.type} obstructs road`);
  for(const c of s.vehicles)assert.equal(moveAgainstBoxes(c,c,obstaclesNear(c.z)).hit,null,`blocked spawn ${c.id}`);
 }
});
test('entering or servicing a vehicle through a garage wall is prohibited',()=>{const s=newGame();ensureVehicles(s);const c=s.vehicles.find(c=>c.id==='abandoned-0-0');s.mode='walk';s.player={x:c.x+6,z:c.z,yaw:0};c.x+=2;assert.equal(interaction(s),'');interact(s);assert.equal(s.mode,'walk');});
test('recovery restores enough fluids and cools the engine for an actual departure',()=>{const s=newGame();s.car.oil=0;s.car.water=0;s.car.temperature=145;s.car.health=0;s.car.fuel=0;recover(s);const health=s.car.health;for(let i=0;i<120;i++)step(s,{forward:true},1/120);assert.ok(s.car.speed>1);assert.equal(s.car.health,health);});
test('walking diagonally against a wall slides along it instead of freezing',()=>{const s=newGame();s.mode='walk';s.player={x:-27.3,z:-23,yaw:-Math.PI/4,health:100};for(let i=0;i<120;i++)step(s,{forward:true},1/120);assert.ok(s.player.z>-21);assert.ok(s.player.x>-27.5);});
test('a destroyed donor can be entered and repaired after finding parts',()=>{const s=newGame();ensureVehicles(s);const c=s.vehicles.find(c=>c.health===0);s.mode='walk';s.player={x:c.x+3,z:c.z,yaw:0};assert.match(interaction(s),/Сесть/);interact(s);assert.equal(s.car,c);});
test('old saves relocate obstructed spawns without throwing away progress',()=>{const s=newGame();s.worldRevision=1;ensureVehicles(s);s.vehicles[0].x=-28;s.vehicles[0].z=-25;const restored=deserialize(serialize(s));assert.ok(restored);assert.equal(restored.worldRevision,2);assert.equal(moveAgainstBoxes(restored.vehicles[0],restored.vehicles[0],obstaclesNear(-25)).hit,null);});
test('engine from another vehicle changes acceleration and retains donor identity after reload',()=>{
 const s=newGame(),donor={type:'tanker',name:'Донор бензовоз',speed:0,health:100,color:[.7,.2,.1]};ensureParts(s.car);ensureParts(donor);removePart(s,donor,'engine');fitPart(s,s.car,'engine',0);assert.equal(s.car.parts.engine.donor,'Донор бензовоз');
 const stock={speed:0,fuel:10,health:100},mixed={...stock,parts:s.car.parts};for(let i=0;i<500;i++){advanceSpeed(stock,{forward:true},.01);advanceSpeed(mixed,{forward:true},.01);}assert.ok(mixed.speed>stock.speed*1.25);
 const loaded=deserialize(serialize(s));assert.equal(loaded.car.parts.engine.donor,'Донор бензовоз');assert.equal(loaded.spareParts.length,1);
});
test('removing engine or wheels prevents driving; refitting restores it',()=>{
 for(const kind of ['engine','wheels']){const s=newGame();ensureParts(s.car);removePart(s,s.car,kind);for(let i=0;i<100;i++)advanceSpeed(s.car,{forward:true},.01);assert.equal(s.car.speed,0);fitPart(s,s.car,kind,0);for(let i=0;i<100;i++)advanceSpeed(s.car,{forward:true},.01);assert.ok(s.car.speed>1);}
});
test('part transfers conserve every object and missing slots are not regenerated',()=>{const s=newGame();ensureParts(s.car);const original=s.car.parts.doors;removePart(s,s.car,'doors');ensureParts(s.car);assert.equal(s.car.parts.doors,null);assert.equal(s.spareParts[0],original);removePart(s,s.car,'doors');assert.equal(s.spareParts.length,1);fitPart(s,s.car,'doors',0);assert.equal(s.car.parts.doors,original);assert.equal(s.spareParts.length,0);});
test('missing radiator overheats rather than acting like a free cooling system',()=>{const s=newGame();ensureParts(s.car);removePart(s,s.car,'radiator');s.car.temperature=119;for(let i=0;i<100;i++)advanceMaintenance(s.car,1,1,true);assert.ok(s.car.temperature>120);assert.ok(s.car.health<100);});
test('malformed part saves cannot corrupt renderer or driving physics',()=>{for(const mutate of [s=>s.car.parts.engine.power=null,s=>s.car.parts.wheels.grip=999,s=>s.car.parts.hood.color=['bad'],s=>s.spareParts=[null]]){const s=newGame();ensureParts(s.car);mutate(s);assert.equal(deserialize(serialize(s)),null);}});

test('dismantled AI donor stays parked, keeps missing parts after reload and does not overlap respawned traffic',()=>{
 const s=newGame(),donor=getTraffic(s)[0];assert.equal(parkVehicle(s,donor),true);removePart(s,donor,'engine');const before={x:donor.x,z:donor.z};for(let i=0;i<50;i++)step(s,{},.01);assert.equal(donor.z,before.z);assert.equal(donor.x,before.x);assert.ok(!getTraffic(s).includes(donor));
 const loaded=deserialize(serialize(s));assert.ok(loaded);const parked=loaded.vehicles.find(c=>c.id===donor.id);assert.equal(parked.parts.engine,null);assert.equal(loaded.spareParts.length,1);for(const t of getTraffic(loaded))assert.equal(moveAgainstBoxes(t,t,[vehicleBox(parked)]).hit,null);
});
test('siphoning a stopped traffic tanker preserves its depleted cargo after reload',()=>{
 const s=newGame(),t=getTraffic(s).find(c=>c.type==='tanker');s.mode='walk';s.player={x:t.x-Math.sin(t.yaw)*4.4,z:t.z-Math.cos(t.yaw)*4.4,yaw:0};assert.match(interact(s),/канистре/);assert.equal(t.cargo,115);const loaded=deserialize(serialize(s));assert.equal(loaded.vehicles.find(c=>c.id===t.id).cargo,115);assert.equal(loaded.inventory.fuel,5);
});
