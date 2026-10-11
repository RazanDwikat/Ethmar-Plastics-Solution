import { columnLetter, inspectSheet, numberValue, type Cell, type ImportedFile, type SourceRow } from './inspection';
import { timestamp } from './calculation-values';
import type { CellTrace, PreparationRecipe, PreparationResult, PreparationStep } from './preparation-types';

export function validatePreparationRecipe(value:unknown):value is PreparationRecipe {
  if(!value||typeof value!=='object')return false;
  const r=value as PreparationRecipe;
  if(r.version!==1||!Array.isArray(r.steps)||r.steps.length>50)return false;
  const ids=new Set<string>();
  return r.steps.every(s=>{
    if(!s||typeof s!=='object'||typeof s.id!=='string'||!s.id||ids.has(s.id))return false;
    ids.add(s.id);
    const text=(...keys:string[])=>keys.every(k=>typeof (s as unknown as Record<string,unknown>)[k]==='string');
    switch(s.kind){
      case 'header':return Number.isInteger(s.line)&&s.line>0;
      case 'exclude':return text('column','value')&&['equals','empty','contains'].includes(s.condition);
      case 'fill':return text('column');
      case 'combine':return text('a','b','name','separator')&&['text','iso-date-time'].includes(s.format);
      case 'multiply':return text('column')&&typeof s.factor==='number';
      case 'calculate':return text('a','b','name')&&['+','-','*','/'].includes(s.operator);
      default:return false;
    }
  });
}
export function preparationStepName(s:PreparationStep):string {
  return {header:'Choose the header row',exclude:'Exclude rows by a condition',fill:'Fill empty cells downward',combine:'Combine columns',multiply:'Convert units',calculate:'Calculated column'}[s.kind];
}
const empty=(c:Cell|undefined)=>c==null||c.raw===null||String(c.raw).trim()==='';
const unionTrace=(cells:Cell[],operation:string):CellTrace=>{
  const origins=cells.flatMap(c=>c.trace?.origins??[]);
  return {
    origins:[...new Map(origins.map(o=>[`${o.file}\0${o.sheet}\0${o.address}`,o])).values()],
    operations:[...new Set([...cells.flatMap(c=>c.trace?.operations??[]),operation])],
  };
};

