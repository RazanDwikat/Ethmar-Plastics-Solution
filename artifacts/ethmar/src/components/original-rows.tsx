import { useState } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import type { ParsedSheet } from '@/lib/inspection';

export function OriginalRows({sheet,kind,headerLine}:{sheet:ParsedSheet;kind:'csv'|'xlsx';headerLine:number|null}){
 const [page,setPage]=useState(0);
 const size=25,pages=Math.max(1,Math.ceil(sheet.rows.length/size));
 const current=Math.min(page,pages-1);
 const width=sheet.rows.reduce((n,r)=>Math.max(n,r.cells.length),0);
 return <details className="panel" data-testid="original-rows"><summary>Original source rows · {sheet.rows.length.toLocaleString()} rows · all columns retained</summary>
 <p>Read-only original values, including headers and empty rows. Nothing has been removed or corrected. {kind==='csv'?'Line ranges include every line of a quoted record.':'Cell addresses refer to the selected Excel sheet.'}</p>
 <p><Info style={{display:'inline'}}/> Dates show the interpreted date beside the original value. Formulas are not calculated here; any cached value was saved by the spreadsheet.</p>
 {sheet.rows.length?<><div className="scroll" tabIndex={0} aria-label="Original rows, scroll horizontally for all columns"><table><thead><tr><th scope="col">{kind==='csv'?'CSV line':'Excel row'}</th>{Array.from({length:width},(_,i)=><th scope="col" key={i}>Column {i+1}</th>)}</tr></thead><tbody>{sheet.rows.slice(current*size,(current+1)*size).map(row=><tr key={row.line} data-testid={`source-row-${row.line}`}><th scope="row">{row.line}{row.endLine&&row.endLine!==row.line?`–${row.endLine}`:''}{headerLine===row.line&&<small>Header</small>}</th>{Array.from({length:width},(_,i)=>{const c=row.cells[i];return <td key={i}>{c?.address&&<small>{c.address}</small>}<div className="raw-value" dir="auto">{c?.raw===null||c?.raw===undefined||c?.raw===''?<span className="muted">{c?.raw===''?'Empty string':'Empty cell'}</span>:String(c.raw)}</div>{c?.date&&<small dir="auto">Date: {c.date}</small>}{c?.formula&&<><small dir="auto">Formula: {c.formula}</small><small>{c.raw===null?'No cached value available':'Original value above is cached; it may be out of date.'}</small></>}</td>})}</tr>)}</tbody></table></div><div className="row between pagination"><span role="status">Rows {current*size+1}–{Math.min((current+1)*size,sheet.rows.length)} of {sheet.rows.length.toLocaleString()}</span><div className="row"><button disabled={current===0} onClick={()=>setPage(current-1)} data-testid="previous-rows"><ChevronLeft/>Previous</button><label>Page<select value={current} onChange={e=>setPage(Number(e.target.value))} data-testid="select-rows-page">{Array.from({length:pages},(_,i)=><option key={i} value={i}>{i+1} of {pages}</option>)}</select></label><button disabled={current===pages-1} onClick={()=>setPage(current+1)} data-testid="next-rows">Next<ChevronRight/></button></div></div></>:<div className="empty"><Info/><h3>No source rows</h3><p>Choose another sheet or export a file containing your production log.</p></div>}
 </details>;
}
