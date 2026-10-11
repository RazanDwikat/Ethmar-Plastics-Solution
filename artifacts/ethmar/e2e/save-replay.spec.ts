import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { compare, confirmSetup, csv, localData, producerRecipe, saved, upload } from './helpers';

test('saved JSON, reload and manager replay retain the recipe but never stale comparisons', async ({ page, context }) => {
  await page.goto('./');
  await producerRecipe(page);
  await confirmSetup(page);
  const initial = await localData(page);
  const profile = initial.profiles[0];
  expect(profile.setup.preparation?.steps.map(s => s.kind)).toEqual(['calculate', 'multiply', 'fill']);
  page.once('dialog', d => d.accept('Browser regression setup'));
  const downloadEvent = page.waitForEvent('download');
  await page.getByTestId('save-export-setup').click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('Browser-regression-setup.json');
  expect(await download.failure()).toBeNull();
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported).toEqual((await localData(page)).profiles[0]);
  expect(exported.setup.preparation).toEqual(profile.setup.preparation);
  expect(exported.headers).toContain('derived');
  expect(exported).toMatchObject({ confirmed: true, headerLine: 2 });
  expect(exported).not.toHaveProperty('report');
  expect(exported).not.toHaveProperty('file');
  await saved(page);
  await page.reload();
  await expect(page.getByTestId('setup-saved')).toBeVisible();
  expect((await localData(page)).profiles[0]).toEqual(exported);

  await page.getByTestId('nav-compare').click();
  await expect(page.getByTestId('manager-upload')).toBeVisible();
  await expect(page.getByTestId('compare-manager')).toHaveCount(0);
  // New values prove replay is on the manager file, not cached analyst results.
  await upload(page, 'manager-upload', csv.replaceAll('E-01', 'M-01').replaceAll('E-02', 'M-02').replaceAll('1000', '2000'));
  await expect(page.getByTestId('compatibility-state')).toContainText('Matches');
  await expect(page.getByTestId('panel-row-shape')).toHaveCount(0);
  await expect(page.getByTestId('panel-prepare')).toHaveCount(0);
  const audit = page.getByTestId('preparation-audit');
  await audit.locator(':scope > summary').click();
  await expect(audit).toContainText('3.');
  await audit.getByTestId('original-rows').locator(':scope > summary').click();
  await expect(audit.getByTestId('source-row-3')).toContainText('2000');
  await expect(audit.locator('input,textarea,[contenteditable=true]')).toHaveCount(0);
  await compare(page);
  await expect(page.getByTestId('compare-manager')).toContainText('M-01');
  await expect(page.getByTestId('compare-manager')).not.toContainText('E-01');
  await page.locator('.all-numbers > summary').click();
  const inputTotals = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Material input', exact: true }) });
  await expect(inputTotals).toContainText('4,000');
  const scrapTotals = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Scrap', exact: true }) });
  await expect(scrapTotals).toContainText('100');
  await expect(scrapTotals).toContainText('200');
  expect((await localData(page)).workspace?.file).toEqual(initial.workspace?.file);
  expect((await localData(page)).profiles[0]).toEqual(exported);
  await page.getByTestId('nav-compare').click();
  await expect(page.getByTestId('compare-manager')).toHaveCount(0);
  await upload(page, 'manager-upload', csv.replace('extra,zero', 'missing,zero'));
  await expect(page.getByTestId('compatibility-state')).toHaveText('Does not match');
  await expect(page.getByTestId('continue-comparison')).toBeDisabled();
  await expect(page.getByTestId('compare-manager')).toHaveCount(0);

  await page.getByText('Exact differences to share with your analyst', { exact: true }).click();
  const differences = page.getByRole('textbox', { name: 'Exact compatibility differences' });
  await expect(differences).toHaveAttribute('readonly', '');
  const message = await differences.inputValue();
  expect(message).toContain('Does not match');
  expect(message).toContain('extra');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy message for analyst' }).click();
  await expect(page.getByText('Message copied.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(message);
  // Explicit failure path: do not claim success if the browser denies clipboard access.
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true, value: async () => { throw new DOMException('Denied', 'NotAllowedError'); },
    });
  });
  await page.getByRole('button', { name: 'Copy message for analyst' }).click();
  await expect(page.getByText('Clipboard unavailable. Select and copy the message in the text box.', { exact: true })).toBeVisible();
  await expect(differences).toHaveValue(message);
  await expect(page.getByText('Message copied.', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('setup-saved')).toBeVisible();
  await page.getByTestId('nav-compare').click();
  await expect(page.getByTestId('manager-setup')).toHaveValue(profile.id);
  await expect(page.getByTestId('manager-upload')).toBeVisible();
  await expect(page.getByTestId('compare-manager')).toHaveCount(0);
});
