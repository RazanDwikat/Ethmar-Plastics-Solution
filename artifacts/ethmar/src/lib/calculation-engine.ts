import { inspectSheet, type ImportedFile, type SourceRow } from './inspection';
import { setupProblems, type Setup, type Measurement } from './setup';
import { formatCalculated, numberText, quantity, timestamp, timestampZone } from './calculation-values';
import type { CalculationReport, CalculatedRun, CalculatedValue, DataIssue, Evidence, EvidenceRow } from './calculation-types';
export { formatCalculated } from './calculation-values';
export type * from './calculation-types';

const text=(r:SourceRow,index:number|null)=>index===null?'':String(r.cells[index]?.raw??'');
const signature=(r:SourceRow)=>JSON.stringify(r.cells.map(c=>[c.raw,c.formula??null]));
const uniqueRows=(rows:EvidenceRow[])=>[...new Map(rows.map(r=>[r.row.line,r])).values()];
type Interval={start:number;end:number;row:SourceRow;definitionId:string;zone:'naive'|'offset'};
type DefinitionResult={measure:CalculatedValue; validRows:SourceRow[]; intervals:Interval[]; count:number|null; countRows:SourceRow[]};

export function calculateFile(file:ImportedFile,sheetIndex:number,setup:Setup,headerLine?:number|null,compatibilityExcluded:EvidenceRow[]=[]):CalculationReport {
  const sheet=file.sheets[sheetIndex];
  if(!sheet)throw new Error('Select a worksheet before calculating.');
  const inspection=inspectSheet(sheet,file.decimal,headerLine);
  const validation=setupProblems(setup,inspection.headers);
  if(validation.errors.length)throw new Error(`Review your setup first: ${validation.errors.join(' ')}`);
  const mapping={setup:structuredClone(setup),headers:[...inspection.headers],decimal:file.decimal,sheet:sheet.name,file:file.name};
  const issues:DataIssue[]=[],excluded:EvidenceRow[]=[...compatibilityExcluded];
  const compatibilityLines=new Set(compatibilityExcluded.map(e=>e.row.line));
  const add=(target:DataIssue[],code:string,level:DataIssue['level'],message:string,rows:SourceRow[],definitionIds:string[]=[])=>{
    target.push({code,level,message,lines:[...new Set(rows.map(r=>r.line))],definitionIds});
  };
  for(const entry of compatibilityExcluded)add(issues,'compatibility-exclusion','note',entry.reason,[entry.row]);
  const structural=new Map<number,string>();
  for(const issue of inspection.issues){
    if(['repeated-header','multiple-headers','totals'].includes(issue.code))
      for(const line of issue.lines)structural.set(line,issue.code==='totals'?'Possible totals row: excluded to avoid mixing summaries with records; review the original.':'Additional header row: not a production record.');
  }
  const candidates:SourceRow[]=[];
  for(const row of sheet.rows){
    let reason='';
    if(inspection.headerLine!==null&&row.line<=inspection.headerLine)reason=row.line===inspection.headerLine?'Header row.':'Row before the selected header.';
    else if(row.cells.every(c=>String(c.raw??'').trim()===''))reason='Empty row; no production values.';
    else if(structural.has(row.line))reason=structural.get(row.line)!;
    if(reason){excluded.push({row,reason});continue;}
    candidates.push(row);
  }
  const structuralExcluded=excluded.filter(x=>structural.has(x.row.line));
  for(const e of structuralExcluded)add(issues,'excluded-structure','note',e.reason,[e.row]);
  for(const issue of inspection.issues.filter(i=>['merged','formulas','formula-no-cache'].includes(i.code)))
    issues.push({code:issue.code,level:'note',message:issue.message,lines:issue.lines,definitionIds:[]});
  if(setup.shape==='event'&&setup.mapping.eventId===null)
    add(issues,'no-event-id','note','No event ID column is mapped, so repeated events cannot be identified safely. Each source row is treated as a separate record.',[]);
  const groups=new Map<string,SourceRow[]>();
  for(const row of candidates){
    const key=text(row,setup.mapping[setup.groupBy]);
    if(!key.trim()){
      const reason=`Missing ${setup.groupBy==='runId'?'run':'order'} ID: this row cannot be assigned to a run.`;
      excluded.push({row,reason});add(issues,'missing-group','missing',reason,[row]);continue;
    }
    groups.set(key,[...(groups.get(key)??[]),row]);
  }
  // Deduplication is file-wide by event ID, not limited to the selected run.
  const idGroups=new Map<string,SourceRow[]>(),duplicates=new Map<number,SourceRow>(),conflicts=new Map<number,SourceRow[]>();
  if(setup.shape==='event'&&setup.mapping.eventId!==null){
    for(const row of candidates){
      const id=text(row,setup.mapping.eventId);if(!id.trim())continue;
      idGroups.set(id,[...(idGroups.get(id)??[]),row]);
    }
    for(const rows of idGroups.values()){
      if(rows.length<2)continue;
      if(new Set(rows.map(signature)).size===1)rows.slice(1).forEach(r=>duplicates.set(r.line,rows[0]));
      else rows.forEach(r=>conflicts.set(r.line,rows));
    }
  }
  const runs:CalculatedRun[]=[];
  for(const [id,allRows] of groups){
    const runIssues:DataIssue[]=[];
    const runExclusions:EvidenceRow[]=compatibilityExcluded.filter(e=>allRows.some(r=>r.line===e.row.line));
    for(const entry of runExclusions)add(runIssues,'compatibility-exclusion','note',entry.reason,[entry.row]);
    let rows=allRows;
    if(setup.shape==='run'&&allRows.length>1){
      const unique=new Map<string,SourceRow>();
      for(const r of allRows){
        const key=signature(r),first=unique.get(key);
        if(first){duplicates.set(r.line,first);runExclusions.push({row:r,reason:`Identical run-summary row; line ${first.line} is used once.`});}
        else unique.set(key,r);
      }
      rows=[...unique.values()];
      if(rows.length>1)add(runIssues,'repeated-run','note','Several summary rows share this identifier. Matching measure values count once; disagreeing measures cannot be calculated.',allRows);
    }
    const handledIds=new Set<string>();
    for(const r of allRows){
      if(duplicates.has(r.line)){
        const first=duplicates.get(r.line)!;
        if(!runExclusions.some(x=>x.row.line===r.line))runExclusions.push({row:r,reason:`Identical event ID and values; line ${first.line} is counted once instead.`});
        add(runIssues,'duplicate','note',`Duplicate record on lines ${first.line} and ${r.line}: counted once; both originals are retained.`,[first,r]);
      }
      if(conflicts.has(r.line)){
        const key=text(r,setup.mapping.eventId),related=conflicts.get(r.line)!;
        if(!handledIds.has(key)){
          handledIds.add(key);
          add(runIssues,'conflicting-id','missing',`Event ID “${key}” has conflicting original values. No version wins; affected results cannot be calculated.`,related,
            setup.events.filter(e=>related.some(row=>e.values.includes(text(row,setup.mapping.eventType)))).map(e=>e.id));
        }
      }
      if(setup.shape==='event'){
        if(setup.mapping.eventId!==null&&!text(r,setup.mapping.eventId).trim())add(runIssues,'missing-event-id','note','This record has no event ID; duplicate checking is not possible for it.',[r]);
        const event=text(r,setup.mapping.eventType);
        if(!setup.events.some(e=>e.values.includes(event))){
          const reason=event.trim()?`Unrecognized activity “${event}”: no configured source value matches it.`:'The activity value is missing, so this record cannot be interpreted.';
          add(runIssues,'unknown-activity','note',reason,[r]);
          runExclusions.push({row:r,reason});
        }
      }
      if(setup.mapping.date!==null&&text(r,setup.mapping.date).trim()&&timestamp(r.cells[setup.mapping.date])===null)
        add(runIssues,'invalid-date','note','The recorded date is invalid or ambiguous. It cannot be used for date matching; other measures are unchanged.',[r]);
    }
    const results=new Map<string,DefinitionResult>();
    for(const definition of setup.events){
      const source=setup.shape==='event'?rows.filter(r=>definition.values.includes(text(r,setup.mapping.eventType))):rows;
      const active=source.filter(r=>!duplicates.has(r.line)&&!compatibilityLines.has(r.line));
      const localExcluded=[...excluded,...runExclusions.filter(x=>source.some(r=>r.line===x.row.line))];
      const evidence:Evidence={formula:'',used:[],excluded:localExcluded,notes:[],mapping};
      const unit=definition.kind==='timed'?'hours':setup.unit;
      const measure:CalculatedValue={id:definition.id,label:definition.label,value:null,unit,state:'unavailable',reason:'',evidence};
      const result:DefinitionResult={measure,validRows:[],intervals:[],count:null,countRows:[]};
      results.set(definition.id,result);
      const fail=(reason:string,code:string,affected:SourceRow[],state:CalculatedValue['state']='unavailable')=>{
        measure.reason=reason;measure.state=state;evidence.formula=`Can't calculate: ${reason}`;
        add(runIssues,code,state==='not-logged'?'note':'missing',reason,affected,[definition.id]);
      };
      // Unknown conflicting row types could belong to any configured activity.
      const affectedConflicts=source.flatMap(r=>conflicts.get(r.line)??[]);
      const unknownConflict=allRows.filter(r=>conflicts.has(r.line)&&!setup.events.some(e=>e.values.includes(text(r,setup.mapping.eventType))));
      if(affectedConflicts.length||unknownConflict.length){
        const refs=[...affectedConflicts,...unknownConflict];
        evidence.excluded.push(...refs.map(row=>({row,reason:'Conflicting event ID: no original row is selected as correct.'})));
        fail(`${definition.label} has a conflicting event ID, so no total is chosen.`,'conflict-measure',refs);continue;
      }
      if(!active.length){
        fail(`No ${definition.label} record is logged for this run.`,'not-logged',[],definition.kind==='timed'?'not-logged':'unavailable');continue;
      }
      result.count=setup.shape==='run'?1:active.length;
      result.countRows=setup.shape==='run'?[active[0]]:active;
      const columns=definition.kind==='quantity'?[setup.shape==='event'?setup.mapping.quantity:definition.column]:
        definition.timing==='range'?[definition.startColumn,definition.endColumn]:[definition.durationColumn];
      if(columns.some(c=>c===null)){
        evidence.excluded.push(...active.map(row=>({row,reason:`Source columns for ${definition.label} are not fully mapped.`})));
        fail(`${definition.label} is unavailable because its source columns are not mapped.`,'missing-column',active);continue;
      }
      const entries:{row:SourceRow;value:number;formula:string;interval?:Interval}[]=[];
      let invalid=false;
      for(const row of active){
        let value:number|null=null,formula='',why='';
        if(definition.kind==='quantity'){
          const cell=row.cells[columns[0]!];value=quantity(cell,file.decimal);
          formula=value===null?'':`${numberText(value)} ${unit} [${cell?.address??`line ${row.line}`}]`;
          if(value===null)why='The quantity is missing, negative, or not a valid number.';
        }else if(definition.timing==='duration'){
          const cell=row.cells[definition.durationColumn!],raw=quantity(cell,file.decimal);
          value=raw===null?null:raw/(definition.durationUnit==='minutes'?60:definition.durationUnit==='seconds'?3600:1);
          formula=raw===null?'':`${numberText(raw)} ${definition.durationUnit} [${cell?.address}] = ${numberText(value!)} h`;
          if(value===null)why='The duration is missing, negative, or not a valid number.';
        }else{
          const a=row.cells[definition.startColumn!],b=row.cells[definition.endColumn!],start=timestamp(a),end=timestamp(b);
          if(start===null||end===null)why='A start or end time is missing, invalid, or ambiguous; use an ISO date such as 2026-10-08 13:00.';
          else if(timestampZone(a)!==timestampZone(b))why='Start and end use different timezone styles; no timezone is guessed.';
          else if(end<start)why='The end time is earlier than the start time.';
          else {
            value=(end-start)/3600000;
            formula=`(${String(b.date??b.raw)} [${b.address}] − ${String(a.date??a.raw)} [${a.address}]) = ${numberText(value)} h`;
            const interval={start,end,row,definitionId:definition.id,zone:timestampZone(a)};
            entries.push({row,value,formula,interval});continue;
          }
        }
        if(value===null){
          invalid=true;evidence.excluded.push({row,reason:why});
          add(runIssues,'invalid-value','missing',`${definition.label}: ${why}`,[row],[definition.id]);
        }else entries.push({row,value,formula});
      }
      evidence.used=entries.map(e=>({row:e.row,reason:e.formula}));
      if(invalid){
        fail(`${definition.label} has missing or invalid source values; a partial total would be misleading.`,'incomplete-measure',active);
        continue;
      }
      let selected=entries;
      if(setup.shape==='run'&&entries.length>1){
        if(new Set(entries.map(e=>e.value)).size!==1){
          evidence.used=[];evidence.excluded.push(...entries.map(e=>({row:e.row,reason:'Run summaries disagree for this measure; no value wins.'})));
          fail(`${definition.label} differs between summary rows for the same run.`,'conflicting-summary',active);continue;
        }
        selected=[entries[0]];
        evidence.excluded.push(...entries.slice(1).map(e=>({row:e.row,reason:`Same summary measure value as line ${entries[0].row.line}; not added twice.`})));
        evidence.used=[{row:entries[0].row,reason:entries[0].formula}];
      }
      result.validRows=selected.map(e=>e.row);result.count=selected.length;
      result.intervals=selected.flatMap(e=>e.interval?[e.interval]:[]);
      measure.value=selected.reduce((sum,e)=>sum+e.value,0);
      if(!Number.isFinite(measure.value)){measure.value=null;fail(`${definition.label} exceeds the supported numeric range.`,'overflow',active);continue;}
      measure.state='available';
      evidence.formula=`${selected.map(e=>e.formula).join(' + ')} = ${formatCalculated(measure)}`;
      evidence.excluded=uniqueRows(evidence.excluded);
      if(definition.kind==='timed'){
        evidence.notes.push('Durations are summed exactly as recorded. No overlapping time is subtracted or merged.');
        if(definition.timing==='range')evidence.notes.push('ISO timestamps without an offset use recorded wall-clock time. No timezone or daylight-saving correction is guessed.');
      }
      if(evidence.used.some(e=>e.row.cells.some(c=>c.formula!==undefined)))evidence.notes.push('Saved spreadsheet formula results are used without recalculation and may be out of date.');
    }
    detectOverlaps([...results.values()].flatMap(r=>r.intervals),setup,runIssues);
    if(setup.events.filter(e=>e.kind==='timed').some(e=>e.timing==='duration'))
      add(runIssues,'overlap-not-assessed','note','Time overlap cannot be assessed for duration-only measures because their start and end times are not recorded.',[]);
    checkBalance(results,setup,runIssues);
    const metrics=setup.measurements.map(m=>calculateMetric(m,results,mapping,runIssues));
    for(const metric of metrics)if(metric.state==='unavailable'&&!runIssues.some(i=>i.message===metric.reason))
      add(runIssues,'unavailable-metric','missing',`${metric.label}: ${metric.reason}`,metric.evidence.used.map(r=>r.row));
    // Reflect run warnings in each affected number's evidence without hiding unrelated results.
    for(const value of [...results.values()].map(r=>r.measure).concat(metrics)){
      value.evidence.notes.push(...runIssues.filter(i=>!i.definitionIds.length||i.definitionIds.includes(value.id)||value.evidence.used.some(r=>i.lines.includes(r.row.line))).map(i=>i.message));
      value.evidence.notes=[...new Set(value.evidence.notes)];
      value.evidence.excluded=uniqueRows(value.evidence.excluded);
    }
    const measures=[...results.values()].map(r=>r.measure);
    runs.push({id,rows:allRows,measures,metrics,issues:runIssues,health:runIssues.some(i=>i.level==='missing')?'missing':runIssues.length?'note':'clear'});
  }
  if(!runs.length)add(issues,'no-runs','missing','No identified production runs remain. Review the grouping column and excluded rows.',[]);
  return {runs,issues,excluded,source:file,sheetIndex,setup:structuredClone(setup)};
}

