import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {parseBytes,inspectSheet,type ImportedFile} from './inspection';
import {defaultSetup,isMeasurementRequired,normalizeRequirements,type Profile} from './setup';
import {samples} from './samples';
import {checkCompatibility,calculateCompatible} from './compatibility';
import {similarHeaders} from './measurement-requirements';
import {validateSavedData} from './saved-data-validation';
import {compareCalculatedRuns} from './calculation-comparison';
import {exportComparisonCsv} from './comparison-tools';
const read=(csv:string)=>parseBytes(new TextEncoder().encode(csv).buffer,'required.csv');
async function fixture(index=0){const file=await read(samples[index].csv),i=inspectSheet(file.sheets[0],file.decimal);return {file,profile:{id:'p',name:'Requirements',savedAt:'now',headers:i.headers,headerLine:i.headerLine,setup:defaultSetup(i),confirmed:true} as Profile};}
function remove(file:ImportedFile,header:string){const col=file.sheets[0].rows[0].cells.findIndex(c=>c.raw===header);assert.ok(col>=0);for(const row of file.sheets[0].rows)row.cells.splice(col,1);}
test('legacy defaults survive renamed labels and explicit false, invalid required values rejected',async()=>{
 const {profile}=await fixture(),m=profile.setup.measurements[0];delete m.required;m.label='Waste percentage';
 assert.equal(isMeasurementRequired(m),true);m.required=false;
 assert.equal(normalizeRequirements(profile.setup).measurements[0].required,false);
 const exported=JSON.parse(JSON.stringify(profile));validateSavedData(null,[exported]);assert.equal(exported.setup.measurements[0].required,false);
 exported.setup.measurements[0].required='yes';assert.throws(()=>validateSavedData(null,[exported]));
});
test('whole-file required quantity loss blocks with advisory header suggestion and immutable profile',async()=>{
 const {file,profile}=await fixture(),before=structuredClone(profile);
 file.sheets[0].rows[0].cells[profile.setup.mapping.quantity!].raw='quantity_kgs';
 file.sheets[0].rows[0].cells[profile.setup.mapping.quantity!].display='quantity_kgs';
 const check=checkCompatibility(file,0,profile);
 assert.equal(check.state,'blocked');assert.match(check.differences.join(' '),/Required measurement “Scrap rate”/);
 assert.match(check.differences.join(' '),/quantity_kg.*Similar column: “quantity_kgs”/);
 assert.equal(check.setup.mapping.quantity,null);assert.deepEqual(profile,before);
});
test('whole-file required event missing blocks, one-run absence allows other runs normal',async()=>{
 const {file,profile}=await fixture();
 const partial=await read(samples[1].csv),check=checkCompatibility(partial,0,profile);
 assert.equal(check.state,'notes');const report=calculateCompatible(partial,0,check);
 assert.equal(report.runs[0].metrics[0].value,5);assert.equal(report.runs[1].metrics[0].value,null);
 const col=profile.setup.mapping.eventType!;
 for(const alias of ['MATERIAL_IN','SCRAP']){
  const absent=structuredClone(file);absent.sheets[0].rows=absent.sheets[0].rows.filter(r=>r.cells[col]?.raw!==alias);
  assert.equal(checkCompatibility(absent,0,profile).state,'blocked');
 }
 profile.setup.events[0].values.push('INPUT');file.sheets[0].rows.forEach(r=>{if(r.cells[col]?.raw==='MATERIAL_IN')r.cells[col].raw='INPUT'});
 assert.equal(checkCompatibility(file,0,profile).state,'matches');
});
test('optional whole-file columns/events retain independent values and explicit unavailable exports',async()=>{
 const {file,profile}=await fixture(3);
 profile.setup.measurements[0].required=false;remove(file,'input_kg');
 const check=checkCompatibility(file,0,profile);assert.equal(check.state,'notes');
 const report=calculateCompatible(file,0,check),[a,b]=report.runs;
 assert.equal(a.metrics[0].value,null);assert.notEqual(a.measures.find(v=>v.id==='good')!.value,null);
 assert.match(exportComparisonCsv(report,a,b),/Missing column.*input_kg/);
 const e=await fixture();e.file.sheets[0].rows=e.file.sheets[0].rows.filter(r=>r.cells[e.profile.setup.mapping.eventType!]?.raw!=='CHANGEOVER');
 let c=checkCompatibility(e.file,0,e.profile);assert.equal(c.state,'notes');
 assert.equal(calculateCompatible(e.file,0,c).runs[0].metrics[1].state,'unavailable');
 e.profile.setup.measurements[1].required=true;c=checkCompatibility(e.file,0,e.profile);assert.equal(c.state,'blocked');
});
test('missing context and custom fields is not a schema error; no calculated numbers lost',async()=>{
 const {file,profile}=await fixture();
 profile.setup.customFields.push({id:'extra',column:profile.headers.length,label:'Operator',compare:true});profile.headers.push('operator');
 remove(file,'mold');
 const c=checkCompatibility(file,0,profile);assert.equal(c.state,'notes');
 const r=calculateCompatible(file,0,c);assert.equal(r.runs[1].metrics[0].value,10);
 assert.equal(compareCalculatedRuns(r.runs[0],r.runs[1],r.setup).checks.find(c=>c.label==='Operator')!.state,'not-assessed');
});
test('Count does not require quantity; structural identity always required',async()=>{
 const {file,profile}=await fixture();
 profile.setup.measurements=[{...profile.setup.measurements[0],template:'Count',a:'scrap',b:'',required:true}];
 remove(file,'quantity_kg');
 let c=checkCompatibility(file,0,profile);assert.equal(c.state,'notes');
 assert.equal(calculateCompatible(file,0,c).runs[0].metrics[0].value,1);
 remove(file,'run_id');c=checkCompatibility(file,0,profile);assert.equal(c.state,'blocked');
});
test('bad independent run-row number cannot erase valid quantities or silently undercount',async()=>{
 const {file,profile}=await fixture(3),col=profile.setup.events.find(e=>e.id==='changeover')!.durationColumn!;
 file.sheets[0].rows[1].cells[col].raw='bad';
 const c=checkCompatibility(file,0,profile);assert.equal(c.state,'notes');
 const r=calculateCompatible(file,0,c);
 assert.equal(r.runs[0].metrics[1].value,null);assert.notEqual(r.runs[0].metrics[0].value,null);assert.notEqual(r.runs[0].metrics[3].value,null);
});
test('all optional allows absent event definitions without guessing; similar names never force a match',async()=>{
 const {file,profile}=await fixture();profile.setup.measurements.forEach(m=>m.required=false);
 file.sheets[0].rows.slice(1).forEach(r=>{r.cells[profile.setup.mapping.eventType!].raw='OTHER'});
 assert.equal(checkCompatibility(file,0,profile).state,'notes');
 assert.deepEqual(similarHeaders('input_kg',['unrelated']),[]);
 assert.deepEqual(similarHeaders('input_kg',['inputkgs','inputkgz']).length,2);
});
test('required custom templates use only their actual operands, not unused configured sources',async()=>{
 for(const template of ['Ratio','Difference','Rate per hour','Total','Average','Count','Duration'] as const){
  const {file,profile}=await fixture(3);
  const timed=template==='Duration'||template==='Rate per hour';
  const event=profile.setup.events.find(e=>e.id===(timed?'changeover':'material'))!;
  const column=timed?event.durationColumn!:event.column!;
  const header=profile.headers[column];remove(file,header);
  profile.setup.measurements=[{id:'custom',label:'Custom required',template,a:template==='Duration'?'changeover':'good',b:timed?'changeover':'material',exampleA:1,exampleB:1,required:true}];
  const check=checkCompatibility(file,0,profile);
  assert.equal(check.state,['Ratio','Difference','Rate per hour','Duration'].includes(template)?'blocked':'notes',template);
 }
});
