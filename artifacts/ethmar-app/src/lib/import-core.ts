import Papa from 'papaparse';
import {defaultSettings} from './defaults';
import {roles} from './import-types';
import type {ParsedFile, Row, Settings, Inspection, ImportRecord, Decision, Problem} from './import-types';

const normalize=(s:string)=>s.trim().normalize('NFKC').toLocaleLowerCase().replace(/[\s_-]+/g,' ');
const nonempty=(r:Row)=>r.values.some(v=>v.trim()!=='');
const breaks=(s:string)=>(s.match(/\r\n|\r|\n/g)||[]).length;
const numeric=(s:string)=>/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(s.trim());
const dateStyle=(s:string)=>/^\d{4}-\d{2}-\d{2}(?:[ T].*)?$/.test(s.trim())?'ISO':/^\d{1,2}\/\d{1,2}\/\d{4}(?:[ T].*)?$/.test(s.trim())?'slash':/^\d{1,2}-\d{1,2}-\d{4}(?:[ T].*)?$/.test(s.trim())?'dash':'';

function delimiterGuess(text:string):string {
  const candidates=[',',';','\t','|'];
  let chosen='',best=0;
  for(const delimiter of candidates){
    const probe=Papa.parse<string[]>(text,{delimiter,header:false,dynamicTyping:false,skipEmptyLines:false,preview:30});
    const widths=probe.data.filter(r=>r.some(v=>v.trim())).map(r=>r.length);
    const freq=new Map<number,number>();
    for(const w of widths)if(w>1)freq.set(w,(freq.get(w)||0)+1);
    const score=Math.max(0,...[...freq].map(([w,n])=>n*10+Math.min(w,9)));
    if(score>best){chosen=delimiter;best=score;}
  }
  return chosen;
}

export function parseCsv(originalText:string,name:string,encoding='UTF-8',delimiter?:string):ParsedFile{
  const text=originalText.startsWith('\uFEFF')?originalText.slice(1):originalText;
  const detected=delimiter??delimiterGuess(text);
  const file:ParsedFile={name,originalText,encoding,delimiter:detected,rows:[],suggestedHeader:null,suggestedShape:'event',errors:[]};
  if(!text.trim()){file.errors.push('This file is empty. Export a CSV containing a heading row and production records.');return file;}
  if(text.includes('\0')){file.errors.push('This file contains unreadable characters. Export it as UTF-8 CSV and try again.');return file;}
  let offset=0,line=1;
  Papa.parse<string[]>(text,{delimiter:detected||',',header:false,dynamicTyping:false,skipEmptyLines:false,
    step(result){
      const end=result.meta.cursor;
      if(offset>=text.length)return;
      const raw=text.slice(offset,end);
      const content=raw.replace(/(?:\r\n|\r|\n)$/,'');
      const row:Row={id:file.rows.length,line,endLine:line+breaks(content),values:[...result.data],raw};
      file.rows.push(row);
      for(const err of result.errors)file.errors.push(`CSV line ${line}: ${err.message}. Check the quoting and export the file again.`);
      line+=breaks(raw);offset=end;
    }});
  const counts=new Map<number,number>();
  file.rows.filter(nonempty).forEach(r=>counts.set(r.values.length,(counts.get(r.values.length)||0)+1));
  const width=[...counts].sort((a,b)=>b[1]-a[1]||b[0]-a[0])[0]?.[0]??0;
  const aliases=Object.values(defaultSettings().synonyms).flat().map(normalize);
  const candidate=file.rows.find(r=>r.values.length===width&&nonempty(r)&&(
    r.values.some(v=>aliases.includes(normalize(v)))||
    (r.values.every(v=>v.trim()!==''&&!numeric(v)&&!dateStyle(v))&&
      file.rows.some(later=>later.id>r.id&&later.values.length===width&&later.values.some(v=>numeric(v)||dateStyle(v))))
  ));
  file.suggestedHeader=candidate?.id??null;
  if(candidate){
    const map=suggestMapping(candidate.values.map((label,index)=>({key:`c${index}`,label,index})),defaultSettings().synonyms);
    file.suggestedShape=map.eventType?'event':'run';
  }
  return file;
}

