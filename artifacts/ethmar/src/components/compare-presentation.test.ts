import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseBytes, inspectSheet } from '../lib/inspection';
import { defaultSetup } from '../lib/setup';
import { calculateFile } from '../lib/calculation-engine';
import { exportComparisonCsv } from '../lib/comparison-tools';
import { samples } from '../lib/samples';
import { comparisonValues, displayHealth, displayValue, shortAnswer, visibleIssues, usedCellAddresses, operandExpressions } from './compare-presentation';
import { prepareFile } from '../lib/preparation';

test('prepared calculation addresses highlight original operand columns by lineage',async()=>{
 const file=await parseBytes(new TextEncoder().encode('run_id,input_kg,good_kg,scrap_kg\nA,0.2,0.184,0.016').buffer,'original.csv');
 const prepared=prepareFile(file,0,{version:1,steps:[{id:'input',kind:'multiply',column:'input_kg',factor:1000},{id:'scrap',kind:'multiply',column:'scrap_kg',factor:1000}]});
 const report=calculateFile(prepared.file,0,defaultSetup(inspectSheet(prepared.file.sheets[0],'.')));
 const value=report.runs[0].metrics.find(v=>v.id==='scrap-rate')!;
 const addresses=usedCellAddresses(value.evidence.used,operandExpressions(value,report));
 assert.ok(addresses.includes('prepared:input_kg:2'));
 assert.ok(addresses.includes('prepared:scrap_kg:2'));
 const origins=value.evidence.used.flatMap(e=>e.row.cells.filter(c=>addresses.includes(c.address)).flatMap(c=>c.trace?.origins.map(o=>o.address)??[]));
 assert.ok(origins.includes('B2'));assert.ok(origins.includes('D2'));
});

async function fixture(){
 const file=await parseBytes(new TextEncoder().encode(samples[0].csv).buffer,'original.csv');
 return calculateFile(file,0,defaultSetup(inspectSheet(file.sheets[0],'.')));
}
test('presentation treats absent downtime neutrally without modifying engine or export',async()=>{
 const report=await fixture(),[a,b]=report.runs;
 const before=JSON.stringify(report),csv=exportComparisonCsv(report,a,b);
 assert.equal(a.health,'note');
 assert.equal(displayHealth(a),'clear');
 assert.equal(visibleIssues(a.issues).length,0);
 assert.equal(displayValue(a.measures.find(v=>v.id==='downtime')!),'Not recorded');
 assert.equal(JSON.stringify(report),before);
 assert.equal(exportComparisonCsv(report,a,b),csv);
});
test('all numbers includes each default measurement once and retains custom templates and labels',async()=>{
 const report=await fixture(),run=report.runs[0];
 assert.deepEqual(comparisonValues(run,report).map(v=>v.id),['material','good','scrap','scrap-rate','changeover','downtime']);
 report.setup.measurements.push({...report.setup.measurements[0],id:'custom-count',label:'Accepted records',template:'Count'});
 const next=calculateFile(report.source,0,report.setup);
 assert.ok(comparisonValues(next.runs[0],next).some(v=>v.label==='Accepted records'));
 assert.equal(comparisonValues(next.runs[0],next).length,7);
});
test('answer is two sentences with rates, changeover and separate recorded downtime',async()=>{
 const report=await fixture(),[a,b]=report.runs,answer=shortAnswer(a,b,report);
 assert.match(answer,/10% versus 5%/);
 assert.match(answer,/E-02 recorded more scrap rate/);
 assert.match(answer,/E-02's changeover was longer/);
 assert.match(answer,/6 h versus 4 h/);
 assert.match(answer,/45 min/);
 assert.equal(answer.split('.').filter(s=>s.trim()).length,2);
 assert.doesNotMatch(answer,/no stop recorded|cause/i);
});
test('only downtime absence is filtered; other missing values remain issues',()=>{
 const issues=[{code:'not-logged',level:'note' as const,message:'No changeover',lines:[],definitionIds:['changeover']},{code:'missing-number',level:'missing' as const,message:'Missing input',lines:[8],definitionIds:['material']}];
 assert.deepEqual(visibleIssues(issues),issues);
});
test('answer relates shorter and equal changeover to the run with more scrap',async()=>{
 const report=await fixture(),[a,b]=report.runs;
 b.measures.find(v=>v.id==='changeover')!.value=2;
 assert.match(shortAnswer(a,b,report),/E-02's changeover was shorter/);
 b.measures.find(v=>v.id==='changeover')!.value=4;
 assert.match(shortAnswer(a,b,report),/E-02's changeover was equal in duration/);
});
