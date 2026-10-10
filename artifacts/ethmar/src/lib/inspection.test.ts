import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import ExcelJS from 'exceljs';
import { parseBytes, parseCsv, inspectSheet } from './inspection';
import { samples } from './samples';
const bytes = (s: string) => new TextEncoder().encode(s).buffer;
test('four sample datasets use real reader and keep raw rows', async () => {
  for (const s of samples) {
    const file = await parseBytes(bytes(s.csv), `${s.id}.csv`);
    const info = inspectSheet(file.sheets[0],file.decimal);
    assert.equal(info.headerLine,1);
    assert.ok(info.runCandidates.length);
    assert.equal(info.shape,s.id==='cake'?'run':'event');
    assert.equal(file.sheets[0].rows[0].cells[0].raw,s.id==='cake'?'run_id':'event_id');
  }
});
test('CSV preserves multiline, escaped quotes, empty rows and physical lines', () => {
  const rows = parseCsv('run_id,note\r\nE01,"a,b\r\n""quoted"""\r\n\r\nE02,last\r\n',',');
  assert.equal(rows.length,4);
  assert.equal(rows[1].cells[1].raw,'a,b\r\n"quoted"');
  assert.deepEqual(rows.map(r=>[r.line,r.endLine]),[[1,1],[2,3],[4,4],[5,5]]);
  assert.throws(()=>parseCsv('a,b\nE01,"bad',','),/does not close/);
  assert.throws(()=>parseCsv('a,b\nE01,"bad"x',','),/Unexpected/);
});
test('Arabic, UTF16, delimiter and decimal detection and overrides', async () => {
  const source='رقم الدفعة;quantity\nدفعة-١;12,5\nدفعة-٢;15,7';
  const file=await parseBytes(bytes(source),'arabic.csv');
  assert.equal(file.delimiter,';'); assert.equal(file.decimal,',');
  assert.equal(file.sheets[0].rows[1].cells[0].raw,'دفعة-١');
  assert.ok(inspectSheet(file.sheets[0],file.decimal).runCandidates.length);
  const b=Buffer.from('\ufeff'+source,'utf16le');
  const utf=await parseBytes(Uint8Array.from(b).buffer,'arabic.csv');
  assert.equal(utf.encoding,'utf-16le');
  assert.equal(utf.sheets[0].rows[1].cells[1].raw,'12,5');
  const override=await parseBytes(file.original,'arabic.csv',{delimiter:';',decimal:'.'});
  assert.ok(inspectSheet(override.sheets[0],override.decimal).issues.some(x=>x.code.startsWith('number-text')));
});
test('issues are visible and originals never edited', async () => {
  const s='run_id,date,quantity\nE01,2026-10-07,50\n\nrun_id,date,quantity\nE02,08/10/2026,"1,000"\nTotal,,1050\nE03,x';
  const f=await parseBytes(bytes(s),'issues.csv',{decimal:'.'});
  const before=JSON.stringify(f.sheets[0]);
  const i=inspectSheet(f.sheets[0],'.');
  for(const code of ['empty-rows','repeated-header','totals','irregular','mixed-dates-1','number-text-2']) assert.ok(i.issues.some(x=>x.code===code),code);
  assert.equal(JSON.stringify(f.sheets[0]),before);
  const no=await parseBytes(bytes('foo,bar\nabc,xyz'),'no-run.csv');
  assert.ok(inspectSheet(no.sheets[0],'.').issues.some(x=>x.code==='no-run'));
});
test('unreadable, empty, unsupported and oversized files give actionable errors',async()=>{
  await assert.rejects(parseBytes(new ArrayBuffer(0),'a.csv'),/empty/);
  await assert.rejects(parseBytes(bytes('a'),'a.xls'),/Save As/);
  await assert.rejects(parseBytes(new Uint8Array([255,255,254]).buffer,'bad.csv'),/encoding/);
  await assert.rejects(parseBytes(bytes('notzip'),'bad.xlsx'),/could not be opened/);
  await assert.rejects(parseBytes(new ArrayBuffer(21*1024*1024),'large.csv'),/20 MB/);
});
test('Excel sheets, serials, formula caches, merges and blank rows are preserved',async()=>{
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('Production');
  ws.addRow(['run_id','date','quantity','calculated']);
  ws.addRow(['E01',new Date('2026-10-07T00:00:00Z'),50,{formula:'C2*2',result:100}]);
  ws.getCell('B2').numFmt='yyyy-mm-dd';
  ws.getCell('A4').value='E02';ws.getCell('C4').value='42';
  ws.getCell('D4').value={formula:'C4*2'};
  ws.mergeCells('A5:B5'); ws.getCell('A5').value='Total';
  wb.addWorksheet('العربية').addRow(['رقم الدفعة','الكمية']);
  const buffer=await wb.xlsx.writeBuffer();
  const f=await parseBytes(Uint8Array.from(new Uint8Array(buffer)).buffer,'test.xlsx');
  assert.equal(f.sheets.length,2);
  const sheet=f.sheets[0];
  assert.equal(sheet.rows[1].cells[1].raw,46302);
  assert.match(sheet.rows[1].cells[1].date!,/^2026-10-07/);
  assert.equal(sheet.rows[1].cells[3].formula,'C2*2');
  assert.equal(sheet.rows[1].cells[3].raw,100);
  assert.equal(sheet.rows[2].line,3);assert.equal(sheet.rows[2].cells[0].raw,null);
  assert.equal(sheet.rows[4].cells[1].raw,null);
  const i=inspectSheet(sheet,'.');
  for(const code of ['merged','formulas','formula-no-cache','empty-rows','stored-text-2'])assert.ok(i.issues.some(x=>x.code===code),code);
});
test('Excel 1904 date system is respected',async()=>{
  const wb=new ExcelJS.Workbook();wb.properties.date1904=true;
  const ws=wb.addWorksheet('Dates');ws.addRow(['run_id','date']);ws.addRow(['E01',new Date('2026-10-07T12:30:00Z')]);ws.getCell('B2').numFmt='yyyy-mm-dd hh:mm';
  const b=await wb.xlsx.writeBuffer();const f=await parseBytes(Uint8Array.from(new Uint8Array(b)).buffer,'date.xlsx');
  assert.match(f.sheets[0].rows[1].cells[1].date!,/^2026-10-07 12:30/);
});