export async function readCsv(file:File):Promise<ParsedFile>{
  if(file.size>25*1024*1024)throw new Error('This file is larger than 25 MB. Export a smaller date range to review it safely in this browser.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const encoding=bytes[0]===0xff&&bytes[1]===0xfe?'UTF-16LE':bytes[0]===0xfe&&bytes[1]===0xff?'UTF-16BE':'UTF-8';
  try{
    // Retain the BOM in originalText; parsing strips it only from the first cell.
    const text=new TextDecoder(encoding,{fatal:true,ignoreBOM:true}).decode(bytes);
    return parseCsv(text,file.name,encoding);
  }catch{throw new Error('This file could not be read as UTF-8 or UTF-16 text. Export it as UTF-8 CSV (not an Excel workbook) and try again.');}
}

export function suggestMapping(headers:Inspection['headers'],synonyms:Settings['synonyms']):Settings['mapping']{
  const mapping:Settings['mapping']={};
  for(const role of roles){
    const matches=headers.filter(h=>(synonyms[role]||[]).some(alias=>normalize(alias)===normalize(h.label)));
    if(matches.length===1)mapping[role]=matches[0].key;
  }
  return mapping;
}

export function inspectImport(file:ParsedFile,headerId:number|null,decisions:Record<number,Decision>):Inspection{
  const header=file.rows.find(r=>r.id===headerId);
  const width=header?.values.length??file.rows.reduce((max,r)=>Math.max(max,r.values.length),0);
  const headers=Array.from({length:width},(_,index)=>({key:`c${index}`,label:header?.values[index]??`Column ${index+1}`,index}));
  const problems:Problem[]=[];
  const add=(row:Row,kind:string,message:string)=>problems.push({id:`${row.id}-${kind}`,line:row.line,kind,message});
  if(header&&(header.values.some(v=>!v.trim())||new Set(header.values.map(normalize)).size!==header.values.length))
    add(header,'headings','Some headings are blank or repeated. Choose a single clear header row; CSV cannot establish whether spreadsheet cells were merged.');
  const originalData=file.rows.filter(r=>r.id!==headerId);
  for(const row of originalData){
    if(!nonempty(row))add(row,'blank','This row is empty. Choose whether to ignore it or keep it.');
    if(header&&row.id<header.id&&nonempty(row))add(row,'title','This row is above the suggested header and may be a title. It has not been removed.');
    if(header&&JSON.stringify(row.values)===JSON.stringify(header.values))add(row,'repeated-header','The header appears again inside the data.');
    if(row.values.some(v=>/^(grand\s+total|sub\s*total|total|المجموع|الإجمالي)$/i.test(v.trim())))add(row,'total','This row looks like a total mixed with individual records.');
    if(nonempty(row)&&row.values.length!==width)add(row,'width','This row has a different number of cells. Check for an extra heading or a broken separator.');
    if(row.values.some(v=>/^[+-]?\d{1,3}(?:[, ]\d{3})+(?:\.\d+)?$/.test(v.trim())||/^[+-]?\d+,\d+$/.test(v.trim())))
      add(row,'text-number','A value such as “1,000” needs a number-format decision. The original text is unchanged; decimal settings are confirmed in the next step.');
  }
  const usable=originalData.filter(r=>nonempty(r)&&(!header||r.id>header.id)&&JSON.stringify(r.values)!==JSON.stringify(header?.values));
  for(let index=0;index<width;index++){
    const styles=usable.map(r=>({r,style:dateStyle(r.values[index]||'')})).filter(v=>v.style);
    const freq=new Map<string,number>();styles.forEach(v=>freq.set(v.style,(freq.get(v.style)||0)+1));
    const common=[...freq].sort((a,b)=>b[1]-a[1])[0]?.[0];
    if(freq.size>1)styles.filter(v=>v.style!==common).forEach(({r})=>add(r,`date-${index}`,'This date uses a different format from other values in its column. Confirm how dates should be read.'));
  }
  const columns=headers.map(h=>{
    const examples=[...new Set(usable.map(r=>r.values[h.index]??'').filter(v=>v.trim()))].slice(0,4);
    const values=usable.map(r=>r.values[h.index]??'').filter(v=>v.trim());
    const type=values.length&&values.every(v=>dateStyle(v))?'Date':values.length&&values.every(numeric)?'Number':'Text';
    return {...h,type,examples};
  });
  return {headers,problems,columns,headerFound:!!header,dataRows:originalData.filter(r=>decisions[r.id]!=='ignore')};
}

export function makeImport(file:ParsedFile):ImportRecord{
  const settings=defaultSettings();
  settings.shape=file.suggestedShape;
  const {headers}=inspectImport(file,file.suggestedHeader,{});
  settings.mapping=suggestMapping(headers,settings.synonyms);
  return {id:crypto.randomUUID(),createdAt:new Date().toISOString(),file,headerId:file.suggestedHeader,decisions:{},settings,confirmed:false};
}

export function validateSetup(record:ImportRecord):string[]{
  const {file,settings:s}=record;
  if(file.errors.length)return [...file.errors];
  const inspection=inspectImport(file,record.headerId,record.decisions);
  const keys=new Set(inspection.headers.map(h=>h.key));
  const issues:string[]=[];
  const valid=(key:string|undefined)=>!!key&&keys.has(key);
  const identity=s.mapping.run||s.mapping.order;
  if(!valid(identity))issues.push('Choose a column that identifies each run or order. If none exists, add one in your source system and export the file again.');
  else {
    const index=inspection.headers.find(h=>h.key===identity)!.index;
    if(!inspection.dataRows.some(r=>(r.values[index]??'').trim()))issues.push('The chosen run column has no recorded identifiers. Choose another column or export a file with run identifiers.');
    else for(const row of inspection.dataRows)if(!(row.values[index]??'').trim())
      issues.push(`CSV line ${row.line} has no run identifier. Choose the correct column, explicitly ignore this row in File check, or correct the source file and import it again.`);
  }
  for(const [role,key] of Object.entries(s.mapping))if(key&&!keys.has(key))issues.push(`The saved ${role} column is not in this file. Choose its column again.`);
  if(!s.quantityUnit.trim())issues.push('Enter a quantity unit.');
  if(!s.definitions.length)issues.push('Add at least one event type or measure.');
  const labels=new Set<string>();
  for(const d of s.definitions){
    if(!d.label.trim()||labels.has(d.label.trim().toLocaleLowerCase()))issues.push('Give each event type or measure a unique, non-empty name.');
    labels.add(d.label.trim().toLocaleLowerCase());
    if(s.shape==='run'){
      if(!valid(d.column))issues.push(`Choose the column for ${d.label||'this measure'}.`);
    } else {
      if(!valid(s.mapping.eventType))issues.push('Choose the column that contains event names.');
      if(!d.values.length||d.values.every(v=>!v.trim()))issues.push(`Enter at least one source value for ${d.label||'this event type'}.`);
      if(d.kind==='quantity'&&!valid(s.mapping.quantity))issues.push('Choose the recorded quantity column.');
      if(d.kind==='timed'){
        if(d.timeMode==='duration'&&!valid(d.duration||s.mapping.duration))issues.push(`Choose a recorded duration column for ${d.label}.`);
        if(d.timeMode==='range'&&(!valid(d.start||s.mapping.start)||!valid(d.end||s.mapping.end)))issues.push(`Choose start and end columns for ${d.label}.`);
      }
    }
  }
  for(const field of s.customFields)if(!field.label.trim()||!valid(field.column))issues.push('Each custom field needs a name and an available source column.');
  return [...new Set(issues)];
}
