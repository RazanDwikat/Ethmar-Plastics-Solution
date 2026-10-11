import {test,expect,type Page} from '@playwright/test';
import {parseBytes,inspectSheet} from '../src/lib/inspection';
import {defaultSetup} from '../src/lib/setup';
import {samples} from '../src/lib/samples';
import {localData} from './helpers';
async function seed(page:Page,required=true){
 const file=await parseBytes(new TextEncoder().encode(samples[0].csv).buffer,'clean.csv'),inspection=inspectSheet(file.sheets[0],'.'),setup=defaultSetup(inspection);
 setup.measurements[0].required=required;
 const profile={id:'required',name:'Required test',savedAt:new Date().toISOString(),setup,headers:inspection.headers,headerLine:inspection.headerLine,confirmed:true};
 await page.goto('/');
 await page.evaluate(async p=>new Promise<void>((resolve,reject)=>{
  const request=indexedDB.open('ethmar-private-workspace',1);request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const db=request.result,tx=db.transaction('data','readwrite');tx.objectStore('data').put([p],'profiles');tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)};
 }),profile);
 await page.reload();await page.getByTestId('nav-compare').click();
}
async function upload(page:Page,csv:string,id='manager-upload'){await page.getByTestId(id).setInputFiles({name:'requirements.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});}
test('required whole-file absence blocks with copied explanation; individual-run absence continues',async({page,context})=>{
 await seed(page);
 await upload(page,samples[0].csv.replace('quantity_kg','quantity_kgs'));
 await expect(page.getByTestId('compatibility-state')).toHaveText('Does not match');
 await expect(page.getByTestId('continue-comparison')).toBeDisabled();
 await page.getByText('Exact differences to share with your analyst',{exact:true}).click();
 const message=page.getByRole('textbox',{name:'Exact compatibility differences'});
 await expect(message).toContainText(/Required measurement.*Scrap rate/);
 expect(await message.inputValue()).toContain('quantity_kgs');
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.getByRole('button',{name:'Copy message for analyst'}).click();
 expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(await message.inputValue());
 await page.getByTestId('manager-another-file').click();await upload(page,samples[1].csv);
 await expect(page.getByTestId('continue-comparison')).toBeEnabled();await page.getByTestId('continue-comparison').click();
 await expect(page.getByTestId('compare-manager')).toContainText('5%');
 await expect(page.locator('.metric-grid')).toContainText("Can't calculate");
});
test('optional whole-file input absence allows remaining results and unavailable tooltips',async({page})=>{
 await seed(page,false);
 await upload(page,samples[0].csv.split('\n').filter(l=>!l.includes('MATERIAL_IN')).join('\n'));
 await expect(page.getByTestId('compatibility-state')).toHaveText('Matches with notes');
 await page.getByTestId('continue-comparison').click();
 await expect(page.locator('.metric-grid')).toContainText('950');
 await expect(page.locator('.metric-grid')).toContainText('45 min');
 await page.locator('.metric-grid .value-link').filter({hasText:"Can't calculate"}).first().focus();
 await expect(page.getByRole('tooltip')).toContainText('MATERIAL_IN');
});
test('analyst Required choices persist and summary names them without changing formulas',async({page})=>{
 await page.goto('/');await upload(page,samples[0].csv,'upload-file');
 await page.getByRole('button',{name:/Continue to row type/}).click();
 await page.getByTestId('button-confirm-shape').click();
 const checkbox=page.getByTestId('required-scrap-rate');
 await page.locator('details').filter({has:checkbox}).evaluateAll(elements=>elements.forEach(el=>(el as HTMLDetailsElement).open=true));
 await expect(checkbox).toBeChecked();await checkbox.uncheck();
 page.once('dialog',d=>d.accept('Optional rates'));
 await page.getByTestId('confirm-setup').click();
 await expect(page.getByTestId('required-summary')).toContainText('None');
 await expect.poll(async()=> (await localData(page)).profiles[0]?.setup.measurements[0].required).toBe(false);
 await expect.poll(async()=> (await localData(page)).workspace?.confirmed).toBe(true);
 await expect.poll(async()=> (await localData(page)).workspace?.screen).toBe('done');
 await page.reload();await expect(page.getByTestId('required-summary')).toContainText('None');
});
