import { type CalculatedValue, type CalculationReport, type CalculatedRun } from '@/lib/calculation-engine';
import { CompareDrawer } from './compare-drawer';
import { EvidenceRows, Issues } from './calculation-checks';
import { displayValue } from './compare-presentation';
import { ExplanationTooltip } from './explanation-tooltip';
import { valueExplanation, valueIssues } from '@/lib/explanations';

export type EvidenceSelection={title:string;operands:{run:CalculatedRun;value:CalculatedValue}[];difference?:{text:string;reason:string}};
export function ValueEvidence({selection,report,onClose}:{selection:EvidenceSelection;report:CalculationReport;onClose:()=>void}){
 return <CompareDrawer title={selection.title} onClose={onClose}>{selection.difference&&<div className="evidence-formula"><ExplanationTooltip text={selection.difference.reason}>{selection.operands[1]?displayValue(selection.operands[1].value):'Unavailable'} − {selection.operands[0]?displayValue(selection.operands[0].value):'Unavailable'} = {selection.difference.text}</ExplanationTooltip><small>{selection.difference.reason}</small></div>}{selection.operands.map(({run,value})=><section key={`${run.id}-${value.id}`} className="panel">
  <h3 dir="auto">{run.id} · {value.label}</h3>
  <div className={`evidence-formula ${value.state==='not-logged'?'neutral-value':''}`}><ExplanationTooltip text={valueExplanation(value,report,run)}>{value.state==='not-logged'?'Not recorded · not zero':value.evidence.formula}</ExplanationTooltip></div>
  {!!value.evidence.parts?.length&&<section aria-label="Formula source parts" data-testid={`formula-evidence-${value.id}`}>
   <h4>Values behind this formula</h4>
   <p>Each part comes from this run. Nested measurement labels show where a value was used. Units are shown as recorded by the calculation, without automatic conversion.</p>
   <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left'}}><thead><tr><th scope="col">Source or measurement</th><th scope="col">Value</th><th scope="col">Calculation and context</th></tr></thead><tbody>
    {value.evidence.parts.map((part,i)=><tr key={`${part.name}-${i}`}>
     <th scope="row" dir="auto" style={{whiteSpace:'normal',overflowWrap:'anywhere'}}>{part.name}</th>
     <td style={{whiteSpace:'nowrap'}}>{part.value===null||!Number.isFinite(part.value)?<ExplanationTooltip text={`${part.name}: ${part.reason||'No usable value is recorded for this run'}. This formula cannot be calculated without this part.`}>Unavailable</ExplanationTooltip>:String(part.value)}{part.unit&&<> {part.unit}</>}</td>
     <td style={{whiteSpace:'normal',overflowWrap:'anywhere'}}>{part.formula&&<div>{part.formula}</div>}{part.reason&&<small>{part.reason}</small>}</td>
    </tr>)}
   </tbody></table></div>
  </section>}
  {value.state!=='available'&&<p>{valueExplanation(value,report,run)}</p>}<Issues report={report} issues={valueIssues(value,report,run)}/><EvidenceRows report={report} title="Included rows and calculation" entries={value.evidence.used} value={value} expanded/><EvidenceRows report={report} title="Rows not used" entries={value.evidence.excluded}/><details><summary>Technical details · mapping, notes and original context</summary>{value.reason&&<p>{value.reason}</p>}{value.evidence.notes.map((note,i)=><p key={i}>{note}</p>)}<EvidenceRows report={report} title="All original run rows" entries={run.rows.map(row=>({row,reason:'Original record assigned to this run; not necessarily used in this measurement.'}))}/><pre className="technical-json">{JSON.stringify(value.evidence.mapping,null,2)}</pre></details>
 </section>)}</CompareDrawer>;
}
