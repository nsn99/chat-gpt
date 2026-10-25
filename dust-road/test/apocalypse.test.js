import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame,step,interact,interaction,serialize,deserialize,ensureVehicles,getTraffic,stepTraffic,hitPedestrian,settlement,obstaclesNear,roadX,vehicleBox,inventory,advanceMaintenance,fuelRate,oasesNear} from '../src/simulation.js';
import {advanceEffects,getParticles} from '../src/effects.js';
import {moveAgainstBoxes} from '../src/collision.js';
const park=s=>{s.car.x=-70;s.car.z=200;s.mode='walk';s.player={x:-3,z:200,yaw:0,health:100,down:0,invulnerable:0};};
function singleTraffic(s,dir=1){const cars=getTraffic(s);cars.splice(1);const t=cars[0];Object.assign(t,{type:'sedan',id:1,dir,lane:dir>0?-3:3,z:dir>0?150:250,x:dir>0?-3:3,yaw:dir>0?0:Math.PI,speed:20,cruise:20,pass:null});s.player.x=t.x;return t;}
test('swap vehicles retains original fuel, damage and parked position across save/load',()=>{
 const s=newGame();ensureVehicles(s);const first=s.car,other=s.vehicles.find(c=>c.health>0&&c.type!=='tanker');first.fuel=7;first.health=51;
 s.mode='walk';s.player={x:other.x+3,z:other.z,yaw:0,health:100};const before=s.vehicles.length;assert.match(interact(s),/За рулём/);assert.equal(s.car,other);assert.ok(s.vehicles.includes(first));assert.ok(s.vehicles.length>=before);
 const loaded=deserialize(serialize(s));assert.ok(loaded);assert.equal(loaded.car.id,other.id);assert.equal(loaded.vehicles.find(c=>c.x===first.x&&c.z===first.z).fuel,7);
 s.mode='walk';s.player={x:first.x+3,z:first.z,yaw:0,health:100};interact(s);assert.equal(s.car,first);assert.equal(s.car.health,51);
});
test('generated fleet never duplicates when revisiting a settlement or loading',()=>{const s=newGame();ensureVehicles(s);const n=s.vehicles.length;for(let i=0;i<10;i++)ensureVehicles(s);assert.equal(s.vehicles.length,n);const saved=deserialize(serialize(s));ensureVehicles(saved);assert.equal(saved.vehicles.length,n);});
test('garage has a usable open entrance and solid walls',()=>{const b=settlement(0).buildings[1],c={x:b.x,z:b.z-12,yaw:0};assert.equal(moveAgainstBoxes(c,{x:b.x,z:b.z},obstaclesNear(b.z)).hit,null);assert.ok(moveAgainstBoxes(c,{x:b.x,z:b.z+15},obstaclesNear(b.z)).hit);});
test('continuous pedestrian collision catches a car crossing an entire person in one step',()=>{const s=newGame();park(s);s.player.x=0;const t={x:0,z:210,yaw:0,speed:40};assert.ok(hitPedestrian(s,t,{x:0,z:190}));assert.equal(s.player.health,0);assert.ok(s.player.down>0);assert.ok(s.player.vz>0);assert.ok(s.player.z>t.z+2);assert.ok(t.speed<40);});
test('pedestrian misses outside vehicle width and invulnerability prevents repeated damage',()=>{const s=newGame();park(s);s.player.x=5;const t={x:0,z:210,yaw:0,speed:12};assert.equal(hitPedestrian(s,t,{x:0,z:190}),false);s.player.x=0;s.player.z=200;assert.ok(hitPedestrian(s,t,{x:0,z:190}));const health=s.player.health;s.player.z=200;hitPedestrian(s,t,{x:0,z:190});assert.equal(s.player.health,health);});
for(const dir of [1,-1])test(`traffic brakes, honks, waits and safely passes a standing pedestrian (${dir})`,()=>{
 const s=newGame();park(s);const t=singleTraffic(s,dir);let stopped=false,honk=false,avoided=false;
 for(let i=0;i<2600;i++){s.time+=.01;stepTraffic(s,.01);if(t.speed<.1)stopped=true;if(t.horn>0)honk=true;if(t.avoid)avoided=true;if(avoided&&(t.z-200)*dir>12)break;}
 assert.equal(s.player.health,100);assert.ok(stopped);assert.ok(honk);assert.ok(avoided);assert.ok((t.z-200)*dir>12);
});
test('oncoming traffic prevents the pedestrian bypass maneuver',()=>{const s=newGame();park(s);const t=singleTraffic(s);t.z=193;t.speed=0;const opponent={id:8,dir:-1,lane:3,z:220,x:3,yaw:Math.PI,speed:0,cruise:0,pass:null,hit:0};getTraffic(s).push(opponent);for(let i=0;i<500;i++)stepTraffic(s,.01);assert.equal(t.avoid,false);assert.ok(t.horn>0);assert.equal(s.player.health,100);});
test('siphoning conserves fuel and requires carrying the canister to a vehicle',()=>{const s=newGame();ensureVehicles(s);const tanker=s.vehicles.find(c=>c.type==='tanker');s.mode='walk';s.player={x:tanker.x,z:tanker.z-4.4,yaw:0};const start=s.car.fuel;for(let i=0;i<6;i++)interact(s);assert.equal(inventory(s).fuel,20);assert.equal(tanker.cargo,100);assert.equal(s.car.fuel,start);s.player.x=s.car.x;s.player.z=s.car.z-2.75;assert.match(interaction(s),/Заправить/);interact(s);assert.equal(s.car.fuel,start+5);assert.equal(inventory(s).fuel,15);const loaded=deserialize(serialize(s));assert.equal(loaded.vehicles.find(c=>c.type==='tanker').cargo,100);});
test('a moving tanker cannot be drained',()=>{const s=newGame();ensureVehicles(s);const t=s.vehicles.find(c=>c.type==='tanker');t.speed=5;s.mode='walk';s.player={x:t.x,z:t.z-4.4,yaw:0};interact(s);assert.equal(t.cargo,120);});
test('maintenance consumes actual stock, repairs damage, and prevents overheating',()=>{const s=newGame();s.car.health=50;s.car.oil=1;s.car.water=0;s.car.damage={front:.5,rear:0,left:0,right:0};s.mode='walk';s.player={x:s.car.x,z:s.car.z+2.6,yaw:0};interact(s);assert.equal(s.car.health,85);assert.equal(s.car.oil,3);assert.equal(s.car.water,4);assert.equal(inventory(s).parts,0);assert.equal(inventory(s).oil,0);assert.ok(s.car.damage.front<.5);const c={health:100,oil:0,water:0,temperature:125};advanceMaintenance(c,10,1,true);assert.ok(c.health<100);});
test('new scenery and road continue far beyond former finish; greenery has solid trunks',()=>{const s=newGame();for(const z of [3001,100000,1000000]){s.car.x=roadX(z);s.car.z=z;step(s,{},.01);assert.equal(s.won,false);assert.ok(ensureVehicles(s).some(c=>Math.abs(c.z-z)<600));}const o=oasesNear(220)[0];assert.ok(obstaclesNear(o.z).some(b=>b.type==='tree'));});
test('fuel consumption is in litres per kilometre, not litres every few metres',()=>{assert.equal(fuelRate({})*100000,8);assert.equal(fuelRate({type:'tanker'})*100000,25);});
test('smoke rises, drifts, fades and stays bounded; particles are not saved',()=>{const s=newGame(),c={x:0,z:0,yaw:0,speed:0,health:10};s.car.x=0;s.car.z=0;advanceEffects(s,.08,[c]);const p=getParticles(s)[0],x=p.x,y=p.y;advanceEffects(s,.1,[]);assert.ok(p.x>x&&p.y>y&&p.age>0);for(let i=0;i<1000;i++)advanceEffects(s,.05,[c]);assert.ok(getParticles(s).length<=600);for(let i=0;i<110;i++)advanceEffects(s,.05,[]);assert.equal(getParticles(s).length,0);});
test('tanker collision uses the longer body and malformed new save fields fail safely',()=>{const c={x:0,z:0,yaw:0,type:'tanker'};assert.equal(vehicleBox(c).d,8.4);assert.ok(moveAgainstBoxes(c,{x:0,z:1},[{x:0,z:5,w:2,d:1}]).hit);for(const mutate of [s=>s.inventory.fuel=-1,s=>s.player.health='bad',s=>s.vehicles=[{x:0}],s=>s.car.color=[1,NaN,0]]){const s=newGame();mutate(s);assert.equal(deserialize(serialize(s)),null);}});

