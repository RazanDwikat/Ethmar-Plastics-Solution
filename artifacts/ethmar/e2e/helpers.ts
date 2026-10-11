import { expect, type Page } from '@playwright/test';
import type { LocalData } from '../src/lib/local-store';

export const csv = [
  'Production log,,,,',
  'run_id,event_type,quantity_kg,extra,zero',
  'E-01,MATERIAL_IN,1000,1000,0',
  'E-01,GOOD_OUT,950,950,0',
  'E-01,SCRAP,50,50,0',
  'E-02,MATERIAL_IN,1000,1000,0',
  'E-02,GOOD_OUT,900,900,0',
  'E-02,SCRAP,100,100,0',
].join('\n');

export async function upload(page: Page, testId = 'upload-file', content = csv) {
  await page.getByTestId(testId).setInputFiles({
    name: 'production.csv', mimeType: 'text/csv', buffer: Buffer.from(content),
  });
}

export async function localData(page: Page): Promise<LocalData> {
  return page.evaluate(async () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ethmar-private-workspace', 1);
      request.onerror = () => reject(request.error?.message);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('data', 'readonly');
        const workspace = tx.objectStore('data').get('workspace');
        const profiles = tx.objectStore('data').get('profiles');
        tx.oncomplete = () => { db.close(); resolve({ workspace: workspace.result ?? null, profiles: profiles.result ?? [] }); };
        tx.onabort = () => { db.close(); reject(tx.error?.message); };
      };
    });
  });
}

export async function saved(page: Page) {
  if(await page.getByTestId('setup-saved').isVisible()){
    await expect.poll(async()=>Boolean((await localData(page)).workspace?.confirmed)).toBe(true);
  }else await expect(page.getByText('Saved in this browser.', { exact: true })).toBeVisible();
}

export async function addStep(page: Page, kind: string) {
  await page.getByTestId('select-add-step').selectOption(kind);
  await page.getByTestId('button-add-step').click();
}

export async function openPreparation(page: Page) {
  await upload(page);
  await page.getByTestId('select-header').selectOption('2');
  await page.getByTestId('button-prepare-file').click();
}

export async function producerRecipe(page: Page) {
  await openPreparation(page);
  await addStep(page, 'calculate');
  await page.getByTestId('select-step-a-0').selectOption('extra');
  await page.getByTestId('select-step-b-0').selectOption('zero');
  await page.getByTestId('input-step-name-0').fill('derived');
  await addStep(page, 'multiply');
  await page.getByTestId('select-step-column-1').selectOption('derived');
  await page.getByTestId('input-step-factor-1').fill('2');
  await addStep(page, 'fill');
  await page.getByTestId('select-step-column-2').selectOption('derived');
  await expect(page.getByTestId('button-prepare-done')).toBeEnabled();
}

export async function confirmSetup(page: Page) {
  await page.getByTestId('button-prepare-done').click();
  await page.getByTestId('button-confirm-shape').click();
  await page.getByText(/Review and edit all column mappings/).click();
  await page.getByRole('combobox', { name: /^Column for Quantity/ }).selectOption({ label: '6 · derived' });
  page.once('dialog', dialog => dialog.accept('Browser regression setup'));
  await page.getByTestId('confirm-setup').click();
  await expect(page.getByTestId('setup-saved')).toBeVisible();
  await saved(page);
}

export async function compare(page: Page) {
  await page.getByTestId('continue-comparison').click();
  await expect(page.getByTestId('compare-manager')).toBeVisible();
}
