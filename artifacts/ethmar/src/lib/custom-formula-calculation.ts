import type {Measurement,Setup} from './setup';
import {evaluateFormula,formulaReferences,type FormulaBinding} from './custom-formula';
import type {CalculatedValue,Evidence,EvidenceRow} from './calculation-types';
import {formatCalculated,numberText} from './calculation-values';
export function calculateCustomFormula(m:Measurement,s:Setup,mapping:Evidence['mapping'],resolve:(binding:FormulaBinding)=>CalculatedValue):CalculatedValue{
 const evidence:Evidence={formula:'',used:[],excluded:[],notes:[],mapping,parts:[]};
 const unit=m.outputUnit==='percent'?'%':m.outputUnit==='quantity'?s.unit:m.outputUnit==='hours'?'hours':m.outputUnit==='minutes'?'minutes':'';
 const result:CalculatedValue={id:m.id,label:m.label,value:null,unit,decimals:m.decimals??2,state:'unavailable',reason:'',evidence};
 try{
  const {ast,references}=formulaReferences(m,s),parts=references.map(r=>({name:r.name,value:resolve(r)}));
  evidence.parts=parts.flatMap(p=>[{name:p.name,value:p.value.value,unit:p.value.unit,reason:p.value.reason,formula:p.value.evidence.formula},...(p.value.evidence.parts??[]).map(q=>({...q,name:`${p.name} → ${q.name}`}))]);
  const merge=(entries:EvidenceRow[])=>{
   const rows=new Map<number,EvidenceRow>();
   for(const e of entries){const existing=rows.get(e.row.line);rows.set(e.row.line,existing?{row:e.row,reason:`${existing.reason}; ${e.reason}`}:{...e});}
   return [...rows.values()];
  };
  evidence.used=merge(parts.flatMap(p=>p.value.evidence.used.map(r=>({...r,reason:`${p.name}: ${r.reason}`}))));
  evidence.excluded=merge(parts.flatMap(p=>p.value.evidence.excluded.map(r=>({...r,reason:`${p.name}: ${r.reason}`}))));
  evidence.notes=[...new Set(parts.flatMap(p=>p.value.evidence.notes))];
  evidence.notes.push('This analyst-defined formula uses per-run totals, never row-by-row arithmetic. Source durations and all original values remain separate and unchanged. Output units label the result; conversions must be explicit in the formula.');
  const missing=parts.filter(p=>p.value.value===null);
  if(missing.length)throw new Error(missing.map(p=>`Missing ${p.name}: ${p.value.reason||'no usable value is recorded'}`).join(' '));
  const numbers=new Map(parts.map(p=>[p.name,p.value.value!]));
  result.value=evaluateFormula(ast,name=>numbers.get(name)!);
  result.state='available';
  const actual=m.formula!.replace(/\[([^\]]+)\]/g,(_,name)=>`(${numberText(numbers.get(name)!)})`);
  evidence.formula=`${m.formula} = ${actual} = ${formatCalculated(result)}`;
 }catch(e){result.value=null;result.reason=(e as Error).message;evidence.formula=`Can't calculate: ${result.reason}`;}
 return result;
}
