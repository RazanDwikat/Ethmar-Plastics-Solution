import {test,expect,type Page} from './analyst-fixture';
import {parseBytes,inspectSheet} from '../src/lib/inspection';
import {defaultSetup} from '../src/lib/setup';
import {samples} from '../src/lib/samples';

async function results(page:Page){
 const file=await parseBytes(new TextEncoder().encode(samples[0].csv).buffer,'clean.csv');
 const inspection=inspectSheet(file.sheets[0],'.');
 const profile={id:'tooltip-test',name:'Tooltip checks',savedAt:new Date().toISOString(),headers:inspection.headers,headerLine:inspection.headerLine,setup:defaultSetup(inspection),confirmed:true};
 await page.goto('/');
 await page.evaluate(async p=>{await new Promise<void>((resolve,reject)=>{
  const request=indexedDB.open('ethmar-private-workspace',1);
  request.onsuccess=()=>{const db=request.result;const tx=db.transaction('data','readwrite');tx.objectStore('data').put([p],'profiles');tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)};
  request.onerror=()=>reject(request.error);
 })},profile);
 await page.reload();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByTestId('signin-manager').click();
 await page.getByTestId('manager-upload').setInputFiles({name:'issues.csv',mimeType:'text/csv',buffer:Buffer.from(samples[1].csv)});
 await page.getByTestId('continue-comparison').click();
 await expect(page.getByTestId('compare-manager')).toBeVisible();
}

test('run badges and unavailable values explain on focus and hover; Escape keeps evidence open',async({page})=>{
 await results(page);
 const badge=page.locator('.run-card .explanation-trigger').filter({has:page.getByTestId('health-note')}).first();
 await badge.focus();
 await expect(page.getByRole('tooltip')).toContainText(/line/i);
 await page.keyboard.press('Escape');
 await expect(page.getByRole('tooltip')).toHaveCount(0);
 await badge.hover();
 await expect(page.getByRole('tooltip')).toContainText(/counted once|duplicate|repeated/i);
 await badge.click();
 await expect(page.getByRole('dialog').last()).toBeVisible();
 await expect(page.getByRole('dialog').last()).toContainText(/line/i);
 await page.keyboard.press('Escape');
 const unavailable=page.locator('.metric-grid .value-link').filter({hasText:/Can't calculate|Cannot calculate/}).first();
 await unavailable.focus();
 await expect(page.getByRole('tooltip')).toContainText(/material|input/i);
 await page.keyboard.press('Escape');
 await unavailable.click();
 await expect(page.getByRole('dialog').last()).toBeVisible();
 const inner=page.getByRole('dialog').last().locator('.explanation-trigger').first();
 if(await inner.count()){
  await inner.focus();await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(page.getByRole('dialog').last()).toBeVisible();
 }
});

test.describe('mobile status explanations',()=>{
 test.use({viewport:{width:390,height:844},hasTouch:true});
 test('tap reveals a readable tooltip without covering its trigger',async({page})=>{
  await results(page);
  const badge=page.locator('.run-card .explanation-trigger').filter({has:page.getByTestId('health-missing')}).first();
  await badge.tap();
  const tip=page.getByRole('tooltip');await expect(tip).toContainText(/material|input/i);
  const a=await badge.boundingBox(),b=await tip.boundingBox();
  expect(a).not.toBeNull();expect(b).not.toBeNull();
  expect(b!.x).toBeGreaterThanOrEqual(0);expect(b!.x+b!.width).toBeLessThanOrEqual(390);
  expect(b!.y>=a!.y+a!.height||b!.y+b!.height<=a!.y).toBeTruthy();
  await page.keyboard.press('Escape');await expect(tip).toHaveCount(0);
 });
});
