import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { formatCalculated, type CalculationReport, type CalculatedRun, type CalculatedValue } from '@/lib/calculation-engine';
import { runFields, searchRunText } from '@/lib/comparison-tools';
import { valueExplanation, unassessedExplanation } from '@/lib/explanations';
import { Health } from './calculation-checks';
import { CompareDrawer } from './compare-drawer';
import { displayHealth, visibleIssues } from './compare-presentation';
import { ExplanationTooltip } from './explanation-tooltip';

export function RunPicker({report,title,onClose,onSelect,onEvidence}:{report:CalculationReport;title:string;onClose:()=>void;onSelect:(run:CalculatedRun)=>void;onEvidence:(run:CalculatedRun,value:CalculatedValue)=>void}){
 const [search,setSearch]=useState(''),[filters,setFilters]=useState<Record<string,string>>({}),[sort,setSort]=useState('id'),[ascending,setAscending]=useState(true);
 const fields=[...['date','line','machine','mold','shift','order'].map(key=>({key,label:key[0].toUpperCase()+key.slice(1)})),...report.setup.customFields.map(f=>({key:`custom:${f.id}`,label:f.label}))];
 const indexed=useMemo(()=>report.runs.map(original=>({run:{...original,health:displayHealth(original),issues:visibleIssues(original.issues)},fields:runFields(original,report.setup)})),[report]);
 const visible=indexed.filter(item=>searchRunText(`${item.run.id} ${Object.values(item.fields).join(' ')}`,search)&&Object.entries(filters).every(([key,value])=>!value||(value==='__unavailable__'?!item.fields[key]:item.fields[key]===value))).sort((a,b)=>{const av=sort==='id'?a.run.id:sort==='health'?a.run.health:a.fields[sort]||'',bv=sort==='id'?b.run.id:sort==='health'?b.run.health:b.fields[sort]||'';return av.localeCompare(bv,undefined,{numeric:true})*(ascending?1:-1)});
 const sortBy=(key:string)=>{if(sort===key)setAscending(!ascending);else{setSort(key);setAscending(true)}};
 return <CompareDrawer title={title} onClose={onClose} wide>
  <p>Every run is available. Different attributes do not prevent a comparison.</p>
  <label><span className="row"><Search/>Search runs and recorded attributes</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Run ID, line, order…" data-testid="search-runs"/></label>
  <details><summary>Filter runs · date, equipment and custom fields</summary><div className="generic-fields">{fields.map(f=><label key={f.key}>{f.label}<ExplanationTooltip interactive text={`Not assessed selects runs without a single usable mapped ${f.label} value. This filter does not change calculated numbers.`}><select aria-label={`Filter ${f.label}`} value={filters[f.key]||''} onChange={e=>setFilters({...filters,[f.key]:e.target.value})}><option value="">All values</option><option value="__unavailable__">Not assessed</option>{[...new Set(indexed.map(i=>i.fields[f.key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(v=><option key={v}>{v}</option>)}</select></ExplanationTooltip></label>)}</div></details>
  <div className="row between"><p>{visible.length} of {report.runs.length} runs · sort using column headings</p><button onClick={()=>{setFilters({});setSearch('')}}>Clear search and filters</button></div>
  {visible.length?<div className="scroll" tabIndex={0}><table><thead><tr>{[{key:'id',label:'Run'},...fields,{key:'health',label:'Data health'}].map(f=><th key={f.key} aria-sort={sort===f.key?(ascending?'ascending':'descending'):'none'}><button onClick={()=>sortBy(f.key)}>{f.label}{sort===f.key?(ascending?' ↑':' ↓'):''}</button></th>)}<th>Quick summary</th><th>Selection</th></tr></thead>
   <tbody>{visible.map(({run,fields:values})=><tr key={run.id}><th dir="auto">{run.id}</th>{fields.map(f=><td key={f.key} dir="auto">{values[f.key]||<ExplanationTooltip text={unassessedExplanation(f.label,run,report)}>Not assessed</ExplanationTooltip>}</td>)}
    <td><Health state={run.health} issues={run.issues} report={report} scope={`run ${run.id}`}/><small>{run.issues.length} data notes</small></td>
    <td>{run.metrics.slice(0,4).map(m=><div key={m.id}><ExplanationTooltip interactive text={`${valueExplanation(m,report,run)} Tap again to see evidence.`}><button className="value-link" onClick={()=>onEvidence(run,m)} aria-label={`${run.id}: ${m.label}, ${formatCalculated(m)}. See evidence; on touch tap once for explanation, again for evidence.`}>{m.label}: {formatCalculated(m)}</button></ExplanationTooltip>{m.reason&&<small>{m.reason}</small>}</div>)}</td>
    <td><button onClick={()=>onSelect(run)} data-testid={`choose-run-${run.id}`}>Choose {run.id}</button></td></tr>)}</tbody></table></div>:<div className="empty"><Search/><h3>No runs match these filters</h3><p>Clear filters to return to the full run list.</p></div>}
 </CompareDrawer>;
}
