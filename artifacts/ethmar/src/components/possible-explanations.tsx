import {useMemo,useState} from 'react';
import {possibleExplanations,hypothesisTitle,proximityMinutes} from '@/lib/hypotheses';
import type {CalculationReport,CalculatedRun} from '@/lib/calculation-types';
import type {EvidenceSelection} from './value-evidence';
export function PossibleExplanations({report,a,b,onEvidence}:{report:CalculationReport;a:CalculatedRun;b:CalculatedRun;onEvidence:(selection:EvidenceSelection)=>void}){
 const items=useMemo(()=>possibleExplanations(report,a,b),[report,a,b]);
 const [all,setAll]=useState(false);
 return <details className="panel" data-testid="possible-explanations"><summary>{hypothesisTitle} · {items.length}</summary>
  <p>Fixed rules using this file only. No AI or network requests. “Near” means within {proximityMinutes} minutes. Data checks come first; attribute links use the largest relative measurement difference, with ties in setup order. These are not causal rankings.</p>
  {!items.length&&<p>No statements match these rules for this pair of runs. This does not prove that the records are complete or that there is no difference.</p>}
  {(all?items:items.slice(0,5)).map(item=><article key={item.id} className="config-card" data-rule={item.rule}>
   <p dir="auto"><strong>Recorded:</strong> {item.facts}</p>
   <p><strong>Hypothesis:</strong> {item.hypothesis}</p>
   <p dir="auto"><strong>Check:</strong> {item.check}</p>
   <button onClick={()=>onEvidence({title:`Hypothesis evidence · ${item.rule}`,operands:item.evidence})} aria-label={`See rows: ${item.facts}`}>See rows</button>
  </article>)}
  {items.length>5&&<button onClick={()=>setAll(!all)}>{all?'Show fewer':`Show all (${items.length})`}</button>}
 </details>;
}
