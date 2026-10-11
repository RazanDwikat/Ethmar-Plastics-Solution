import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {parseFormula,evaluateFormula,bindFormula,formulaProblems,previewFormula} from './custom-formula';
import {defaultSetup,setupProblems,type Measurement,type Setup,type Profile} from './setup';
import {parseBytes,inspectSheet} from './inspection';
import {samples} from './samples';
import {calculateFile,formatCalculated} from './calculation-engine';
import {checkCompatibility,calculateCompatible} from './compatibility';
import {importSetupJson} from './profile-transfer';
import {exportComparisonCsv} from './comparison-tools';
const parse=(text:string)=>parseBytes(new TextEncoder().encode(text).buffer,'formula.csv');
async function fixture(index=0){
 const file=await parse(samples[index].csv),i=inspectSheet(file.sheets[0],'.'),setup=defaultSetup(i);
 return {file,setup,headers:i.headers,header:i.headerLine};
}
function add(s:Setup,formula:string,patch:Partial<Measurement>={}){
 const m:Measurement={id:'formula',label:'Custom result',template:'Custom formula',a:'',b:'',exampleA:12,exampleB:3,required:false,formula,outputUnit:'number',decimals:2,...patch};
 s.measurements.push(m);m.formulaBindings=bindFormula(formula,s,m);return m;
}
test('parser honors precedence, parentheses, negative constants and typed multiplication',()=>{
 assert.equal(evaluateFormula(parseFormula('-(2 + 3) x 4 / 2 + .5'),()=>0),-9.5);
 assert.equal(evaluateFormula(parseFormula('2 + 3 * 4'),()=>0),14);
 for(const text of ['Math.random()','alert(1)','1;2','1**2','[Scrap total].constructor','1 < 3','1 ? 2 : 3','sum([x])']){
  assert.throws(()=>parseFormula(text),undefined,text);
 }
 assert.throws(()=>parseFormula('(1+2'),/Missing closing/);assert.throws(()=>parseFormula('1 2'),/operator/);
 assert.throws(()=>parseFormula('('.repeat(60)+'1'+')'.repeat(60)),/nested/);
 assert.throws(()=>evaluateFormula(parseFormula('1 / 0'),()=>0),/divisor is zero/);
});
test('custom formulas calculate per-run totals and preserve original standard numbers',async()=>{
 const {file,setup,header}=await fixture(),before=structuredClone(file);
 add(setup,'[Scrap total] / [Material input total] * 100',{outputUnit:'percent',decimals:1});
 const report=calculateFile(file,0,setup,header),a=report.runs[0],b=report.runs[1];
 assert.equal(a.metrics.at(-1)!.value,5);assert.equal(b.metrics.at(-1)!.value,10);
 assert.equal(formatCalculated(a.metrics.at(-1)!),'5.0%');
 assert.equal(b.metrics.find(m=>m.id==='downtime')!.value,.75);
 assert.deepEqual(file,before);
 assert.match(a.metrics.at(-1)!.evidence.formula,/\(50\).*\/.*\(1,000\)/);
 assert.equal(a.metrics.at(-1)!.evidence.parts!.length,2);
 assert.ok(a.metrics.at(-1)!.evidence.used.some(e=>e.reason.includes('Scrap')));
});
test('multiple events are summed before division, duplicates count once and counts independent',async()=>{
 const {file,setup,header}=await fixture();
 const source=file.sheets[0].rows[3],copy=structuredClone(source);copy.line=100;copy.cells[0].raw='OTHER_SCRAP';copy.cells[setup.mapping.quantity!].raw=50;file.sheets[0].rows.push(copy);
 add(setup,'[Scrap total] / [Material input total]');
 assert.equal(calculateFile(file,0,setup,header).runs[0].metrics.at(-1)!.value,.1);
 const f=await fixture(1);add(f.setup,'[Scrap count]');
 assert.equal(calculateFile(f.file,0,f.setup,f.header).runs[0].metrics.at(-1)!.value,1);
});
test('nested measurement references resolve independent of order and collect all source rows',async()=>{
 const {file,setup,header}=await fixture();
 const child=add(setup,'[Scrap total] / [Material input total] * 100',{id:'child',label:'Waste'});
 const parent=add(setup,'[Waste measurement] + [Good output total]',{id:'parent'});
 setup.measurements=[parent,...setup.measurements.filter(m=>m.id!=='parent')];
 const r=calculateFile(file,0,setup,header).runs[0],v=r.metrics[0];
 assert.equal(v.value,955);assert.equal(v.evidence.used.length,3);
 child.label='Renamed waste';setup.events.find(e=>e.id==='scrap')!.label='Renamed scrap';
 assert.equal(calculateFile(file,0,setup,header).runs[0].metrics[0].value,955);
});
test('invalid/circular/deleted sources rejected; no silent zero or evaluation shortcuts',async()=>{
 const {file,setup,header,headers}=await fixture();
 const m=add(setup,'[No such source]');
 assert.match(setupProblems(setup,headers).errors.join(' '),/Unknown name/);
 m.formula='[Custom result measurement]';m.formulaBindings=bindFormula(m.formula,setup,m);
 assert.match(formulaProblems(setup).join(' '),/Circular/);
 m.formula='[Good output total]';m.formulaBindings=bindFormula(m.formula,setup,m);setup.events=setup.events.filter(e=>e.id!=='good');
 assert.match(formulaProblems(setup).join(' '),/removed/);
 assert.throws(()=>calculateFile(file,0,setup,header),/Review your setup/);
});
test('indirect circular references detected',async()=>{
 const {setup}=await fixture();
 const a=add(setup,'1',{id:'a',label:'A'}),b=add(setup,'[A measurement]',{id:'b',label:'B'});
 a.formula='[B measurement]';a.formulaBindings=bindFormula(a.formula,setup,a);
 assert.match(formulaProblems(setup).join(' '),/Circular/);
});
test('unavailable input remains unavailable even when multiplied by zero; zero division is explicit',async()=>{
 const {file,setup,header}=await fixture(1);add(setup,'0 * [Material input total]');
 assert.match(calculateFile(file,0,setup,header).runs[1].metrics.at(-1)!.reason,/Missing Material input total/);
 setup.measurements.at(-1)!.formula='[Good output total] / (2 - 2)';
 const v=calculateFile(file,0,setup,header).runs[0].metrics.at(-1)!;
 assert.equal(v.value,null);assert.equal(v.evidence.formula,"Can't calculate: divisor is zero");
});
test('Required follows nested dependencies, Count remains independent of quantities',async()=>{
 const {file,setup,headers,header}=await fixture();
 setup.measurements.forEach(m=>m.required=false);
 add(setup,'[Material input total]',{id:'child',label:'Input'});
 const parent=add(setup,'[Input measurement] * 2',{id:'parent',required:true});
 file.sheets[0].rows=file.sheets[0].rows.filter(r=>r.cells[setup.mapping.eventType!]?.raw!=='MATERIAL_IN');
 const profile:Profile={id:'p',name:'P',headers,headerLine:header,setup,savedAt:'now'};
 assert.equal(checkCompatibility(file,0,profile).state,'blocked');
 parent.required=false;assert.equal(checkCompatibility(file,0,profile).state,'notes');
 const f=await fixture();f.setup.measurements=[];add(f.setup,'[Scrap count]',{required:true});
 const col=f.setup.mapping.quantity!;for(const row of f.file.sheets[0].rows)row.cells.splice(col,1);
 const p={...profile,headers:f.headers,setup:f.setup};const c=checkCompatibility(f.file,0,p);
 assert.equal(c.state,'notes');assert.equal(calculateCompatible(f.file,0,c).runs[0].metrics[0].value,1);
});
test('combined durations retain each part and overlap warnings in evidence and export',async()=>{
 const {file,setup,header}=await fixture(2);
 add(setup,'[Changeover total] + [Unplanned downtime total]',{outputUnit:'hours'});
 const r=calculateFile(file,0,setup,header),v=r.runs[1].metrics.at(-1)!;
 assert.equal(v.evidence.parts!.length,2);
 assert.ok(v.evidence.notes.some(n=>/overlap/.test(n)));
 assert.equal(r.runs[1].measures.find(m=>m.id==='changeover')!.value,6);
 assert.match(exportComparisonCsv(r,r.runs[0],r.runs[1]),/overlap/);
});
test('units label the explicit arithmetic and decimals round display, not saved values',async()=>{
 const {file,setup,header}=await fixture();
 const m=add(setup,'[Changeover total] * 60',{outputUnit:'minutes',decimals:0});
 let v=calculateFile(file,0,setup,header).runs[0].metrics.at(-1)!;assert.equal(formatCalculated(v),'240 min');
 m.formula='1 / 3';m.decimals=2;m.outputUnit='number';
 v=calculateFile(file,0,setup,header).runs[0].metrics.at(-1)!;assert.equal(v.value,1/3);assert.equal(formatCalculated(v),'0.33');
});
test('preview examples, saved JSON and imports preserve required/formula/display/headline settings',async()=>{
 const {setup,headers,header}=await fixture();const m=add(setup,'[Scrap total] / [Material input total] * 100',{required:true,headline:true,outputUnit:'percent',decimals:3});
 assert.equal(previewFormula(m,setup).value,5);m.formulaExamples={'Scrap total':100};assert.equal(previewFormula(m,setup).value,10);
 const original:Profile={id:'p',name:'P',setup,headers,headerLine:header,savedAt:'now'};
 assert.deepEqual(importSetupJson(JSON.stringify(original)),original);
 m.formula='alert(1)';assert.throws(()=>importSetupJson(JSON.stringify(original)),/needs correction/);
});
