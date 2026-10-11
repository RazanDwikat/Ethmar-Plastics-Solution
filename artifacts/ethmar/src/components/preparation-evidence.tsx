import type { Cell, ImportedFile, SourceRow } from '@/lib/inspection';
import { preparationStepName } from '@/lib/preparation';
import { OriginalRows } from './original-rows';

export function CellEvidence({cell}:{cell:Cell}){
 const origins=cell.trace?.origins;
 return <div className="proof-cell"><strong>{origins?`Table cell · ${cell.address}`:cell.address}</strong><div className="raw-value" dir="auto">{cell.raw===null?'Empty cell':cell.raw===''?'Empty string':String(cell.raw)}</div>
 {cell.date&&<small>Interpreted date: {cell.date}</small>}
 {origins?<>{origins.map((o,i)=><div key={i}><small>{o.file} · {o.sheet} · line {o.line}{o.endLine&&o.endLine!==o.line?`–${o.endLine}`:''} · {o.address}</small><span className="raw-value" dir="auto">Original: {o.raw===null?'Empty cell':o.raw===''?'Empty string':String(o.raw)}</span>{o.formula!==undefined&&<small>Original spreadsheet formula: {o.formula} (saved result only)</small>}{o.date&&<small>Original interpreted date: {o.date}</small>}</div>)}{cell.trace!.operations.map((operation,i)=><p className="calculation-formula" key={i}>{operation}</p>)}</>:cell.formula!==undefined&&<><small className="raw-value">Formula: {cell.formula}</small><small>{cell.raw===null?'No cached value available.':'Original value above is cached; it may be out of date.'}</small></>}
 </div>;
}
export function PreparationAudit({file,sheetIndex}:{file:ImportedFile;sheetIndex:number}){
 if(!file.prepared)return null;
 const prepared=file.prepared;
 return <details className="panel" data-testid="preparation-audit"><summary>Preparation steps and excluded source rows · {prepared.recipe.steps.length} steps</summary><p>Applied to a copy. Original cells and source line numbers remain unchanged.</p>
 {prepared.recipe.steps.map((step,i)=>{
  const excluded=prepared.excluded.filter(e=>e.stepId===step.id);
  return <section key={step.id}><h3>{i+1}. {preparationStepName(step)}</h3><p>{excluded.length} rows excluded{excluded.length?` · lines ${excluded.map(e=>e.row.line).join(', ')}`:''}.</p>{excluded.length>0&&<details><summary>Show excluded values and reasons</summary>{excluded.map(({row,reason})=><div key={row.line}><p>Line {row.line}: {reason}</p>{row.cells.map((cell,j)=><CellEvidence key={j} cell={cell}/>)}</div>)}</details>}<details><summary>Step settings</summary><pre className="technical-json">{JSON.stringify(step,null,2)}</pre></details></section>;
 })}
 <OriginalRows sheet={prepared.originalSheets[sheetIndex]} kind={file.kind} headerLine={prepared.headerLine}/>
 </details>;
}
export function evidenceRowsForLines(file:ImportedFile,sheetIndex:number,lines:number[]):SourceRow[]{
 const originals=file.prepared?.originalSheets[sheetIndex]?.rows??[];
 const prepared=file.sheets[sheetIndex].rows;
 return [...new Map([...originals,...(file.prepared?.excluded.map(e=>e.row)??[]),...prepared].map(r=>[r.line,r])).values()].filter(r=>lines.includes(r.line));
}
