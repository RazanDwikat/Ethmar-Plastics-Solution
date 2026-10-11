import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {parseBytes,inspectSheet,type ImportedFile} from './inspection';
import {defaultSetup,type Profile} from './setup';
import {samples} from './samples';
import {checkCompatibility,calculateCompatible} from './compatibility';
const read=(csv:string)=>parseBytes(new TextEncoder().encode(csv).buffer,'manager.csv');
async function fixture(){
  const file=await read(samples[0].csv),inspection=inspectSheet(file.sheets[0],file.decimal);
  const profile:Profile={id:'p',name:'Production',savedAt:'2026-10-11',headers:inspection.headers,setup:defaultSetup(inspection),headerLine:inspection.headerLine,confirmed:true};
  return {file,profile};
}
function cell(file:ImportedFile,line:number,column:number,value:string){
  const c=file.sheets[0].rows.find(r=>r.line===line)!.cells[column];c.raw=value;c.display=value;
}
test('compatibility requires explicit shape, blocks mismatch and never calculates blocked file',async()=>{
  const {file,profile}=await fixture();
  assert.equal(checkCompatibility(file,0,profile).state,'blocked');
  const bad=checkCompatibility(file,0,profile,'run');
  assert.match(bad.differences.join(' '),/Different file shape/);
  assert.throws(()=>calculateCompatible(file,0,bad),/does not match/);
});
test('exact original headers match regardless of order; acceptance numbers unchanged',async()=>{
  const {file,profile}=await fixture(),before=structuredClone(profile);
  for(const row of file.sheets[0].rows)row.cells.reverse();
  const check=checkCompatibility(file,0,profile,'event');
  assert.equal(check.state,'matches');
  const report=calculateCompatible(file,0,check);
  assert.equal(report.runs.find(r=>r.id==='E-02')!.metrics.find(m=>m.id==='scrap-rate')!.value,10);
  assert.equal(report.runs.find(r=>r.id==='E-02')!.metrics.find(m=>m.id==='downtime')!.value,0.75);
  assert.deepEqual(profile,before);
});
test('missing, case-changed, ambiguous headers blocked; extra columns retained as unmapped',async()=>{
  const {file,profile}=await fixture();
  cell(file,1,0,'EVENT_ID');
  assert.match(checkCompatibility(file,0,profile,'event').differences.join(' '),/Missing column: “event_id”/);
  cell(file,1,0,'event_id');
  for(const row of file.sheets[0].rows)row.cells.push({address:`Z${row.line}`,raw:row.line===1?'operator_note':'original note',display:row.line===1?'operator_note':'original note'});
  const check=checkCompatibility(file,0,profile,'event');
  assert.equal(check.state,'notes');assert.ok(check.unmapped.includes('operator_note'));
  const report=calculateCompatible(file,0,check);
  assert.equal(report.source.sheets[0].rows[1].cells.at(-1)!.raw,'original note');
  cell(file,1,file.sheets[0].rows[0].cells.length-1,'event_id');
  assert.match(checkCompatibility(file,0,profile,'event').differences.join(' '),/appears more than once/);
});
test('unknown activities and invalid dates/numbers excluded from every calculation, originals retained',async()=>{
  const {file,profile}=await fixture();
  cell(file,2,profile.setup.mapping.eventType!,'OTHER');
  cell(file,3,profile.setup.mapping.quantity!,'not a number');
  cell(file,4,profile.setup.mapping.start!,'yesterday');
  const before=structuredClone(file),check=checkCompatibility(file,0,profile,'event');
  assert.equal(check.state,'notes');
  assert.deepEqual(check.excluded.map(e=>e.row.line),[2,3,4]);
  assert.match(check.notes.join(' '),/1 row — lines 3/);
  const report=calculateCompatible(file,0,check);
  for(const run of report.runs)for(const value of [...run.metrics,...run.measures]){
    assert.ok(value.evidence.used.every(e=>![2,3,4].includes(e.row.line)));
  }
  assert.ok(report.excluded.some(e=>e.row.line===3));
  assert.deepEqual(file,before);
});
test('conflicting event IDs remain conflicting even if one row is excluded by parsing checks',async()=>{
  const {file,profile}=await fixture();
  const duplicate=structuredClone(file.sheets[0].rows[3]);duplicate.line=100;duplicate.cells[profile.setup.mapping.quantity!].raw='bad';
  file.sheets[0].rows.push(duplicate);
  const report=calculateCompatible(file,0,checkCompatibility(file,0,profile,'event'));
  assert.equal(report.runs[0].measures.find(m=>m.id==='scrap')!.value,null);
  assert.ok(report.runs[0].issues.some(i=>i.code==='conflicting-id'));
});
