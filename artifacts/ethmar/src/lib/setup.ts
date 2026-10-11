import { normalizeHeader, type Inspection, type ParseOptions } from './inspection';
import type { PreparationRecipe } from './preparation-types';
import {formulaProblems,type FormulaBinding} from './custom-formula';

export const roles = [
  ['runId','Run ID'], ['orderId','Order ID'], ['eventId','Event ID'], ['eventType','Event type'],
  ['quantity','Quantity'], ['start','Start time'], ['end','End time'], ['date','Date'],
  ['line','Line'], ['machine','Machine'], ['mold','Mold'], ['product','Product'], ['shift','Shift'], ['reason','Recorded reason'],
] as const;
export type Role = typeof roles[number][0];
export type Synonyms = Record<Role,string[]>;
export type EventDefinition = {
  id:string; label:string; values:string[]; kind:'quantity'|'timed';
  timing:'range'|'duration'; column:number|null; startColumn:number|null; endColumn:number|null; durationColumn:number|null;
  durationUnit:'hours'|'minutes'|'seconds';
};
export const templates = ['Ratio','Duration','Total','Difference','Count','Rate per hour','Average','Custom formula'] as const;
export type Measurement = { id:string; label:string; template:typeof templates[number]; a:string; b:string; exampleA:number; exampleB:number; required?:boolean;
 formula?:string;formulaBindings?:Record<string,FormulaBinding>;formulaExamples?:Record<string,number>;
 outputUnit?:'percent'|'quantity'|'hours'|'minutes'|'number';decimals?:number;headline?:boolean };
