import {roles,templates} from './setup';
import {validatePreparationRecipe} from './preparation';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object';
const list=(v:unknown,test:(item:unknown)=>boolean):boolean=>Array.isArray(v)&&v.every(test);
const text=(v:unknown):v is string=>typeof v==='string';
const column=(v:unknown)=>v===null||(typeof v==='number'&&Number.isInteger(v)&&v>=-1);
function formulaFields(m:Record<string,unknown>){
 return (m.formula===undefined||text(m.formula))
 &&(m.headline===undefined||typeof m.headline==='boolean')
 &&(m.decimals===undefined||(typeof m.decimals==='number'&&Number.isInteger(m.decimals)&&m.decimals>=0&&m.decimals<=6))
 &&(m.outputUnit===undefined||['percent','quantity','hours','minutes','number'].includes(String(m.outputUnit)))
 &&(m.formulaExamples===undefined||(object(m.formulaExamples)&&Object.values(m.formulaExamples).every(v=>typeof v==='number')))
 &&(m.formulaBindings===undefined||(object(m.formulaBindings)&&Object.values(m.formulaBindings).every(b=>object(b)&&['total','count','measurement'].includes(String(b.kind))&&text(b.id))));
}
function setup(v:unknown):boolean{
  if(!object(v)||v.version!==1||!['event','run'].includes(String(v.shape))||!object(v.mapping)||!object(v.synonyms))return false;
  const mapping=v.mapping,synonyms=v.synonyms;
  return roles.every(([r])=>column(mapping[r])&&list(synonyms[r],text))
    &&['runId','orderId'].includes(String(v.groupBy))&&text(v.unit)&&typeof v.tolerance==='number'&&typeof v.checkBalance==='boolean'
    &&list(v.events,e=>object(e)&&text(e.id)&&text(e.label)&&list(e.values,text)&&['quantity','timed'].includes(String(e.kind))&&['range','duration'].includes(String(e.timing))&&['hours','minutes','seconds'].includes(String(e.durationUnit))&&['column','startColumn','endColumn','durationColumn'].every(k=>column(e[k])))
    &&list(v.measurements,m=>object(m)&&text(m.id)&&text(m.label)&&templates.some(t=>t===m.template)&&text(m.a)&&text(m.b)&&typeof m.exampleA==='number'&&typeof m.exampleB==='number'&&(m.required===undefined||typeof m.required==='boolean')&&formulaFields(m))
    &&(v.preparation===undefined||validatePreparationRecipe(v.preparation))
    &&(v.attributeChecks===undefined||(object(v.attributeChecks)&&Object.values(v.attributeChecks).every(text)))
    &&list(v.customFields,f=>object(f)&&text(f.id)&&text(f.label)&&typeof f.column==='number'&&column(f.column)&&typeof f.compare==='boolean'&&(f.useExplanations===undefined||typeof f.useExplanations==='boolean')&&(f.checkText===undefined||text(f.checkText)));
}
/** Validate stored structure, not setup correctness: incomplete drafts must remain recoverable. */
export function validateSavedData(workspace:unknown,profiles:unknown):void{
  const fail=()=>{throw new Error('Saved work has an unreadable or unsupported format. Nothing was changed. Keep your source file; retry or continue without saving.');};
  if(!list(profiles,p=>object(p)&&text(p.id)&&text(p.name)&&text(p.savedAt)&&list(p.headers,text)&&setup(p.setup)
    &&(p.sheetName===undefined||text(p.sheetName))
    &&(p.sourceFileName===undefined||text(p.sourceFileName))
    &&(p.headerLine===undefined||p.headerLine===null||(Number.isInteger(p.headerLine)&&(p.headerLine as number)>0))
    &&(p.confirmed===undefined||typeof p.confirmed==='boolean')
    &&(p.reading===undefined||(object(p.reading)&&(p.reading.encoding===undefined||text(p.reading.encoding))&&(p.reading.delimiter===undefined||text(p.reading.delimiter))&&(p.reading.decimal===undefined||p.reading.decimal==='.'||p.reading.decimal===',')))))fail();
  if(workspace===null)return;
  if(!object(workspace)){fail();return;}
  const w=workspace,f=w.file;
  if(!object(f)||!text(f.name)||!['csv','xlsx'].includes(String(f.kind))||!(f.original instanceof ArrayBuffer)||!text(f.encoding)||!text(f.delimiter)||!['.',','].includes(String(f.decimal))||!list(f.notes,text)||!Array.isArray(f.sheets)||!f.sheets.length){fail();return;}
  if(!list(f.sheets,s=>object(s)&&text(s.name)&&list(s.merges,text)&&list(s.rows,r=>object(r)&&Number.isInteger(r.line)&&(r.line as number)>0&&(r.endLine===undefined||Number.isInteger(r.endLine))&&list(r.cells,c=>object(c)&&text(c.address)&&text(c.display)&&(c.raw===null||['string','number','boolean'].includes(typeof c.raw))&&(c.formula===undefined||text(c.formula))&&(c.date===undefined||text(c.date))))))fail();
  if(!(w.sheetIndex===null||(Number.isInteger(w.sheetIndex)&&(w.sheetIndex as number)>=0&&(w.sheetIndex as number)<f.sheets.length))
    ||!(w.header===undefined||w.header===null||Number.isInteger(w.header))
    ||!(w.shape===null||['event','run'].includes(String(w.shape)))
    ||!['upload','sheets','check','prepare','shape','mapping','done','compare'].includes(String(w.screen))
    ||!(w.shapeConfirmed===undefined||typeof w.shapeConfirmed==='boolean')
    ||!(w.setup===null||setup(w.setup))||!(w.confirmed===undefined||typeof w.confirmed==='boolean')||!text(w.savedAt)
    ||!(w.preparation===undefined||w.preparation===null||validatePreparationRecipe(w.preparation)))fail();
}
