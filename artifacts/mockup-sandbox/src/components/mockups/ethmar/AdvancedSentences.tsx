import { useState } from 'react';
import { Info } from 'lucide-react';
import { headers, eventTypes, type Configuration } from './_data';
import { type Model } from './_unifiedModel';
import { validConfig } from './_unifiedParts';
import './Unified.css';

export function AdvancedSentences({config,setConfig,m}:{config:Configuration;setConfig:(c:Configuration)=>void;m:Model}){
 const [profiles,setProfiles]=useState<{name:string;config:Configuration}[]>([]),[name,setName]=useState(''),[notice,setNotice]=useState('');
 const update=<K extends keyof Configuration>(key:K,value:Configuration[K])=>setConfig({...config,[key]:value});
 const clone=(c:Configuration):Configuration=>JSON.parse(JSON.stringify(c));
 const cell=(row:string[],role:string)=>row[headers.indexOf(config.mapping[role])];
 const groupRole=config.grouping;
 const exampleGroup=m.data.rows.find(row=>cell(row,groupRole))?.[headers.indexOf(config.mapping[groupRole])];
 const exampleRows=m.data.rows.filter(row=>cell(row,groupRole)===exampleGroup);
 const groupName=exampleGroup||'Example';
 const selectedRows=(type:string)=>exampleRows.filter(row=>cell(row,'event_type')===config.events[type]);
 const calculate=(type:string,duration=false):{value:number|null;reason:string}=>{
  if(!exampleGroup||!config.mapping.event_type||!config.mapping.event_id)return {value:null,reason:'Assign a group, event ID and event column to see an example.'};
  const rows=selectedRows(type),used:string[][]=[];
  if(!rows.length)return {value:null,reason:`No ${config.events[type]} events are recorded for ${groupName}; this is not zero.`};
  for(const row of rows){
   const id=cell(row,'event_id');
   if(!id)return {value:null,reason:'An event ID is missing, so repeated events cannot be checked.'};
   const siblings=m.data.rows.filter(r=>cell(r,'event_id')===id);
   if(siblings.some(r=>JSON.stringify(r)!==JSON.stringify(row)))return {value:null,reason:`Event ${id} has conflicting rows; no value has been chosen.`};
   if(!used.some(r=>cell(r,'event_id')===id))used.push(row);
  }
  let total=0;
  for(const row of used){
   if(duration){
    const start=cell(row,'start_time'),end=cell(row,'end_time');
    const a=Date.parse((start||'').replace(' ','T')),b=Date.parse((end||'').replace(' ','T'));
    if(!Number.isFinite(a)||!Number.isFinite(b)||b<a)return {value:null,reason:'A start or end time is missing or invalid.'};
    total+=(b-a)/60000;
   }else{
    const q=cell(row,'quantity_kg');
    if(!q?.trim()||!Number.isFinite(Number(q)))return {value:null,reason:'A quantity is missing or is not a number.'};
    total+=Number(q);
   }
  }
  return {value:total,reason:used.length<rows.length?'An identical repeat is counted once; original rows stay unchanged.':''};
 };
 const top=calculate(config.numerator),bottom=calculate(config.denominator),duration=calculate(config.durationEvent,true),total=calculate(config.totalEvent);
 const ratio=top.value!==null&&bottom.value!==null&&bottom.value!==0?top.value/bottom.value*100:null;
 const ratioReason=top.value===null?top.reason:bottom.value===null?bottom.reason:bottom.value===0?'The quantity used for division is zero; a percentage cannot be calculated.':top.reason||bottom.reason;
 const format=(value:number)=>value.toLocaleString('en-US',{maximumFractionDigits:2});
 const output=(value:number|null,unit:string,reason:string)=><span className="sentence-result" aria-live="polite">→ {groupName} = <strong>{value===null?'Cannot calculate':`${format(value)}${unit==='%'?'':' '}${unit}`}</strong>{reason&&<small>{reason}</small>}</span>;
 const choose=(key:'grouping'|'numerator'|'denominator'|'durationEvent'|'durationUnit'|'totalEvent',options:string[],label:string)=><select aria-label={label} value={config[key]} onChange={e=>update(key,e.target.value)}>{options.map(o=><option key={o} value={o}>{o==='run_id'?'Run ID':o==='order_id'?'Order ID':o}</option>)}</select>;
 const title=(key:'ratioName'|'durationName'|'totalName',label:string)=><input aria-label={label} className="sentence-name" value={config[key]} onChange={e=>update(key,e.target.value)}/>;
 const available=headers.filter(h=>!Object.values(config.mapping).includes(h)&&!config.customFields.some(f=>f.column===h));
 const labels:Record<string,string>={MATERIAL_IN:'Material input',GOOD_OUT:'Good output',SCRAP:'Scrap',CHANGEOVER:'Changeover',DOWNTIME_UNPLANNED:'Unplanned downtime'};
 const tolerance=Number(config.tolerance),inputGap=Math.abs((m.value('E-01','input')??NaN)-(m.value('E-04','input')??NaN));
 return <details id="advanced-settings" className="panel sentence-settings" open={typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('advanced')==='open'||undefined}><summary>Advanced settings <span style={{fontWeight:400}}>· calculations, custom fields & profiles</span></summary>
 <p>Standard setup: scrap ÷ material input · changeover time · scrap total · {config.tolerance} kg input similarity tolerance.</p>
 <div className="scope"><Info/><span>The examples below update from your selected sample and column choices. They do not change the documented sample results on Compare. All originals remain unchanged.</span></div>
 <section><h3>Group your events</h3><p>Which events belong to the same production run?</p><div className="setting-sentence">Keep events together using {choose('grouping',['run_id','order_id'],'Group events by')}<span className="sentence-result">→ {groupName}: {exampleRows.length} original rows</span></div></section>
 <section><h3>Words in your file</h3><p>Which words in your file mean what?</p>{eventTypes.map(type=>{const count=m.data.rows.filter(row=>cell(row,'event_type')===config.events[type]).length;return <div className="setting-sentence" key={type}><strong>{labels[type]}</strong> is written as <select aria-label={`Source word for ${labels[type]}`} value={config.events[type]} onChange={e=>update('events',{...config.events,[type]:e.target.value})}>{eventTypes.map(t=><option key={t}>{t}</option>)}</select><span className="sentence-result" aria-live="polite">{config.events[type]} → {count} {count===1?'row':'rows'} found</span></div>;})}<small>Counts cover the entire selected sample, including repeated original rows. Calculation examples count identical repeats once.</small></section>
 <section><h3>Calculate your numbers</h3><p>How should the numbers be calculated?</p>
 <div className="setting-sentence">{title('ratioName','Percentage measurement name')} = {choose('numerator',eventTypes.slice(0,3),'Quantity being measured')} ÷ {choose('denominator',eventTypes.slice(0,3),'Quantity to divide by')}{output(ratio,'%',ratioReason)}</div><small>Divide the totals, then multiply by 100 to show a percentage. Event choices use the words assigned above.</small>
 <div className="setting-sentence">{title('durationName','Time measurement name')} = end time − start time of {choose('durationEvent',eventTypes.slice(3),'Events to time')} events; show in {choose('durationUnit',['h','min'],'Time display unit')}{output(duration.value===null?null:duration.value/(config.durationUnit==='h'?60:1),config.durationUnit,duration.reason)}</div><small>Add the recorded event durations. Changeover and unplanned downtime stay separate, even if they overlap.</small>
 <div className="setting-sentence">{title('totalName','Total measurement name')} = sum of {choose('totalEvent',eventTypes.slice(0,3),'Quantities to total')} quantities{output(total.value,'kg',total.reason)}</div>
 </section>
 <section><h3>Similar input quantities</h3><p>How different can input quantities be and still count as similar?</p><div className="setting-sentence">Allow an input difference of up to <input aria-label="Input tolerance in kilograms" type="number" min="0" step="any" value={config.tolerance} onChange={e=>update('tolerance',e.target.value)}/> kg.<span className="sentence-result" aria-live="polite">→ E-01 vs E-04: {Number.isFinite(inputGap)?`${inputGap} kg apart — ${config.tolerance!==''&&Number.isFinite(tolerance)&&tolerance>=0?(inputGap<=tolerance?'within tolerance':'compare with care'):'enter a valid tolerance'}`:'cannot assess because input is missing'}</span></div><small>This is a kilogram difference, not a percentage. A difference exactly equal to the limit is allowed. No run is excluded.</small></section>
 <section><h3>Custom fields</h3><p>What extra information should stay with your runs?</p><p>Unassign an optional role in “Review all column roles” to use its column here. Originals are never removed.</p>{available.length===0&&<p>All columns have roles. Unassign Shift, for example, to give it a custom name.</p>}{available.map(column=><div className="row between statusline" key={column}><strong>{column}</strong><button onClick={()=>update('customFields',[...config.customFields,{column,name:column.replaceAll('_',' '),compare:false}])}>Add custom field</button></div>)}{config.customFields.map(f=><div className="setting-sentence" key={f.column}>Call <strong>{f.column}</strong><input aria-label={`Display name for ${f.column}`} maxLength={80} value={f.name} onChange={e=>update('customFields',config.customFields.map(x=>x.column===f.column?{...x,name:e.target.value}:x))}/> and use it for <select aria-label={`Where to use ${f.name}`} value={f.compare?'compare':'source'} onChange={e=>update('customFields',config.customFields.map(x=>x.column===f.column?{...x,compare:e.target.value==='compare'}:x))}><option value="source">Source & evidence only</option><option value="compare">Also compare between runs</option></select><span className="sentence-result">→ {groupName}: {[...new Set(exampleRows.map(r=>r[headers.indexOf(f.column)]||'No value recorded'))].join(', ')}</span><button onClick={()=>update('customFields',config.customFields.filter(x=>x.column!==f.column))}>Remove definition</button></div>)}</section>
 <section><h3>Saved profiles · this session</h3><p>Which setup would you like to use again?</p><p>Profiles keep every column role, custom field, grouping choice, event word, calculation and tolerance. They do not change the source. Reloading clears them.</p><div className="setting-sentence">Save this setup as <input aria-label="Profile name" value={name} onChange={e=>setName(e.target.value)} placeholder="L1 daily production"/><button disabled={!name.trim()||!validConfig(config)} onClick={()=>{setProfiles([...profiles,{name:name.trim(),config:clone(config)}]);setNotice(`Saved ${name.trim()} with every setting.`);setName('');}}>Save full profile</button></div>{profiles.map((p,i)=><div className="row between statusline" key={i}><span><strong>{p.name}</strong> · {p.config.ratioName} · {p.config.tolerance} kg tolerance</span><div className="row"><button onClick={()=>{setConfig(clone(p.config));setNotice(`Restored ${p.name}; examples now use its settings. Compare sample results remain unchanged.`);}}>Reuse</button><button onClick={()=>{if(window.confirm(`Delete profile “${p.name}”? Original rows remain unchanged.`))setProfiles(profiles.filter((_,j)=>i!==j));}}>Delete</button></div></div>)}<p role="status">{notice}</p></section>
 </details>;
}