/** Legacy built-in identity, not the editable display name. Explicit false is preserved. */
export const isMeasurementRequired=(m:Measurement)=>m.required??m.id==='scrap-rate';
export function normalizeRequirements(setup:Setup):Setup{
  return {...setup,measurements:setup.measurements.map(m=>({...m,required:isMeasurementRequired(m)}))};
}
export type Setup = {
  preparation?:PreparationRecipe;
  version:1; shape:'event'|'run'; mapping:Record<Role,number|null>; synonyms:Synonyms; groupBy:'runId'|'orderId';
  events:EventDefinition[]; measurements:Measurement[]; unit:string; tolerance:number; checkBalance:boolean;
  customFields:{id:string; column:number; label:string; compare:boolean}[];
};
export type Profile = { id:string; name:string; savedAt:string; headers:string[]; setup:Setup; sheetName?:string; headerLine?:number|null; reading?:ParseOptions; confirmed?:boolean };
export const defaultSynonyms:Synonyms = {
  runId:['run_id','run','batch','batch_id','رقم الدفعة','رقم التشغيل'],
  orderId:['order_id','order','order number','رقم الطلب'], eventId:['event_id','event id','معرف الحدث'],
  eventType:['event_type','event','نوع الحدث'], quantity:['quantity_kg','quantity','weight','الكمية'],
  start:['start_time','start','بداية'], end:['end_time','end','نهاية'], date:['date','تاريخ'],
  line:['line','production_line','الخط'], machine:['machine','equipment','الآلة'], mold:['mold','mould','القالب'],
  product:['product','product_name','المنتج'], shift:['shift','الوردية'], reason:['reason','cause_recorded','السبب'],
};
export function suggestMapping(headers:string[], synonyms:Synonyms):Record<Role,number|null> {
  return Object.fromEntries(roles.map(([role])=>{
    const matches=headers.flatMap((h,i)=>synonyms[role].some(s=>normalizeHeader(s)===normalizeHeader(h))?[i]:[]);
    return [role,matches.length===1?matches[0]:null];
  })) as Record<Role,number|null>;
}
const guess = (headers:string[],names:string[]) => {
  const found=headers.flatMap((h,i)=>names.some(n=>normalizeHeader(n)===normalizeHeader(h))?[i]:[]);
  return found.length===1?found[0]:null;
};
export function defaultSetup(inspection:Inspection, shape=inspection.shape):Setup {
  const synonyms=structuredClone(defaultSynonyms),mapping=suggestMapping(inspection.headers,synonyms);
  const specs = [
    ['material','Material input','MATERIAL_IN','quantity',['input_kg','material_in','input']],
    ['good','Good output','GOOD_OUT','quantity',['good_kg','good_output','good']],
    ['scrap','Scrap','SCRAP','quantity',['scrap_kg','scrap','waste']],
    ['changeover','Changeover','CHANGEOVER','timed',['changeover_hours','cleaning_hours','changeover_minutes']],
    ['downtime','Unplanned downtime','DOWNTIME_UNPLANNED','timed',['stoppage_hours','downtime_hours','downtime_minutes']],
  ] as const;
  const events:EventDefinition[]=specs.map(([id,label,value,kind,names])=>{
    const column=guess(inspection.headers,[...names]);
    const durationColumn=shape==='run'?column:guess(inspection.headers,['duration','duration_minutes','duration_hours','duration_seconds']);
    const name=(durationColumn===null?'':inspection.headers[durationColumn]).toLowerCase();
    return { id, label:name.includes('cleaning')?'Cleaning time':label, values:[value], kind,
      timing:shape==='run'||(durationColumn!==null&&(mapping.start===null||mapping.end===null))?'duration':'range', column, startColumn:mapping.start,endColumn:mapping.end,
      durationColumn,
      durationUnit:name.includes('minute')?'minutes':name.includes('second')?'seconds':'hours' };
  });
  return {version:1,shape,mapping,synonyms,groupBy:mapping.runId!==null?'runId':'orderId',events,
    unit:'kg',tolerance:0,checkBalance:true,customFields:[],
    measurements:[
      {id:'scrap-rate',label:'Scrap rate',template:'Ratio',a:'scrap',b:'material',exampleA:50,exampleB:1000,required:true},
      {id:'changeover',label:events[3].label,template:'Duration',a:'changeover',b:'',exampleA:4,exampleB:0,required:false},
      {id:'downtime',label:'Unplanned downtime',template:'Duration',a:'downtime',b:'',exampleA:0.75,exampleB:0,required:false},
      {id:'good',label:'Good output',template:'Total',a:'good',b:'',exampleA:950,exampleB:0,required:false},
    ],
  };
}
export function exampleResult(m:Measurement):string {
  const {exampleA:a,exampleB:b}=m;
  if(!Number.isFinite(a)||!Number.isFinite(b))return 'Enter valid example numbers.';
  const n=(v:number)=>Number(v.toFixed(4)).toLocaleString('en-US');
  switch(m.template){
    case 'Custom formula':return 'Use the formula builder preview.';
    case 'Ratio':return b===0?'Cannot divide by zero.':`${n(a)} ÷ ${n(b)} × 100 = ${n(a/b*100)}%`;
    case 'Duration':return `${n(a)} hours + ${n(b)} hours = ${n(a+b)} hours`;
    case 'Total':return `${n(a)} + ${n(b)} = ${n(a+b)}`;
    case 'Difference':return `${n(a)} − ${n(b)} = ${n(a-b)}`;
    case 'Count':return Number.isInteger(a)&&a>=0?`${n(a)} records → ${n(a)} counted records`:'Enter a whole, non-negative record count.';
    case 'Rate per hour':return b<=0?'Enter hours greater than zero.':`${n(a)} ÷ ${n(b)} hours = ${n(a/b)} per hour`;
    case 'Average':return b<=0||!Number.isInteger(b)?'Enter a whole record count greater than zero.':`${n(a)} total ÷ ${n(b)} records = ${n(a/b)} average`;
  }
}
export function setupProblems(s:Setup, headers:string[]):{errors:string[];notes:string[]} {
  const errors:string[]=[], notes:string[]=[];
  const valid=(v:number|null)=>v===null||(Number.isInteger(v)&&v>=0&&v<headers.length);
  const group=s.mapping[s.groupBy];
  if(group===null)errors.push(`Choose a ${s.groupBy==='runId'?'run ID':'order ID'} column so records can be grouped.`);
  if(s.shape==='event'&&s.mapping.eventType===null)errors.push('Choose the event-type column so each activity can be identified.');
  if(Object.values(s.mapping).some(v=>!valid(v)))errors.push('Some column selections no longer exist. Select them again.');
  if(!s.unit.trim())errors.push('Enter the quantity unit.');
  if(!Number.isFinite(s.tolerance)||s.tolerance<0)errors.push('Input tolerance must be zero or a positive number.');
  if(!s.events.length)errors.push('Add at least one activity or measure.');
  const aliases=new Map<string,string>();
  for(const e of s.events){
    if(!e.label.trim())errors.push('Every activity or measure needs a display name.');
    if([e.column,e.startColumn,e.endColumn,e.durationColumn].some(v=>!valid(v)))errors.push(`${e.label}: choose existing source columns.`);
    if(s.shape==='event'){
      if(!e.values.some(v=>v.trim()))errors.push(`${e.label}: add at least one source value.`);
      for(const v of e.values.filter(v=>v.trim())){
        // Source words are deliberately exact, unlike header synonyms.
        if(aliases.has(v))errors.push(`Source value “${v}” is assigned more than once. Give it one meaning.`);
        aliases.set(v,e.id);
      }
    }
    if(e.kind==='quantity'&&(s.shape==='event'?s.mapping.quantity:e.column)===null)notes.push(`${e.label}: no quantity column is selected. Its results will be unavailable until one is mapped.`);
    if(e.kind==='timed'&&(e.timing==='range'?(e.startColumn===null||e.endColumn===null):e.durationColumn===null))notes.push(`${e.label}: timing columns are missing. This means unavailable, not zero.`);
  }
  const used=new Set(Object.values(s.mapping).filter(v=>v!==null));
  for(const e of s.events)for(const c of [e.column,e.startColumn,e.endColumn,e.durationColumn])if(c!==null)used.add(c);
  const custom=new Set<number>();
  for(const f of s.customFields){
    if(!f.label.trim()||!valid(f.column))errors.push('Each custom field needs a name and an existing source column.');
    if(used.has(f.column)||custom.has(f.column))errors.push(`“${f.label}” must use a column not already mapped or added as a custom field.`);
    custom.add(f.column);
  }
  const ids=new Set(s.events.map(e=>e.id));
  for(const m of s.measurements){
    if(!m.label.trim())errors.push('Every measurement needs a display name.');
    if(m.template==='Custom formula')continue;
    if(!ids.has(m.a))errors.push(`“${m.label}” needs a valid source activity or measure.`);
    if(['Ratio','Difference','Rate per hour'].includes(m.template)&&!ids.has(m.b))errors.push(`“${m.label}” needs a second source activity or measure.`);
    if(m.template==='Duration'&&s.events.find(e=>e.id===m.a)?.kind!=='timed')errors.push(`“${m.label}” needs a timed source for Duration.`);
    if(m.template==='Rate per hour'&&s.events.find(e=>e.id===m.b)?.kind!=='timed')errors.push(`“${m.label}” needs a timed second source for Rate per hour.`);
  }
  errors.push(...formulaProblems(s));
  return {errors:[...new Set(errors)],notes:[...new Set(notes)]};
}
export function applyProfile(profile:Profile, headers:string[]):{setup:Setup;notes:string[]} {
  const setup=normalizeRequirements(structuredClone(profile.setup)),notes:string[]=[];
  const remap=(index:number|null)=>{
    if(index===null)return null;
    const old=profile.headers[index];
    const normalized=old===undefined?'':normalizeHeader(old);
    const matches=headers.flatMap((h,i)=>normalizeHeader(h)===normalized?[i]:[]);
    const oldCount=profile.headers.filter(h=>normalizeHeader(h)===normalized).length;
    if(matches.length===1&&oldCount===1)return matches[0];
    notes.push(`“${old??'Unknown column'}” is missing or ambiguous in this file. Select its column again.`);
    return null;
  };
  for(const [role] of roles)setup.mapping[role]=remap(setup.mapping[role]);
  for(const e of setup.events){e.column=remap(e.column);e.startColumn=remap(e.startColumn);e.endColumn=remap(e.endColumn);e.durationColumn=remap(e.durationColumn);}
  setup.customFields=setup.customFields.map(f=>({...f,column:remap(f.column)??-1}));
  // An unmapped role is an explicit saved choice, not a request for new suggestions.
  // Re-suggestion is a separate user action so custom/evidence columns stay assigned.
  return {setup,notes:[...new Set(notes)]};
}
