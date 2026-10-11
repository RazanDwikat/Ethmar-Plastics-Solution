import {useMemo} from 'react';
import {hypothesisTitle,proximityMinutes} from '@/lib/hypotheses';
import {explanationSummary} from '@/lib/explanation-summary';
import type {CalculationReport,CalculatedRun} from '@/lib/calculation-types';
import type {EvidenceSelection} from './value-evidence';
import {ExplanationTooltip} from './explanation-tooltip';
import './explanation-summary.css';
export function PossibleExplanations({report,a,b,onEvidence}:{report:CalculationReport;a:CalculatedRun;b:CalculatedRun;onEvidence:(selection:EvidenceSelection)=>void}){
 const {items,differences,context,checks}=useMemo(()=>explanationSummary(report,a,b),[report,a,b]);
 return <details className="panel" data-testid="possible-explanations"><summary>{hypothesisTitle} · {items.length}</summary>
  <article className="config-card explanation-summary" data-testid="explanation-summary">
   <h2 dir="auto">{a.id} compared with {b.id}</h2>
   <h3>What is different?</h3>
   <ul>{differences.map(d=><li key={d.id}><p dir="auto">{d.evidence.some(e=>e.value.value===null)?<ExplanationTooltip text={d.text}>{d.text}</ExplanationTooltip>:d.text}</p></li>)}</ul>
   {differences.length>0&&<button onClick={()=>onEvidence({title:'Comparison evidence',operands:differences.flatMap(d=>d.evidence)})}>See source rows</button>}
   {!differences.length&&<p>No measurements are configured. Source totals remain available in All numbers.</p>}
   <h3>What might be related?</h3>
   {context.slice(0,3).map(text=><p dir="auto" key={text}>{text}</p>)}
   {context.length>3&&<p>More recorded context is available in the full details below.</p>}
   <p><strong>Possible explanations, not conclusions.</strong> This file cannot confirm a cause or assign responsibility to a person.</p>
   {checks.length>0&&<><h3>What to check</h3><ul>{checks.slice(0,2).map(check=><li key={check} dir="auto">{check}</li>)}</ul>{checks.length>2&&<p>All {checks.length} suggestions are included in the full details below.</p>}</>}
   <details data-testid="explanation-details"><summary>Show all details ({items.length}) · source rows</summary>
   <p>Fixed rules using this file only. No AI or network requests. “Near” means within {proximityMinutes} minutes. Data checks come first; attribute links use the largest relative measurement difference, with ties in setup order. These are not causal rankings.</p>
   <ol>{items.map(item=><li key={item.id} data-rule={item.rule}>
   <p dir="auto"><strong>Recorded:</strong> {item.facts}</p>
   <p><strong>Hypothesis:</strong> {item.hypothesis}</p>
   <p dir="auto"><strong>Check:</strong> {item.check}</p>
   <button onClick={()=>onEvidence({title:`Hypothesis evidence · ${item.rule}`,operands:item.evidence})} aria-label={`See rows: ${item.facts}`}>See rows</button>
   </li>)}</ol>
   </details>
  </article>
 </details>;
}
