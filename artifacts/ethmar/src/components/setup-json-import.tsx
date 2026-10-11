import { useRef, useState } from 'react';
import { importSetupJson } from '@/lib/profile-transfer';
import type { Profile } from '@/lib/setup';

export function SetupJsonImport({onImport}:{onImport:(profile:Profile)=>void|Promise<void>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const input=useRef<HTMLInputElement>(null);
 const importRef=useRef(onImport);
 importRef.current=onImport;
 const read=async(file:File)=>{
  setError('');setNotice('');setBusy(true);
  try{
   if(!/\.json$/i.test(file.name))throw new Error('Choose an Ethmar setup file with a .json extension.');
   if(file.size>1024*1024)throw new Error('This setup is too large. Choose a JSON file no larger than 1 MB.');
   const profile=importSetupJson(await file.text());
   await importRef.current({...profile,id:crypto.randomUUID()});
   setNotice(`Imported “${profile.name}” as a new saved setup. Existing setups and uploaded data are unchanged.`);
  }catch(e){setError(e instanceof Error?e.message:'Could not read this file. Try choosing it again.');}
  finally{setBusy(false);if(input.current)input.current.value='';}
 };
 return <div className="config-card">
  <h4>Import setup</h4>
  <p>Add an Ethmar JSON setup to this browser. Import checks its structure, formulas and source references; it does not replace your current setup or uploaded data.</p>
  <label>Setup JSON file · maximum 1 MB<input ref={input} type="file" accept=".json,application/json" disabled={busy} data-testid="import-setup-json" onChange={e=>{const file=e.currentTarget.files?.[0];if(file)void read(file);}}/></label>
  {busy&&<p role="status">Checking setup…</p>}
  {error&&<div className="error" role="alert" data-testid="import-setup-error">{error} No setup was imported. Choose a corrected file to retry.</div>}
  {notice&&<div className="file-note" role="status" data-testid="import-setup-success">{notice}</div>}
 </div>;
}
