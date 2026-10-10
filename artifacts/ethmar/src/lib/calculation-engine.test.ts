import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {parseBytes,inspectSheet,type ImportedFile} from './inspection';
import {defaultSetup,type Setup} from './setup';
import {samples} from './samples';
import {calculateFile,formatCalculated,type CalculationReport} from './calculation-engine';
import {compareCalculatedRuns} from './calculation-comparison';
import {timestamp} from './calculation-values';
const bytes=(s:string)=>new TextEncoder().encode(s).buffer;
async function read(csv:string){
  const file=await parseBytes(bytes(csv),'test.csv');
  const setup=defaultSetup(inspectSheet(file.sheets[0],file.decimal));
  return {file,setup};
}
const run=(r:CalculationReport,id='E-01')=>r.runs.find(r=>r.id===id)!;
const metric=(r:CalculationReport,id:string,runId='E-01')=>run(r,runId).metrics.find(m=>m.id===id)!;
const measure=(r:CalculationReport,id:string,runId='E-01')=>run(r,runId).measures.find(m=>m.id===id)!;
async function sample(index=0){return read(samples[index].csv);}
function set(file:ImportedFile,line:number,column:number,raw:string|number|null){
  const c=file.sheets[0].rows.find(r=>r.line===line)!.cells[column];
  c.raw=raw;c.display=String(raw??'');delete c.date;
}
test('clean acceptance: real rates, durations, differences, comparability and unchanged evidence',async()=>{
  const {file,setup}=await sample();const before=structuredClone(file);
  const r=calculateFile(file,0,setup);
  assert.equal(metric(r,'scrap-rate').value,5);assert.equal(metric(r,'scrap-rate','E-02').value,10);
  assert.equal(metric(r,'changeover').value,4);assert.equal(metric(r,'changeover','E-02').value,6);
  assert.equal(metric(r,'downtime','E-02').value,0.75);
  assert.equal(formatCalculated(metric(r,'downtime','E-02')),'45 min');
  assert.equal(formatCalculated(metric(r,'changeover','E-02')),'6 h');
  assert.equal(metric(r,'downtime').value,null);assert.equal(metric(r,'downtime').state,'not-logged');
  assert.ok(!r.runs.some(run=>run.issues.some(i=>i.code==='overlap')));
  const comparison=compareCalculatedRuns(run(r),run(r,'E-02'),setup);
  assert.equal(comparison.differences.find(d=>d.id==='scrap-rate')!.value,5);
  assert.equal(comparison.differences.find(d=>d.id==='scrap-rate')!.unit,'percentage points');
  assert.equal(comparison.differences.find(d=>d.id==='changeover')!.value,2);
  assert.equal(comparison.checks.find(c=>c.label==='Line')!.state,'match');
  assert.equal(comparison.checks.find(c=>c.label==='Product')!.state,'not-assessed');
  const evidence=metric(r,'scrap-rate').evidence;
  assert.match(evidence.formula,/50.*1,000.*5%/);
  assert.deepEqual(evidence.used.map(r=>r.row.line).sort(),[2,4]);
  assert.equal(evidence.mapping.setup.mapping.quantity,9);
  assert.deepEqual(file,before);
});
test('identical duplicates count once; missing input only affects dependent results',async()=>{
  const {file,setup}=await sample(1),r=calculateFile(file,0,setup);
  assert.equal(measure(r,'scrap').value,50);
  assert.equal(metric(r,'scrap-rate').value,5);
  assert.ok(run(r).issues.some(i=>i.code==='duplicate'&&i.lines.includes(4)&&i.lines.includes(5)));
  assert.ok(metric(r,'scrap-rate').evidence.excluded.some(e=>e.row.line===5&&e.reason.includes('counted once')));
  assert.equal(metric(r,'scrap-rate','E-02').value,null);
  assert.match(metric(r,'scrap-rate','E-02').reason,/Material input/);
  assert.equal(metric(r,'good','E-02').value,900);
  assert.equal(metric(r,'changeover','E-02').value,6);
});
test('conflicting duplicate blocks scrap but keeps unrelated good and separate overlapping durations',async()=>{
  const {file,setup}=await sample(2),r=calculateFile(file,0,setup);
  assert.equal(measure(r,'scrap').value,null);assert.equal(metric(r,'scrap-rate').value,null);
  assert.equal(metric(r,'good').value,950);
  assert.ok(metric(r,'scrap-rate').evidence.excluded.some(e=>e.row.cells[9].raw==='50'));
  assert.ok(metric(r,'scrap-rate').evidence.excluded.some(e=>e.row.cells[9].raw==='65'));
  assert.equal(metric(r,'changeover','E-02').value,6);
  assert.equal(metric(r,'downtime','E-02').value,0.75);
  const overlap=run(r,'E-02').issues.find(i=>i.code==='overlap')!;
  assert.equal(overlap.lines.length,2);
});
test('same conflicting event ID across runs or types blocks both affected sources',async()=>{
  const {file,setup}=await sample();
  set(file,8,0,'EV-003'); // E02 scrap shares E01 ID, full original row differs
  const r=calculateFile(file,0,setup);
  assert.equal(measure(r,'scrap').value,null);assert.equal(measure(r,'scrap','E-02').value,null);
  assert.equal(measure(r,'good').value,950);
  set(file,8,6,'GOOD_OUT');
  const changed=calculateFile(file,0,setup);
  assert.equal(measure(changed,'good','E-02').value,null);
});
test('invalid numeric rows do not produce partial totals; Count stays independent',async()=>{
  const {file,setup}=await sample();
  set(file,4,9,'not a number');
  setup.measurements.push({id:'count',label:'Scrap records',template:'Count',a:'scrap',b:'',exampleA:1,exampleB:0});
  const r=calculateFile(file,0,setup);
  assert.equal(metric(r,'scrap-rate').value,null);assert.equal(measure(r,'scrap').value,null);
  assert.equal(metric(r,'count').value,1);
  assert.equal(metric(r,'good').value,950);
  assert.ok(run(r).issues.some(i=>i.code==='invalid-value'&&i.lines.includes(4)));
});
test('zero input cannot divide; negative quantities are invalid and explicit zero remains valid',async()=>{
  const {file,setup}=await sample();set(file,2,9,'0');set(file,4,9,'0');
  let r=calculateFile(file,0,setup);
  assert.equal(measure(r,'scrap').value,0);assert.equal(metric(r,'scrap-rate').value,null);assert.match(metric(r,'scrap-rate').reason,/zero/);
  set(file,4,9,'-5');r=calculateFile(file,0,setup);
  assert.equal(measure(r,'scrap').value,null);
});
test('balance warnings respect configuration and keep numeric results',async()=>{
  const {file,setup}=await sample();set(file,3,9,'940');
  let r=calculateFile(file,0,setup);
  assert.equal(metric(r,'scrap-rate').value,5);
  assert.ok(run(r).issues.some(i=>i.code==='imbalance'));
  setup.checkBalance=false;r=calculateFile(file,0,setup);
  assert.ok(!run(r).issues.some(i=>i.code.startsWith('balance')||i.code==='imbalance'));
});
test('invalid timestamps, reversed ranges and mixed timezone style affect only their duration',async()=>{
  const {file,setup}=await sample();
  for(const end of ['2026-02-30 10:00','2026-10-07 05:00','10/07/2026 10:00','2026-10-07T10:00:00Z']){
    set(file,5,8,end);const r=calculateFile(file,0,setup);
    assert.equal(metric(r,'changeover').value,null,end);
    assert.equal(metric(r,'scrap-rate').value,5);
  }
});
test('strict timestamps handle calendar/timezone validation and leap days',()=>{
  const cell=(raw:string)=>({raw,display:raw,address:'A1'});
  assert.equal(timestamp(cell('2026-02-30')),null);
  assert.equal(timestamp(cell('2026-10-08 25:00')),null);
  assert.notEqual(timestamp(cell('2024-02-29')),null);
  assert.equal(timestamp(cell('2026-10-08T13:00:00+02:00')),timestamp(cell('2026-10-08T11:00:00Z')));
});
test('touching windows do not overlap; same-type overlaps warn without merging',async()=>{
  const {file,setup}=await sample();set(file,10,7,'2026-10-08 12:00');set(file,10,8,'2026-10-08 12:45');
  let r=calculateFile(file,0,setup);assert.ok(!run(r,'E-02').issues.some(i=>i.code==='overlap'));
  const row=structuredClone(file.sheets[0].rows[8]);row.line=30;row.cells[0].raw='NEW';file.sheets[0].rows.push(row);
  r=calculateFile(file,0,setup);
  assert.equal(metric(r,'changeover','E-02').value,12);
  assert.ok(run(r,'E-02').issues.some(i=>i.code==='overlap'));
});
test('cake run-summary measures preserve zeros and convert duration units',async()=>{
  const {file,setup}=await sample(3);let r=calculateFile(file,0,setup);
  assert.equal(metric(r,'scrap-rate','C-01').value,5);assert.equal(metric(r,'scrap-rate','C-02').value,8);
  assert.equal(metric(r,'changeover','C-01').value,0.5);
  assert.equal(metric(r,'downtime','C-03').value,0);
  assert.equal(formatCalculated(metric(r,'downtime','C-03')),'0 min');
  setup.events.find(e=>e.id==='changeover')!.durationUnit='minutes';
  set(file,2,8,'30');r=calculateFile(file,0,setup);
  assert.equal(metric(r,'changeover','C-01').value,0.5);
  assert.ok(run(r,'C-01').issues.some(i=>i.code==='overlap-not-assessed'));
});
test('event single duration columns in seconds convert without inventing timestamps',async()=>{
  const {file,setup}=await read('run_id,event_type,duration_seconds\nR1,CHANGEOVER,3600\nR1,DOWNTIME_UNPLANNED,2700');
  const r=calculateFile(file,0,setup);
  assert.equal(metric(r,'changeover','R1').value,1);assert.equal(metric(r,'downtime','R1').value,0.75);
  assert.ok(run(r,'R1').issues.some(i=>i.code==='overlap-not-assessed'));
});
test('repeated summary rows do not double count; only disagreeing measures are unavailable',async()=>{
  const {file,setup}=await sample(3);
  const duplicate=structuredClone(file.sheets[0].rows[1]);duplicate.line=10;file.sheets[0].rows.push(duplicate);
  let r=calculateFile(file,0,setup);
  assert.equal(measure(r,'scrap','C-01').value,10);
  assert.ok(run(r,'C-01').issues.some(i=>i.code==='duplicate'));
  set(file,10,7,'12');r=calculateFile(file,0,setup);
  assert.equal(measure(r,'scrap','C-01').value,null);
  assert.equal(metric(r,'good','C-01').value,190);
});
test('renamed Arabic headers and event words produce identical configured results',async()=>{
  const {file,setup}=await sample();
  const aliases=['دخول','جيد','هدر','تبديل','توقف'];
  const originals=setup.events.map(e=>e.values[0]);
  setup.events.forEach((e,i)=>{e.values=[aliases[i]];e.label=aliases[i];});
  for(const row of file.sheets[0].rows.slice(1)){
    const index=originals.indexOf(String(row.cells[6].raw));
    if(index>=0)set(file,row.line,6,aliases[index]);
  }
  file.sheets[0].rows[0].cells.forEach((c,i)=>{c.raw=`حقل ${i}`;c.display=String(c.raw);});
  const r=calculateFile(file,0,setup,1);
  assert.equal(metric(r,'scrap-rate').value,5);
  assert.equal(metric(r,'changeover','E-02').value,6);
  assert.equal(metric(r,'downtime','E-02').value,0.75);
});
test('order grouping, missing identifiers and unmapped event IDs are transparent',async()=>{
  const {file,setup}=await sample();setup.groupBy='orderId';setup.mapping.runId=null;setup.mapping.eventId=null;
  set(file,4,1,'');
  const r=calculateFile(file,0,setup);
  assert.ok(run(r,'ORD-071'));
  assert.ok(r.issues.some(i=>i.code==='missing-group'&&i.lines.includes(4)));
  assert.ok(r.issues.some(i=>i.code==='no-event-id'));
  assert.ok(r.excluded.some(e=>e.row.line===4));
});
test('all seven templates use data, deduplicated counts, hours and A-minus-B',async()=>{
  const {file,setup}=await sample();
  setup.measurements=[
    {id:'ratio',template:'Ratio',a:'scrap',b:'material'},
    {id:'duration',template:'Duration',a:'changeover',b:''},
    {id:'total',template:'Total',a:'good',b:''},
    {id:'difference',template:'Difference',a:'material',b:'good'},
    {id:'count',template:'Count',a:'scrap',b:''},
    {id:'rate',template:'Rate per hour',a:'good',b:'changeover'},
    {id:'average',template:'Average',a:'scrap',b:''},
  ].map(m=>({...m,label:m.id,exampleA:999,exampleB:999})) as Setup['measurements'];
  const r=calculateFile(file,0,setup);
  assert.deepEqual(run(r).metrics.map(v=>v.value),[5,4,950,50,1,237.5,50]);
});
test('tolerance boundary passes; custom differences warn and missing attributes are not assessed',async()=>{
  const {file,setup}=await sample();setup.tolerance=200;
  setup.customFields=[{id:'context',column:5,label:'Shift context',compare:true}];
  setup.mapping.shift=null;
  const r=calculateFile(file,0,setup);
  const compared=compareCalculatedRuns(run(r),run(r,'E-04'),setup);
  assert.equal(compared.checks.find(c=>c.label==='Input quantity')!.state,'match');
  assert.equal(compared.checks.find(c=>c.label==='Shift context')!.state,'different');
  assert.equal(compared.care,true);
  assert.equal(compared.checks.find(c=>c.label==='Product')!.state,'not-assessed');
  setup.tolerance=199;assert.equal(compareCalculatedRuns(run(r),run(r,'E-04'),setup).checks.find(c=>c.label==='Input quantity')!.state,'different');
});
test('structural exclusions, unknown words and unmapped quantities have explicit reasons',async()=>{
  const {file,setup}=await read('run_id,event_type,quantity\nR1,MATERIAL_IN,100\nR1,SCRAP,5\n\nrun_id,event_type,quantity\nTotal,,105\nR1,OTHER,3');
  setup.mapping.quantity=null;
  const r=calculateFile(file,0,setup);
  assert.ok(r.excluded.some(e=>e.row.line===4&&e.reason.includes('Empty')));
  assert.ok(r.excluded.some(e=>e.row.line===5&&e.reason.includes('header')));
  assert.ok(r.excluded.some(e=>e.row.line===6&&e.reason.includes('totals')));
  assert.ok(run(r,'R1').issues.some(i=>i.code==='unknown-activity'));
  assert.match(measure(r,'scrap','R1').reason,/not mapped/);
});
test('negative duration differences have unambiguous units',()=>{
  assert.equal(formatCalculated({value:-0.75,unit:'hours',state:'available'}),'−45 min');
});
test('decimal tolerance equality survives floating-point subtraction',async()=>{
  const {file,setup}=await sample();set(file,2,9,'0.1');set(file,6,9,'0.2');setup.tolerance=0.1;
  let r=calculateFile(file,0,setup);
  assert.equal(compareCalculatedRuns(run(r),run(r,'E-02'),setup).checks.find(c=>c.label==='Input quantity')!.state,'match');
  set(file,2,9,'0.2');set(file,6,9,'0.3');r=calculateFile(file,0,setup);
  assert.equal(compareCalculatedRuns(run(r),run(r,'E-02'),setup).checks.find(c=>c.label==='Input quantity')!.state,'match');
});
test('saved Excel numeric results and interpreted serial dates retain original evidence',async()=>{
  const {file,setup}=await sample();
  const row=file.sheets[0].rows[3];row.cells[9]={address:'J4',raw:50,display:'50',formula:'25*2'};
  const timed=file.sheets[0].rows[4];
  timed.cells[7]={address:'H5',raw:46302.25,display:'46302.25',date:'2026-10-07 06:00:00'};
  timed.cells[8]={address:'I5',raw:46302.4166666667,display:'46302.4166666667',date:'2026-10-07 10:00:00'};
  const r=calculateFile(file,0,setup);
  assert.equal(metric(r,'scrap-rate').value,5);
  assert.equal(metric(r,'changeover').value,4);
  assert.equal(metric(r,'changeover').evidence.used[0].row.cells[7].raw,46302.25);
  assert.ok(metric(r,'scrap-rate').evidence.notes.some(n=>n.includes('without recalculation')));
});
