import type {CalculatedRun, CalculationReport} from './calculation-types';
import {formatCalculated} from './calculation-values';
import {possibleExplanations, type Hypothesis} from './hypotheses';

/** Presentation only: never infer causes or change the rule results/calculations. */
export function explanationSummary(report:CalculationReport,a:CalculatedRun,b:CalculatedRun,items:Hypothesis[]=possibleExplanations(report,a,b)){
 const differences=a.metrics.map(av=>{
  const bv=b.metrics.find(v=>v.id===av.id);
  const reading=(run:CalculatedRun,v:typeof bv)=>`${run.id}: ${v?formatCalculated(v):'Unavailable'}${!v||v.value===null?` — ${v?.reason||'No recorded value is available.'}`:''}`;
  let delta='No comparison';
  if(av.state==='available'&&bv?.state==='available'&&av.value!==null&&bv.value!==null&&av.unit===bv.unit){
   const d=bv.value-av.value;
   delta=d===0?'no difference':`${formatCalculated({value:Math.abs(d),unit:av.unit==='%'?'percentage points':av.unit,state:'available',decimals:av.decimals})} ${d>0?'higher':'lower'} in ${b.id}`;
  }else if(bv&&av.unit!==bv.unit)delta+=' — units differ';
  return {id:av.id,text:`${av.label} — ${reading(a,av)}; ${reading(b,bv)}. ${delta}.`,evidence:[{run:a,value:av},...(bv?[{run:b,value:bv}]:[])]};
 });
 const context:string[]=[];
 if(items.some(i=>i.rule==='data'))context.push('Some recorded numbers have data-quality notes. These may affect the comparison; review the linked checks before interpreting the differences.');
 const attributes=items.filter(i=>i.rule==='attribute').map(i=>{
  // Remove the repeated metric pair; it is already shown once in the difference list.
  const suffix=i.evidence.map(e=>`${e.run.id}: ${e.value.label} = ${formatCalculated(e.value)}`).join('; ');
  return i.facts.endsWith(`${suffix}.`)?i.facts.slice(0,-`${suffix}.`.length).trim():i.facts;
 });
 if(attributes.length)context.push(`${attributes.join(' ')} These recorded differences could be related to the measurement differences, or not at all.`);
 for(const item of items.filter(i=>i.rule==='timing'))context.push(`${item.facts} Their timing might be worth checking, but does not show that one affected the other.`);
 for(const item of items.filter(i=>i.rule==='stop')){
  if(items.some(i=>i.rule==='timing'&&i.evidence.some(e=>e.run.id===item.evidence[0]?.run.id)))continue;
  const source=item.evidence[0];
  const alreadyShown=source&&differences.some(d=>d.evidence.some(e=>e.run.id===source.run.id&&report.setup.measurements.find(m=>m.id===e.value.id)?.a===source.value.id));
  context.push(`${alreadyShown?`The recorded ${source.value.label} in ${source.run.id}`:item.facts} could be worth checking alongside these results, or may be unrelated.`);
 }
 const co=items.filter(i=>i.rule==='co-occurrence');
 if(co.length)context.push(`${[...new Set(co.flatMap(i=>i.evidence.map(e=>e.value.label)))].join(' and ')} differ together between these runs. They could be related, or not at all.`);
 const unexplained=items.find(i=>i.rule==='unexplained');
 if(unexplained)context.push(unexplained.hypothesis);
 if(!items.length)context.push(a.id===b.id?'You selected the same run twice. Choose a different run to investigate differences.':'No possible explanation is supported by these rules for this pair. This does not prove that the records are complete or that there is no difference.');
 return {differences,context:[...new Set(context)],checks:[...new Set(items.map(i=>i.check))],items};
}
