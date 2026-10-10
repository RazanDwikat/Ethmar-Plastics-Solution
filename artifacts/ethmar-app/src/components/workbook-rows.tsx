import {useState} from 'react';
import type {ImportRecord} from '@/lib/import-types';
export function WorkbookRows({record,change,editable}:{record:ImportRecord;change:(p:Partial<ImportRecord>)=>void;editable:boolean}){
 const [page,setPage]=useState(0);
 const rows=record.file.rows, pages=Math.max(1,Math.ceil(rows.length/25)), current=Math.min(page,pages-1);
 return <details className="panel"><summary>Original source rows · {rows.length} rows · all values retained</summary>
 <p>Sheet “{record.file.workbook!.selected}”. Each cell shows its original Excel address and displayed text. Empty cells remain empty; merged cells are not filled.</p>
 <div className="scroll"><table><thead><tr><th>Worksheet row</th><th>Original cells</th><th>Row choice</th></tr></thead><tbody>{rows.slice(current*25,current*25+25).map(r=><tr key={r.id}><td>{r.line}</td><td>{r.values.map((v,i)=><div key={i}><strong>{r.cells?.[i]}</strong><pre dir="auto">{v===''?'(empty cell)':v}</pre></div>)}</td><td>{record.headerId===r.id?'Header':editable?<><select aria-label={`Row ${r.line} choice`} value={record.decisions[r.id]||''} onChange={e=>change({decisions:{...record.decisions,[r.id]:e.target.value as 'keep'|'ignore'}})}><option value="" disabled>Choose</option><option value="keep">Keep</option><option value="ignore">Ignore</option></select><button onClick={()=>change({headerId:r.id,settings:{...record.settings,mapping:{}}})}>Use as header</button></>:record.decisions[r.id]||'Kept (default)'}</td></tr>)}</tbody></table></div>
 <div className="row"><button disabled={!current} onClick={()=>setPage(current-1)}>Previous rows</button><span>Page {current+1} of {pages}</span><button disabled={current+1>=pages} onClick={()=>setPage(current+1)}>Next rows</button></div>
 </details>;
}
