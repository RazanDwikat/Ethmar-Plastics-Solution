import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {parseBytes,inspectSheet} from './inspection';
import {defaultSetup} from './setup';
import {calculateFile} from './calculation-engine';
import {samples} from './samples';
import {suggestRuns,runFields,answerSentence,exportComparisonCsv,comparisonPrintHtml,searchRunText} from './comparison-tools';
test('run search ignores punctuation and supports Arabic text',()=>{
 assert.ok(searchRunText('E-04 L2','e04'));
 assert.ok(searchRunText('دفعة-١ آلة A','دفعة ١'));
 assert.ok(!searchRunText('E-04 L2','E02'));
});
async function report(index=0){
 const file=await parseBytes(new TextEncoder().encode(samples[index].csv).buffer,'source.csv');
 const setup=defaultSetup(inspectSheet(file.sheets[0],'.'));
 return calculateFile(file,0,setup);
}
test('suggestions rank by matches then date and never include baseline',async()=>{
 const r=await report(),list=suggestRuns(r,'E-01');
 assert.equal(list[0].run.id,'E-02');
 assert.equal(list[1].run.id,'E-03');
 assert.ok(list.every(s=>s.run.id!=='E-01'));
 assert.equal(runFields(r.runs[0],r.setup).date,'2026-10-07');
 assert.ok(list[0].reasons.some(s=>s.includes('Input quantity')));
});
test('answer sentence uses recorded values, correct time relation, separate downtime and no causation',async()=>{
 const r=await report();const s=answerSentence(r.runs[0],r.runs[1],r.setup);
 assert.match(s,/E-02 recorded more scrap/);assert.match(s,/also longer/);
 assert.match(s,/45 min/);assert.match(s,/shown separately/);assert.match(s,/not evidence of a cause/);
});
test('exports retain units, deltas, warnings, formulas, unavailable reasons and source references',async()=>{
 const r=await report(1),a=r.runs[0],b=r.runs[1],csv=exportComparisonCsv(r,a,b);
 assert.match(csv,/percentage points/);assert.match(csv,/No Material input record/);
 assert.match(csv,/Duplicate record/);assert.match(csv,/source.csv/);
 assert.match(csv,/Excluded row/);assert.match(csv,/Technical details/);
 const h=comparisonPrintHtml(r,a,b);
 assert.match(h,/Duplicate record/);assert.match(h,/No Material input record/);assert.match(h,/Used row/);
});
test('exports escape markup and formula injection without modifying original cells',async()=>{
 const r=await report();r.runs[0].id='=HYPERLINK("evil")';r.runs[1].id='<script>alert(1)</script>';
 const before=structuredClone(r.source);
 const csv=exportComparisonCsv(r,r.runs[0],r.runs[1]),html=comparisonPrintHtml(r,r.runs[0],r.runs[1]);
 assert.ok(csv.includes(`"'=HYPERLINK`));assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);
 assert.deepEqual(r.source,before);
});
