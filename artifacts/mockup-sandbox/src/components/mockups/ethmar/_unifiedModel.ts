import { demos, headers, type Configuration } from './_data';
import type { MatchCheck, RunRecord } from './RunList';
export type Metric = 'input'|'good'|'scrap'|'rate'|'changeover'|'downtime';
export const metrics: {key:Metric;label:string;unit:string;types:string[]}[] = [
 {key:'input',label:'Material input',unit:'kg',types:['MATERIAL_IN']},{key:'good',label:'Good output',unit:'kg',types:['GOOD_OUT']},{key:'scrap',label:'Scrap quantity',unit:'kg',types:['SCRAP']},{key:'rate',label:'Scrap rate',unit:'%',types:['SCRAP','MATERIAL_IN']},{key:'changeover',label:'Changeover',unit:'h',types:['CHANGEOVER']},{key:'downtime',label:'Unplanned downtime',unit:'min',types:['DOWNTIME_UNPLANNED']}
];
const extraRows = [
 ...[['MATERIAL_IN','1000'],['GOOD_OUT','940'],['SCRAP','60'],['CHANGEOVER','']].map(([event,q],i)=>[`EV-03${i}`,'ORD-073','E-03','EX-04','MLD-12','B',event,event==='CHANGEOVER'?'2026-10-09 06:00':'',event==='CHANGEOVER'?'2026-10-09 11:00':'',q,'L1']),
 ...[['MATERIAL_IN','1200'],['GOOD_OUT','1164'],['SCRAP','36'],['CHANGEOVER','']].map(([event,q],i)=>[`EV-04${i}`,'ORD-074','E-04','EX-07','MLD-19','B',event,event==='CHANGEOVER'?'2026-10-10 06:00':'',event==='CHANGEOVER'?'2026-10-10 09:00':'',q,'L2']),
];
export const sources = demos.map(d=>({...d,file:d.file.replace('.csv','_four_runs.csv'),rows:[...d.rows,...extraRows]}));
export type SourceRow={cells:string[];line:number};
export function model(demo:number,config:Configuration){
 const data=sources[demo],source=data.rows.map((cells,i)=>({cells,line:i+2}));
 const value=(run:string,key:Metric):number|null=>{
  if(demo===1&&run==='E-02'&&['input','rate'].includes(key))return null;
  if(demo===2&&run==='E-01'&&['scrap','rate'].includes(key))return null;
  return (run==='E-01'?{input:1000,good:950,scrap:50,rate:5,changeover:4,downtime:null}:run==='E-02'?{input:1000,good:900,scrap:100,rate:10,changeover:6,downtime:45}:run==='E-03'?{input:1000,good:940,scrap:60,rate:6,changeover:5,downtime:null}:{input:1200,good:1164,scrap:36,rate:3,changeover:3,downtime:null})[key];
 };
 const reason=(run:string,key:Metric)=>key==='downtime'&&run!=='E-02'?'No downtime event is logged; this is not zero.':demo===1&&run==='E-02'?'Material input is missing, so input-dependent results are unavailable.':'Event EV-003 records both 50 kg and 65 kg; no winning value is selected.';
 const format=(run:string,key:Metric)=>value(run,key)===null?key==='downtime'?'Not logged':'Cannot calculate':`${value(run,key)!.toLocaleString('en-US')}${key==='rate'?'%':` ${metrics.find(m=>m.key===key)!.unit}`}`;
 const issues=(id:string)=>demo===1&&id==='E-01'?['Exact duplicate EV-003: CSV line 5 is excluded; line 4 counts once. Scrap stays 50 kg (5%). Both originals are preserved.']:demo===1&&id==='E-02'?['Material input is missing. Input and scrap rate cannot calculate; balance cannot be assessed. No missing row is invented.']:demo===2&&id==='E-01'?['EV-003 has conflicting 50 kg and 65 kg quantities on CSV lines 4 and 5. Scrap and scrap rate cannot calculate. Balance cannot be assessed; neither value wins.']:demo===2&&id==='E-02'?['Downtime 11:00–11:45 overlaps changeover 06:00–12:00 on 8 October. Both durations stay separate: 45 min and 6 h. Nothing is subtracted or merged.']:[];
 const missing=(id:string)=>(demo===1&&id==='E-02')||(demo===2&&id==='E-01');
 const values=(column:string,run:string)=>[...new Set(source.filter(r=>r.cells[2]===run).map(r=>r.cells[headers.indexOf(column)]).filter(Boolean))].sort();
 const checks=(a:string,b:string):MatchCheck[]=>{
  const out:MatchCheck[]=[];
  const add=(label:string,column:string)=>{
   const x=values(column,a),y=values(column,b);
   if(!column||source.some(r=>[a,b].includes(r.cells[2])&&!r.cells[headers.indexOf(column)]?.trim())||x.length!==1||y.length!==1){out.push({label,state:'unassessed',text:`${label}: not assessed because values are unmapped, missing or multiple.`});return;}
   out.push({label,state:x[0]===y[0]?'match':'different',text:x[0]===y[0]?`Same ${label.toLowerCase()} ${x[0]}`:`${label}: ${x[0]} / ${y[0]}`});
  };
  add('Line',config.mapping.line);add('Mold',config.mapping.mold);add('Machine',config.mapping.machine);
  const x=value(a,'input'),y=value(b,'input'),t=Number(config.tolerance);
  if(config.mapping.quantity_kg!=='quantity_kg'||x===null||y===null||!Number.isFinite(t)||t<0)out.push({label:'Input',state:'unassessed',text:'Input: not assessed because input or its supported mapping/tolerance is unavailable.'});
  else out.push({label:'Input',state:Math.abs(x-y)<=t?'match':'different',text:`Input difference ${Math.abs(x-y)} kg · tolerance ${t} kg`});
  config.customFields.filter(f=>f.compare).forEach(f=>add(f.name,f.column));return out;
 };
 const runs:RunRecord[]=['E-01','E-02','E-03','E-04'].map(id=>({id,date:source.find(r=>r.cells[2]===id&&r.cells[7])!.cells[7].slice(0,10),line:values('line',id).join(', '),machine:values('machine',id).join(', '),mold:values('mold',id).join(', '),shift:values('shift',id).join(', '),order:values('order_id',id).join(', '),rate:value(id,'rate'),changeover:value(id,'changeover'),issues:issues(id),blocking:missing(id)}));
 const policy=(r:SourceRow)=>demo===1&&r.line===5?'Excluded: identical repeat of CSV line 4':demo===2&&r.cells[0]==='EV-003'?'Unresolved: conflicting quantities; no winning value':'Retained original';
 const formula=(run:string,key:Metric)=>{
  if(value(run,key)===null)return `${run}: ${reason(run,key)}`;
  if(key==='rate')return `${run}: ${value(run,'scrap')} kg ÷ ${value(run,'input')} kg × 100 = ${format(run,key)}`;
  if(key==='changeover'||key==='downtime'){const row=source.find(r=>r.cells[2]===run&&r.cells[6]===metrics.find(m=>m.key===key)!.types[0])!;return `${run}: ${row.cells[8]} − ${row.cells[7]} = ${format(run,key)}`;}
  return `${run}: total retained ${metrics.find(m=>m.key===key)!.types[0]} quantity = ${format(run,key)}`;
 };
 return {data,source,value,reason,format,issues,missing,values,checks,runs,policy,formula};
}
export type Model=ReturnType<typeof model>;
