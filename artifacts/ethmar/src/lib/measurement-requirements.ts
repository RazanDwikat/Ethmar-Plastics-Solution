import {normalizeHeader} from './inspection';
import type {EventDefinition,Measurement,Setup} from './setup';

export const measurementSources=(m:Measurement)=>[m.a,...(['Ratio','Difference','Rate per hour'].includes(m.template)?[m.b]:[])];
export const definitionColumns=(e:EventDefinition,s:Setup)=>
  e.kind==='quantity'?[s.shape==='event'?s.mapping.quantity:e.column]:
    e.timing==='range'?[e.startColumn,e.endColumn]:[e.durationColumn];

/** Advisory spelling candidates only. Exact matching remains the sole remapping rule. */
export function similarHeaders(name:string,headers:string[]):string[]{
 const target=normalizeHeader(name);
 const distance=(a:string,b:string)=>{
  let previous=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
   const current=[i];
   for(let j=1;j<=b.length;j++)current[j]=Math.min(current[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
   previous=current;
  }
  return previous[b.length];
 };
 return [...new Set(headers)].map(header=>({header,score:distance(target,normalizeHeader(header))}))
  .filter(c=>target.length>0&&c.header!==name&&(c.score===0||(target.length>=4&&c.score<=Math.min(2,Math.floor(target.length*.25)))))
  .sort((a,b)=>a.score-b.score||a.header.localeCompare(b.header)).slice(0,3).map(c=>c.header);
}
