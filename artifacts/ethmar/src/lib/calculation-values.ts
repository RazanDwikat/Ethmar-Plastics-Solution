import { numberValue, type Cell } from './inspection';
import type { CalculatedValue } from './calculation-types';

export const numberText=(n:number)=>new Intl.NumberFormat('en-US',{maximumSignificantDigits:15}).format(n);
export function formatCalculated(v:Pick<CalculatedValue,'value'|'unit'|'state'>):string {
  if(v.value===null)return v.state==='not-logged'?'Not logged':"Can't calculate";
  if(v.unit==='hours'){
    const sign=v.value<0?'−':'';
    const seconds=Math.abs(v.value)*3600;
    if(seconds===0)return '0 min';
    if(seconds%3600===0)return `${sign}${numberText(seconds/3600)} h`;
    if(seconds%60===0){const h=Math.floor(seconds/3600),m=seconds/60-h*60;return h?`${sign}${h} h ${numberText(m)} min`:`${sign}${numberText(m)} min`;}
    return `${sign}${numberText(seconds)} sec`;
  }
  return `${numberText(v.value)}${v.unit==='%'?'%':v.unit?` ${v.unit}`:''}`;
}
export function quantity(cell:Cell|undefined,decimal:'.'|','):number|null {
  if(cell?.raw===null||cell?.raw===undefined||typeof cell.raw==='boolean')return null;
  const n=typeof cell.raw==='number'?cell.raw:numberValue(cell.raw,decimal);
  return n!==null&&Number.isFinite(n)&&n>=0?n:null;
}
/** No locale/date-order guessing. Naive timestamps are compared as recorded wall-clock time. */
export function timestamp(cell:Cell|undefined):number|null {
  const raw=cell?.date??cell?.raw;
  if(typeof raw!=='string')return null;
  const match=raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?)?$/);
  if(!match)return null;
  const [,y,mo,d,h='00',mi='00',s='00',ms='0',zone='']=match;
  const year=+y,month=+mo,day=+d,hour=+h,minute=+mi,second=+s;
  const date=new Date(0);date.setUTCFullYear(year,month-1,day);date.setUTCHours(hour,minute,second,+(ms.padEnd(3,'0')));
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day||hour>23||minute>59||second>59)return null;
  let offset=0;
  if(zone&&zone!=='Z'){
    const zh=+zone.slice(1,3),zm=+zone.slice(4);
    if(zh>14||zm>59||(zh===14&&zm!==0))return null;
    offset=(zh*60+zm)*60000*(zone[0]==='+'?1:-1);
  }
  return date.getTime()-offset;
}
export function timestampZone(cell:Cell|undefined):'naive'|'offset' {
  return /(?:Z|[+-]\d{2}:\d{2})$/.test(String(cell?.date??cell?.raw??''))?'offset':'naive';
}
