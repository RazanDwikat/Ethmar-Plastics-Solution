import { sources } from './_unifiedModel';
import { headers } from './_data';
export type Definition={id:string;label:string;values:string;kind:'quantity'|'timed';column:string};
export type Measurement={id:string;name:string;type:string;a:string;b:string;unit:string};
export type Setup={shape:string;unit:string;otherUnit:string;mapping:Record<string,string>;definitions:Definition[];measurements:Measurement[];tolerance:number;custom:{column:string;name:string;compare:boolean}[];input:string};
export const cakeHeaders=['run_id','order','date','machine','shift','input_kg','good_kg','scrap_kg','cleaning_hours','stoppage_hours','reason'];
export const datasets=[...sources.map(s=>({...s,headers})),{name:'Cake factory · one row per run',file:'cake_factory.csv',short:'Four bakery runs. No line or mold column.',headers:cakeHeaders,rows:[['C-01','B-201','2026-10-07','Oven 2','A','200','190','10','0.5','0.25','Oven temperature reset'],['C-02','B-202','2026-10-08','Oven 2','A','200','184','16','0.75','0.5','Tray jam'],['C-03','B-203','2026-10-09','Oven 2','B','205','195','10','0.5','0','No stoppage recorded'],['C-04','B-204','2026-10-10','Oven 3','B','240','234','6','1','0.25','Sensor inspection']]}];
export function defaults(cake=false):Setup{
 const definitions:Definition[]=[{id:'input',label:'Material input',values:'MATERIAL_IN',kind:'quantity',column:cake?'input_kg':''},{id:'good',label:'Good output',values:'GOOD_OUT',kind:'quantity',column:cake?'good_kg':''},{id:'waste',label:'Scrap',values:'SCRAP',kind:'quantity',column:cake?'scrap_kg':''},{id:'change',label:cake?'Cleaning time':'Changeover time',values:'CHANGEOVER',kind:'timed',column:cake?'cleaning_hours':''},{id:'stop',label:'Unplanned downtime',values:'DOWNTIME_UNPLANNED',kind:'timed',column:cake?'stoppage_hours':''}];
 return {shape:cake?'run':'event',unit:'kg',otherUnit:'',mapping:cake?{run:'run_id',order:'order',date:'date',machine:'machine',shift:'shift',reason:'reason'}:{run:'run_id',order:'order_id',event:'event_id',type:'event_type',quantity:'quantity_kg',start:'start_time',end:'end_time',machine:'machine',shift:'shift',line:'line',tool:'mold'},definitions,input:'input',tolerance:0,custom:[],measurements:[{id:'ratio',name:'',type:'Ratio',a:'waste',b:'input',unit:'%'},{id:'change',name:'',type:'Duration',a:'change',b:'',unit:'h'},{id:'stop',name:'',type:'Duration',a:'stop',b:'',unit:'min'},{id:'good',name:'',type:'Total',a:'good',b:'',unit:''},{id:'input',name:'',type:'Total',a:'input',b:'',unit:''},{id:'waste',name:'',type:'Total',a:'waste',b:'',unit:''}]};
}
export const templateTypes=['Ratio','Duration','Total','Difference','Count','Rate per hour','Average'];
export function engine(index:number,c:Setup){
 const data=datasets[index],unit=c.unit==='other'?c.otherUnit||'quantity':c.unit;
 const rows=data.rows.map((cells,i)=>({cells,line:i+2}));
 type Row=typeof rows[number];
 const cell=(r:Row,col:string)=>r.cells[data.headers.indexOf(col)]||'';
 const mapped=(r:Row,key:string)=>cell(r,c.mapping[key]);
 const group=c.mapping.run||c.mapping.order;
 const ids=[...new Set(rows.map(r=>cell(r,group)).filter(Boolean))];
 const per=(id:string)=>rows.filter(r=>cell(r,group)===id);
 const label=(id:string)=>c.definitions.find(d=>d.id===id)?.label||'Unassigned measure';
 const metricName=(m:Measurement)=>m.name||`${label(m.a)}${m.type==='Ratio'?' rate':m.type==='Total'?' total':m.type==='Count'?' event count':m.type==='Average'?' average':m.type==='Difference'?` minus ${label(m.b)}`:m.type==='Rate per hour'?' per hour':''}`;
 const policy=(r:Row)=>{const key=c.shape==='event'?mapped(r,'event'):cell(r,group);if(!key)return 'Retained';const same=rows.filter(x=>(c.shape==='event'?mapped(x,'event'):cell(x,group))===key);if(same.some(x=>JSON.stringify(x.cells)!==JSON.stringify(r.cells)))return 'Conflicting values — no value selected';return same[0].line===r.line?'Retained':'Repeated row — counted once';};
 const result=(id:string,m:Measurement)=>{
  let used:Row[]=[],excluded:Row[]=[],notes:string[]=[];
  const values=(defId:string)=>{
   const d=c.definitions.find(x=>x.id===defId);
   if(!d)throw Error('Choose a measure for this calculation.');
   const candidates=per(id).filter(r=>c.shape==='run'||d.values.split(',').map(x=>x.trim()).includes(mapped(r,'type')));
   if(!candidates.length)throw Error(`No ${d.label} event is recorded; this is not a measured zero.`);
   const usable:Row[]=[];
   const conflicts=candidates.filter(r=>policy(r).startsWith('Conflicting'));
   if(conflicts.length){excluded.push(...conflicts);throw Error(`${d.label} has conflicting original rows; no value was chosen.`);}
   for(const r of candidates){const p=policy(r);if(p.startsWith('Repeated'))excluded.push(r);else usable.push(r);}
   used.push(...usable);
   return usable.map(r=>{
    if(m.type==='Count')return 1;
    let n:number;
    if(c.shape==='run'){const text=cell(r,d.column);if(!text.trim())throw Error(`The ${d.label} column has no value for ${id}.`);n=Number(text);}
    else if(d.kind==='timed'){const start=Date.parse(mapped(r,'start')),end=Date.parse(mapped(r,'end'));n=(end-start)/3600000;}
    else {const text=mapped(r,'quantity');if(!text.trim())throw Error(`${d.label} has no recorded quantity.`);n=Number(text);}
    if(!Number.isFinite(n)||n<0)throw Error(`${d.label} has an invalid quantity or time interval.`);
    return n;
   });
  };
  let value:number|null=null,formula='',outUnit=unit,reason='';
  try{
   if(m.type==='Count'&&c.shape==='run')throw Error('Event counts cannot be recovered from one-row-per-run summaries.');
   const av=values(m.a),a=av.reduce((x,y)=>x+y,0);
   if(m.type==='Duration'&&c.definitions.find(d=>d.id===m.a)?.kind!=='timed')throw Error('Choose a timed measure for a duration.');
   if(['Ratio','Difference','Rate per hour'].includes(m.type)){
    const bv=values(m.b),b=bv.reduce((x,y)=>x+y,0);
    if(m.type!=='Difference'&&b===0)throw Error('The quantity being divided by is zero.');
    if(m.type==='Rate per hour'&&c.definitions.find(d=>d.id===m.b)?.kind!=='timed')throw Error('Choose a timed measure as the hours used.');
    value=m.type==='Difference'?a-b:m.type==='Ratio'?a/b*100:a/b;outUnit=m.type==='Ratio'?'%':m.type==='Rate per hour'?`${unit}/h`:unit;formula=`${a} ${m.type==='Difference'?'−':'÷'} ${b}${m.type==='Ratio'?' × 100':''}`;
   }else if(m.type==='Average'){value=a/av.length;formula=`${a} ÷ ${av.length} recorded values`;outUnit=c.definitions.find(d=>d.id===m.a)?.kind==='timed'?'h':unit;}
   else if(m.type==='Count'){value=av.length;outUnit='events';formula=`Count ${av.length} unique recorded events`;}
   else {value=a*(m.type==='Duration'&&m.unit==='min'?60:1);outUnit=m.type==='Duration'?m.unit||'h':c.definitions.find(d=>d.id===m.a)?.kind==='timed'?'h':unit;formula=av.join(' + ')+(m.type==='Duration'&&m.unit==='min'?' hours × 60':'');}
  }catch(e){reason=(e as Error).message;notes.push(reason);}
  const unique=(list:Row[])=>list.filter((r,i)=>list.findIndex(x=>x.line===r.line)===i);
  return {value,unit:outUnit,formula,reason,used:unique(used),excluded:unique(excluded),notes};
 };
 const format=(r:ReturnType<typeof result>)=>r.value===null?'Cannot calculate':`${Number(r.value.toFixed(2))} ${r.unit}`;
 const values=(id:string,col:string)=>[...new Set(per(id).map(r=>cell(r,col)).filter(Boolean))];
 const checks=(a:string,b:string)=>{
  const entries=[...['line','tool','machine'].map(k=>({name:c.mapping[k]||k,column:c.mapping[k]})),...c.custom.filter(f=>f.compare).map(f=>({name:f.name,column:f.column}))];
  const out=entries.map(f=>{const x=values(a,f.column),y=values(b,f.column);return {name:f.name,state:!f.column||x.length!==1||y.length!==1?'unassessed':x[0]===y[0]?'match':'different',text:!f.column||x.length!==1||y.length!==1?`${f.name}: not assessed`:`${f.name}: ${x[0]} / ${y[0]}`};});
  const measurement={id:'similar',name:'',type:'Total',a:c.input,b:'',unit:''},x=result(a,measurement),y=result(b,measurement);
  out.push({name:label(c.input),state:x.value===null||y.value===null?'unassessed':Math.abs(x.value-y.value)<=c.tolerance?'match':'different',text:`${label(c.input)}: ${x.value===null||y.value===null?'not assessed':Math.abs(x.value-y.value)<=c.tolerance?'within tolerance':'outside tolerance'} (${c.tolerance} ${unit})`});return out;
 };
 const issues=(id:string)=>{
  const messages=new Set<string>();
  per(id).forEach(r=>{if(policy(r)!=='Retained')messages.add(`CSV line ${r.line}: ${policy(r)}.`);});
  c.measurements.forEach(m=>{const r=result(id,m);if(r.value===null)messages.add(r.reason);});
  if(c.shape==='event'){const timed=per(id).filter(r=>c.definitions.some(d=>d.kind==='timed'&&d.values.split(',').map(x=>x.trim()).includes(mapped(r,'type'))));timed.forEach((a,i)=>timed.slice(i+1).forEach(b=>{if(Date.parse(mapped(a,'start'))<Date.parse(mapped(b,'end'))&&Date.parse(mapped(b,'start'))<Date.parse(mapped(a,'end')))messages.add(`CSV lines ${a.line} and ${b.line} overlap. Their durations stay separate and unchanged.`);}));}
  if(c.definitions.some(d=>d.id==='input')&&c.definitions.some(d=>d.id==='good')&&c.definitions.some(d=>d.id==='waste')){const vals=['input','good','waste'].map(a=>result(id,{id:a,name:'',type:'Total',a,b:'',unit:''}).value);if(vals.every(v=>v!==null)&&Math.abs(vals[0]!-vals[1]!-vals[2]!)>0.000001)messages.add(`${label('good')} + ${label('waste')} does not equal ${label('input')}. Original quantities are unchanged.`);}
  return [...messages];
 };
 return {data,unit,rows,ids,per,cell,mapped,group,label,metricName,result,format,values,checks,issues,policy};
}
