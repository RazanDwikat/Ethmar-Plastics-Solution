import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {parseBytes,inspectSheet} from './inspection';
import {samples} from './samples';
import {defaultSetup,defaultSynonyms,suggestMapping,applyProfile,setupProblems,exampleResult,templates,type Profile} from './setup';
async function sample(index=0){
  const file=await parseBytes(new TextEncoder().encode(samples[index].csv).buffer,'test.csv');
  const inspection=inspectSheet(file.sheets[0],file.decimal);
  return {file,inspection,setup:defaultSetup(inspection)};
}
test('event defaults suggest normalized roles without changing source data',async()=>{
  const {file,inspection,setup}=await sample();
  const before=JSON.stringify(file.sheets);
  assert.equal(setup.shape,'event');
  assert.equal(setup.mapping.runId,2);
  assert.equal(setup.groupBy,'runId');
  assert.equal(setup.mapping.product,null);
  assert.equal(setup.tolerance,0);
  assert.deepEqual(setupProblems(setup,inspection.headers).errors,[]);
  assert.equal(JSON.stringify(file.sheets),before);
  assert.equal(suggestMapping([' RUN-ID '],defaultSynonyms).runId,0);
  assert.equal(suggestMapping(['RUN-ID','run id'],defaultSynonyms).runId,null);
});
test('run summary defaults map each quantity/duration with cleaning labels',async()=>{
  const {inspection,setup}=await sample(3);
  assert.equal(setup.shape,'run');
  assert.equal(setup.events.find(e=>e.id==='material')!.column,5);
  assert.equal(setup.events.find(e=>e.id==='changeover')!.label,'Cleaning time');
  assert.equal(setup.events.find(e=>e.id==='changeover')!.timing,'duration');
  assert.equal(setup.events.find(e=>e.id==='changeover')!.durationColumn,8);
  assert.deepEqual(setupProblems(setup,inspection.headers).errors,[]);
});
test('synonyms support Arabic and duplicate headers are never guessed',()=>{
  const synonyms=structuredClone(defaultSynonyms);
  synonyms.runId.push('معرّف العملية');
  assert.equal(suggestMapping(['معرّف العملية'],synonyms).runId,0);
  assert.equal(suggestMapping(['معرّف العملية','معرّف العملية'],synonyms).runId,null);
});
test('profile reuse remaps reordered columns, preserves exact event words and settings',async()=>{
  const {inspection,setup}=await sample();
  setup.events[0].values=['مواد','MATERIAL_IN'];
  setup.unit='liters';setup.tolerance=5;
  setup.customFields=[{id:'custom',column:11,label:'Customer',compare:true}];
  const headers=[...inspection.headers,'customer'];
  const profile:Profile={id:'p',name:'Arabic',savedAt:'2026-10-10',headers,setup};
  const reversed=[...headers].reverse();
  const applied=applyProfile(profile,reversed);
  assert.equal(applied.setup.mapping.runId,reversed.indexOf('run_id'));
  assert.equal(applied.setup.customFields[0].column,0);
  assert.equal(applied.setup.unit,'liters');
  assert.equal(applied.setup.tolerance,5);
  assert.deepEqual(applied.setup.events[0].values,['مواد','MATERIAL_IN']);
  assert.deepEqual(applied.notes,[]);
  assert.equal(profile.setup.mapping.runId,2);
  const missing=applyProfile(profile,['unrelated']);
  assert.equal(missing.setup.mapping.runId,null);
  assert.equal(missing.setup.customFields[0].column,-1);
  assert.ok(missing.notes.some(n=>n.includes('customer')));
  assert.ok(setupProblems(missing.setup,['unrelated']).errors.length);
});
test('invalid settings and exact event value conflicts require attention',async()=>{
  const {inspection,setup}=await sample();
  setup.tolerance=-1;setup.events[1].values=['MATERIAL_IN'];
  setup.mapping.runId=null;
  setup.customFields=[{id:'x',column:4,label:'Same as mold',compare:true}];
  const problems=setupProblems(setup,inspection.headers);
  assert.ok(problems.errors.some(x=>x.includes('tolerance')));
  assert.ok(problems.errors.some(x=>x.includes('more than once')));
  assert.ok(problems.errors.some(x=>x.includes('run ID')));
  assert.ok(problems.errors.some(x=>x.includes('already mapped')));
});
test('profile preserves deliberate unmapped roles when a column becomes a custom field',async()=>{
  const {inspection,setup}=await sample();
  const machineColumn=setup.mapping.machine!;
  setup.mapping.machine=null;
  setup.customFields=[{id:'custom-machine',column:machineColumn,label:'Recorded equipment',compare:true}];
  const profile:Profile={id:'p',name:'Custom context',savedAt:'2026-10-10',headers:inspection.headers,setup};
  const reordered=[...inspection.headers].reverse();
  const result=applyProfile(profile,reordered);
  assert.equal(result.setup.mapping.machine,null);
  assert.equal(result.setup.customFields[0].column,reordered.indexOf('machine'));
  assert.deepEqual(setupProblems(result.setup,reordered).errors,[]);
  assert.deepEqual(result.notes,[]);
});
test('missing measures remain explicit notes, never replaced with zero',async()=>{
  const {inspection,setup}=await sample(3);
  setup.events[2].column=null;
  setup.events[3].durationColumn=null;
  const p=setupProblems(setup,inspection.headers);
  assert.deepEqual(p.errors,[]);
  assert.ok(p.notes.some(x=>x.includes('unavailable')));
  assert.ok(p.notes.some(x=>x.includes('not zero')));
});
test('all seven templates have interactive illustrative examples, without run calculations',async()=>{
  const {setup}=await sample();
  for(const template of templates.filter(t=>t!=='Custom formula')){
    const m={...setup.measurements[0],template,exampleA:50,exampleB:10};
    const first=exampleResult(m),second=exampleResult({...m,exampleA:100});
    assert.notEqual(first,second);
  }
  assert.match(exampleResult({...setup.measurements[0],exampleB:0}),/zero/);
  assert.match(exampleResult({...setup.measurements[0],template:'Average',exampleB:1.5}),/whole/);
});
