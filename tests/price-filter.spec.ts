import { test, expect } from '@playwright/test';

test('price filter: from and to', async ({ page, isMobile }) => {
  // Pop-ups that cover the filter on mobile. Playwright closes them whenever they appear.
  const rewardsTooltip = page.locator('[class*="RewardsTooltipContent__container"]');
  await page.addLocatorHandler(rewardsTooltip, async () => {
    await rewardsTooltip.getByRole('button').first().click();
  });
  const cookieButton = page.getByRole('button', { name: 'Погоджуюсь' });
  await page.addLocatorHandler(cookieButton, async () => {
    await cookieButton.click();
  });

  await page.goto('/ua/categorys/3218/');

  const cards = page
    .locator('[class*="Products__cards"] > [class*="ProductCard__cardContainer"]')
    .filter({ hasNot: page.locator('[class*="Sponsored__sponsored"]') });
  const cardPrices = cards.locator('[class*="Price__priceCurrent"]');

  await expect(cardPrices.first()).toBeVisible();
  const pricesBefore = (await cardPrices.allTextContents()).map(toNumber).sort((a, b) => a - b);
  expect(pricesBefore.length, 'The category must have at least 4 products to build a range').toBeGreaterThanOrEqual(4);
  const priceFrom = pricesBefore[Math.floor(pricesBefore.length * 0.25)];
  const priceTo = pricesBefore[Math.floor(pricesBefore.length * 0.75)];
  expect(priceFrom, 'The category must have products with different prices to build a range').toBeLessThan(priceTo);

  const priceSelectorFrom = page.locator('[class*="PriceSelector__field"]').filter({ hasText: /^Від$/ }).getByRole('textbox');
  const priceSelectorTo = page.locator('[class*="PriceSelector__field"]').filter({ hasText: /^До$/ }).getByRole('textbox');
  const filterButton = page.getByRole('button', { name: /Фільтр$/ });
  const applyButton = page.getByRole('button', { name: 'Застосувати' });

  await expect(async () => {
    if (isMobile && !(await priceSelectorFrom.isVisible())) await filterButton.click({ timeout: 1000 });
    await priceSelectorFrom.fill(String(priceFrom), { timeout: 1000 });
    await priceSelectorFrom.blur();
    await expect(page).toHaveURL(new RegExp(`price_from=${priceFrom}`), { timeout: 1000 });
  }).toPass();

  const newProductList = page.waitForResponse(
    (response) => response.url().includes('/products/?') && response.url().includes(`priceTo=${priceTo}`),
  );

  await expect(async () => {
    if (isMobile && !(await priceSelectorTo.isVisible())) await filterButton.click({ timeout: 1000 });
    await priceSelectorTo.fill(String(priceTo), { timeout: 1000 });
    await priceSelectorTo.blur();
    await expect(page).toHaveURL(new RegExp(`price_to=${priceTo}`), { timeout: 1000 });
  }).toPass();

  await newProductList;

  if (isMobile) {
    await applyButton.click();
    await expect(priceSelectorFrom).toBeHidden();
  }

  await expect(page.locator('[class*="ProductSkeleton__grid"]')).toBeHidden();

  const prices = (await cardPrices.allTextContents()).map(toNumber);

  expect(prices.length).toBeGreaterThan(0);
  expect(prices.filter((price) => price < priceFrom || price > priceTo)).toEqual([]);
});

function toNumber(text: string): number {
  return Number(text.replace(/\D/g, ''));
}
