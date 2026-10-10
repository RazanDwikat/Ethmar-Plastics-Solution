import {Check} from 'lucide-react';
import type {ImportRecord,Inspection} from '@/lib/import-types';
export function SourceProblems({record,inspection,change}:{record:ImportRecord;inspection:Inspection;change:(p:Partial<ImportRecord>)=>void}){
 return <section className="panel"><h2>Rows that need a choice</h2><p>Keep a row as recorded or ignore it for this setup. Ignored rows remain in the original file.</p>
 {!inspection.problems.length&&<div className="good"><Check/>No row problems found by the file check.</div>}
 {inspection.problems.map(p=>{
 const row=record.file.rows.find(r=>p.line>=r.line&&p.line<=r.endLine);
 return <div className="problem" key={p.id}>
 <strong>{record.file.workbook?`Sheet “${record.file.workbook.selected}”, row`:'CSV line'} {p.line}</strong><p>{p.message}</p>
 {row&&row.id!==record.headerId?<div className="row">
 {(['keep','ignore'] as const).map(d=><button key={d} aria-pressed={record.decisions[row.id]===d} onClick={()=>change({decisions:{...record.decisions,[row.id]:d}})}>{record.decisions[row.id]===d&&<Check/>}{d==='keep'?'Keep row':'Ignore row'}</button>)}
 <button onClick={()=>change({headerId:row.id,settings:{...record.settings,mapping:{}}})}>Use as header</button>
 <small>{record.decisions[row.id]?'Choice recorded. Save the import to keep it after reload.':'Your choice is needed.'}</small>
 </div>:<small>Selected as header. Review column names in the next step.</small>}
 </div>;
 })}
 </section>;
}
