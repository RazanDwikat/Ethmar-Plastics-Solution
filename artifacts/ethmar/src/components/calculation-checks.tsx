import { useState } from 'react';
import { Check, Info, TriangleAlert } from 'lucide-react';
import { formatCalculated, type CalculationReport, type CalculatedValue, type DataIssue, type EvidenceRow } from '@/lib/calculation-engine';
import { evidenceRowsForLines } from './preparation-evidence';
import { EvidenceSheet } from './evidence-sheet';
import { inspectSheet } from '@/lib/inspection';
import { usedCellAddresses, operandExpressions } from './compare-presentation';
import { ExplanationTooltip } from './explanation-tooltip';
import { healthExplanation, issueExplanation, valueExplanation, valueIssues } from '@/lib/explanations';
import { CompareDrawer } from './compare-drawer';

export function Health({state,issues,report,scope='these original records'}:{state:'clear'|'note'|'missing'|'conflict';issues:DataIssue[];report:CalculationReport;scope?:string}) {
 const [open,setOpen]=useState(false);
 const text=healthExplanation(issues,report,scope);
 return <><ExplanationTooltip text={text} onAction={report?()=>setOpen(true):undefined}><span className={`tag ${state}`} data-testid={`health-${state}`}>{state==='clear'?<Check/>:state==='note'?<Info/>:<TriangleAlert/>}{state==='clear'?'Clear':state==='note'?'Note':state==='conflict'?'Conflict':'Missing'}</span></ExplanationTooltip>{open&&report&&<CompareDrawer title={`Data checks · ${scope}`} onClose={()=>setOpen(false)}>{issues.length?<Issues issues={issues} report={report}/>:<p>{text}</p>}</CompareDrawer>}</>;
}

export function EvidenceRows({entries,title,report,value,expanded=false}:{entries:EvidenceRow[];title:string;report:CalculationReport;value?:CalculatedValue;expanded?:boolean}) {
 const [page,setPage]=useState(0);
 const pages=Math.max(1,Math.ceil(entries.length/15)),current=Math.min(page,pages-1);
 const sheet=report.source.prepared?.originalSheets[report.sheetIndex]??report.source.sheets[report.sheetIndex];
 const headerLine=report.source.prepared?.headerLine??inspectSheet(sheet,report.source.decimal).headerLine;
 const mapping=report.setup.mapping;
 const identifiers=[mapping[report.setup.groupBy],mapping.eventId,mapping.eventType,mapping.date,mapping.line,mapping.machine,mapping.mold].filter((c):c is number=>c!==null);
 const selected=report.source.prepared?entries.flatMap(e=>identifiers.flatMap(i=>(e.row.cells[i]?.trace?.origins??[]).map(o=>sheet.rows.find(r=>r.line===o.line)?.cells.findIndex(c=>c.address===o.address)??-1))):identifiers;
 // Addresses are supplied by the engine's actual source expressions, not inferred from every mapped numeric column.
 const expressions=value?operandExpressions(value,report):'';
 const addresses=usedCellAddresses(entries,expressions);
 if(value&&report.setup.measurements.find(m=>m.id===value.id)?.template==='Count')for(const e of entries)for(const i of [mapping[report.setup.groupBy],mapping.eventId,mapping.eventType])if(i!==null&&e.row.cells[i])addresses.push(e.row.cells[i].address);
 return <details className="evidence-rows" open={expanded||undefined}><summary>{title} · {entries.length} {entries.length===1?'row':'rows'}</summary>{entries.length?<><p>{report.source.name} · {sheet.name}. Original values and source addresses are unchanged.</p><EvidenceSheet entries={entries.slice(current*15,(current+1)*15)} sheet={sheet} headerLine={headerLine} selectedColumns={selected} usedAddresses={addresses} unit={value?.unit}/><div className="row between pagination"><span>Page {current+1} of {pages}</span><div className="row"><button disabled={!current} onClick={()=>setPage(current-1)}>Previous rows</button><button disabled={current===pages-1} onClick={()=>setPage(current+1)}>Next rows</button></div></div></>:<p>No rows in this category.</p>}</details>;
}

export function Issues({issues,report}:{issues:DataIssue[];report:CalculationReport}) {
  return <>{issues.map((issue,i)=><div className={`check-issue ${issue.level}`} key={`${issue.code}-${i}`}><div className="row"><Health state={issue.level} issues={[issue]} report={report}/><strong>{issueExplanation(issue,report)}</strong></div>{issue.lines.length>0&&<EvidenceRows title="See problem rows" report={report} entries={evidenceRowsForLines(report.source,report.sheetIndex,issue.lines).map(row=>({row,reason:issueExplanation(issue,report)}))}/>}</div>)}</>;
}

