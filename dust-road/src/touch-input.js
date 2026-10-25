// Pointer IDs are tracked separately: releasing one finger must not release another.
export class TouchInput {
  constructor(){this.pointers=new Map();}
  press(id,code){this.pointers.set(id,code);}
  release(id){this.pointers.delete(id);}
  has(code){return [...this.pointers.values()].includes(code);}
  clear(){this.pointers.clear();}
}

export function bindTouchControls(root,input,isRunning){
  const buttons=[...root.querySelectorAll('[data-hold]')];
  function paint(){for(const button of buttons)button.classList.toggle('pressed',input.has(button.dataset.hold));}
  function clear(){input.clear();paint();}
  for(const button of buttons){
    button.addEventListener('pointerdown',event=>{
      if(!isRunning())return;
      event.preventDefault();input.press(event.pointerId,button.dataset.hold);
      try{button.setPointerCapture(event.pointerId);}catch{/* Global release still handles the gesture. */}
      paint();
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,event=>{input.release(event.pointerId);paint();});
    button.addEventListener('contextmenu',event=>event.preventDefault());
  }
  const release=event=>{input.release(event.pointerId);paint();};
  window.addEventListener('pointerup',release);
  window.addEventListener('pointercancel',release);
  window.addEventListener('blur',clear);
  window.addEventListener('resize',clear);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
  return clear;
}
