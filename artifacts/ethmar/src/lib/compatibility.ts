import { inspectSheet, type ImportedFile } from './inspection';
import { roles, setupProblems, normalizeRequirements, isMeasurementRequired, type Profile, type Setup } from './setup';
import { quantity, timestamp, timestampZone } from './calculation-values';
import { calculateFile, type CalculationReport, type EvidenceRow, type CalculationAvailability } from './calculation-engine';
import { detectRowShape } from './row-shape';
import { prepareFile } from './preparation';
import {definitionColumns,measurementSources,similarHeaders} from './measurement-requirements';

export type CompatibilityResult = {
 preparedFile?:ImportedFile; availability?:CalculationAvailability;
 state:'matches'|'notes'|'blocked'; differences:string[]; notes:string[];
 excluded:EvidenceRow[]; setup:Setup; headerLine:number|null; headers:string[]; unmapped:string[]; detectedShape:'event'|'run'|null;
};

/** Exact header matching only. Requirements decide whether a missing source stops the file. */
export function checkCompatibility(file:ImportedFile,sheetIndex:number,profile:Profile):CompatibilityResult {
 let preparedFile:ImportedFile|undefined,preparedHeader=profile.headerLine;
 if(profile.setup.preparation){
  try{
   const result=prepareFile(file,sheetIndex,profile.setup.preparation,profile.headerLine);
   preparedFile=result.file;file=result.file;preparedHeader=result.headerLine;
  }catch(error){
   return {state:'blocked',differences:[error instanceof Error?error.message:'Preparation could not be applied. Ask your analyst to review the setup.'],notes:[],excluded:[],setup:structuredClone(profile.setup),headerLine:null,headers:[],unmapped:[],detectedShape:null};
  }
 }
 const sheet=file.sheets[sheetIndex];
 if(!sheet)throw new Error('Choose a sheet before checking this file.');
 const inspection=inspectSheet(sheet,file.decimal,preparedHeader);
 const headers=inspection.headers,setup=normalizeRequirements(structuredClone(profile.setup));
 const differences:string[]=[],notes:string[]=[],excluded:EvidenceRow[]=[];
 const availability:CalculationAvailability={definitions:{},issues:[]};
 if(file.prepared){
  notes.push(`${file.prepared.recipe.steps.length} saved preparation steps applied to a copy. Original values are unchanged.`);
  for(const step of file.prepared.recipe.steps){
   const removed=file.prepared.excluded.filter(e=>e.stepId===step.id);
   if(removed.length)notes.push(`${removed[0].reason} ${removed.length} rows excluded — lines ${removed.map(e=>e.row.line).join(', ')}.`);
  }
 }
 const mapped=new Set<number>(),missing=new Map<number,string>();
 const remap=(index:number|null):number|null=>{
  if(index===null)return null;
  mapped.add(index);
  const name=profile.headers[index],matches=headers.flatMap((h,i)=>h===name?[i]:[]);
  if(matches.length!==1||profile.headers.filter(h=>h===name).length!==1){
   const suggestions=matches.length===0&&name?similarHeaders(name,headers):[];
   missing.set(index,matches.length===0?`Missing column: “${name??`column ${index+1}`}”.${suggestions.length?` Similar ${suggestions.length===1?'column':'columns'}: ${suggestions.map(h=>`“${h}”`).join(', ')}. Ask your analyst to review; no mapping was changed.`:''}`:`Column “${name}” appears more than once; it cannot be matched safely.`);
   return null;
  }
  return matches[0];
 };
 for(const [role] of roles)setup.mapping[role]=remap(setup.mapping[role]);
 for(const e of setup.events){e.column=remap(e.column);e.startColumn=remap(e.startColumn);e.endColumn=remap(e.endColumn);e.durationColumn=remap(e.durationColumn);}
 setup.customFields=setup.customFields.map(f=>({...f,column:remap(f.column)??-1}));
 const mappedNames=new Set([...mapped].map(i=>profile.headers[i]));
 const unmapped=headers.filter(h=>!mappedNames.has(h)),extra=headers.filter(h=>!profile.headers.includes(h));
 if(extra.length)notes.push(`Extra columns are kept unchanged as unmapped source columns: ${extra.map(h=>`“${h}”`).join(', ')}.`);
 for(const role of [setup.groupBy,...(setup.shape==='event'?['eventType' as const]:[])]){
  const original=profile.setup.mapping[role];
  if(setup.mapping[role]===null)differences.push(original===null?`No ${role===setup.groupBy?'run/grouping identifier':'event-type'} column is configured.`:missing.get(original)!);
 }
 const detectedShape=detectRowShape(sheet,inspection,profile);
 if(detectedShape&&detectedShape!==setup.shape)differences.push(`This file looks like one row per ${detectedShape}, but your setup expects one row per ${setup.shape}.`);
 if(!detectedShape)differences.push('The file structure could not be identified safely: activity and per-run measure columns may conflict, or there is not enough information. Ask your analyst to check this file.');
 if(profile.confirmed===false)differences.push('This setup has not been confirmed by the analyst.');
 differences.push(...setupProblems(profile.setup,profile.headers).errors);

 const structural=new Set(inspection.issues.filter(i=>['repeated-header','multiple-headers','totals'].includes(i.code)).flatMap(i=>i.lines));
 const rows=sheet.rows.filter(r=>(inspection.headerLine===null||r.line>inspection.headerLine)&&!structural.has(r.line)&&r.cells.some(c=>String(c.raw??'').trim()));
 const identified=rows.filter(r=>setup.mapping[setup.groupBy]!==null&&String(r.cells[setup.mapping[setup.groupBy]!] ?.raw??'').trim());
 const values=new Set(identified.map(r=>setup.mapping.eventType===null?'':String(r.cells[setup.mapping.eventType]?.raw??'')));
 const eventMissing=new Map<string,string>(),columnMissing=new Map<string,string[]>();
 for(const original of profile.setup.events){
  const columns=definitionColumns(original,profile.setup);
  const reasons=[...new Set(columns.flatMap(c=>c===null?[`No source column for ${original.label} is selected in this setup.`]:missing.has(c)?[`${original.label}: ${missing.get(c)}`]:[]))];
  if(reasons.length)columnMissing.set(original.id,reasons);
  if(setup.shape==='event'&&!original.values.some(v=>values.has(v))){
   eventMissing.set(original.id,`Missing event type for ${original.label}: ${original.values.map(v=>`“${v}”`).join(' or ')} is not recorded for any identified run in this file.`);
  }
  const all=[...(eventMissing.has(original.id)?[eventMissing.get(original.id)!]:[]),...reasons];
  if(all.length)availability.definitions[original.id]=all;
 }
 for(const m of setup.measurements){
  const reasons=measurementSources(m).flatMap(id=>[
   ...(eventMissing.has(id)?[eventMissing.get(id)!]:[]),
   ...(m.template==='Count'?[]:columnMissing.get(id)??[])
  ]);
  if(!reasons.length)continue;
  const message=`${isMeasurementRequired(m)?'Required':'Optional'} measurement “${m.label}” cannot be calculated for any run: ${[...new Set(reasons)].join(' ')}`;
  (isMeasurementRequired(m)?differences:notes).push(message);
 }
 for(const [id,reasons] of Object.entries(availability.definitions)){
  const message=reasons.join(' ');
  notes.push(message);
  availability.issues.push({code:'file-missing-source',level:'missing',message,lines:[],definitionIds:[id]});
 }
 for(const [index,reason] of missing){
  const affected=profile.setup.events.filter(e=>definitionColumns(e,profile.setup).includes(index)).map(e=>e.id);
  const message=affected.length?reason:`${reason} Its saved context or identity checks are not assessed; independently recorded measurements are unchanged.`;
  notes.push(message);
  if(!affected.length)availability.issues.push({code:'missing-context',level:'note',message,lines:[],definitionIds:[]});
 }

 // Parsing failures are scoped to each definition by the engine, not global row
 // deletion: e.g. bad changeover cannot erase valid good output on a run-summary row.
 const parsing=new Map<string,number[]>(),groups=new Map<string,typeof rows>();
 for(const row of rows){
  const value=(column:number|null)=>column===null?'':String(row.cells[column]?.raw??'');
  const key=value(setup.mapping[setup.groupBy]);if(key.trim())groups.set(key,[...(groups.get(key)??[]),row]);
  const definitions=setup.shape==='event'?setup.events.filter(e=>e.values.includes(value(setup.mapping.eventType))):setup.events;
  if(setup.shape==='event'&&!definitions.length){
   const reason=`Excluded from calculations: Event type “${value(setup.mapping.eventType)||'(empty)'}” is not defined in this setup.`;
   excluded.push({row,reason});parsing.set(reason,[...(parsing.get(reason)??[]),row.line]);continue;
  }
  const reasons:string[]=[];
  for(const e of definitions){
   const columns=definitionColumns(e,setup);if(columns.some(c=>c===null))continue;
   if(e.kind==='quantity'||e.timing==='duration'){
    if(quantity(row.cells[columns[0]!],file.decimal)===null)reasons.push(`${e.label} has a missing or invalid non-negative number`);
   }else{
    const a=row.cells[columns[0]!],b=row.cells[columns[1]!],start=timestamp(a),end=timestamp(b);
    if(start===null||end===null||end<start||timestampZone(a)!==timestampZone(b))reasons.push(`${e.label} has missing, invalid, reversed or incompatible start/end times`);
   }
  }
  if(setup.mapping.date!==null&&value(setup.mapping.date).trim()&&timestamp(row.cells[setup.mapping.date])===null)reasons.push('Date is invalid or ambiguous; date matching is not assessed');
  for(const reason of reasons){const message=`${reason}. Only dependent results are affected; original rows are kept.`;parsing.set(message,[...(parsing.get(message)??[]),row.line]);}
 }
 for(const [reason,lines] of parsing)notes.push(`${reason} ${lines.length} ${lines.length===1?'row':'rows'} — lines ${lines.join(', ')}.`);
 if(setup.shape==='event')for(const e of setup.events){
  if(eventMissing.has(e.id))continue;
  const absent=[...groups].filter(([,rs])=>!rs.some(r=>e.values.includes(String(r.cells[setup.mapping.eventType!]?.raw??'')))).map(([id])=>id);
  // A timed event missing in individual runs means not logged, not a file mismatch.
  if(absent.length&&e.kind==='quantity')notes.push(`${e.label} is not recorded for runs ${absent.join(', ')}. Only their dependent results are unavailable; other runs remain usable.`);
 }
 return {state:differences.length?'blocked':notes.length?'notes':'matches',differences:[...new Set(differences)],notes:[...new Set(notes)],excluded,setup,headerLine:inspection.headerLine,headers,unmapped,detectedShape,preparedFile,availability};
}

export function calculateCompatible(file:ImportedFile,sheetIndex:number,check:CompatibilityResult):CalculationReport {
 if(check.state==='blocked')throw new Error('This file does not match the setup. Resolve the listed differences before comparing.');
 return calculateFile(check.preparedFile??file,sheetIndex,check.setup,check.headerLine,check.excluded,check.availability);
}
