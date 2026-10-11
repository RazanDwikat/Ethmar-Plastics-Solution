import { test, expect } from '@playwright/test';
import { addStep, compare, confirmSetup, csv, localData, openPreparation, producerRecipe, saved } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('upload-file')).toBeVisible();
  // A fresh Playwright context includes an empty IndexedDB, not just empty cookies.
  expect(await localData(page)).toEqual({ workspace: null, profiles: [] });
});

test('both preparation entry points, inline radios and confirmation only after action', async ({ page }) => {
  await openPreparation(page);
  await expect(page.getByTestId('panel-prepare')).toBeVisible();
  await page.getByTestId('button-prepare-back').click();
  await page.getByTestId('continue-mapping').click();
  for (const kind of ['event', 'run', 'prepare']) {
    const card = page.getByTestId(`radio-shape-${kind}`);
    const radio = await card.locator('input').boundingBox();
    const label = await card.locator('strong').boundingBox();
    expect(radio).not.toBeNull();
    expect(label).not.toBeNull();
    expect(radio!.x + radio!.width).toBeLessThanOrEqual(label!.x);
    expect(Math.abs(radio!.y - label!.y)).toBeLessThan(12);
  }
  await expect(page.getByTestId('text-shape-confirmed')).toBeHidden();
  await page.getByTestId('radio-shape-prepare').click();
  await expect(page.getByTestId('panel-prepare')).toBeVisible();
  await page.getByTestId('button-prepare-done').click();
  await expect(page.getByTestId('text-shape-confirmed')).toBeHidden();
  await page.getByTestId('button-confirm-shape').click();
  await page.getByTestId('button-back-row-type').click();
  await expect(page.getByTestId('text-shape-confirmed')).toBeHidden();
  await page.getByTestId('button-confirm-shape').click();
  await expect(page.getByTestId('text-shape-confirmed')).toBeVisible();
  await page.getByTestId('button-back-row-type').click();
  await page.getByTestId('radio-shape-prepare').click();
  await addStep(page, 'fill');
  await page.getByTestId('select-step-column-0').selectOption('run_id');
  await page.getByTestId('button-prepare-done').click();
  await expect(page.getByTestId('text-shape-confirmed')).toBeHidden();
  await saved(page);
  expect((await localData(page)).workspace?.shapeConfirmed).toBe(false);
});

test('valid and unfinished recipe drafts recover on reload without changing original bytes', async ({ page }) => {
  await producerRecipe(page);
  await saved(page);
  const before = await localData(page);
  await page.reload();
  await expect(page.getByTestId('input-step-name-0')).toHaveValue('derived');
  await expect(page.getByTestId('preview-after-1')).toContainText('2000');
  expect((await localData(page)).workspace?.preparation).toEqual(before.workspace?.preparation);
  await addStep(page, 'calculate');
  await expect(page.getByTestId('error-step-3')).toBeVisible();
  await saved(page);
  const draft = (await localData(page)).workspace?.preparation;
  await page.reload();
  await expect(page.getByTestId('error-step-3')).toBeVisible();
  await expect(page.getByTestId('button-prepare-done')).toBeDisabled();
  expect((await localData(page)).workspace?.preparation).toEqual(draft);
  const original = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('ethmar-private-workspace'); r.onsuccess = () => resolve(r.result); });
    const tx = db.transaction('data');
    const w = await new Promise<any>(resolve => { const r = tx.objectStore('data').get('workspace'); r.onsuccess = () => resolve(r.result); });
    db.close();
    return new TextDecoder().decode(w.file.original);
  });
  expect(original).toBe(csv);
  await page.getByTestId('button-prepare-back').click();
  const originals = page.getByTestId('original-rows');
  await originals.locator('summary').click();
  await expect(originals.getByTestId('source-row-3')).toContainText('1000');
  await expect(originals.locator('input,textarea,[contenteditable=true]')).toHaveCount(0);
});

test('reordering or deleting a producer invalidates dependent previews and setup', async ({ page }) => {
  await producerRecipe(page);
  await confirmSetup(page);
  await page.getByTestId('preview-as-manager').click();
  await compare(page);
  await page.getByTestId('nav-setup').click();
  await page.getByTestId('button-back-row-type').click();
  await page.getByTestId('details-prepared-preview').locator(':scope > summary').click();
  await page.getByTestId('button-edit-preparation').click();
  await page.getByTestId('button-step-down-0').click();
  await expect(page.getByTestId('error-step-0')).toBeVisible();
  await expect(page.getByTestId('preview-after-0')).toHaveCount(0);
  await expect(page.getByTestId('text-step-waiting-2')).toBeVisible();
  await expect(page.getByTestId('preview-after-2')).toHaveCount(0);
  await expect(page.getByTestId('button-prepare-done')).toBeDisabled();
  await expect(page.getByTestId('compare-manager')).toHaveCount(0);
  await expect(page.getByTestId('step-4')).toBeDisabled();
  await saved(page);
  expect((await localData(page)).workspace).toMatchObject({ setup: null, confirmed: false, shapeConfirmed: false });
  await page.getByTestId('button-step-up-1').click();
  await expect(page.getByTestId('preview-after-2')).toBeVisible();
  page.once('dialog', d => d.dismiss());
  await page.getByTestId('button-step-delete-0').click();
  await expect(page.getByTestId('card-step-2')).toBeVisible();
  page.once('dialog', d => d.accept());
  await page.getByTestId('button-step-delete-0').click();
  await expect(page.getByTestId('error-step-0')).toBeVisible();
  await expect(page.getByTestId('text-step-waiting-1')).toBeVisible();
  await expect(page.getByTestId('button-prepare-done')).toBeDisabled();
  await saved(page);
  await page.reload();
  await expect(page.getByTestId('error-step-0')).toBeVisible();
  await expect(page.getByTestId('step-4')).toBeDisabled();
  await expect(page.getByTestId('compare-manager')).toHaveCount(0);
});
