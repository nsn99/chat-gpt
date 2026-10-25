import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
export async function runtime(save=null){
 const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8'),elements=new Map(),queue=[],storage=new Map(save?[['dust-road-save-v3',save]]:[]),errors=[];
 class Element{
  constructor(id){this.id=id;this.hidden=false;this.style={};this.dataset={};this.textContent='';this.listeners={};this.children=[];this.value='';this.lastElementChild={textContent:''};const classes=new Set();this.classList={add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){on??=!classes.has(c);on?classes.add(c):classes.delete(c);return on;}};}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}emit(type,event={}){for(const fn of this.listeners[type]??[])fn({preventDefault(){},...event});}
  replaceChildren(){this.children=[];this.value='';}append(c){this.children.push(c);if(this.children.length===1)this.value=c.value;}
  setAttribute(){}setPointerCapture(){}querySelectorAll(){return [...elements.values()].filter(e=>e.dataset.hold);}getContext(){return gl;}
 }
 for(const tag of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)){const e=new Element(tag[1]);e.hidden=/\bhidden\b/.test(tag[0]);elements.set(e.id,e);}
 for(const [i,tag] of [...html.matchAll(/<button[^>]*data-hold="([^"]+)"[^>]*>/g)].entries()){const id=tag[0].match(/id="([^"]+)"/)?.[1]??'hold-'+i,e=elements.get(id)??new Element(id);e.dataset.hold=tag[1];elements.set(id,e);}
 const doc=new Element('document');doc.body=new Element('body');doc.createElement=tag=>new Element(tag);doc.getElementById=id=>elements.get(id)??null;doc.exitPointerLock=()=>{};const win=new Element('window');
 let bound=null;const sizes=new Map(),attributes=new Map();let glId=1;
 const methods={createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,getShaderInfoLog:()=>'',createProgram:()=>({}),attachShader(){},linkProgram(){},getProgramParameter:()=>true,getProgramInfoLog:()=>'',useProgram(){},createBuffer:()=>({id:glId++}),bindBuffer:(target,b)=>{bound=b;},getAttribLocation:(p,n)=>({position:0,color:1,params:2})[n],enableVertexAttribArray(){},disableVertexAttribArray:a=>attributes.delete(a),vertexAttribPointer:(a,size,type,n,stride,offset)=>attributes.set(a,{size,stride,offset,buffer:bound}),getUniformLocation:()=>0,enable(){},disable(){},depthMask(){},blendFunc(){},getParameter:p=>p===gl.ALIASED_POINT_SIZE_RANGE?[1,255]:8,viewport(){},clearColor(){},clear(){},uniformMatrix4fv:(l,t,v)=>assert.ok([...v].every(Number.isFinite)),uniform3fv:(l,v)=>assert.ok([...v].every(Number.isFinite)),uniform1f:(l,v)=>assert.ok(Number.isFinite(v)),bufferData:(target,data)=>{assert.ok([...data].every(Number.isFinite));sizes.set(bound,data.byteLength);},drawArrays:(mode,first,count)=>{assert.ok(Number.isFinite(count));for(const a of attributes.values())assert.ok((first+count-1)*a.stride+a.offset+a.size*4<=sizes.get(a.buffer),'draw exceeds buffer');}};
 const gl=new Proxy(methods,{get:(o,k)=>k in o?o[k]:k});
 globalThis.document=doc;globalThis.window=win;globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};globalThis.matchMedia=()=>({matches:false});globalThis.innerWidth=390;globalThis.innerHeight=844;globalThis.devicePixelRatio=1;globalThis.requestAnimationFrame=fn=>queue.push(fn);globalThis.confirm=()=>true;
 const previousConsole=console.error;console.error=(...args)=>errors.push(args.join(' '));
 await import('../../src/main.js?test='+Math.random());let time=0;
 return {elements,doc,win,storage,errors,click:id=>{assert.ok(!elements.get(id).disabled);elements.get(id).onclick?.();},key:code=>doc.emit('keydown',{code}),frames(n=1){for(let i=0;i<n;i++){assert.ok(queue.length,'animation loop stopped');time+=1000/60;queue.shift()(time);}},close(){console.error=previousConsole;}};
}