test('garage upgrades cost parts once, stay with the car, and survive save/load',async()=>{
 const {installUpgrade,workshopVehicle}=await import('../src/simulation.js');const s=newGame();interact(s);inventory(s).parts=6;assert.equal(workshopVehicle(s),s.car);installUpgrade(s,'armor');installUpgrade(s,'engine');assert.equal(inventory(s).parts,1);installUpgrade(s,'armor');assert.equal(inventory(s).parts,1);assert.deepEqual(deserialize(serialize(s)).car.upgrades,{armor:true,engine:true});
 s.player.x=500;assert.match(installUpgrade(s,'cargo'),/Подойдите/);assert.equal(inventory(s).parts,1);
});
test('armor reduces crash damage and engine upgrade increases actual acceleration',async()=>{
 const {crash,advanceSpeed}=await import('../src/simulation.js');const a=newGame(),b=newGame();b.car.upgrades={armor:true};crash(a,20,0,-1);crash(b,20,0,-1);assert.ok(b.car.health>a.car.health);
 const c={speed:0,fuel:9,health:100},d={...c,upgrades:{engine:true}};for(let i=0;i<500;i++){advanceSpeed(c,{forward:true},.01);advanceSpeed(d,{forward:true},.01);}assert.ok(d.speed>c.speed*1.2);
});
test('bus conversion requires a bus and parts; resting works only beside a stationary camper',async()=>{
 const {installUpgrade,restInCamper}=await import('../src/simulation.js');const s=newGame();interact(s);inventory(s).parts=8;installUpgrade(s,'camper');assert.equal(inventory(s).parts,8);s.car.type='bus';installUpgrade(s,'camper');assert.equal(inventory(s).parts,4);assert.ok(s.car.upgrades.camper);s.player.health=30;restInCamper(s);assert.equal(s.player.health,100);s.player.health=30;s.car.speed=8;restInCamper(s);assert.equal(s.player.health,30);
});
