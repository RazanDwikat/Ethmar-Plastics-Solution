import { useState } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import type { ParsedSheet } from '@/lib/inspection';
import { EvidenceSheet } from './evidence-sheet';

export function OriginalRows({sheet,kind,headerLine}:{sheet:ParsedSheet;kind:'csv'|'xlsx';headerLine:number|null}){
 const [page,setPage]=useState(0);
 const size=25,pages=Math.max(1,Math.ceil(sheet.rows.length/size)),current=Math.min(page,pages-1);
 return <details className="panel" data-testid="original-rows"><summary>Original source rows · {sheet.rows.length.toLocaleString()} rows · all columns retained</summary><p>Read-only original values. {kind==='csv'?'Line ranges include every line of a quoted record.':'Cell addresses refer to the selected Excel sheet.'}</p>{sheet.rows.length?<><EvidenceSheet sheet={sheet} headerLine={headerLine} selectedColumns={[0,1,2,3]} entries={sheet.rows.slice(current*size,(current+1)*size).map(row=>({row,reason:row.line===headerLine?'Not used: header row':'Original source record'}))}/><div className="row between pagination"><span role="status">Rows {current*size+1}–{Math.min((current+1)*size,sheet.rows.length)} of {sheet.rows.length.toLocaleString()}</span><div className="row"><button disabled={!current} onClick={()=>setPage(current-1)} data-testid="previous-rows"><ChevronLeft/>Previous</button><label>Page<select value={current} onChange={e=>setPage(Number(e.target.value))} data-testid="select-rows-page">{Array.from({length:pages},(_,i)=><option key={i} value={i}>{i+1} of {pages}</option>)}</select></label><button disabled={current===pages-1} onClick={()=>setPage(current+1)} data-testid="next-rows">Next<ChevronRight/></button></div></div></>:<div className="empty"><Info/><h3>No source rows</h3><p>Choose another sheet or export a file containing your production log.</p></div>}</details>;
}
