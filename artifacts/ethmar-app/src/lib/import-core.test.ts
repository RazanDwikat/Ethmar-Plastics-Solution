import {describe,it,expect} from 'vitest';
import {parseCsv,inspectImport,makeImport,suggestMapping,validateSetup,readCsv} from './import-core';
import {defaultSettings} from './defaults';
import {samples} from './samples';

describe('immutable CSV reading',()=>{
  it('retains quoted multiline cells, leading zeroes, whitespace, blank rows and physical line ranges',()=>{
    const text='run_id,note,value\r\nR1,"hello\r\nworld",001\r\n\r\nR2," a ""quote"" ",0\r\n';
    const f=parseCsv(text,'quoted.csv');
    expect(f.originalText).toBe(text);
    expect(f.rows.map(r=>r.line)).toEqual([1,2,4,5]);
    expect(f.rows[1].endLine).toBe(3);
    expect(f.rows[1].values).toEqual(['R1','hello\r\nworld','001']);
    expect(f.rows[2].values).toEqual(['']);
    expect(f.rows[3].values).toEqual(['R2',' a "quote" ','0']);
    expect(f.rows.map(r=>r.raw).join('')).toBe(text);
  });
  it.each([',',';','\t','|'])('detects delimiter %s without title row interference',delimiter=>{
    const f=parseCsv(`Report\nrun_id${delimiter}value\nR1${delimiter}20\nR2${delimiter}30`,'file.csv');
    expect(f.delimiter).toBe(delimiter);expect(f.suggestedHeader).toBe(1);
  });
  it('reports malformed quotes and empty files rather than claiming success',()=>{
    expect(parseCsv('a,b\n"x,2','bad.csv').errors.length).toBeGreaterThan(0);
    expect(parseCsv('','empty.csv').errors.length).toBeGreaterThan(0);
  });
  it('keeps BOM in original text, not the heading value',()=>{
    const f=parseCsv('\uFEFFrun_id,value\nR1,1','bom.csv');
    expect(f.originalText.startsWith('\uFEFF')).toBe(true);
    expect(f.rows[0].values[0]).toBe('run_id');
  });
  it('decodes UTF-16 and refuses invalid UTF-8',async()=>{
    const text='run_id,مقدار\nR1,2';const bytes=new Uint8Array(2+text.length*2);bytes.set([255,254]);
    for(let i=0;i<text.length;i++){bytes[2+i*2]=text.charCodeAt(i)&255;bytes[3+i*2]=text.charCodeAt(i)>>8;}
    const f=await readCsv({size:bytes.length,name:'utf16.csv',arrayBuffer:async()=>bytes.buffer} as File);
    expect(f.encoding).toBe('UTF-16LE');expect(f.rows[0].values[1]).toBe('مقدار');
    await expect(readCsv({size:1,name:'bad.csv',arrayBuffer:async()=>new Uint8Array([255]).buffer} as File)).rejects.toThrow('UTF-8');
  });
});
describe('file review and mappings',()=>{
  it('reports requested messy lines without changing or automatically ignoring any row',()=>{
    const f=parseCsv(samples[4].text,'messy.csv');const inspection=inspectImport(f,f.suggestedHeader,{});
    for(const [kind,line] of [['title',1],['blank',3],['text-number',4],['date-7',7],['repeated-header',8],['total',12]] as const)
      expect(inspection.problems.some(p=>p.kind===kind&&p.line===line),`${kind} at ${line}`).toBe(true);
    expect(inspection.dataRows).toHaveLength(11);
    const reviewed=inspectImport(f,1,{0:'ignore',2:'ignore',7:'ignore',11:'ignore'});
    expect(reviewed.dataRows).toHaveLength(7);
    expect(f.originalText).toBe(samples[4].text);
  });
  it('supports explicit no-header files and selecting another header',()=>{
    const f=parseCsv('R1,4\nR2,5','no-header.csv');
    expect(f.suggestedHeader).toBeNull();
    expect(inspectImport(f,null,{}).headers[0].label).toBe('Column 1');
    expect(inspectImport(f,0,{}).headers[0].label).toBe('R1');
  });
  it('keeps ambiguous aliases unmapped and matches user-defined Arabic aliases',()=>{
    const settings=defaultSettings();settings.synonyms.run=['تشغيلة'];
    expect(suggestMapping([{key:'c0',index:0,label:'تشغيلة'}],settings.synonyms).run).toBe('c0');
    settings.synonyms.run=['a','b'];
    expect(suggestMapping([{key:'c0',index:0,label:'a'},{key:'c1',index:1,label:'b'}],settings.synonyms).run).toBeUndefined();
  });
  it('accepts renamed arbitrary source columns and event values via configuration',()=>{
    const f=parseCsv('تشغيلة,الصنف,وزن,من,إلى\nأ,دخول,1000,,\nأ,خارج,950,,\nأ,فاقد,50,,\nأ,تنظيف,,2026-10-07 06:00,2026-10-07 10:00','renamed.csv');
    const r=makeImport(f);r.settings.shape='event';r.settings.mapping={run:'c0',eventType:'c1',quantity:'c2',start:'c3',end:'c4'};
    r.settings.definitions=r.settings.definitions.slice(0,4).map((d,i)=>({...d,values:[['دخول','خارج','فاقد','تنظيف'][i]]}));
    expect(validateSetup(r)).toEqual([]);
    expect(r.file.rows[1].values[0]).toBe('أ');
  });
  it('requires an identifier column with at least one recorded value',()=>{
    const r=makeImport(parseCsv('name,value\nx,2','no-run.csv'));
    expect(validateSetup(r).some(x=>x.includes('identifies each run'))).toBe(true);
    r.settings.mapping.run='c8';expect(validateSetup(r).some(x=>x.includes('not in this file'))).toBe(true);
  });
  it('explains missing identifiers per included row and accepts an explicit ignore decision',()=>{
    const r=makeImport(parseCsv(samples[0].text+'\r\n', 'blank-tail.csv'));
    const f=parseCsv('run_id,event_type,quantity,start_time,end_time\nA,T,2,,\n,T,3,,','missing-run.csv');
    const record=makeImport(f);
    record.settings.definitions=[{...r.settings.definitions[0],values:['T']}];
    expect(validateSetup(record).some(v=>v.includes('CSV line 3'))).toBe(true);
    record.decisions[2]='ignore';
    expect(validateSetup(record)).toEqual([]);
  });
  it.each(samples.slice(0,4))('parses reconstructed $name as source rows, without calculating future-stage results',sample=>{
    const record=makeImport(parseCsv(sample.text,sample.name));
    if(sample.settings)record.settings={...record.settings,...structuredClone(sample.settings)};
    expect(record.file.errors).toEqual([]);
    expect(validateSetup(record)).toEqual([]);
    expect(record.file.originalText).toBe(sample.text);
  });
  it('validates both duration and range timing modes, retaining units and source text',()=>{
    const r=makeImport(parseCsv('run_id,event_type,quantity,start_time,end_time,elapsed\nA,T,10,,,90','duration.csv'));
    r.settings.definitions=[{...r.settings.definitions[3],values:['T'],timeMode:'duration',duration:'c5',durationUnit:'minutes'}];
    expect(validateSetup(r)).toEqual([]);
    r.settings.definitions[0].duration='';r.settings.mapping.duration='';
    expect(validateSetup(r).some(x=>x.includes('duration column'))).toBe(true);
    expect(r.file.rows[1].values[5]).toBe('90');
  });
});