export function Value({value,report}:{value:CalculatedValue;report:CalculationReport}) {
 const evidence=value.evidence;
 const run=report.runs.find(r=>r.metrics.includes(value)||r.measures.includes(value));
 const explanation=valueExplanation(value,report,run);
 return <details className="calculated-value" data-testid={`calculated-${value.id}`}><summary><span>{value.label}<small>{value.state==='available'?'Expand for calculation and original rows':value.reason}</small></span><ExplanationTooltip text={explanation}><span className="calculated-number">{formatCalculated(value)}{value.state!=='available'&&<span className="row"><Info/><small>{value.state==='not-logged'?'Not logged · not zero':'Unavailable'}</small></span>}</span></ExplanationTooltip></summary><div className="inline-proof"><h4>How calculated</h4><p className="calculation-formula">{evidence.formula}</p>{value.reason&&<p>{explanation}</p>}<Issues report={report} issues={valueIssues(value,report,run)}/><EvidenceRows entries={evidence.used} title="Used rows" report={report}/><EvidenceRows entries={evidence.excluded} title="Excluded rows and reasons" report={report}/><h4>Notes</h4>{evidence.notes.length?<ul>{evidence.notes.map((note,i)=><li key={i}>{note}</li>)}</ul>:<p>No additional notes for this result.</p>}<details><summary>Technical details · setup and source mapping</summary><p>{evidence.mapping.file} · {evidence.mapping.sheet} · Decimal separator: {evidence.mapping.decimal}</p><p>Original headers, role mappings, activity definitions and custom fields used for this calculation:</p><pre className="technical-json">{JSON.stringify(evidence.mapping,null,2)}</pre></details></div></details>;
}

export function CalculationChecks({report,error,onRun,onEdit}:{report:CalculationReport|null;error:string;onRun:()=>void;onEdit:()=>void}) {
 if(error)return <section className="panel calculation-checks" data-testid="calculation-checks"><div className="error" role="alert"><h2>Calculations need your attention</h2><p>{error}</p><p>No previous results are shown. Your original records are unchanged.</p></div><div className="row"><button className="primary" onClick={onRun}>Retry checks</button><button onClick={onEdit}>Edit setup</button></div></section>;
 return <details className="panel calculation-checks" data-testid="calculation-checks"><summary>See data checks</summary><p>Calculated from your confirmed setup and original records. These are production data checks, separate from the file check. Not logged means no record was found; it never means zero.</p>
  {!report?<div className="empty"><Info/><h3>Run checks for this confirmed setup</h3><p>Calculated results are not saved. Run checks again after reopening your workspace.</p><button className="primary" onClick={onRun}>Run checks</button></div>:<>
   <div className="row between"><h2>Calculated run results</h2><ExplanationTooltip text={`${report.runs.length} runs grouped from ${report.source.name}. Configured definition totals and measurements were checked; review each run's notes before using its results.`}><span className="tag"><Check/>{report.runs.length} runs checked</span></ExplanationTooltip></div>
   <p>{report.source.name} · {report.source.sheets[report.sheetIndex].name}</p><section><h3>File-wide data checks</h3>{report.issues.length?<Issues issues={report.issues} report={report}/>:<p className="row"><Check/>No file-wide calculation issues found.</p>}<EvidenceRows entries={report.excluded} title="File-wide excluded rows and reasons" report={report}/></section>
   {!report.runs.length&&<div className="empty"><TriangleAlert/><h3>No runs could be calculated</h3><p>Review the grouping column and excluded rows, then edit your setup.</p><button onClick={onEdit}>Edit setup</button></div>}
   {report.runs.map(run=><section className="check-run" key={run.id} data-testid={`run-check-${run.id}`}>
    <div className="row between"><h3 dir="auto">{report.setup.groupBy==='runId'?'Run':'Order'} {run.id}</h3><Health state={run.health} issues={run.issues} report={report} scope={`run ${run.id}`}/></div>
    <p>{run.health==='clear'?'No production data issues found for this run.':run.health==='note'?'Read the notes before using these recorded results.':'Some results cannot be calculated; available values remain visible.'}</p>
    <h4>Configured measurements</h4>{run.metrics.length?run.metrics.map(value=><Value key={value.id} value={value} report={report}/>):<p>No measurements are configured. Definition totals remain available below.</p>}
    <details className="config-card"><summary>Definition totals · {run.measures.length}</summary><p>All configured quantities and durations, including material input, good output and scrap when defined.</p>{run.measures.map(value=><Value key={value.id} value={value} report={report}/>)}</details>
    <details><summary>Run data checks · {run.issues.length}</summary>{run.issues.length?<Issues issues={run.issues} report={report}/>:<p className="row"><Check/>No run data issues found.</p>}</details>
    <EvidenceRows entries={run.rows.map(row=>({row,reason:'Original record assigned to this run; inspect each result to see whether it was used.'}))} title="All original run rows" report={report}/>
   </section>)}
  </>}
 </details>;
}
