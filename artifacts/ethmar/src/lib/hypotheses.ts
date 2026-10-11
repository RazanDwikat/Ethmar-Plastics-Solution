import type {Setup} from './setup';
import type {CalculatedRun,CalculatedValue,CalculationReport} from './calculation-types';
import {formatCalculated,timestamp,timestampZone} from './calculation-values';
import {measurementDependencies} from './custom-formula';

export const hypothesisTitle='Possible explanations to check (hypotheses, not conclusions)';
export const proximityMinutes=15;
export const defaultCheck=(label:string)=>`Review the recorded ${label} and operating conditions with your analyst; check comparable records before drawing conclusions.`;
export function explanationAttributes(setup:Setup,headers:string[]){
 return [
  ...(['line','machine','mold','shift','product'] as const).map(id=>({id,column:setup.mapping[id],label:headers[setup.mapping[id]??-1]||id,enabled:true,check:setup.attributeChecks?.[id]})),
  ...setup.customFields.map(f=>({id:f.id,column:f.column,label:f.label,enabled:f.useExplanations===true,check:f.checkText})),
 ];
}
export type Hypothesis={
 id:string;rule:'data'|'attribute'|'stop'|'timing'|'co-occurrence'|'unexplained';
 facts:string;hypothesis:string;check:string;score:number;
 evidence:{run:CalculatedRun;value:CalculatedValue}[];
};
const recorded=(r:CalculatedRun,v:CalculatedValue)=>`${r.id}: ${v.label} = ${formatCalculated(v)}`;
export function possibleExplanations(report:CalculationReport,a:CalculatedRun,b:CalculatedRun):Hypothesis[]{
 if(a.id===b.id)return [];
 const s=report.setup,out:Hypothesis[]=[];
 const pairs=a.metrics.flatMap(av=>{
  const bv=b.metrics.find(v=>v.id===av.id);
  return bv&&av.value!==null&&bv.value!==null&&av.state==='available'&&bv.state==='available'&&av.unit===bv.unit&&av.value!==bv.value?
   [{av,bv,score:Math.abs(bv.value-av.value)/Math.max(Math.abs(av.value),Math.abs(bv.value),Number.EPSILON)}]:[];
 }).sort((x,y)=>y.score-x.score);
 const related=pairs[0];
 const pairEvidence=(p:typeof pairs[number])=>[{run:a,value:p.av},{run:b,value:p.bv}];
 const pairFact=(p:typeof pairs[number])=>`${recorded(a,p.av)}; ${recorded(b,p.bv)}`;
 const headers=a.metrics[0]?.evidence.mapping.headers??a.measures[0]?.evidence.mapping.headers??[];
 // Link checks to their affected measurements instead of copying check messages.
 for(const run of [a,b]){
  const seen=new Set<string>();
  for(const issue of run.issues){
   if(issue.code==='missing-context')continue;
   if(!/duplicate|conflict|missing|imbalance|balance|unavailable/.test(issue.code))continue;
   const values=run.metrics.filter(v=>{
    const m=s.measurements.find(m=>m.id===v.id);
    if(issue.code==='unavailable-metric')return issue.message.startsWith(`${v.label}:`);
    const ids=issue.definitionIds.length?issue.definitionIds:s.shape==='event'?s.events.filter(e=>run.rows.some(r=>issue.lines.includes(r.line)&&e.values.includes(String(r.cells[s.mapping.eventType??-1]?.raw??'')))).map(e=>e.id):s.events.map(e=>e.id);
    return ids.includes(v.id)||!!m&&measurementDependencies(m,s).some(d=>ids.includes(d.id));
   });
   if(!values.length)continue;
   const key=`${issue.code}:${issue.lines.join(',')}:${values.map(v=>v.id).join(',')}`;
   if(seen.has(key))continue;seen.add(key);
   const kind=/duplicate|conflict/.test(issue.code)?'Repeated or conflicting record check':/balance/.test(issue.code)?'Quantity balance check':'Missing or unusable data check';
   out.push({id:`data:${run.id}:${key}`,rule:'data',score:0,
    facts:`${run.id}: ${kind}${issue.definitionIds.length?` (${s.events.filter(e=>issue.definitionIds.includes(e.id)).map(e=>e.label).join(', ')})`:''}${issue.lines.length?` at lines ${issue.lines.join(', ')}`:''} links to ${values.map(v=>`${v.label} = ${formatCalculated(v)}`).join('; ')}.`,
    hypothesis:'This data issue may affect these numbers, or it may not change their recorded comparison.',
    check:'Open the linked calculation checks and original rows; verify completeness before interpreting the difference.',
    evidence:values.map(value=>({run,value}))});
  }
 }
 let different=false,assessed=0,notAssessed=0;
 for(const attr of explanationAttributes(s,headers).filter(x=>x.enabled)){
  const values=(run:CalculatedRun)=>attr.column===null||attr.column<0?[]:[...new Set(run.rows.map(r=>String(r.cells[attr.column!]?.raw??'').trim()).filter(Boolean))].sort();
  const av=values(a),bv=values(b);
  if(!av.length||!bv.length){notAssessed++;continue;}
  assessed++;
  if(JSON.stringify(av)===JSON.stringify(bv))continue;
  different=true;if(!related)continue;
  out.push({id:`attribute:${attr.id}`,rule:'attribute',score:related.score,
   facts:`${attr.label}: ${a.id} = ${av.join(' / ')}; ${b.id} = ${bv.join(' / ')}. ${pairFact(related)}.`,
   hypothesis:'The recorded context may be relevant, or not at all. This comparison does not attribute responsibility to a person.',
   check:attr.check?.trim()||defaultCheck(attr.label),evidence:pairEvidence(related).map(({run,value})=>({
    run,value:{...value,id:`context:${attr.id}:${value.id}`,evidence:{
     ...value.evidence,formula:`${attr.label}: ${values(run).join(' / ')}. ${value.evidence.formula}`,
     used:run.rows.map(row=>({row,reason:`Recorded ${attr.label} context; not an additional calculation input.`})),
    }},
   }))});
 }
 for(const run of [a,b]){
  const stop=run.measures.find(v=>v.id==='downtime'),change=run.measures.find(v=>v.id==='changeover');
  if(stop?.state==='available'&&stop.value!==null&&stop.evidence.used.length){
   out.push({id:`stop:${run.id}`,rule:'stop',score:0,facts:`${recorded(run,stop)}.`,
    hypothesis:'This recorded interval could be worth checking alongside the results, or it may be unrelated.',
    check:`Review the ${stop.label} records and the measurements from this run.`,evidence:[{run,value:stop},...run.metrics.filter(v=>s.measurements.find(m=>m.id===v.id)?.a==='downtime').map(value=>({run,value}))]});
  }
  const sd=s.events.find(e=>e.id==='downtime'),cd=s.events.find(e=>e.id==='changeover');
  if(!stop||!change||sd?.timing!=='range'||cd?.timing!=='range')continue;
  for(const sr of stop.evidence.used)for(const cr of change.evidence.used){
   const sc=sr.row.cells[sd.startColumn??-1],se=sr.row.cells[sd.endColumn??-1],cc=cr.row.cells[cd.startColumn??-1],ce=cr.row.cells[cd.endColumn??-1];
   const ss=timestamp(sc),es=timestamp(se),cs=timestamp(cc),ec=timestamp(ce);
   if(ss===null||es===null||cs===null||ec===null||timestampZone(sc)!==timestampZone(cc))continue;
   const overlap=Math.min(es,ec)-Math.max(ss,cs),gap=Math.max(cs-es,ss-ec,0)/60000;
   if(overlap<=0&&gap>proximityMinutes)continue;
   out.push({id:`timing:${run.id}:${sr.row.line}:${cr.row.line}`,rule:'timing',score:0,
    facts:`${run.id}: ${stop.label} (${sc?.display} → ${se?.display}, line ${sr.row.line}) and ${change.label} (${cc?.display} → ${ce?.display}, line ${cr.row.line}) ${overlap>0?`overlap by ${overlap/60000} min`:`are ${gap} min apart (within ${proximityMinutes} min)`}.`,
    hypothesis:'Their timing may warrant review; timing alone does not establish a connection.',
    check:'Verify the timestamps and recorded sequence. Keep both durations separate.',
    evidence:[{run,value:stop},{run,value:change}]});
  }
 }
 for(let i=0;i<pairs.length;i++)for(let j=i+1;j<pairs.length;j++){
  const x=pairs[i],y=pairs[j];
  out.push({id:`co:${x.av.id}:${y.av.id}`,rule:'co-occurrence',score:Math.max(x.score,y.score),
   facts:`${pairFact(x)}. ${pairFact(y)}.`,
   hypothesis:`Both measurements differ in ${b.id} relative to ${a.id}; they could be related, or not at all.`,
   check:'Review the source records and more comparable runs before interpreting a relationship.',
   evidence:[...pairEvidence(x),...pairEvidence(y)]});
 }
 if(related&&!different)out.push({id:'unexplained',rule:'unexplained',score:0,
  facts:`${pairFact(related)}. No assessed attribute differs (${assessed} assessed; ${notAssessed} unavailable). Custom attributes not enabled in Setup are not assessed here.`,
  hypothesis:'The difference cannot be explained by the assessed attributes in this file; unrecorded context could matter.',
  check:'Check missing context and additional comparable records, without assuming a cause.',evidence:pairEvidence(related)});
 const order={data:0,attribute:1,stop:2,timing:3,'co-occurrence':4,unexplained:5};
 return out.sort((x,y)=>order[x.rule]-order[y.rule]||y.score-x.score);
}
