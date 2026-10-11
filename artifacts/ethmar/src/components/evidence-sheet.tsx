import { useState } from 'react';
import { columnLetter, type ParsedSheet, type SourceRow } from '@/lib/inspection';
import type { EvidenceRow } from '@/lib/calculation-engine';
import './evidence-sheet.css';

export function EvidenceSheet({entries,sheet,headerLine,selectedColumns=[],usedAddresses=[]}:{entries:EvidenceRow[];sheet:ParsedSheet;headerLine?:number|null;selectedColumns?:number[];usedAddresses?:string[];unit?:string}){
 // Derived cells can be operands with units different from the result (for example kg in a ratio).
 const unit='';
 const [all,setAll]=useState(false);
 const header=sheet.rows.find(r=>r.line===headerLine);
 const width=sheet.rows.reduce((n,r)=>Math.max(n,r.cells.length),0);
 const used=new Set(usedAddresses);
 // Always render immutable source rows, even when evidence refers to derived cells.
 const rows=new Map<number,{row:SourceRow;reasons:Set<string>;derived:Map<string,{value:string;address:string;operations:string[];used:boolean}[]>}>();
 for(const entry of entries){
  const origins=entry.row.cells.flatMap(c=>c.trace?.origins??[]);
  const lines=origins.length?[...new Set([entry.row.line,...origins.map(o=>o.line)])]:[entry.row.line];
  for(const line of lines){
   const original=sheet.rows.find(r=>r.line===line)??(line===entry.row.line?entry.row:undefined);
   if(!original)continue;
   let item=rows.get(line);if(!item){item={row:original,reasons:new Set(),derived:new Map()};rows.set(line,item);}
   item.reasons.add(entry.reason);
   for(const c of entry.row.cells)for(const origin of c.trace?.operations.length?c.trace.origins:[]){
    if(origin.line!==line)continue;
    const list=item.derived.get(origin.address)??[];
    if(!list.some(d=>d.address===c.address))list.push({value:String(c.raw??''),address:c.address,operations:c.trace?.operations??[],used:used.has(c.address)});
    item.derived.set(origin.address,list);
   }
  }
 }
 const visible=[...rows.values()].sort((a,b)=>a.row.line-b.row.line);
 const usedColumns=visible.flatMap(({row,derived})=>row.cells.flatMap((c,i)=>used.has(c.address)||derived.get(c.address)?.some(d=>d.used)?[i]:[]));
 const columns=Array.from({length:width},(_,i)=>i).filter(i=>all||selectedColumns.includes(i)||usedColumns.includes(i));
 const shown=columns.length?columns:Array.from({length:Math.min(width,4)},(_,i)=>i);
 return <div className="evidence-sheet"><div className="row between"><span className="evidence-legend">Highlighted cells used in this calculation · read-only originals</span><button aria-pressed={all} onClick={()=>setAll(!all)}>{all?'Show identifying and used columns':`Show all columns (${width})`}</button></div><div className="scroll" tabIndex={0} aria-label="Original source rows"><table><thead><tr><th>Source line</th>{shown.map(i=><th key={i}>{columnLetter(i)} · {String(header?.cells[i]?.raw??`Column ${columnLetter(i)}`)}</th>)}<th>What we did</th></tr></thead><tbody>{visible.map(({row,reasons,derived})=><tr key={row.line} data-testid={`source-row-${row.line}`}><th scope="row">Line {row.line}{row.endLine&&row.endLine!==row.line?`–${row.endLine}`:''}</th>{shown.map(i=>{const c=row.cells[i],conversions=c?derived.get(c.address):undefined;return <td key={i} className={c&&(used.has(c.address)||conversions?.some(d=>d.used))?'used-cell':''}><small className="source-address">{c?.address}</small><div dir="auto">{c?.raw===null||c?.raw===undefined||c?.raw===''?<span className="muted">-</span>:String(c.raw)}</div>{conversions?.map(d=><div key={d.address}><small className="derived-value">→ {d.value||'-'}{d.used&&unit?` ${unit}`:''} · prepared {d.address}</small><details><summary>Conversion and lineage</summary>{d.operations.map((o,j)=><small key={j}>{o}</small>)}</details></div>)}{c?.date&&<small>Date: {c.date}</small>}{c?.formula!==undefined&&<small>Formula: {c.formula} · saved result only</small>}</td>})}<td>{[...reasons].join(' · ')}</td></tr>)}</tbody></table></div>{!visible.length&&<p>No source rows in this category.</p>}</div>;
}
