import type { ImportedFile } from './inspection';
import type { Profile, Setup } from './setup';
export type SavedWorkspace = {
  file:ImportedFile; sheetIndex:number|null; header:number|null|undefined; shape:'event'|'run'|null;
  screen:'upload'|'sheets'|'check'|'mapping'|'done'|'compare'; setup:Setup|null; confirmed?:boolean; savedAt:string;
};
export type LocalData = { workspace:SavedWorkspace|null; profiles:Profile[] };
const DB='ethmar-private-workspace', STORE='data';
let queue:Promise<unknown>=Promise.resolve();
function open():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>req.result.createObjectStore(STORE);
    req.onerror=()=>reject(new Error('Browser storage is unavailable. Check private-browsing or storage permissions.'));
    req.onblocked=()=>reject(new Error('Close other Ethmar tabs and try again.'));
    req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result);};
  });
}
async function transact(action:(store:IDBObjectStore)=>void):Promise<void>{
  const db=await open();
  try {await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.oncomplete=()=>resolve();
    tx.onabort=()=>reject(new Error('Could not save in this browser. Storage may be full. Keep your source file and try again.'));
    tx.onerror=()=>reject(new Error('Could not save in this browser. Check available storage and permissions.'));
    action(tx.objectStore(STORE));
  });}finally{db.close();}
}
export async function loadLocalData():Promise<LocalData>{
  await queue.catch(()=>{});
  const db=await open();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly'),s=tx.objectStore(STORE);
    const workspace=s.get('workspace'),profiles=s.get('profiles');
    tx.oncomplete=()=>resolve({workspace:workspace.result??null,profiles:profiles.result??[]});
    tx.onabort=tx.onerror=()=>reject(new Error('Saved data could not be read. Keep your source files; you can retry or delete browser data.'));
  });}finally{db.close();}
}
function enqueue(work:()=>Promise<void>):Promise<void>{
  const next=queue.catch(()=>{}).then(work);queue=next;return next;
}
export function saveWorkspace(workspace:SavedWorkspace|null):Promise<void>{
  const snapshot=structuredClone(workspace);
  return enqueue(()=>transact(s=>snapshot?s.put(snapshot,'workspace'):s.delete('workspace')));
}
export function saveProfiles(profiles:Profile[]):Promise<void>{
  const snapshot=structuredClone(profiles);
  return enqueue(()=>transact(s=>s.put(snapshot,'profiles')));
}
export function deleteAllLocalData():Promise<void>{
  return enqueue(()=>transact(s=>s.clear()));
}
