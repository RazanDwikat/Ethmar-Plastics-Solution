import 'fake-indexeddb/auto';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { defaultSetup, type Profile } from './setup';
import { inspectSheet, parseBytes } from './inspection';
import { duplicateProfile, savedInspection, savedMeasurementFormula, savedProfileProblems, uniqueProfileName, usableProfile } from './saved-setups';
import { validateSavedData } from './saved-data-validation';
import { importSetupJson } from './profile-transfer';
import { deleteAllLocalData, loadLocalData, saveProfiles, saveWorkspace } from './local-store';
async function fixture():Promise<Profile>{
 const f=await parseBytes(new TextEncoder().encode('run_id,event_type,quantity\nB1,MATERIAL_IN,100').buffer,'original.csv');
 const i=inspectSheet(f.sheets[0],'.');
 return {id:'saved',name:'Line 2',savedAt:'2026-04-07T10:11:12.000Z',sourceFileName:f.name,headers:i.headers,setup:defaultSetup(i),confirmed:true};
}
test('provenance is optional for legacy setups and validated in new exports',async()=>{
 const p=await fixture();assert.equal(importSetupJson(JSON.stringify(p)).sourceFileName,'original.csv');
 delete p.sourceFileName;assert.equal(importSetupJson(JSON.stringify(p)).sourceFileName,undefined);
 assert.throws(()=>validateSavedData(null,[{...p,sourceFileName:42}]));
});
test('read-only formulas describe only the sources the calculation actually uses',async()=>{
 const p=await fixture(),m=p.setup.measurements[0],a=p.setup.events.find(e=>e.id===m.a)!.label;
 assert.equal(savedMeasurementFormula({...m,template:'Total'},p.setup),`${a} total`);
 assert.equal(savedMeasurementFormula({...m,template:'Duration'},p.setup),`Sum of ${a} durations (hours)`);
 assert.match(savedMeasurementFormula(m,p.setup),/÷.*× 100/);
 assert.equal(savedMeasurementFormula({...m,template:'Custom formula',formula:'10 / 2'},p.setup),'10 / 2');
});
test('duplicates deeply clone settings with a unique id/name and retain provenance',async()=>{
 const p=await fixture(),copy=duplicateProfile(p,[p]);
 assert.notEqual(copy.id,p.id);assert.equal(copy.sourceFileName,p.sourceFileName);
 copy.setup.events[0].label='Changed';assert.notEqual(copy.setup.events[0].label,p.setup.events[0].label);
 assert.equal(uniqueProfileName(copy.name,[copy]),`${copy.name} (2)`);
 assert.notEqual(copy.savedAt,p.savedAt);
});
test('schema-only inspection contains no examples, production rows or remapped columns',async()=>{
 const p=await fixture(),i=savedInspection(p);
 assert.deepEqual(i.headers,p.headers);assert.equal(i.dataRows,0);
 assert.ok(i.columns.every(c=>c.examples.length===0));assert.equal(p.setup.mapping.runId,0);
});
test('legacy usability is honest and incomplete or unconfirmed profiles stay unavailable',async()=>{
 const p=await fixture();assert.equal(usableProfile(p),true);
 delete p.confirmed;assert.equal(usableProfile(p),true);
 p.confirmed=false;assert.equal(usableProfile(p),false);
 p.confirmed=true;p.setup.mapping.quantity=null;assert.equal(usableProfile(p),false);
 p.setup.mapping.runId=null;assert.equal(usableProfile(p),false);
});
test('preparation edit validation rejects blank sources and nonfinite factors',async()=>{
 const p=await fixture();p.setup.preparation={version:1,steps:[{id:'x',kind:'multiply',column:'',factor:NaN}]};
 assert.ok(savedProfileProblems(p).length>=2);
});
test('workspace autosaves cannot restore deleted profiles; persistence preserves schema edits',async()=>{
 await deleteAllLocalData();const p=await fixture();await saveProfiles([p]);
 const snapshot=structuredClone(p);snapshot.setup.unit='tonnes';snapshot.savedAt=new Date().toISOString();
 await saveProfiles([snapshot]);assert.equal((await loadLocalData()).profiles[0].sourceFileName,'original.csv');
 await Promise.all([saveWorkspace(null),saveProfiles([]),saveWorkspace(null)]);
 assert.deepEqual((await loadLocalData()).profiles,[]);
 await deleteAllLocalData();
});
