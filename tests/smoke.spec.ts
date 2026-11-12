import { test, expect } from '@playwright/test';

test('makeup opens', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/makeup\.com\.ua/);
});
