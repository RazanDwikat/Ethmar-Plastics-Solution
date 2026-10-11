import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {parseBytes,inspectSheet} from './inspection';
import {defaultSetup} from './setup';
import {calculateFile} from './calculation-engine';
import {samples} from './samples';
import {possibleExplanations,hypothesisTitle} from './hypotheses';
import {exportComparisonCsv,comparisonPrintHtml} from './comparison-tools';
import {importSetupJson} from './profile-transfer';
import {explanationSummary} from './explanation-summary';
async function fixture(index=0){
 const file=await parseBytes(new TextEncoder().encode(samples[index].csv).buffer,'rules.csv'),inspection=inspectSheet(file.sheets[0],'.');
 const setup=defaultSetup(inspection);
 const calculate=()=>calculateFile(file,0,setup,inspection.headerLine);
 return {file,setup,inspection,calculate};
}
test('summary consolidates values, keeps clear differences and all original rules',async()=>{
 const f=await fixture(),r=f.calculate(),[a,b]=r.runs,s=explanationSummary(r,a,b);
 assert(s.differences.some(d=>d.text.includes('5 percentage points higher in E-02')));
 assert(s.differences.some(d=>d.text.includes('2 h higher in E-02')));
 assert(s.differences.some(d=>d.text.includes('Not logged')&&d.text.includes('No comparison')));
 assert.equal(new Set(s.checks).size,s.checks.length);
 assert.deepEqual(s.items,possibleExplanations(r,a,b));
 const attrs=explanationSummary(r,a,r.runs[3]);
 assert(!attrs.context.join(' ').includes('Scrap rate ='));
 const csv=exportComparisonCsv(r,a,b),html=comparisonPrintHtml(r,a,b);
 for(const item of s.items){assert(csv.includes(item.id.split(':')[0]==='co'?'co-occurrence':item.rule));assert(html.includes(item.check));}
 assert(csv.includes('5 percentage points higher in E-02'));
 assert(html.includes('What is different?'));
});
test('summary explains missing values and gives no invented factor when rules do not match',async()=>{
 const f=await fixture(1),r=f.calculate(),[a,b]=r.runs,s=explanationSummary(r,a,b);
 const missing=s.differences.find(d=>d.id===a.metrics[0].id)!;
 assert(missing.text.includes("Can't calculate"));
 assert(missing.text.includes(b.metrics[0].reason));
 assert(s.context[0].includes('data-quality'));
 const equal={...a,id:'other',measures:a.measures.filter(m=>m.id!=='downtime'),issues:[]};
 const clean={...a,issues:[]};
 assert(explanationSummary(r,clean,equal).context.some(c=>c.includes('No possible explanation')));
 assert(explanationSummary(r,a,a).context[0].includes('same run'));
});
test('attribute differences require a differing measurement and retain original context evidence',async()=>{
 const f=await fixture();f.setup.attributeChecks={machine:'Verify equipment records.'};
 const r=f.calculate(),[a,,,b]=r.runs,items=possibleExplanations(r,a,b).filter(x=>x.rule==='attribute');
 assert(items.some(x=>x.facts.includes('EX-07')&&x.check==='Verify equipment records.'));
 assert(items.every(x=>x.evidence[0].value.evidence.used.length===a.rows.length));
 const equal={...b,metrics:a.metrics};
 assert.equal(possibleExplanations(r,a,equal).filter(x=>x.rule==='attribute').length,0);
});
test('stop rule uses configured display names and recorded durations, not absent zero',async()=>{
 const f=await fixture();f.setup.events.find(x=>x.id==='downtime')!.label='Unexpected pause';
 const r=f.calculate(),items=possibleExplanations(r,r.runs[0],r.runs[1]).filter(x=>x.rule==='stop');
 assert.equal(items.length,1);assert.match(items[0].facts,/Unexpected pause.*45 min/);
});
test('timing rules include overlap, near endpoints and exclude distant times',async()=>{
 const f=await fixture(),r=f.calculate();
 assert.equal(possibleExplanations(r,r.runs[0],r.runs[1]).filter(x=>x.rule==='timing').length,0);
 const row=f.file.sheets[0].rows.find(r=>r.cells.some(c=>c.raw==='EV-009'))!;
 row.cells[7]={...row.cells[7],raw:'2026-10-08 12:10',display:'2026-10-08 12:10'};
 let report=f.calculate();
 assert.match(possibleExplanations(report,...report.runs.slice(0,2) as [typeof r.runs[0],typeof r.runs[0]]).find(x=>x.rule==='timing')!.facts,/10 min apart/);
 row.cells[7]={...row.cells[7],raw:'2026-10-08 11:45',display:'2026-10-08 11:45'};
 report=f.calculate();
 assert.match(possibleExplanations(report,report.runs[0],report.runs[1]).find(x=>x.rule==='timing')!.facts,/overlap by 15 min/);
});
test('data issues link affected measurements, precede attributes, and do not copy check paragraphs',async()=>{
 const f=await fixture(1),r=f.calculate(),items=possibleExplanations(r,r.runs[0],r.runs[1]);
 assert.equal(items[0].rule,'data');
 assert(items.some(x=>x.rule==='data'&&x.facts.includes("Can't calculate")));
 const duplicate=items.find(x=>x.facts.includes('Repeated'))!;
 assert.match(duplicate.facts,/Scrap rate/);assert(!duplicate.facts.includes('Good output'));
 assert(!items.some(x=>r.runs.some(run=>run.issues.some(i=>x.facts.includes(i.message)))));
 const f2=await fixture();const row=f2.file.sheets[0].rows.find(r=>r.cells.some(c=>c.raw==='EV-002'))!;row.cells[9]={...row.cells[9],raw:'900',display:'900'};
 const r2=f2.calculate();assert(possibleExplanations(r2,r2.runs[0],r2.runs[1]).some(x=>x.rule==='data'&&x.facts.includes('balance')));
});
test('co-occurrence uses renamed measurements and excludes unavailable differences',async()=>{
 const f=await fixture();f.setup.measurements[0].label='Loss fraction';
 const r=f.calculate(),items=possibleExplanations(r,r.runs[0],r.runs[1]);
 assert(items.some(x=>x.rule==='co-occurrence'&&x.facts.includes('Loss fraction')));
 assert(!items.filter(x=>x.rule==='co-occurrence').some(x=>x.facts.includes('Unplanned downtime')));
});
test('unexplained rule distinguishes unassessed attributes and disappears when context differs',async()=>{
 const f=await fixture(),r=f.calculate();
 assert(possibleExplanations(r,r.runs[0],r.runs[1]).some(x=>x.rule==='unexplained'&&x.facts.includes('unavailable')));
 assert(!possibleExplanations(r,r.runs[0],r.runs[3]).some(x=>x.rule==='unexplained'));
 assert.equal(possibleExplanations(r,r.runs[0],r.runs[0]).length,0);
});
test('custom attributes opt in separately; guidance survives setup transfer; all hypotheses export',async()=>{
 const f=await fixture();f.setup.mapping.orderId=null;f.setup.customFields=[{id:'operator',label:'Team member',column:1,compare:false}];
 let r=f.calculate();
 assert(!possibleExplanations(r,r.runs[0],r.runs[1]).some(x=>x.id==='attribute:operator'));
 f.setup.customFields[0].useExplanations=true;f.setup.customFields[0].checkText='Verify the shift log.';
 f.setup.attributeChecks={line:'Review line records.'};
 r=f.calculate();const item=possibleExplanations(r,r.runs[0],r.runs[1]).find(x=>x.id==='attribute:operator')!;
 assert.equal(item.check,'Verify the shift log.');assert(!/because|caused by/.test(item.hypothesis));
 const profile=importSetupJson(JSON.stringify({id:'test',name:'Test',setup:f.setup,headers:f.inspection.headers,savedAt:new Date().toISOString(),confirmed:true}));
 assert.equal(profile.setup.customFields[0].useExplanations,true);assert.equal(profile.setup.attributeChecks?.line,'Review line records.');
 assert(exportComparisonCsv(r,r.runs[0],r.runs[1]).includes(hypothesisTitle));
 assert(comparisonPrintHtml(r,r.runs[0],r.runs[1]).includes('Verify the shift log.'));
});
