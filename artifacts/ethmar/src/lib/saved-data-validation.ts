import {roles,templates} from './setup';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object';
const list=(v:unknown,test:(item:unknown)=>boolean):boolean=>Array.isArray(v)&&v.every(test);
const text=(v:unknown):v is string=>typeof v==='string';
const column=(v:unknown)=>v===null||(typeof v==='number'&&Number.isInteger(v)&&v>=-1);
function setup(v:unknown):boolean{
  if(!object(v)||v.version!==1||!['event','run'].includes(String(v.shape))||!object(v.mapping)||!object(v.synonyms))return false;
  const mapping=v.mapping,synonyms=v.synonyms;
  return roles.every(([r])=>column(mapping[r])&&list(synonyms[r],text))
    &&['runId','orderId'].includes(String(v.groupBy))&&text(v.unit)&&typeof v.tolerance==='number'&&typeof v.checkBalance==='boolean'
    &&list(v.events,e=>object(e)&&text(e.id)&&text(e.label)&&list(e.values,text)&&['quantity','timed'].includes(String(e.kind))&&['range','duration'].includes(String(e.timing))&&['hours','minutes','seconds'].includes(String(e.durationUnit))&&['column','startColumn','endColumn','durationColumn'].every(k=>column(e[k])))
    &&list(v.measurements,m=>object(m)&&text(m.id)&&text(m.label)&&templates.some(t=>t===m.template)&&text(m.a)&&text(m.b)&&typeof m.exampleA==='number'&&typeof m.exampleB==='number')
    &&list(v.customFields,f=>object(f)&&text(f.id)&&text(f.label)&&typeof f.column==='number'&&column(f.column)&&typeof f.compare==='boolean');
}
/** Validate stored structure, not setup correctness: incomplete drafts must remain recoverable. */
export function validateSavedData(workspace:unknown,profiles:unknown):void{
  const fail=()=>{throw new Error('Saved work has an unreadable or unsupported format. Nothing was changed. Keep your source file; retry or continue without saving.');};
  if(!list(profiles,p=>object(p)&&text(p.id)&&text(p.name)&&text(p.savedAt)&&list(p.headers,text)&&setup(p.setup)))fail();
  if(workspace===null)return;
  if(!object(workspace)){fail();return;}
  const w=workspace,f=w.file;
  if(!object(f)||!text(f.name)||!['csv','xlsx'].includes(String(f.kind))||!(f.original instanceof ArrayBuffer)||!text(f.encoding)||!text(f.delimiter)||!['.',','].includes(String(f.decimal))||!list(f.notes,text)||!Array.isArray(f.sheets)||!f.sheets.length){fail();return;}
  if(!list(f.sheets,s=>object(s)&&text(s.name)&&list(s.merges,text)&&list(s.rows,r=>object(r)&&Number.isInteger(r.line)&&(r.line as number)>0&&(r.endLine===undefined||Number.isInteger(r.endLine))&&list(r.cells,c=>object(c)&&text(c.address)&&text(c.display)&&(c.raw===null||['string','number','boolean'].includes(typeof c.raw))&&(c.formula===undefined||text(c.formula))&&(c.date===undefined||text(c.date))))))fail();
  if(!(w.sheetIndex===null||(Number.isInteger(w.sheetIndex)&&(w.sheetIndex as number)>=0&&(w.sheetIndex as number)<f.sheets.length))
    ||!(w.header===undefined||w.header===null||Number.isInteger(w.header))
    ||!(w.shape===null||['event','run'].includes(String(w.shape)))
    ||!['upload','sheets','check','mapping','done','compare'].includes(String(w.screen))
    ||!(w.setup===null||setup(w.setup))||!(w.confirmed===undefined||typeof w.confirmed==='boolean')||!text(w.savedAt))fail();
}
