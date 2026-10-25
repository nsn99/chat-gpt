import {newGame,step,roadX,station,interact,interaction,recover,serialize,deserialize,clamp,GOAL,TANK} from './simulation.js';
import {Renderer} from './renderer.js';
import {drawWorld,drawCar} from './world.js';
import {TouchInput,bindTouchControls} from './touch-input.js';
const $=id=>document.getElementById(id), KEY='dust-road-save-v2';
let renderer;try{renderer=new Renderer($('scene'));}catch(e){$('fatal').hidden=false;$('fatal').textContent=e.message;$('start').disabled=true;throw e;}
let s=newGame(),running=false,started=false,keys=new Set(),last=0,auto=0,toastTime=0,look=0,lookPitch=0,finishShown=false;
const touch=new TouchInput();
const clearTouch=bindTouchControls($('touchControls'),touch,()=>running);
const touchDevice=matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0;
if(touchDevice){document.body.classList.add('touch-device');renderer.low=true;$('settings').textContent='Качество: низкое';}
function clearInput(){keys.clear();clearTouch();lookPointer=null;}
let lookPointer=null;
let sound=null,osc=null,gain=null;
function audio(){try{if(!sound){sound=new(window.AudioContext||window.webkitAudioContext)();osc=sound.createOscillator();gain=sound.createGain();osc.type='triangle';gain.gain.value=0;osc.connect(gain).connect(sound.destination);osc.start();}sound.resume();}catch{/* Audio is optional. */}}
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');toastTime=3.3;}
function readSave(){try{return deserialize(localStorage.getItem(KEY));}catch{return null;}}
function save(quiet=false){try{localStorage.setItem(KEY,serialize(s));if(!quiet)toast('Поездка сохранена в этом браузере');return true;}catch{if(!quiet)toast('Браузер не разрешил сохранение');return false;}}
$('continue').hidden=!readSave();
function showGame(){running=true;started=true;clearInput();look=0;lookPitch=0;$('menu').hidden=true;$('postcard').hidden=true;$('footer').hidden=true;$('hud').hidden=false;$('menuButton').hidden=false;document.body.classList.add('playing');audio();}
function pause(){running=false;clearInput();document.exitPointerLock?.();$('menu').hidden=false;$('postcard').hidden=false;$('hud').hidden=true;$('resume').hidden=false;$('footer').hidden=false;document.body.classList.remove('playing');$('start').textContent='Новая поездка ↗';$('continue').hidden=true;save(true);}
$('start').onclick=()=>{if((started||readSave())&&!confirm('Начать новую поездку? Текущее сохранение будет заменено.'))return;s=newGame();finishShown=false;showGame();save(true);toast(touchDevice||innerWidth<=900?'Удерживайте газ и стрелки. Обзор: ведите пальцем по сцене.':'WASD: движение · E: выход · C: камера');};
$('continue').onclick=()=>{const loaded=readSave();if(loaded){s=loaded;finishShown=s.won;showGame();}else toast('Сохранение не удалось прочитать');};
$('moreControls').onclick=()=>{$('touchControls').classList.toggle('expanded');$('moreControls').setAttribute('aria-expanded',$('touchControls').classList.contains('expanded'));};
$('resume').onclick=showGame;$('menuButton').onclick=pause;$('save').onclick=()=>save();
$('settings').onclick=()=>{renderer.low=!renderer.low;$('settings').textContent='Качество: '+(renderer.low?'низкое':'обычное');};
$('keepDriving').onclick=()=>{$('finish').hidden=true;showGame();};
function action(){if(!running)return;toast(interact(s));look=0;lookPitch=0;}
function camera(){if(!running)return;s.camera=s.camera==='chase'?'cockpit':'chase';look=0;lookPitch=0;}
function rescue(){if(!running)return;clearInput();recover(s);toast('Эвакуация: до 150 м назад, штраф за топливо и ремонт');}
$('touchAction').onclick=action;$('touchCamera').onclick=camera;$('touchSave').onclick=()=>{if(running)save();};$('touchRecover').onclick=rescue;
function turnView(dx,dy){if(s.mode==='walk')s.player.yaw-=dx*.004;else look=clamp(look-dx*.004,-1.7,1.7);lookPitch=clamp(lookPitch-dy*.003,-.5,.5);}
$('scene').addEventListener('pointerdown',e=>{
  if(!running)return;
  if(e.pointerType==='mouse'){
    if(s.mode==='walk'||s.camera==='cockpit'){try{$('scene').requestPointerLock?.()?.catch?.(()=>toast('Зажмите мышь и ведите для обзора'));}catch{/* Dragging also works. */}}
  }else if(lookPointer===null){e.preventDefault();lookPointer={id:e.pointerId,x:e.clientX,y:e.clientY};try{$('scene').setPointerCapture(e.pointerId);}catch{}}
});
$('scene').addEventListener('pointermove',e=>{if(!running||!lookPointer||e.pointerId!==lookPointer.id)return;turnView(e.clientX-lookPointer.x,e.clientY-lookPointer.y);lookPointer.x=e.clientX;lookPointer.y=e.clientY;});
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('scene').addEventListener(name,e=>{if(lookPointer?.id===e.pointerId)lookPointer=null;});
$('scene').addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('mousemove',e=>{if(running&&(document.pointerLockElement||e.buttons===1)&&!lookPointer)turnView(e.movementX,e.movementY);});
document.addEventListener('keydown',e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&running)e.preventDefault();
  if(e.repeat)return;
  if(e.code==='Escape'){if(!started||!$('finish').hidden)return;running?pause():showGame();return;}
  if(!running)return;keys.add(e.code);
  if(e.code==='KeyE')action();
  if(e.code==='KeyC')camera();
  if(e.code==='KeyP')save();
  if(e.code==='KeyR')rescue();
});
document.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{if(running)pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)pause();});
window.addEventListener('pagehide',()=>{if(started)save(true);});
$('scene').addEventListener('webglcontextlost',e=>{e.preventDefault();if(started)save(true);running=false;clearInput();$('fatal').hidden=false;$('fatal').textContent='Графический контекст потерян. Перезагрузите страницу и продолжите сохранённую поездку.';});
function updateHUD(){
  const c=s.car;$('speed').textContent=Math.round(Math.abs(c.speed)*3.6);$('fuel').textContent=c.fuel.toFixed(1)+' л';$('fuelBar').style.width=c.fuel/TANK*100+'%';$('health').textContent=Math.round(c.health)+'%';$('healthBar').style.width=c.health+'%';
  $('fuelBar').style.background=c.fuel<3?'#e87d51':'#dfc084';$('healthBar').style.background=c.health<30?'#e87d51':'#dfc084';
  $('progress').textContent=(Math.max(0,c.z)/1000).toFixed(2);$('progressBar').style.width=clamp(s.furthest/GOAL*100,0,100)+'%';
  const next=Math.max(0,Math.ceil((c.z-70)/350)),st=station(next);$('nextStop').textContent='Станция впереди · '+Math.max(0,Math.round(st.z-c.z))+' м';
  $('range').textContent=c.fuel<=0?'Бак пуст. Нужны запасы':c.fuel<3?'Мало топлива. Ищите станцию':'Запас хода ~ '+Math.round(c.fuel/.003)+' м';
  $('surface').textContent=c.health<=0?'Нужен ремонт':Math.abs(c.x-roadX(c.z))>6?'Песок · пониженная тяга':'Асфальт';
  $('modeLabel').textContent=s.mode==='walk'?'ПЕШКОМ · ОБЗОР ПО СЦЕНЕ':s.camera==='cockpit'?'ЗА РУЛЁМ · САЛОН':'ЗА РУЛЁМ · ВНЕШНЯЯ КАМЕРА';
  const prompt=interaction(s);$('prompt').hidden=!prompt;$('prompt').lastElementChild.textContent=prompt;
  $('touchAction').textContent=s.mode==='drive'?'Выйти':prompt.startsWith('Забрать')?'Забрать':prompt.startsWith('Сесть')?'За руль':'Действие';
  $('touchAction').disabled=s.mode==='drive'?Math.abs(c.speed)>1:!prompt;
  $('forwardLabel').textContent=s.mode==='walk'?'ИДТИ':'ГАЗ';
}
function frame(t){
  const dt=Math.min((t-last)/1000||0,.05);last=t;toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('show');
  if(running){
    const held=key=>keys.has(key)||touch.has(key);
    const input={forward:held('KeyW')||held('ArrowUp'),backward:held('KeyS')||held('ArrowDown'),left:held('KeyA')||held('ArrowLeft'),right:held('KeyD')||held('ArrowRight'),brake:held('Space'),sprint:held('ShiftLeft')};
    // Fixed substeps keep collision response consistent across 30/60 Hz displays.
    let rem=dt;while(rem>0){const h=Math.min(rem,1/120);step(s,input,h);rem-=h;}
    auto+=dt;if(auto>12){save(true);auto=0;}
    if(s.won&&!finishShown){finishShown=true;running=false;clearInput();document.exitPointerLock?.();save(true);$('finish').hidden=false;}
    updateHUD();
  }
  if(gain){gain.gain.setTargetAtTime(running&&s.mode==='drive'&&s.car.fuel>0&&s.car.health>0?.018:0,sound.currentTime,.1);osc.frequency.setTargetAtTime(35+Math.abs(s.car.speed)*3,sound.currentTime,.1);}
  const c=s.car;let eye,target;
  const cockpit=running&&s.mode==='drive'&&s.camera==='cockpit';
  drawWorld(renderer,s,s.mode==='walk'&&started?s.player.z:c.z);drawCar(renderer,s,cockpit);
  if(!running&&!started){eye=[c.x-11,5,c.z-13];target=[c.x+1,1,c.z+5];}
  else if(s.mode==='walk'){const p=s.player;eye=[p.x,1.7,p.z];target=[p.x+Math.sin(p.yaw)*10,1.7+lookPitch*10,p.z+Math.cos(p.yaw)*10];}
  else if(cockpit){eye=[c.x-Math.cos(c.yaw)*.38,1.48,c.z+Math.sin(c.yaw)*.38-.1];target=[eye[0]+Math.sin(c.yaw+look)*20,1.4+lookPitch*20,eye[2]+Math.cos(c.yaw+look)*20];}
  else{const inGarage=Math.abs(c.x+22)<7&&c.z>-36&&c.z<-12;const follow=inGarage?3.5:9;eye=[c.x-Math.sin(c.yaw+look)*follow,clamp((inGarage?2.7:4.2)+lookPitch*6,1.8,7.2),c.z-Math.cos(c.yaw+look)*follow];target=[c.x+Math.sin(c.yaw)*4,.9,c.z+Math.cos(c.yaw)*4];}
  renderer.render(eye,target,s.time);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
