import { formatCalculated, type CalculatedRun, type CalculatedValue, type CalculationReport, type DataIssue } from '@/lib/calculation-engine';
import type { EvidenceRow } from '@/lib/calculation-engine';
import {measurementDependencies} from '@/lib/custom-formula';

export function usedCellAddresses(entries:EvidenceRow[],expressions:string){
 return [...new Set(entries.flatMap(e=>e.row.cells.filter(c=>expressions.includes(`[${c.address}]`)).map(c=>c.address)))];
}
export function operandExpressions(value:CalculatedValue,report:CalculationReport){
 const run=report.runs.find(r=>r.metrics.includes(value)||r.measures.includes(value));
 const metric=run?.metrics.includes(value)?report.setup.measurements.find(m=>m.id===value.id):undefined;
 const ids=metric?measurementDependencies(metric,report.setup).filter(d=>!d.countOnly).map(d=>d.id):[];
 const operands=metric?.template==='Count'?[]:run?.measures.filter(v=>ids.includes(v.id))??[];
 return [value,...operands].flatMap(v=>[v.evidence.formula,...v.evidence.used.map(e=>e.reason)]).join(' ');
}

// Presentation only: retain every engine issue and value in the report and exports.
export const visibleIssues=(issues:DataIssue[])=>issues.filter(i=>!(i.code==='not-logged'&&i.level==='note'&&i.definitionIds.length===1&&i.definitionIds[0]==='downtime'));
export const displayHealth=(run:CalculatedRun):CalculatedRun['health']=>visibleIssues(run.issues).some(i=>i.level==='missing')?'missing':visibleIssues(run.issues).length?'note':'clear';
export const displayValue=(value:CalculatedValue)=>value.state==='not-logged'?'Not recorded':formatCalculated(value);
export function comparisonValues(run:CalculatedRun,report:CalculationReport){
 const represented=new Set(report.setup.measurements.filter(m=>m.template==='Total'||m.template==='Duration').map(m=>m.a));
 const values=[...run.measures.filter(m=>!represented.has(m.id)),...run.metrics];
 const order=['material','good','scrap','scrap-rate','changeover','downtime'];
 const rank=(v:CalculatedValue)=>{const m=run.metrics.includes(v)?report.setup.measurements.find(m=>m.id===v.id):undefined;const key=m?.template==='Ratio'&&m.a==='scrap'?'scrap-rate':m&&(m.template==='Total'||m.template==='Duration')?m.a:m?v.id:v.id;const i=order.indexOf(key);return i<0?order.length:i;};
 return values.sort((a,b)=>rank(a)-rank(b));
}
export function shortAnswer(a:CalculatedRun,b:CalculatedRun,report:CalculationReport){
 const ratio=report.setup.measurements.find(m=>m.template==='Ratio'&&m.a==='scrap');
 const [x,y]=ratio?[a.metrics.find(v=>v.id===ratio.id),b.metrics.find(v=>v.id===ratio.id)]:[a.measures.find(v=>v.id==='scrap'),b.measures.find(v=>v.id==='scrap')];
 const comparable=x&&y&&x.value!==null&&y.value!==null&&x.unit===y.unit;
 const higher=comparable&&y.value!>x.value!?b:a,other=higher===a?b:a;
 const change=higher.measures.find(v=>v.id==='changeover'),otherChange=other.measures.find(v=>v.id==='changeover');
 const label=x?.label??report.setup.events.find(e=>e.id==='scrap')?.label??'Scrap';
 let answer=comparable?(x.value===y.value?`${label} was equal in both runs (${displayValue(x)} each)`:`${higher.id} recorded more ${label.toLowerCase()} (${displayValue(higher===a?x:y)} versus ${displayValue(higher===a?y:x)})`):`${label} cannot be compared from the available records`;
 if(change&&otherChange&&change.value!==null&&otherChange.value!==null&&change.unit===otherChange.unit){
  answer+=`; ${higher.id}'s ${change.label.toLowerCase()} was ${change.value>otherChange.value?'longer':change.value<otherChange.value?'shorter':'equal in duration'} (${displayValue(change)} versus ${displayValue(otherChange)})`;
 }else if(change)answer+=`; ${change.label.toLowerCase()} cannot be compared from the available records`;
 const stops=[a,b].flatMap(r=>{const v=r.measures.find(m=>m.id==='downtime');return v?.state==='available'?[`${r.id}: ${displayValue(v)}`]:[]});
 return `${answer}.${stops.length?` ${report.setup.events.find(e=>e.id==='downtime')?.label??'Recorded downtime'} is shown separately (${stops.join('; ')}).`:''}`;
}
