import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TouchInput} from '../src/touch-input.js';
import {newGame,step} from '../src/simulation.js';
test('two fingers can accelerate and steer together',()=>{
  const input=new TouchInput();input.press(11,'KeyW');input.press(12,'KeyD');
  const game=newGame(),yaw=game.car.yaw;
  for(let i=0;i<30;i++)step(game,{forward:input.has('KeyW'),right:input.has('KeyD')},1/60);
  assert.ok(game.car.speed>0);assert.ok(game.car.yaw<yaw);
  input.release(12);assert.equal(input.has('KeyW'),true);assert.equal(input.has('KeyD'),false);
});
test('a second finger holding the same action survives first finger release',()=>{
  const input=new TouchInput();input.press(1,'KeyW');input.press(2,'KeyW');input.release(1);assert.equal(input.has('KeyW'),true);input.release(2);assert.equal(input.has('KeyW'),false);
});
test('pause, cancellation and rotation can clear every held action',()=>{
  const input=new TouchInput();input.press(1,'KeyW');input.press(2,'KeyA');input.press(3,'Space');input.clear();assert.equal(input.pointers.size,0);for(const key of ['KeyW','KeyA','Space'])assert.equal(input.has(key),false);input.release(99);assert.equal(input.pointers.size,0);
});
