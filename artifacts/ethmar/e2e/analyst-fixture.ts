import {test as base} from '@playwright/test';
export {expect,type Page} from '@playwright/test';
// Existing feature regressions explicitly enter the demo as an analyst.
export const test=base.extend({
 page:async({page},use)=>{
  await page.goto('/');
  await page.getByTestId('signin-analyst').click();
  await page.getByTestId('nav-setup').waitFor();
  await use(page);
 },
});
