import { isMeasurementRequired, setupProblems, type Profile, type Measurement, type Setup } from './setup';
import type { Inspection } from './inspection';
import { measurementDependencies } from './custom-formula';
import { definitionColumns } from './measurement-requirements';
import { validatePreparationRecipe } from './preparation';
export const setupStorageNote='Setups are stored on this browser. Use Export to keep them or move them to another device.';
export function savedMeasurementFormula(m:Measurement,s:Setup):string{
 const label=(id:string)=>s.events.find(e=>e.id===id)?.label||id||'Missing source';
 const a=label(m.a),b=label(m.b);
 switch(m.template){
  case 'Custom formula':return m.formula||'Not set';
  case 'Ratio':return `${a} total ÷ ${b} total × 100`;
  case 'Duration':return `Sum of ${a} durations (hours)`;
  case 'Total':return `${a} total`;
  case 'Difference':return `${a} total − ${b} total`;
  case 'Count':return `Count included ${a} records`;
  case 'Rate per hour':return `${a} total ÷ ${b} duration in hours`;
  case 'Average':return `${a} total ÷ included ${a} record count`;
 }
}
export function savedProfileProblems(p:Profile):string[]{
 const errors=[...setupProblems(p.setup,p.headers).errors],recipe=p.setup.preparation;
 if(p.headerLine!==undefined&&p.headerLine!==null&&(!Number.isInteger(p.headerLine)||p.headerLine<1))errors.push('Header line must be a positive whole number.');
 if(recipe){
  if(!validatePreparationRecipe(recipe))errors.push('Review preparation settings: a step has an unsupported or invalid value.');
  for(const step of recipe.steps){
   if(('column' in step&&!step.column.trim())||('a' in step&&(!step.a.trim()||!step.b.trim()||!step.name.trim())))errors.push('Every preparation step needs its source column names and any output column name.');
   if(step.kind==='multiply'&&!Number.isFinite(step.factor))errors.push('Enter a finite multiplication factor.');
  }
 }
 return [...new Set(errors)];
}
export function usableProfile(p:Profile){
 if(p.confirmed===false||savedProfileProblems(p).length)return false;
 const unique=(c:number|null)=>c!==null&&p.headers[c]!==undefined&&p.headers.filter(h=>h===p.headers[c]).length===1;
 if(!unique(p.setup.mapping[p.setup.groupBy])||(p.setup.shape==='event'&&!unique(p.setup.mapping.eventType)))return false;
 return p.setup.measurements.filter(isMeasurementRequired).every(m=>measurementDependencies(m,p.setup).every(d=>{
  const e=p.setup.events.find(x=>x.id===d.id);
  return !!e&&(d.countOnly||definitionColumns(e,p.setup).every(unique));
 }));
}
export function uniqueProfileName(name:string,profiles:Profile[]){
 let next=name,n=2;while(profiles.some(p=>p.name.toLocaleLowerCase()===next.toLocaleLowerCase()))next=`${name} (${n++})`;return next;
}
export function duplicateProfile(p:Profile,profiles:Profile[]):Profile{
 return {...structuredClone(p),id:crypto.randomUUID(),name:uniqueProfileName(`${p.name} copy`,profiles),savedAt:new Date().toISOString()};
}
export function savedInspection(p:Profile):Inspection{
 return {headers:[...p.headers],headerLine:p.headerLine??null,dataRows:0,columnCount:p.headers.length,shape:p.setup.shape,columns:p.headers.map((name,index)=>({name,index,type:'Not inspected',examples:[]})),issues:[],runCandidates:[]};
}
export function exportProfile(p:Profile){
 const url=URL.createObjectURL(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=`${p.name.replace(/[^a-z0-9_-]/gi,'-')||'setup'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
