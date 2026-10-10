import 'fake-indexeddb/auto';
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {deleteAllLocalData,loadLocalData,saveProfiles,saveWorkspace,type SavedWorkspace} from './local-store';
import {parseBytes,inspectSheet} from './inspection';
import {defaultSetup} from './setup';
test('browser persistence keeps original bytes/drafts/profiles and ordered deletion',async()=>{
  await deleteAllLocalData();
  assert.deepEqual(await loadLocalData(),{workspace:null,profiles:[]});
  const csv='run_id,event_type,quantity\nE01,MATERIAL_IN,1000';
  const file=await parseBytes(new TextEncoder().encode(csv).buffer,'test.csv');
  const i=inspectSheet(file.sheets[0],'.');
  const setup=defaultSetup(i);
  const w:SavedWorkspace={file,sheetIndex:0,header:undefined,shape:'event',screen:'mapping',setup,savedAt:new Date().toISOString()};
  await saveWorkspace(w);
  await saveProfiles([{id:'profile',name:'Test',savedAt:w.savedAt,headers:i.headers,setup}]);
  setup.unit='modified in memory';
  const restored=await loadLocalData();
  assert.equal(restored.workspace!.setup!.unit,'kg');
  assert.equal(new TextDecoder().decode(restored.workspace!.file.original),csv);
  assert.equal(restored.workspace!.screen,'mapping');
  assert.equal(restored.profiles.length,1);
  // Start over clears the current import only, not the reusable profiles.
  await saveWorkspace(null);
  assert.equal((await loadLocalData()).workspace,null);
  assert.equal((await loadLocalData()).profiles.length,1);
  const olderWrite=saveWorkspace(w);
  const deletion=deleteAllLocalData();
  await Promise.all([olderWrite,deletion]);
  assert.deepEqual(await loadLocalData(),{workspace:null,profiles:[]});
});
test('corrupt stored data is rejected without overwriting the original record',async()=>{
  await deleteAllLocalData();
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('ethmar-private-workspace',1);
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  const damaged={file:{name:'keep-original.csv'},screen:'done'};
  await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction('data','readwrite');
    tx.objectStore('data').put(damaged,'workspace');
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
  });
  await assert.rejects(loadLocalData(),/Nothing was changed/);
  const stillStored=await new Promise((resolve,reject)=>{
    const request=db.transaction('data','readonly').objectStore('data').get('workspace');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  assert.deepEqual(stillStored,damaged);
  db.close();await deleteAllLocalData();
});
