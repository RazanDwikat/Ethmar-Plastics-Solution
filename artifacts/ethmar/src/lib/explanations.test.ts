import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseBytes, inspectSheet } from './inspection';
import { defaultSetup } from './setup';
import { samples } from './samples';
import { calculateFile, type DataIssue } from './calculation-engine';
import { affectedLabels, attributeExplanation, healthExplanation, issueExplanation, unassessedExplanation, valueExplanation } from './explanations';

async function fixture(){
 const file=await parseBytes(new TextEncoder().encode(samples[0].csv).buffer,'tooltip-source.csv');
 return calculateFile(file,0,defaultSetup(inspectSheet(file.sheets[0],file.decimal)));
}
test('issue explanation retains exact source message, actual values, lines and dependent ratio',async()=>{
 const report=await fixture();
 const issue:DataIssue={code:'conflict',level:'missing',message:'Material values disagree: 840 kg and 730 kg.',lines:[2,8],definitionIds:['material']};
 const text=issueExplanation(issue,report);
 assert.ok(text.startsWith(issue.message.slice(0,-1)));
 assert.match(text,/840 kg and 730 kg/);
 assert.match(text,/tooltip-source.csv/);
 assert.match(text,/lines 2, 8/);
 assert.ok(affectedLabels(issue,report.setup).includes(report.setup.measurements.find(m=>m.id==='scrap-rate')!.label));
});
test('both ratio operands identify the dependent metric; unrelated definitions do not',async()=>{
 const {setup}=await fixture(),ratio=setup.measurements.find(m=>m.id==='scrap-rate')!;
 for(const id of [ratio.a,ratio.b])assert.ok(affectedLabels({code:'test',level:'note',message:'Review',lines:[],definitionIds:[id]},setup).includes(ratio.label));
 assert.ok(!affectedLabels({code:'test',level:'note',message:'Review',lines:[],definitionIds:['downtime']},setup).includes(ratio.label));
});
test('file-wide issues explain all configured affected numbers without inventing source lines',async()=>{
 const report=await fixture(),issue:DataIssue={code:'mapping',level:'note',message:'No event ID is mapped.',lines:[],definitionIds:[]};
 const text=issueExplanation(issue,report);
 for(const metric of report.setup.measurements)assert.ok(text.includes(metric.label));
 assert.match(text,/setup-level check/);
});
test('multiple issue tooltip uses first exact detail plus count and full-details affordance',async()=>{
 const report=await fixture();
 const first:DataIssue={code:'first',level:'note',message:'Duplicate: values 16 and 16.',lines:[2,3],definitionIds:['scrap']};
 const second:DataIssue={...first,code:'second',message:'Second issue.'};
 const text=healthExplanation([first,second],report,'run E-01');
 assert.match(text,/2 issues/);
 assert.ok(text.includes(issueExplanation(first,report)));
 assert.match(text,/Click to see all \(2\)/);
 assert.ok(!text.includes(second.message));
});
test('clear status names audited scope and limits',async()=>{
 const report=await fixture(),text=healthExplanation([],report,'run E-01');
 assert.match(text,/run E-01/);assert.match(text,/Only configured checks/);assert.match(text,/not a guarantee/);
});
test('unavailable value uses same dependency issue explanation as full details',async()=>{
 const report=await fixture(),run=report.runs[0],value=run.metrics.find(m=>m.id==='scrap-rate')!;
 const issue:DataIssue={code:'bad-input',level:'missing',message:'Material 840 conflicts with 730.',lines:[2,8],definitionIds:['material']};
 run.issues=[issue];
 assert.ok(valueExplanation({...value,state:'unavailable',reason:'Input conflict.',value:null},report,run).includes(issueExplanation(issue,report)));
 const stop=run.measures.find(m=>m.id==='downtime')!;
 assert.match(valueExplanation(stop,report,run),/No record is not zero/);
});
test('attribute explanation preserves actual values and check result',()=>{
 const text=attributeExplanation({label:'Input quantity',state:'different',baseline:'840 kg',compared:'730 kg',reason:'Absolute difference 110 kg; tolerance 12 kg.'});
 assert.match(text,/840 kg/);assert.match(text,/730 kg/);assert.match(text,/110 kg; tolerance 12 kg/);
});
test('unassessed picker field identifies original run source scope',async()=>{
 const report=await fixture(),text=unassessedExplanation('Product',report.runs[0],report);
 assert.match(text,/Product/);assert.match(text,/tooltip-source.csv/);assert.match(text,/lines /);
});
