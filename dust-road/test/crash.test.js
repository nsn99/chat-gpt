import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moveAgainstBoxes} from '../src/collision.js';
import {newGame,advanceSpeed,MAX_SPEED,step,station,obstaclesNear,serialize,deserialize,getDebris} from '../src/simulation.js';
test('sweep stops a 20 metre jump at a thin pole, including reverse travel',()=>{
 const box={x:0,z:10,w:.2,d:.2};
 const a=moveAgainstBoxes({x:0,z:0,yaw:0},{x:0,z:20},[box]);assert.ok(a.hit);assert.ok(a.z<7.8);
 const b=moveAgainstBoxes({x:0,z:20,yaw:0},{x:0,z:0},[box]);assert.ok(b.hit);assert.ok(b.z>12.2);
});
test('rotated footprint hits a wall before the centre crosses it',()=>{const r=moveAgainstBoxes({x:0,z:0,yaw:Math.PI/2},{x:20,z:0},[{x:10,z:0,w:.2,d:20}]);assert.ok(r.hit);assert.ok(r.x<7.8);});
test('parallel travel outside wall is not blocked',()=>{assert.equal(moveAgainstBoxes({x:0,z:0,yaw:0},{x:0,z:50},[{x:4,z:20,w:.2,d:40}]).hit,null);});
test('all station structures and roadside objects have collision footprints',()=>{const types=new Set(obstaclesNear(70).map(b=>b.type));for(const t of ['building','pump','pillar','sign','pole','marker','hill'])assert.ok(types.has(t),t);});
test('high speed pump collision stops car, crumples body and creates debris',()=>{
 const s=newGame(),p=station(0);Object.assign(s.car,{x:p.x-5,z:p.z-10,yaw:0,speed:75});
 for(let i=0;i<4;i++)step(s,{},.05);
 assert.ok(s.car.z<p.z-6.5);assert.equal(s.car.health,0);assert.ok(s.car.damage.front>0);assert.ok(getDebris(s).length>0);
 const loaded=deserialize(serialize(s));assert.deepEqual(loaded.car.damage,s.car.damage);
});
test('gentle launch followed by a substantially higher top speed',()=>{
 const c=newGame().car;for(let i=0;i<60;i++)advanceSpeed(c,{forward:true},1/60);
 assert.ok(c.speed>1&&c.speed<4);
 for(let i=0;i<3600;i++)advanceSpeed(c,{forward:true},1/60);
 assert.ok(c.speed>70);assert.ok(c.speed<=MAX_SPEED);
 const high=c.speed;for(let i=0;i<60;i++)advanceSpeed(c,{brake:true},1/60);assert.ok(c.speed<high-20);
});
test('drivetrain has similar results at 30 and 120 Hz',()=>{const a=newGame().car,b=newGame().car;for(let i=0;i<300;i++)advanceSpeed(a,{forward:true},1/30);for(let i=0;i<1200;i++)advanceSpeed(b,{forward:true},1/120);assert.ok(Math.abs(a.speed-b.speed)<.3);});
test('wrecked engine cannot accelerate even after a held throttle',()=>{const c=newGame().car;advanceSpeed(c,{forward:true},.1);c.speed=0;c.health=0;for(let i=0;i<100;i++)advanceSpeed(c,{forward:true},.01);assert.equal(c.speed,0);});
