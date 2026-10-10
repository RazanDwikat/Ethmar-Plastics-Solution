import 'fake-indexeddb/auto';
import {expect,it} from 'vitest';
import {saveStore,loadStore} from './storage';
import {makeImport,parseCsv} from './import-core';
import {defaultSettings} from './defaults';
it('durably round-trips original file, decisions, settings and settings-only profiles',async()=>{
  const record=makeImport(parseCsv('run_id,value\nA,"1,000"\n\n','saved.csv'));
  record.decisions[2]='ignore';
  record.settings.dateFormat='DMY';record.settings.decimalSeparator=',';
  const profile={id:'p1',name:'My profile',settings:defaultSettings(),createdAt:'2026-10-10'};
  await saveStore({imports:[record],profiles:[profile],activeId:record.id});
  const restored=await loadStore();
  expect(restored.imports[0]).toEqual(record);
  expect(restored.profiles[0]).toEqual(profile);
  expect(Object.keys(restored.profiles[0]).sort()).toEqual(['createdAt','id','name','settings']);
  record.settings.quantityUnit='liters';
  expect((await loadStore()).imports[0].settings.quantityUnit).toBe('kg');
});
