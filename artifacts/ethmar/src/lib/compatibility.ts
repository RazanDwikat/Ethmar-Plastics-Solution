import { inspectSheet, type ImportedFile } from './inspection';
import { roles, setupProblems, type Profile, type Setup } from './setup';
import { quantity, timestamp, timestampZone } from './calculation-values';
import { calculateFile, type CalculationReport, type EvidenceRow } from './calculation-engine';
import { detectRowShape } from './row-shape';
import { prepareFile } from './preparation';

export type CompatibilityResult = {
  preparedFile?:ImportedFile;
  state:'matches'|'notes'|'blocked'; differences:string[]; notes:string[];
  excluded:EvidenceRow[]; setup:Setup; headerLine:number|null; headers:string[]; unmapped:string[]; detectedShape:'event'|'run'|null;
};

/** Match original header names exactly. Synonyms belong only to analyst preparation. */
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
  const headers=inspection.headers,setup=structuredClone(profile.setup);
  const differences:string[]=[],notes:string[]=[],excluded:EvidenceRow[]=[];
  if(file.prepared){
    notes.push(`${file.prepared.recipe.steps.length} saved preparation steps applied to a copy. Original values are unchanged.`);
    for(const step of file.prepared.recipe.steps){
      const removed=file.prepared.excluded.filter(e=>e.stepId===step.id);
      if(removed.length)notes.push(`${removed[0].reason} ${removed.length} rows excluded — lines ${removed.map(e=>e.row.line).join(', ')}.`);
    }
  }
  const required=new Set<number>();
  const remap=(index:number|null):number|null=>{
    if(index===null)return null;
    required.add(index);
    const name=profile.headers[index];
    const matches=headers.flatMap((h,i)=>h===name?[i]:[]);
    if(matches.length!==1||profile.headers.filter(h=>h===name).length!==1){
      differences.push(matches.length===0?`Missing column: “${name??`column ${index+1}`}”.`:`Column “${name}” appears more than once; it cannot be matched safely.`);
      return null;
    }
    return matches[0];
  };
  for(const [role] of roles)setup.mapping[role]=remap(setup.mapping[role]);
  for(const e of setup.events){
    e.column=remap(e.column);e.startColumn=remap(e.startColumn);e.endColumn=remap(e.endColumn);e.durationColumn=remap(e.durationColumn);
  }
  setup.customFields=setup.customFields.map(f=>({...f,column:remap(f.column)??-1}));
  const requiredNames=new Set([...required].map(i=>profile.headers[i]));
  const unmapped=headers.filter(h=>!requiredNames.has(h));
  const extra=headers.filter(h=>!profile.headers.includes(h));
  if(extra.length)notes.push(`Extra columns are kept unchanged as unmapped source columns: ${extra.map(h=>`“${h}”`).join(', ')}.`);
  const detectedShape=detectRowShape(sheet,inspection,profile);
  if(detectedShape&&detectedShape!==setup.shape)differences.push(`This file looks like one row per ${detectedShape}, but your setup expects one row per ${setup.shape}.`);
  if(!detectedShape)differences.push('The file structure could not be identified safely: activity and per-run measure columns may conflict, or there is not enough information. Ask your analyst to check this file.');
  if(profile.confirmed===false)differences.push('This setup has not been confirmed by the analyst.');
  differences.push(...setupProblems(profile.setup,profile.headers).errors);
  if(!differences.length){
    const groups=new Map<string,number[]>();
    for(const row of sheet.rows){
      if(inspection.headerLine!==null&&row.line<=inspection.headerLine)continue;
      if(row.cells.every(c=>String(c.raw??'').trim()===''))continue;
      const reasons:string[]=[];
      const value=(column:number|null)=>column===null?'':String(row.cells[column]?.raw??'');
      const number=(column:number|null,label:string)=>{
        if(column!==null&&quantity(row.cells[column],file.decimal)===null)reasons.push(`“${label}” is missing or is not a valid non-negative number`);
      };
      const date=(column:number|null,label:string,required=false)=>{
        if(column!==null&&(required||value(column).trim())&&timestamp(row.cells[column])===null)reasons.push(`“${label}” is missing or is not an unambiguous date/time`);
      };
      const definitions=setup.shape==='event'?setup.events.filter(e=>e.values.includes(value(setup.mapping.eventType))):setup.events;
      if(setup.shape==='event'&&!definitions.length)reasons.push(`Event type “${value(setup.mapping.eventType)||'(empty)'}” is not defined in this setup`);
      for(const e of definitions){
        if(e.kind==='quantity')number(setup.shape==='event'?setup.mapping.quantity:e.column,e.label);
        else if(e.timing==='duration')number(e.durationColumn,`${e.label} duration`);
        else{
          date(e.startColumn,`${e.label} start`,true);date(e.endColumn,`${e.label} end`,true);
          if(e.startColumn!==null&&e.endColumn!==null){
            const a=row.cells[e.startColumn],b=row.cells[e.endColumn],start=timestamp(a),end=timestamp(b);
            if(start!==null&&end!==null&&(end<start||timestampZone(a)!==timestampZone(b)))reasons.push(`${e.label} has reversed times or mixed time-zone formats`);
          }
        }
      }
      date(setup.mapping.date,'Date');
      date(setup.mapping.start,'Start time');
      date(setup.mapping.end,'End time');
      if(reasons.length){
        const reason=`Excluded from calculations: ${reasons.join('; ')}.`;
        excluded.push({row,reason});
        groups.set(reason,[...(groups.get(reason)??[]),row.line]);
      }
    }
    for(const [reason,lines] of groups)notes.push(`${reason} ${lines.length} ${lines.length===1?'row':'rows'} — lines ${lines.join(', ')}.`);
  }
  return {state:differences.length?'blocked':notes.length?'notes':'matches',differences:[...new Set(differences)],notes,excluded,setup,headerLine:inspection.headerLine,headers,unmapped,detectedShape,preparedFile};
}

export function calculateCompatible(file:ImportedFile,sheetIndex:number,check:CompatibilityResult):CalculationReport {
  if(check.state==='blocked')throw new Error('This file does not match the setup. Resolve the listed differences before comparing.');
  return calculateFile(check.preparedFile??file,sheetIndex,check.setup,check.headerLine,check.excluded);
}
