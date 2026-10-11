import type { AttributeCheck, CalculationReport, CalculatedRun, CalculatedValue, DataIssue } from './calculation-types';
import type { Setup } from './setup';

export function affectedLabels(issue:DataIssue,setup:Setup):string[]{
 const ids=new Set(issue.definitionIds);
 if(!ids.size)return [...setup.events.map(e=>e.label),...setup.measurements.map(m=>m.label)];
 return [...new Set([...setup.events.filter(e=>ids.has(e.id)).map(e=>e.label),...setup.measurements.filter(m=>ids.has(m.id)||ids.has(m.a)||(usesSecondOperand(m.template)&&ids.has(m.b))).map(m=>m.label)])];
}
const usesSecondOperand=(template:string)=>['Ratio','Difference','Rate per hour'].includes(template);
const phrase=(text:string)=>text.trim().replace(/\.\s+/g,'; ').replace(/[.!?]+$/,'');
export function issueExplanation(issue:DataIssue,report:CalculationReport):string{
 const labels=affectedLabels(issue,report.setup);
 return `${phrase(issue.message)}; affected numbers: ${labels.join(', ')||'run grouping and configured results'} (${report.source.name} · ${report.source.sheets[report.sheetIndex]?.name}${issue.lines.length?` · lines ${issue.lines.join(', ')}`:' · setup-level check (no specific source rows)'}).`;
}
export function healthExplanation(issues:DataIssue[],report:CalculationReport,scope:string):string{
 return issues.length?`${issues.length} ${issues.length===1?'issue':'issues'} · ${issueExplanation(issues[0],report)} Click to see all (${issues.length}).`:`Clear: no issues found in ${scope} for the configured definitions and measurements (${[...report.setup.events.map(e=>e.label),...report.setup.measurements.map(m=>m.label)].join(', ')||'none configured'}). Only configured checks were assessed; this is not a guarantee that the source is complete.`;
}
export function valueIssues(value:CalculatedValue,report:CalculationReport,run?:CalculatedRun):DataIssue[]{
 const metric=report.setup.measurements.find(m=>m.id===value.id);
 const ids=new Set([value.id,metric?.a,...(metric&&usesSecondOperand(metric.template)?[metric.b]:[])]);
 return [...new Map([...report.issues,...(run?.issues??[])].filter(i=>!i.definitionIds.length||i.definitionIds.some(id=>ids.has(id))).map(i=>[JSON.stringify(i),i])).values()];
}
export function valueExplanation(value:CalculatedValue,report:CalculationReport,run?:CalculatedRun):string{
 const issues=valueIssues(value,report,run);
 const reason=`${value.label}: ${phrase(value.reason||value.evidence.formula)}${value.state==='not-logged'?'; No record is not zero':''}`;
 return issues.length?`${reason}; ${issues.length} ${issues.length===1?'issue':'issues'} · ${issueExplanation(issues[0],report)}`:`${reason} (${value.evidence.mapping.file} · ${value.evidence.mapping.sheet}${value.evidence.used.length?` · lines ${value.evidence.used.map(e=>e.row.line).join(', ')}`:' · no usable source rows recorded'}).`;
}
export function attributeExplanation(check:AttributeCheck):string{
 return `${check.label}: ${phrase(check.reason)}; baseline: ${check.baseline}; compared: ${check.compared}. This affects the ${check.label} comparison, not the recorded calculation values.`;
}
export function unassessedExplanation(label:string,run:CalculatedRun,report:CalculationReport):string{
 return `${label} is not assessed for ${run.id}: no single usable mapped value is available. This affects the ${label} comparison, not the recorded production totals. Source: ${report.source.name} · ${report.source.sheets[report.sheetIndex]?.name} · lines ${run.rows.map(r=>r.line).join(', ')||'none'}. Review column mappings and these original rows.`;
}
