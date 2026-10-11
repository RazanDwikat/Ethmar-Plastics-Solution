import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {parseBytes,inspectSheet,type ImportedFile} from './inspection';
import {prepareFile,validatePreparationRecipe} from './preparation';
import type {PreparationRecipe,PreparationStep} from './preparation-types';
import {defaultSetup,type Profile} from './setup';
import {checkCompatibility,calculateCompatible} from './compatibility';
import {calculateFile} from './calculation-engine';
import {exportComparisonCsv,comparisonPrintHtml} from './comparison-tools';
import {validateSavedData} from './saved-data-validation';
import {samples} from './samples';
import ExcelJS from 'exceljs';
const read=(csv:string)=>parseBytes(new TextEncoder().encode(csv).buffer,'production.csv');
const recipe=(...steps:PreparationStep[]):PreparationRecipe=>({version:1,steps});
const summary='run_id,input_kg,good_kg,scrap_kg,changeover_hours,downtime_minutes\nE-01,1000,950,50,4,0\nE-02,1000,900,100,6,45';
function profileFor(file:ImportedFile,r:PreparationRecipe):Profile{
 const p=prepareFile(file,0,r),inspection=inspectSheet(p.file.sheets[0],file.decimal,p.headerLine);
 return {id:'p',name:'Prepared setup',savedAt:'now',headers:inspection.headers,headerLine:inspectSheet(file.sheets[0],file.decimal).headerLine,setup:{...defaultSetup(inspection),preparation:r},confirmed:true};
}
test('header selection and all exclusion conditions retain originals and physical lines',async()=>{
 const file=await read('Title\nrun_id,amount,note\nE-01,10,"two\nlines"\nrun_id,amount,note\nTotal,10,end\n,0,blank\nE-02,20,ok');
 const original=structuredClone(file);
 const r=recipe({id:'h',kind:'header',line:2},{id:'repeat',kind:'exclude',column:'run_id',condition:'equals',value:'run_id'},{id:'total',kind:'exclude',column:'run_id',condition:'contains',value:'Total'},{id:'empty',kind:'exclude',column:'run_id',condition:'empty',value:''});
 const p=prepareFile(file,0,r);
 assert.deepEqual(p.excluded.map(e=>e.row.line),[1,5,6,7]);
 assert.deepEqual(p.file.sheets[0].rows.map(x=>x.line),[2,3,8]);
 assert.equal(p.file.sheets[0].rows[1].endLine,4);
 assert.equal(p.file.sheets[0].rows[1].cells[2].trace?.origins[0].raw,'two\nlines');
 assert.equal(p.previews[1].before.length,5);
 assert.deepEqual(file,original);
 assert.deepEqual(p.file.original,original.original);
});
test('fill, conversion, arithmetic and combine preserve chained operands and donor cells',async()=>{
 const file=await read('run_id,input,loss,date,time\nE-01,1,0.05,2026-10-01,08:15\n,2,0.1,2026-10-02,09:30');
 const r=recipe(
  {id:'fill',kind:'fill',column:'run_id'},
  {id:'units',kind:'multiply',column:'input',factor:1000},
  {id:'lossunits',kind:'multiply',column:'loss',factor:1000},
  {id:'good',kind:'calculate',a:'input',b:'loss',name:'good',operator:'-'},
  {id:'rate',kind:'calculate',a:'loss',b:'input',name:'rate',operator:'/'},
  {id:'date',kind:'combine',a:'date',b:'time',name:'start',separator:' ',format:'iso-date-time'},
  {id:'text',kind:'combine',a:'run_id',b:'date',name:'label',separator:' · ',format:'text'}
 );
 const p=prepareFile(file,0,r),row=p.file.sheets[0].rows[2];
 assert.equal(row.cells[0].raw,'E-01');assert.deepEqual(row.cells[0].trace?.origins.map(x=>x.line),[3,2]);
 assert.equal(row.cells[5].raw,1900);assert.equal(row.cells[6].raw,0.05);
 assert.equal(row.cells[7].raw,'2026-10-02 09:30');
 assert.equal(row.cells[8].raw,'E-01 · 2026-10-02');
 assert.match(row.cells[5].trace!.operations.join(' '),/2 × 1000 = 2000/);
 assert.match(row.cells[5].trace!.operations.join(' '),/2000 - 100 = 1900/);
 assert.deepEqual(row.cells[5].trace!.origins.map(o=>o.raw),['2','0.1']);
 assert.equal(file.sheets[0].rows[2].cells[0].raw,'');
});
test('addition and multiplication use numbers even with comma decimals',async()=>{
 const file=await parseBytes(new TextEncoder().encode('run_id;a;b\nA;1,5;2,5').buffer,'decimal.csv',{delimiter:';',decimal:','});
 const p=prepareFile(file,0,recipe({id:'add',kind:'calculate',a:'a',b:'b',name:'sum',operator:'+'},{id:'mul',kind:'calculate',a:'sum',b:'b',name:'product',operator:'*'}));
 assert.equal(p.file.sheets[0].rows[1].cells[3].raw,4);
 assert.equal(p.file.sheets[0].rows[1].cells[4].raw,10);
});
test('invalid steps fail explicitly without mutating originals or returning partial results',async()=>{
 const file=await read('run_id,a,b,date,time\nA,4,0,01/02/2026,08:00');
 const original=structuredClone(file);
 const bad:PreparationStep[]=[
  {id:'x',kind:'header',line:999},
  {id:'x',kind:'fill',column:'absent'},
  {id:'x',kind:'multiply',column:'a',factor:NaN},
  {id:'x',kind:'calculate',a:'a',b:'b',operator:'/',name:'ratio'},
  {id:'x',kind:'calculate',a:'a',b:'b',operator:'+',name:'a'},
  {id:'x',kind:'combine',a:'date',b:'time',separator:' ',format:'iso-date-time',name:'start'},
  {id:'x',kind:'exclude',column:'run_id',condition:'contains',value:''},
 ];
 for(const s of bad)assert.throws(()=>prepareFile(file,0,recipe(s)));
 assert.deepEqual(file,original);
 const noNumbers=await read('run_id,a,b\nA,oops,3');
 assert.throws(()=>prepareFile(noNumbers,0,recipe({id:'x',kind:'multiply',column:'a',factor:2})),/Line 2.*valid number/);
 assert.throws(()=>prepareFile({...file,sheets:[]},0,recipe()),/worksheet/);
 const noDonor=await read('run_id,a\n,2');
 assert.throws(()=>prepareFile(noDonor,0,recipe({id:'x',kind:'fill',column:'run_id'})),/no earlier value/);
 const ambiguous=await read('run_id,a,a\nA,1,2');
 assert.throws(()=>prepareFile(ambiguous,0,recipe({id:'x',kind:'multiply',column:'a',factor:2})),/more than once/);
});
test('reordering or deleting producer invalidates dependent steps; unknown recipes rejected',async()=>{
 const file=await read('run_id,a,b\nA,4,2');
 const producer:PreparationStep={id:'one',kind:'calculate',a:'a',b:'b',name:'new',operator:'+'};
 const consumer:PreparationStep={id:'two',kind:'multiply',column:'new',factor:2};
 assert.equal(prepareFile(file,0,recipe(producer,consumer)).file.sheets[0].rows[1].cells[3].raw,12);
 assert.throws(()=>prepareFile(file,0,recipe(consumer,producer)),/Missing column “new”/);
 assert.throws(()=>prepareFile(file,0,recipe(consumer)),/Missing column/);
 assert.equal(validatePreparationRecipe({version:2,steps:[]}),false);
 assert.equal(validatePreparationRecipe(recipe(producer,producer)),false);
 assert.throws(()=>prepareFile(file,0,{version:1,steps:[{id:'bad',kind:'eval',code:'alert(1)'}]} as unknown as PreparationRecipe),/unsupported/);
});
test('manager replay, missing prerequisites, exports and calculation evidence use prepared values',async()=>{
 const file=await read('Report\n'+summary+'\nTotal,2000,1850,150,10,45');
 // Halve input and good, then restore them through explicit factors.
 for(const row of file.sheets[0].rows.slice(2,-1))for(const i of [1,2]){row.cells[i].raw=Number(row.cells[i].raw)/2;row.cells[i].display=String(row.cells[i].raw);}
 const r=recipe({id:'header',kind:'header',line:2},{id:'totals',kind:'exclude',column:'run_id',condition:'equals',value:'Total'},{id:'input',kind:'multiply',column:'input_kg',factor:2},{id:'good',kind:'multiply',column:'good_kg',factor:2});
 const profile=profileFor(file,r),before=structuredClone(file);
 const check=checkCompatibility(file,0,profile);
 assert.equal(check.state,'notes');
 const report=calculateCompatible(file,0,check),[a,b]=report.runs;
 assert.equal(a.metrics[0].value,5);assert.equal(b.metrics[0].value,10);
 assert.equal(a.metrics[1].value,4);assert.equal(b.metrics[1].value,6);assert.equal(b.metrics[2].value,0.75);
 assert.ok(report.excluded.some(e=>e.row.line===5&&e.reason.includes('Total')));
 assert.match(exportComparisonCsv(report,a,b),/Preparation exclusion/);
 assert.match(comparisonPrintHtml(report,a,b),/500 × 2 = 1000/);
 assert.deepEqual(file,before);
 const bad=structuredClone(file);bad.sheets[0].rows[1].cells[1].raw='missing';bad.sheets[0].rows[1].cells[1].display='missing';
 const blocked=checkCompatibility(bad,0,profile);assert.equal(blocked.state,'blocked');assert.match(blocked.differences.join(' '),/Missing column “input_kg”/);
 assert.throws(()=>calculateCompatible(bad,0,blocked),/does not match/);
 const reordered=structuredClone(file);for(const row of reordered.sheets[0].rows)row.cells.reverse();
 assert.equal(checkCompatibility(reordered,0,profile).state,'notes');
 assert.equal(calculateFile(file,0,profile.setup,2).runs[1].metrics[0].value,10);
});
test('Excel merged blanks and date/time serials trace to unchanged original cells',async()=>{
 const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Production');
 sheet.addRow(['run_id','date','time','amount']);
 sheet.addRow(['E-01',new Date('2026-10-01T00:00:00Z'),new Date('2026-10-01T08:15:00Z'),1]);
 sheet.addRow([null,new Date('2026-10-02T00:00:00Z'),new Date('2026-10-02T09:30:00Z'),2]);
 sheet.mergeCells('A2:A3');
 for(const n of [2,3]){sheet.getCell(`B${n}`).numFmt='yyyy-mm-dd';sheet.getCell(`C${n}`).numFmt='yyyy-mm-dd hh:mm';}
 const buffer=await workbook.xlsx.writeBuffer();
 const file=await parseBytes(Uint8Array.from(new Uint8Array(buffer)).buffer,'merged.xlsx'),before=structuredClone(file);
 const prepared=prepareFile(file,0,recipe({id:'fill',kind:'fill',column:'run_id'},{id:'start',kind:'combine',a:'date',b:'time',name:'start_time',separator:' ',format:'iso-date-time'}));
 assert.equal(prepared.file.sheets[0].rows[2].cells[0].raw,'E-01');
 assert.equal(prepared.file.sheets[0].rows[2].cells[4].raw,'2026-10-02 09:30:00');
 assert.deepEqual(prepared.file.sheets[0].rows[2].cells[0].trace?.origins.map(o=>o.address),['A3','A2']);
 assert.equal(typeof prepared.file.sheets[0].rows[2].cells[4].trace?.origins[0].raw,'number');
 assert.deepEqual(file,before);
});
test('zero-step legacy files retain acceptance and recipes persist in drafts and exported JSON',async()=>{
 const file=await read(samples[0].csv),inspection=inspectSheet(file.sheets[0],file.decimal),setup=defaultSetup(inspection);
 assert.equal(calculateFile(file,0,setup).runs[1].metrics[2].value,0.75);
 const r=recipe({id:'incomplete',kind:'multiply',column:'',factor:NaN});
 validateSavedData({file,sheetIndex:0,header:1,shape:null,screen:'prepare',setup:null,preparation:r,savedAt:'now'},[]);
 const profile=profileFor(await read(summary),recipe({id:'one',kind:'multiply',column:'input_kg',factor:1}));
 const exported=JSON.parse(JSON.stringify(profile));
 validateSavedData(null,[exported]);assert.deepEqual(exported.setup.preparation,profile.setup.preparation);
 validateSavedData({file,sheetIndex:0,header:1,shape:'event',screen:'mapping',setup,savedAt:'now'},[]);
 assert.equal(checkCompatibility(file,0,{...profile,setup:{...setup,preparation:{version:2,steps:[]} as unknown as PreparationRecipe}}).state,'blocked');
});
