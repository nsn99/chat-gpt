import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Renderer} from '../src/renderer.js';
import {drawWorld,drawCar} from '../src/world.js';
import {newGame,roadX} from '../src/simulation.js';
test('procedural scene produces finite vertices within the GPU buffer budget',()=>{
  // Exercise real geometry methods without requiring a graphics context.
  const r=Object.create(Renderer.prototype);r.data=new Float32Array(1500000);r.low=false;
  const s=newGame();
  for(const z of [0,350,3000,100000,-300]){
    s.car.z=z;s.car.x=roadX(z);drawWorld(r,s);drawCar(r,s);
    assert.ok(r.n>10000);assert.ok(r.n<r.data.length);assert.equal(r.n%18,0);
    assert.ok(r.data.subarray(0,r.n).every(Number.isFinite));
  }
});
test('low quality reduces geometry; cockpit geometry stays valid',()=>{
  const r=Object.create(Renderer.prototype);r.data=new Float32Array(1500000);r.low=false;
  const s=newGame();drawWorld(r,s);const regular=r.n;r.low=true;drawWorld(r,s);assert.ok(r.n<regular);drawCar(r,s,true);assert.ok(r.data.subarray(0,r.n).every(Number.isFinite));
});
