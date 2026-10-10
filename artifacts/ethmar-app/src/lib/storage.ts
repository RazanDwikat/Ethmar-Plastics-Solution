import type {Store} from './import-types';
const empty=():Store=>({imports:[],profiles:[],activeId:null});
function open():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){reject(new Error('Browser saving is unavailable. Enable local site storage to save your work.'));return;}
    const request=indexedDB.open('ethmar-local-preparation',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('workspace');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(new Error('Browser storage could not be opened. Check privacy settings and available disk space.'));
    request.onblocked=()=>reject(new Error('Close other open Ethmar tabs, then reload to enable browser saving.'));
  });
}
export async function loadStore():Promise<Store>{
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('workspace','readonly');
    const req=tx.objectStore('workspace').get('state');
    req.onsuccess=()=>{
      const value=req.result;
      if(value&&(!Array.isArray(value.imports)||!Array.isArray(value.profiles))){reject(new Error('Saved browser data could not be read. Do not clear it unless you have copies of your files.'));return;}
      resolve(value??empty());
    };
    req.onerror=()=>reject(new Error('Saved browser data could not be read. Reload and try again.'));
    tx.oncomplete=()=>db.close();
  });
}
export async function saveStore(store:Store):Promise<void>{
  const db=await open();
  return new Promise((resolve,reject)=>{
    try{
      const tx=db.transaction('workspace','readwrite');
      tx.objectStore('workspace').put(structuredClone(store),'state');
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>{db.close();reject(new Error('Your changes were not saved. Browser storage may be full or disabled. Keep this tab open and free space before trying again.'));};
      tx.onabort=()=>{db.close();reject(new Error('Saving was interrupted. Keep this tab open and try saving again.'));};
    }catch{db.close();reject(new Error('Your changes could not be saved. Keep this tab open and check browser storage permissions.'));}
  });
}