function detectOverlaps(intervals:Interval[],setup:Setup,issues:DataIssue[]){
  if(new Set(intervals.map(i=>i.zone)).size>1)
    issues.push({code:'mixed-timezones',level:'note',message:'Some intervals have explicit timezones and others do not. Overlap between those groups is not assessed; no timezone is guessed.',lines:intervals.map(i=>i.row.line),definitionIds:[...new Set(intervals.map(i=>i.definitionId))]});
  const sorted=[...intervals].sort((a,b)=>a.start-b.start);
  for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length&&sorted[j].start<sorted[i].end;j++){
    const a=sorted[i],b=sorted[j];
    if(a.zone!==b.zone){
      issues.push({code:'overlap-zone',level:'note',message:'Time overlap cannot be assessed between offset and unzoned timestamps; no timezone is guessed.',lines:[a.row.line,b.row.line],definitionIds:[a.definitionId,b.definitionId]});continue;
    }
    if(Math.max(a.start,b.start)>=Math.min(a.end,b.end))continue;
    const label=(id:string)=>setup.events.find(e=>e.id===id)?.label??id;
    issues.push({code:'overlap',level:'note',message:`${label(a.definitionId)} and ${label(b.definitionId)} overlap on lines ${a.row.line} and ${b.row.line}. Both recorded durations remain separate and unchanged.`,lines:[a.row.line,b.row.line],definitionIds:[a.definitionId,b.definitionId]});
  }
}
function checkBalance(results:Map<string,DefinitionResult>,setup:Setup,issues:DataIssue[]){
  if(!setup.checkBalance)return;
  const [input,good,scrap]=['material','good','scrap'].map(id=>results.get(id)?.measure);
  if(!input||!good||!scrap||[input,good,scrap].some(v=>v.value===null)){
    issues.push({code:'balance-not-assessed',level:'note',message:'Input balance is not assessed because material input, good output, or scrap is unavailable or no longer defined.',lines:[],definitionIds:['material','good','scrap']});return;
  }
  const difference=good.value!+scrap.value!-input.value!;
  if(Math.abs(difference)>Math.max(1,Math.abs(input.value!))*1e-10)
    issues.push({code:'imbalance',level:'note',message:`${good.label} (${numberText(good.value!)} ${setup.unit}) + ${scrap.label} (${numberText(scrap.value!)} ${setup.unit}) does not equal ${input.label} (${numberText(input.value!)} ${setup.unit}). Difference: ${numberText(difference)} ${setup.unit}; no values are changed.`,lines:[...new Set([input,good,scrap].flatMap(v=>v.evidence.used.map(r=>r.row.line)))],definitionIds:['material','good','scrap']});
}
function calculateMetric(m:Measurement,results:Map<string,DefinitionResult>,mapping:Evidence['mapping'],issues:DataIssue[]):CalculatedValue {
  const a=results.get(m.a),needsB=['Ratio','Difference','Rate per hour'].includes(m.template),b=needsB?results.get(m.b):undefined;
  const operands=[a,b].filter((x):x is DefinitionResult=>!!x);
  const evidence:Evidence={formula:'',mapping,used:uniqueRows(operands.flatMap(o=>o.measure.evidence.used)),excluded:uniqueRows(operands.flatMap(o=>o.measure.evidence.excluded)),notes:[...new Set(operands.flatMap(o=>o.measure.evidence.notes))]};
  const unit=m.template==='Ratio'?'%':m.template==='Count'?'records':m.template==='Rate per hour'?`${a?.measure.unit??mapping.setup.unit}/h`:a?.measure.unit??mapping.setup.unit;
  const value:CalculatedValue={id:m.id,label:m.label,value:null,unit,state:'unavailable',reason:'',evidence};
  const fail=(reason:string)=>{value.reason=reason;evidence.formula=`Can't calculate: ${reason}`;return value;};
  if(!a||(needsB&&!b))return fail('A configured source is missing. Review this measurement in Setup.');
  if(m.template==='Count'&&a.count!==null){
    value.value=a.count;value.state='available';
    evidence.used=a.countRows.map(row=>({row,reason:'One identified source record is counted; its quantity or duration is not required for Count.'}));
    evidence.excluded=evidence.excluded.filter(e=>!a.countRows.some(r=>r.line===e.row.line));
    evidence.formula=`Count ${a.count} included records = ${a.count} records`;
    evidence.notes.push('Count uses record identity, not quantity or duration. Invalid values may still affect other measurements.');
    return value;
  }
  const bad=operands.find(o=>o.measure.value===null);
  if(bad){value.state=!needsB&&bad.measure.state==='not-logged'?'not-logged':'unavailable';return fail(bad.measure.reason);}
  const av=a.measure.value!,bv=b?.measure.value??0;
  if((m.template==='Ratio'||m.template==='Difference')&&a.measure.unit!==b?.measure.unit)return fail('The two sources use different units; choose compatible sources.');
  switch(m.template){
    case 'Total':case 'Duration':value.value=av;evidence.formula=a.measure.evidence.formula;break;
    case 'Ratio':
      if(bv===0)return fail(`${b!.measure.label} is zero, so this ratio cannot be calculated.`);
      value.value=av/bv*100;evidence.formula=`${a.measure.label}: ${numberText(av)} ÷ ${b!.measure.label}: ${numberText(bv)} × 100 = ${numberText(value.value)}%`;break;
    case 'Difference':value.value=av-bv;evidence.formula=`${numberText(av)} − ${numberText(bv)} = ${numberText(value.value)} ${unit}`;break;
    case 'Count':value.value=a.count;evidence.formula=`Count ${a.count} included records = ${a.count} records`;break;
    case 'Rate per hour':
      if(bv===0)return fail(`${b!.measure.label} is zero hours, so a rate per hour cannot be calculated.`);
      value.value=av/bv;evidence.formula=`${numberText(av)} ${a.measure.unit} ÷ ${numberText(bv)} h = ${numberText(value.value)} ${unit}`;break;
    case 'Average':value.value=a.count?av/a.count:null;evidence.formula=`${numberText(av)} ${unit} ÷ ${a.count} included records = ${numberText(value.value!)} ${unit}`;break;
  }
  if(value.value===null||!Number.isFinite(value.value)){value.value=null;return fail('The calculation exceeds the supported numeric range or has no valid records.');}
  value.state='available';
  evidence.notes.push(...issues.filter(i=>i.definitionIds.includes(m.a)||(needsB&&i.definitionIds.includes(m.b))).map(i=>i.message));
  return value;
}