/** Execute only explicit steps on a separate table; retain original physical row IDs. */
export function prepareFile(input:ImportedFile,sheetIndex:number,recipe:PreparationRecipe,headerLine?:number|null):PreparationResult {
  if(!validatePreparationRecipe(recipe))throw new Error('Preparation steps have an unreadable or unsupported format. Ask your analyst to save the setup again.');
  const originalSheets=input.prepared?.originalSheets??input.sheets;
  const source=originalSheets[sheetIndex];
  if(!source)throw new Error('The worksheet needed for preparation is missing.');
  const originalFile={...input,sheets:originalSheets,prepared:undefined};
  let chosen=inspectSheet(source,input.decimal,headerLine).headerLine;
  if(!recipe.steps.length)return {file:originalFile,headerLine:chosen,headers:inspectSheet(source,input.decimal,chosen).headers,previews:[],excluded:[]};
  let rows=structuredClone(source.rows);
  for(const row of rows)for(const cell of row.cells){
    cell.trace={origins:[{file:input.name,sheet:source.name,line:row.line,endLine:row.endLine,address:cell.address,raw:cell.raw,formula:cell.formula,date:cell.date}],operations:[]};
  }
  let headers=inspectSheet({...source,rows},input.decimal,chosen).headers;
  const previews:PreparationResult['previews']=[],excluded:PreparationResult['excluded']=[];
  const data=()=>rows.filter(r=>chosen===null||r.line>chosen);
  for(let n=0;n<recipe.steps.length;n++){
    const s=recipe.steps[n],name=preparationStepName(s),label=`Step ${n+1} (${name})`;
    const before=structuredClone((s.kind==='header'?rows:data()).slice(0,5)),headersBefore=[...headers],removed:PreparationResult['excluded']=[];
    const fail=(reason:string):never=>{throw new Error(`${label}: ${reason}`)};
    const col=(name:string)=>{
      if(!name.trim())return fail('Choose a source column.');
      const matches=headers.flatMap((h,i)=>h===name?[i]:[]);
      if(matches.length!==1)return fail(matches.length?`Column “${name}” appears more than once and cannot be used safely.`:`Missing column “${name}”.`);
      return matches[0];
    };
    const num=(c:Cell|undefined,row:SourceRow)=>{
      const v=c&&typeof c.raw==='number'?c.raw:numberValue(String(c?.raw??''),input.decimal);
      if(v===null||!Number.isFinite(v))return fail(`Line ${row.line}, ${c?.address??'empty cell'} is not a valid number. No rows were silently skipped.`);
      return v;
    };
    const output=(name:string)=>{
      if(!name.trim())return fail('Give the new column a name.');
      if(headers.some(h=>h.trim().toLowerCase()===name.trim().toLowerCase()))return fail(`Column “${name}” already exists. Choose a different name.`);
      if(headers.length>=300)return fail('The prepared table cannot exceed 300 columns.');
      if(chosen===null)return fail('Choose a header row before adding a column.');
      const i=headers.length;headers=[...headers,name];
      const header=rows.find(r=>r.line===chosen)!;
      while(header.cells.length<i)header.cells.push({address:`${columnLetter(header.cells.length)}${header.line}`,raw:null,display:''});
      header.cells.push({address:`prepared:${name}`,raw:name,display:name,trace:{origins:[],operations:[`${label}: named column “${name}”.`]}});
      return i;
    };
    const derived=(row:SourceRow,index:number,value:string|number,inputs:Cell[],formula:string)=>{
      if(typeof value==='number'&&!Number.isFinite(value))fail(`Line ${row.line}: result exceeds the supported numeric range.`);
      // Numeric derived values remain numbers, independent of the CSV decimal style.
      row.cells[index]={address:`prepared:${headers[index]}:${row.line}`,raw:value,display:String(value),trace:unionTrace(inputs,`${label}, line ${row.line}: ${formula}`)};
    };
    switch(s.kind){
      case 'header':{
        const h=rows.find(r=>r.line===s.line);
        if(!h)fail(`Header line ${s.line} does not exist in the current table.`);
        if(!h!.cells.some(c=>!empty(c)))fail(`Header line ${s.line} is empty.`);
        for(const row of rows.filter(r=>r.line<s.line))removed.push({row,stepId:s.id,reason:`${label}: ignored above header line ${s.line}.`});
        rows=rows.filter(r=>r.line>=s.line);chosen=s.line;
        headers=inspectSheet({...source,rows},input.decimal,chosen).headers;
        break;
      }
      case 'exclude':{
        const i=col(s.column),lines=new Set<number>();
        for(const row of data()){
          const value=String(row.cells[i]?.raw??'');
          if(s.condition==='empty'?empty(row.cells[i]):s.condition==='equals'?value===s.value:value.includes(s.value)){
            lines.add(row.line);removed.push({row,stepId:s.id,reason:`${label}: “${s.column}” ${s.condition==='empty'?'is empty':`${s.condition} ${JSON.stringify(s.value)}`}.`});
          }
        }
        rows=rows.filter(r=>!lines.has(r.line));break;
      }
      case 'fill':{
        const i=col(s.column);let donor:Cell|undefined;
        for(const row of data()){
          const cell=row.cells[i];
          if(!empty(cell)){donor=cell;continue;}
          if(!donor)fail(`Line ${row.line}, “${s.column}” has no earlier value to fill from.`);
          const target=cell??{address:`${columnLetter(i)}${row.line}`,raw:null,display:'',trace:{origins:[{file:input.name,sheet:source.name,line:row.line,endLine:row.endLine,address:`${columnLetter(i)}${row.line}`,raw:null}],operations:[]}};
          row.cells[i]={...donor!,address:`prepared:${headers[i]}:${row.line}`,trace:unionTrace([target,donor!],`${label}, line ${row.line}: filled with ${JSON.stringify(donor!.raw)} from ${donor!.address}.`)};
        }break;
      }
      case 'multiply':{
        const i=col(s.column);
        if(!Number.isFinite(s.factor)||s.factor<=0)fail('Enter a finite conversion factor greater than zero.');
        for(const row of data()){
          const c=row.cells[i],v=num(c,row);
          derived(row,i,v*s.factor,[c],`${v} × ${s.factor} = ${v*s.factor}`);
        }break;
      }
      case 'calculate':{
        const a=col(s.a),b=col(s.b),i=output(s.name);
        for(const row of data()){
          const ca=row.cells[a],cb=row.cells[b],av=num(ca,row),bv=num(cb,row);
          if(s.operator==='/'&&bv===0)fail(`Line ${row.line}: cannot divide by zero in “${s.name}”.`);
          const value=s.operator==='+'?av+bv:s.operator==='-'?av-bv:s.operator==='*'?av*bv:av/bv;
          derived(row,i,value,[ca,cb],`${av} ${s.operator} ${bv} = ${value}`);
        }break;
      }
      case 'combine':{
        const a=col(s.a),b=col(s.b),i=output(s.name);
        for(const row of data()){
          const ca=row.cells[a],cb=row.cells[b];
          if(empty(ca)||empty(cb))fail(`Line ${row.line}: both “${s.a}” and “${s.b}” need a value before combining.`);
          let value=`${String(ca.raw)}${s.separator}${String(cb.raw)}`;
          if(s.format==='iso-date-time'){
            const date=ca.date?.slice(0,10)??String(ca.raw);
            const time=cb.date?.split(/[ T]/)[1]??String(cb.raw);
            if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(time))fail(`Line ${row.line}: use an unambiguous YYYY-MM-DD date and HH:mm[:ss] time. No date order is guessed.`);
            value=`${date} ${time}`;
            if(timestamp({address:'prepared',raw:value,display:value})===null)fail(`Line ${row.line}: the combined date and time are invalid.`);
          }
          derived(row,i,value,[ca,cb],`${JSON.stringify(ca.raw)} + ${JSON.stringify(s.format==='iso-date-time'?' ':s.separator)} + ${JSON.stringify(cb.raw)} → ${JSON.stringify(value)}`);
        }break;
      }
    }
    excluded.push(...removed);
    previews.push({id:s.id,name,headersBefore,headersAfter:[...headers],before,after:structuredClone(data().slice(0,5)),excluded:removed});
  }
  if(!data().some(r=>r.cells.some(c=>!empty(c))))throw new Error('Preparation leaves no data rows. Review the header and exclusion steps.');
  const sheet={...source,rows};
  const file:ImportedFile={...originalFile,sheets:originalSheets.map((s,i)=>i===sheetIndex?sheet:s),prepared:{recipe:structuredClone(recipe),sheetIndex,headerLine:chosen,originalSheets,excluded}};
  return {file,headers,headerLine:chosen,previews,excluded};
}
