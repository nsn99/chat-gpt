// Parts are individual saved objects. A missing slot is null, not a new free part.
export const PARTS={engine:'Двигатель',wheels:'Комплект колёс',radiator:'Радиатор',hood:'Капот',doors:'Двери'};
const nativePower=c=>c.type==='tanker'?1.4:c.type==='bus'?1.25:1;
export function ensureParts(c){
 if(c.parts)return c.parts;
 const color=c.color??[.29,.47,.43],condition=Math.max(.2,(c.health??100)/100),donor=c.name??'Универсал';
 c.parts=Object.fromEntries(Object.keys(PARTS).map(kind=>[kind,{kind,donor,condition,color:[...color],power:kind==='engine'?nativePower(c):1,grip:kind==='wheels'?.75+.25*condition:1}]));return c.parts;
}
export function removePart(s,c,kind){
 if(!PARTS[kind]||!c||Math.abs(c.speed)>.5)return 'Сначала остановите машину';const parts=ensureParts(c),pack=s.spareParts??=[];
 if(!parts[kind])return 'Узел уже снят';if(pack.length>=100)return 'Хранилище деталей заполнено';pack.push(parts[kind]);parts[kind]=null;c.speed=0;return 'Снято: '+PARTS[kind];
}
export function fitPart(s,c,kind,index){
 const pack=s.spareParts??=[],part=pack[index];if(!c||Math.abs(c.speed)>.5||!part||part.kind!==kind)return 'Выберите подходящую деталь';
 const parts=ensureParts(c),old=parts[kind];pack.splice(index,1);parts[kind]=part;if(old)pack.push(old);return 'Установлено: '+PARTS[kind]+' · '+part.donor;
}
export function canRoll(c){return !c.parts||!!(c.parts.engine&&c.parts.wheels);}
export function engineFactor(c){return !c.parts?1:!canRoll(c)?0:c.parts.engine.power/nativePower(c)*(.7+.3*c.parts.engine.condition);}
export function wheelGrip(c){return c.parts?(c.parts.wheels?.grip??0):1;}
export function missingParts(c){return !c.parts?'':!c.parts.engine?'Нет двигателя':!c.parts.wheels?'Нет колёс':'';}
export function validPart(part,kind){return part===null||!!(part&&part.kind===kind&&typeof part.donor==='string'&&part.donor.length<100&&Number.isFinite(part.condition)&&part.condition>=0&&part.condition<=1&&Number.isFinite(part.power)&&part.power>=.1&&part.power<=3&&Number.isFinite(part.grip)&&part.grip>=.1&&part.grip<=1.5&&Array.isArray(part.color)&&part.color.length===3&&part.color.every(v=>Number.isFinite(v)&&v>=0&&v<=1));}
