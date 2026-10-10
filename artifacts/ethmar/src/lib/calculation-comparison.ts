import type { CalculatedRun, EngineComparison, AttributeCheck } from './calculation-types';
import type { Setup } from './setup';
/** Pure engine output for later Compare UI. Deltas always mean compared minus baseline. */
export function compareCalculatedRuns(baseline:CalculatedRun,compared:CalculatedRun,setup:Setup):EngineComparison {
  const checks:AttributeCheck[]=[];
  const attribute=(label:string,column:number|null)=>{
    const values=(run:CalculatedRun)=>{
      if(column===null)return null;
      const raw=run.rows.map(r=>String(r.cells[column]?.raw??''));
      if(!raw.length||raw.some(v=>!v.trim())||new Set(raw).size!==1)return null;
      return raw[0];
    };
    const a=values(baseline),b=values(compared);
    const state=a===null||b===null?'not-assessed':a===b?'match':'different';
    checks.push({label,state,baseline:a??'Not assessed',compared:b??'Not assessed',reason:state==='not-assessed'?'This attribute is unmapped, missing, or has more than one value.':state==='match'?'Recorded values match.':'Recorded values differ; this is context, not a cause.'});
  };
  for(const role of ['line','machine','mold','product'] as const)attribute(role[0].toUpperCase()+role.slice(1),setup.mapping[role]);
  for(const field of setup.customFields.filter(f=>f.compare))attribute(field.label,field.column<0?null:field.column);
  const a=baseline.measures.find(m=>m.id==='material'),b=compared.measures.find(m=>m.id==='material');
  const assessed=a?.value!==null&&a?.value!==undefined&&b?.value!==null&&b?.value!==undefined&&a.unit===b.unit;
  const delta=assessed?Math.abs(b!.value!-a!.value!):null;
  const roundingAllowance=Number.EPSILON*Math.max(Math.abs(a?.value??0),Math.abs(b?.value??0),setup.tolerance)*4;
  checks.push({label:'Input quantity',state:delta===null?'not-assessed':delta<=setup.tolerance+roundingAllowance?'match':'different',
    baseline:a?.value===null||a?.value===undefined?'Not assessed':`${a.value} ${a.unit}`,compared:b?.value===null||b?.value===undefined?'Not assessed':`${b.value} ${b.unit}`,
    reason:delta===null?'Input is missing or unavailable for at least one run.':`Absolute difference ${delta} ${setup.unit}; tolerance ${setup.tolerance} ${setup.unit}. A difference equal to tolerance is allowed.`});
  const differences=baseline.metrics.map(a=>{
    const b=compared.metrics.find(v=>v.id===a.id);
    return {id:a.id,value:a.value!==null&&b?.value!==null&&b?.value!==undefined&&a.unit===b.unit?b.value-a.value:null,
      unit:a.unit==='%'?'percentage points':a.unit,reason:a.value===null?a.reason:!b?'This measurement is missing for the compared run.':b.value===null?b.reason:a.unit!==b.unit?'The measurement units differ.':'Compared run minus baseline run.'};
  });
  return {differences,checks,care:checks.some(c=>c.state==='different')};
}
