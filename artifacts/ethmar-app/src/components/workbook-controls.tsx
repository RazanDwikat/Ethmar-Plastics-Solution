import {parseWorkbook} from '@/lib/workbook';
import {useState} from 'react';
import {makeImport} from '@/lib/import-core';
import type {ImportRecord} from '@/lib/import-types';
export function WorkbookControls({record,change}:{record:ImportRecord;change:(p:Partial<ImportRecord>)=>void}){
 const book=record.file.workbook;
 const [error,setError]=useState('');
 if(!book)return null;
 return <section className="panel"><h2>Excel worksheet</h2>
 <label>Sheet<select value={book.selected} onChange={e=>{
   if(!confirm('Changing sheets resets the current row choices and mapping. Save a draft first to retain this sheet’s setup. Continue?'))return;
   try{const file=parseWorkbook(book.bytes,record.file.name,e.target.value);
   const next=makeImport(file);change(next);setError('');}
   catch(e){setError(e instanceof Error?e.message:'This sheet could not be read.');}
 }} >{book.sheets.map(s=><option key={s}>{s}</option>)}</select></label>
 <p>First sheet selected by default. Worksheet row numbers and cell addresses are retained. CSV separator and text encoding do not apply to Excel.</p>
 {error&&<p role="alert" className="error">{error}</p>}
 {book.sheets.length>1&&<p className="notice">ⓘ Multiple sheets: {book.sheets.join(', ')}. Only “{book.selected}” is being prepared. The complete original workbook is retained.</p>}
 {book.merges.map(range=><p className="notice" key={range}>ⓘ Sheet “{book.selected}”, merged cells {range}. Values have not been copied into empty cells. Review the affected rows below and choose Keep, Ignore or Use as header.</p>)}
 </section>;
}
