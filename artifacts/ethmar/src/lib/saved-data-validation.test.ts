import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {validateSavedData} from './saved-data-validation';
import {parseBytes,inspectSheet} from './inspection';
import {defaultSetup} from './setup';
async function workspace(){
 const file=await parseBytes(new TextEncoder().encode('run_id,event_type,quantity\nR1,SCRAP,5').buffer,'test.csv');
 return {file,sheetIndex:0,header:undefined,shape:'event',screen:'mapping',setup:defaultSetup(inspectSheet(file.sheets[0],'.')),confirmed:false,savedAt:'2026-10-11'};
}
test('saved data validation accepts empty workspaces and incomplete editable drafts',async()=>{
 validateSavedData(null,[]);
 const w=await workspace();w.setup.mapping.runId=null;w.setup.tolerance=NaN;
 validateSavedData(w,[]);
});
test('unreadable stored files and settings are rejected without editing data',async()=>{
 const w=await workspace();
 for(const bad of [{...w,file:{}},{...w,setup:{version:99}},{...w,sheetIndex:99},{...w,screen:'unknown'}]){
  const original=structuredClone(bad);
  assert.throws(()=>validateSavedData(bad,[]),/Nothing was changed/);
  assert.deepEqual(bad,original);
 }
 assert.throws(()=>validateSavedData(null,[{name:'Damaged profile'}]),/Nothing was changed/);
});
