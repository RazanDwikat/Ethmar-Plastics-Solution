import { useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Info, Plus, Trash2 } from 'lucide-react';
import type { ImportedFile, SourceRow } from '@/lib/inspection';
import type { PreparationRecipe, PreparationResult, PreparationStep } from '@/lib/preparation-types';
import { prepareFile, preparationStepName } from '@/lib/preparation';
import './prepare-data.css';

type Kind=PreparationStep['kind'];
const kinds:[Kind,string][]=[
 ['header','Choose the header row and ignore rows above it'],
 ['exclude','Leave out rows that match a rule (titles, repeated headers, totals)'],
 ['fill','Fill empty cells downward from the cell above'],
 ['combine','Combine two columns (for example date and time)'],
 ['multiply','Convert units by multiplying a column'],
 ['calculate','Add a named calculated column (A + B, A − B, A × B, A ÷ B)'],
];
function newStep(kind:Kind,headerLine:number|null):PreparationStep{
 const id=crypto.randomUUID();
 switch(kind){
  case 'header':return {id,kind,line:headerLine??1};
  case 'exclude':return {id,kind,column:'',condition:'equals',value:''};
  case 'fill':return {id,kind,column:''};
  case 'combine':return {id,kind,a:'',b:'',name:'',separator:' ',format:'text'};
  case 'multiply':return {id,kind,column:'',factor:1};
  default:return {id,kind:'calculate',a:'',b:'',name:'',operator:'-'};
 }
}
function Rows({headers,rows,label,testId}:{headers:string[];rows:SourceRow[];label:string;testId:string}){
 return <div data-testid={testId}><h4>{label}</h4>{rows.length?<div className="scroll" tabIndex={0} aria-label={label}><table><thead><tr><th>Line</th>{headers.map((h,i)=><th key={i} dir="auto">{h||`Column ${i+1}`}</th>)}</tr></thead><tbody>{rows.map((r,ri)=><tr key={ri}><td>{r.line}{r.endLine&&r.endLine!==r.line?`–${r.endLine}`:''}</td>{headers.map((_,i)=><td key={i} dir="auto" className="raw-value">{r.cells[i]?.display??''}</td>)}</tr>)}</tbody></table></div>:<p><small>No rows to show.</small></p>}</div>;
}
type Props={schemaOnly?:boolean;file:ImportedFile|null;sheetIndex:number;header:number|null|undefined;rawHeaders:string[];rawHeaderLine:number|null;lineOptions:number[];recipe:PreparationRecipe|null;result:PreparationResult|null;error:string;onChange:(r:PreparationRecipe|null)=>void;onDone:()=>void;onBack:()=>void};
export function PrepareData({schemaOnly=false,file,sheetIndex,header,rawHeaders,rawHeaderLine,lineOptions,recipe,result,error,onChange,onDone,onBack}:Props){
 const steps=recipe?.steps??[];
 const [addKind,setAddKind]=useState<Kind>('header');
 const diag=useMemo(()=>{
  if(!error||!file||schemaOnly)return null;
  let last:PreparationResult|null=null;
  for(let i=0;i<steps.length;i++){
   try{last=prepareFile(file,sheetIndex,{version:1,steps:steps.slice(0,i+1)},header);}
   catch(e){return {failed:i,message:e instanceof Error?e.message:'This step could not be applied.',last};}
  }
  return {failed:-1,message:error,last};
 },[error,steps,file,sheetIndex,header]);
 const known=result??diag?.last??null;
 const set=(next:PreparationStep[])=>onChange(next.length?{version:1,steps:next}:null);
 const patch=(i:number,p:Partial<PreparationStep>)=>set(steps.map((s,j)=>j===i?{...s,...p} as PreparationStep:s));
 const move=(i:number,d:number)=>{const n=[...steps];const [s]=n.splice(i,1);n.splice(i+d,0,s);set(n);};
 const headersFor=(i:number):string[]=>{
  const pv=known?.previews.find(p=>p.id===steps[i]?.id);if(pv)return pv.headersBefore;
  for(let j=i-1;j>=0;j--){const prev=known?.previews.find(p=>p.id===steps[j].id);if(prev)return prev.headersAfter;}
  return rawHeaders;
 };
 const colSelect=(i:number,value:string,onPick:(v:string)=>void,label:string,key:string)=>{const hs=headersFor(i);return <label>{label}{schemaOnly?<input value={value} onChange={e=>onPick(e.target.value)} data-testid={`input-step-${key}-${i}`} placeholder="Exact source column header"/>:<select value={value} onChange={e=>onPick(e.target.value)} data-testid={`select-step-${key}-${i}`}><option value="">Choose a column</option>{hs.map((h,k)=>h?<option key={k} value={h}>{h}</option>:null)}{value&&!hs.includes(value)&&<option value={value}>{value} (not found)</option>}</select>}</label>;};
 const settings=(s:PreparationStep,i:number)=>{
  switch(s.kind){
   case 'header':return <label>Header row{schemaOnly?<input type="number" min="1" value={s.line} onChange={e=>patch(i,{line:Number(e.target.value)})}/>:<select value={s.line} onChange={e=>patch(i,{line:Number(e.target.value)})} data-testid={`select-step-line-${i}`}>{lineOptions.map(l=><option key={l} value={l}>Line {l}</option>)}</select>}<small>Rows above this line are ignored and listed as excluded.</small></label>;
   case 'exclude':return <>{colSelect(i,s.column,v=>patch(i,{column:v}),'Column','column')}<label>Leave out rows where the value<select value={s.condition} onChange={e=>patch(i,{condition:e.target.value as 'equals'})} data-testid={`select-step-condition-${i}`}><option value="equals">equals</option><option value="contains">contains</option><option value="empty">is empty</option></select></label>{s.condition!=='empty'&&<label>Value<input value={s.value} onChange={e=>patch(i,{value:e.target.value})} placeholder="For example, Total" data-testid={`input-step-value-${i}`}/></label>}</>;
   case 'fill':return colSelect(i,s.column,v=>patch(i,{column:v}),'Column to fill downward','column');
   case 'combine':return <>{colSelect(i,s.a,v=>patch(i,{a:v}),'First column','a')}{colSelect(i,s.b,v=>patch(i,{b:v}),'Second column','b')}<label>New column name<input value={s.name} onChange={e=>patch(i,{name:e.target.value})} placeholder="For example, Start" data-testid={`input-step-name-${i}`}/></label><label>Result<select value={s.format} onChange={e=>patch(i,{format:e.target.value as 'text'})} data-testid={`select-step-format-${i}`}><option value="text">Join as text</option><option value="iso-date-time">Date plus time</option></select></label>{s.format==='text'&&<label>Separator<input value={s.separator} onChange={e=>patch(i,{separator:e.target.value})} data-testid={`input-step-separator-${i}`}/></label>}</>;
   case 'multiply':return <>{colSelect(i,s.column,v=>patch(i,{column:v}),'Numeric column','column')}<label>Multiply by<input type="number" step="any" value={Number.isFinite(s.factor)?s.factor:''} onChange={e=>patch(i,{factor:e.target.value===''?Number.NaN:Number(e.target.value)})} data-testid={`input-step-factor-${i}`}/><small>For example, 1000 turns tonnes into kilograms.</small></label></>;
   case 'calculate':return <>{colSelect(i,s.a,v=>patch(i,{a:v}),'Column A','a')}<label>Operation<select value={s.operator} onChange={e=>patch(i,{operator:e.target.value as '+'})} data-testid={`select-step-operator-${i}`}><option value="+">A + B</option><option value="-">A − B</option><option value="*">A × B</option><option value="/">A ÷ B</option></select></label>{colSelect(i,s.b,v=>patch(i,{b:v}),'Column B','b')}<label>New column name<input value={s.name} onChange={e=>patch(i,{name:e.target.value})} placeholder="For example, Good output" data-testid={`input-step-name-${i}`}/></label></>;
  }
 };
 const failedAt=diag?.failed??-1;
 return <section className="panel stack" data-testid="panel-prepare">
  <div className="eyebrow">Optional · Prepare your data</div>
  <h2>Clean or rearrange your file</h2>
  <p className="file-name">{file?`${file.name} · ${file.sheets[sheetIndex]?.name}`:'Saved instructions · no file loaded'}</p>
  <div className="prep-intro"><p>{schemaOnly?'Edit instructions in order. Previews and row checks require a real file and are not run here.':'Add steps in the order they should happen. Each step shows the first five rows before and after. Your original file is never changed; the same steps run again on every future upload that uses this setup.'}</p></div>
  {steps.length===0?<div className="empty" data-testid="empty-prepare"><strong>No steps yet</strong><p>Clean files can skip this. Add a step below if your file has titles above the header, repeated headers, totals, merged cells or values in separate columns.</p></div>:
  <ol className="prep-steps">{steps.map((s,i)=>{const pv=known?.previews.find(p=>p.id===s.id);const failed=failedAt===i;const after=failedAt>=0&&i>failedAt;return <li key={s.id} className={`prep-step${failed?' failed':''}`} data-testid={`card-step-${i}`}>
   <div className="prep-step-head"><div className="prep-title"><span className="prep-num">{i+1}</span><div><strong data-testid={`text-step-name-${i}`}>{preparationStepName(s)}</strong><small>{kinds.find(k=>k[0]===s.kind)?.[1]}</small></div></div>
   <div className="row"><button aria-label={`Move step ${i+1} up`} disabled={i===0} onClick={()=>move(i,-1)} data-testid={`button-step-up-${i}`}><ArrowUp/></button><button aria-label={`Move step ${i+1} down`} disabled={i===steps.length-1} onClick={()=>move(i,1)} data-testid={`button-step-down-${i}`}><ArrowDown/></button><button className="danger" onClick={()=>{if(confirm(`Delete step ${i+1}? Later steps will be checked again.`))set(steps.filter((_,j)=>j!==i))}} data-testid={`button-step-delete-${i}`}><Trash2/>Delete</button></div></div>
   <div className="prep-settings">{settings(s,i)}</div>
   {failed&&<div className="prep-error" role="alert" data-testid={`error-step-${i}`}><strong>This step cannot run yet.</strong><p>{diag?.message}</p></div>}
   {after&&<p className="file-note" data-testid={`text-step-waiting-${i}`}><Info style={{display:'inline'}}/> Waiting for step {failedAt+1} to be fixed. No preview is shown so nothing stale is used.</p>}
   {pv&&!failed&&!after&&<><div className="prep-preview"><Rows headers={pv.headersBefore} rows={pv.before} label="Before · first 5 rows" testId={`preview-before-${i}`}/><Rows headers={pv.headersAfter} rows={pv.after} label="After · first 5 rows" testId={`preview-after-${i}`}/></div>
   {pv.excluded.length>0&&<details data-testid={`details-excluded-${i}`}><summary>{pv.excluded.length.toLocaleString()} {pv.excluded.length===1?'row':'rows'} left out by this step</summary><ul>{pv.excluded.slice(0,200).map((x,k)=><li key={k}>Line {x.row.line}{x.row.endLine&&x.row.endLine!==x.row.line?`–${x.row.endLine}`:''}: {x.reason}</li>)}</ul>{pv.excluded.length>200&&<small>Showing the first 200. All are listed in data checks.</small>}</details>}</>}
  </li>})}</ol>}
  <div className="prep-add"><label>Add a step<select value={addKind} onChange={e=>setAddKind(e.target.value as Kind)} data-testid="select-add-step">{kinds.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><button onClick={()=>set([...steps,newStep(addKind,rawHeaderLine)])} data-testid="button-add-step"><Plus/>Add step</button></div>
  {error&&failedAt<0&&<div className="prep-error" role="alert" data-testid="error-prepare">{error}</div>}
  {result&&!error&&<div className="file-ok" data-testid="text-prepare-ok"><Check/><span>{steps.length} {steps.length===1?'step':'steps'} applied. {result.headers.length} columns, {result.excluded.length.toLocaleString()} rows left out with reasons.</span></div>}
  {!schemaOnly&&<div className="row between"><button onClick={onBack} data-testid="button-prepare-back"><ArrowLeft/>Back</button><div className="row">{steps.length>0&&<button onClick={()=>{if(confirm('Remove all preparation steps and use the file as it is?'))onChange(null)}} data-testid="button-prepare-clear">Remove all steps</button>}<button className="primary" disabled={!!error} onClick={onDone} data-testid="button-prepare-done">{steps.length?'Use prepared table':'Continue without preparing'}<ArrowRight/></button></div></div>}
 </section>;
}
