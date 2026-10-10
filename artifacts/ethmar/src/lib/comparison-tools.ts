import type {CalculatedRun,CalculationReport,CalculatedValue} from './calculation-types';
import type {Setup} from './setup';
import {compareCalculatedRuns} from './calculation-comparison';
import {formatCalculated,timestamp} from './calculation-values';

export function searchRunText(text:string,query:string):boolean {
  const normalized=(s:string)=>s.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  return normalized(text).includes(normalized(query));
}

export function runFields(run:CalculatedRun,setup:Setup):Record<string,string>{
  const out:Record<string,string>={};
  const values=(column:number|null)=>column===null?'':[...new Set(run.rows.map(r=>String(r.cells[column]?.raw??'')).filter(v=>v.trim()))].join(' · ');
  for(const role of ['line','machine','mold','shift','product','reason'] as const)out[role]=values(setup.mapping[role]);
  out.order=values(setup.mapping.orderId);
  const dateColumn=setup.mapping.date??setup.mapping.start;
  const dates=run.rows.map(r=>dateColumn===null?null:timestamp(r.cells[dateColumn])).filter((v):v is number=>v!==null);
  out.date=dates.length?new Date(Math.min(...dates)).toISOString().slice(0,10):'';
  for(const f of setup.customFields)out[`custom:${f.id}`]=values(f.column<0?null:f.column);
  return out;
}
export function suggestRuns(report:CalculationReport,baselineId:string){
  const baseline=report.runs.find(r=>r.id===baselineId);if(!baseline)return [];
  const date=runFields(baseline,report.setup).date;
  return report.runs.filter(r=>r.id!==baselineId).map(run=>{
    const {checks}=compareCalculatedRuns(baseline,run,report.setup);
    // Product remains in comparison context but is not part of the agreed suggestion rank.
    const selected=checks.filter(c=>c.label!=='Product');
    const matches=selected.filter(c=>c.state==='match');
    const otherDate=runFields(run,report.setup).date;
    const distance=date&&otherDate?Math.abs(Date.parse(otherDate)-Date.parse(date)):Infinity;
    return {run,score:matches.length,reasons:matches.map(c=>`${c.label}: ${c.reason} (${c.baseline} / ${c.compared})`),unassessed:selected.filter(c=>c.state==='not-assessed').map(c=>`${c.label}: ${c.reason}`),distance};
  }).sort((a,b)=>b.score-a.score||a.distance-b.distance||a.run.id.localeCompare(b.run.id)).slice(0,5);
}
export function answerSentence(a:CalculatedRun,b:CalculatedRun,setup:Setup):string{
  const scrapA=a.measures.find(m=>m.id==='scrap'),scrapB=b.measures.find(m=>m.id==='scrap');
  const changeA=a.measures.find(m=>m.id==='changeover'),changeB=b.measures.find(m=>m.id==='changeover');
  const comparable=(x:CalculatedValue|undefined,y:CalculatedValue|undefined)=>x?.value!==null&&x?.value!==undefined&&y?.value!==null&&y?.value!==undefined&&x.unit===y.unit;
  let sentence:string;
  if(comparable(scrapA,scrapB)){
    const d=scrapB!.value!-scrapA!.value!;
    const label=setup.events.find(e=>e.id==='scrap')?.label??'Waste';
    sentence=d===0?`${label} was equal in both runs (${formatCalculated(scrapA!)} each).`:`${d>0?b.id:a.id} recorded more ${label.toLowerCase()} (${formatCalculated(d>0?scrapB!:scrapA!)} versus ${formatCalculated(d>0?scrapA!:scrapB!)}).`;
    if(comparable(changeA,changeB)){
      const changeLabel=changeA!.label.toLowerCase();
      if(d===0)sentence+=` ${changeA!.label} was ${formatCalculated(changeA!)} in ${a.id} and ${formatCalculated(changeB!)} in ${b.id}.`;
      else {const high=d>0?changeB!:changeA!,low=d>0?changeA!:changeB!;sentence+=` Its ${changeLabel} was ${high.value!>low.value!?'also longer':high.value!<low.value!?'shorter':'the same length'} (${formatCalculated(high)} versus ${formatCalculated(low)}).`;}
    }else sentence+=' The time comparison is unavailable because a required recorded value is missing or invalid.';
  }else sentence=`Which run recorded more waste cannot be determined: ${scrapA?.value===null?scrapA.reason:scrapB?.value===null?scrapB.reason:'the waste measure is not configured or uses incompatible units.'}`;
  const downtime=(r:CalculatedRun)=>{const v=r.measures.find(m=>m.id==='downtime');return `${r.id}: ${v?formatCalculated(v):'Not configured'}${v?.value===null?` (${v.reason})`:''}`;};
  const label=setup.events.find(e=>e.id==='downtime')?.label??'Unplanned downtime';
  return `${sentence} ${label} is shown separately — ${downtime(a)}; ${downtime(b)}. These are recorded differences, not evidence of a cause.`;
}
const refs=(v:CalculatedValue)=>v.evidence.used.map(e=>`${v.evidence.mapping.file} / ${v.evidence.mapping.sheet} / line ${e.row.line}${e.row.endLine&&e.row.endLine!==e.row.line?`–${e.row.endLine}`:''} / ${e.row.cells.map(c=>c.address).join(', ')}`).join('; ');
function allValues(run:CalculatedRun){return [...run.metrics,...run.measures.map(v=>({...v,id:`definition:${v.id}`}))];}
function exportRows(report:CalculationReport,a:CalculatedRun,b:CalculatedRun):string[][]{
  const rows:string[][]=[['Ethmar comparison','Baseline',a.id,'Compared',b.id],['Source file',report.source.name,'Sheet',report.source.sheets[report.sheetIndex].name],['Summary',answerSentence(a,b,report.setup)],['Difference direction','Compared minus baseline; rate differences are percentage points.'],['Measurement','Baseline','Compared','Difference','Unit','Unavailable reason','Baseline references','Compared references']];
  for(const av of allValues(a)){
    const bv=allValues(b).find(v=>v.id===av.id);
    const value=av.value!==null&&bv?.value!==null&&bv?.value!==undefined&&av.unit===bv.unit?bv.value-av.value:null;
    const unit=av.unit==='%'?'percentage points':av.unit;
    const reason=value===null?(av.value===null?av.reason:bv?.value===null?bv.reason:'The source or compatible unit is unavailable.'):'';
    rows.push([av.label,formatCalculated(av),bv?formatCalculated(bv):'Not configured',formatCalculated({value,unit,state:'unavailable'}),unit,reason,refs(av),bv?refs(bv):'']);
  }
  rows.push(['Comparability','State','Baseline','Compared','Explanation']);
  for(const c of compareCalculatedRuns(a,b,report.setup).checks)rows.push([c.label,c.state,c.baseline,c.compared,c.reason]);
  for(const r of [a,b]){
    rows.push(['Run health',r.id,r.health]);
    for(const issue of r.issues)rows.push(['Run note',r.id,issue.level,issue.message,`Lines ${issue.lines.join(', ')}`]);
    const fields=runFields(r,report.setup);
    if(fields.reason)rows.push(['Recorded reason — not a causal claim',r.id,fields.reason]);
    for(const f of report.setup.customFields)rows.push(['Custom context',r.id,f.label,f.compare?'Evidence and comparison':'Evidence only',fields[`custom:${f.id}`]||'Not assessed']);
    for(const v of allValues(r)){
      rows.push(['Formula',r.id,v.label,v.evidence.formula]);
      for(const note of v.evidence.notes)rows.push(['Metric note',r.id,v.label,note]);
      for(const [category,entries] of [['Used row',v.evidence.used],['Excluded row',v.evidence.excluded]] as const)
        for(const e of entries)rows.push([category,r.id,v.label,`${report.source.name} / ${report.source.sheets[report.sheetIndex].name} / lines ${e.row.line}${e.row.endLine&&e.row.endLine!==e.row.line?`–${e.row.endLine}`:''}`,e.reason,JSON.stringify(e.row.cells)]);
    }
  }
  for(const issue of report.issues)rows.push(['File note',issue.level,issue.message,`Lines ${issue.lines.join(', ')}`]);
  rows.push(['Technical details',JSON.stringify({setup:report.setup,encoding:report.source.encoding,decimal:report.source.decimal,delimiter:report.source.delimiter})]);
  return rows;
}
/** Prevent spreadsheet formula execution in user-controlled cells; originals remain unchanged in memory. */
export function exportComparisonCsv(report:CalculationReport,a:CalculatedRun,b:CalculatedRun):string{
  const safe=(v:string)=>/^[\s\u0000-\u001f]*[=+\-@]/.test(v)?`'${v}`:v;
  return '\uFEFF'+exportRows(report,a,b).map(row=>row.map(v=>`"${safe(v).replaceAll('"','""')}"`).join(',')).join('\r\n');
}
const escape=(v:string)=>v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export function comparisonPrintHtml(report:CalculationReport,a:CalculatedRun,b:CalculatedRun):string{
  const rows=exportRows(report,a,b);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ethmar comparison</title><style>body{font:14px system-ui,sans-serif;color:#193d35;margin:24px}h1{font-size:26px}table{border-collapse:collapse;width:100%;table-layout:fixed}td{padding:8px;border:1px solid #bdcec5;overflow-wrap:anywhere;white-space:pre-wrap;vertical-align:top}tr:nth-child(even){background:#f0f5f2}thead{display:table-header-group}@media print{body{margin:0;font-size:14px}tr{break-inside:avoid}}@page{size:landscape;margin:12mm}</style></head><body><h1>Ethmar · ${escape(a.id)} and ${escape(b.id)}</h1><p>Read-only recorded values. Warnings, unavailable values and source references are included. Dates without timezones are interpreted as recorded wall-clock time.</p><p>Spreadsheet downloads protect formula-like text with a leading apostrophe; original imported cells are retained unchanged below.</p><table><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${escape(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
}
