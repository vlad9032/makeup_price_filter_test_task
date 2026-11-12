import { test, expect } from '@playwright/test';
import { CategoryPage } from '../src/pages/CategoryPage';
import type { Preset } from '../src/pages/PriceFilter';
import { isInRange, percentile } from '../src/price';

const AT_LEAST_4_PRODUCTS = 'The category must have at least 4 products to build a range';

test('price filter: from and to', async ({ page, isMobile }) => {
  const categoryPage = new CategoryPage(page, isMobile);
  await categoryPage.open();

  const pricesBefore = await categoryPage.products.prices();
  expect(pricesBefore.length, AT_LEAST_4_PRODUCTS).toBeGreaterThanOrEqual(4);
  const priceFrom = percentile(pricesBefore, 25);
  const priceTo = percentile(pricesBefore, 75);
  expect(priceFrom, 'The category must have products with different prices to build a range').toBeLessThan(priceTo);

  await categoryPage.priceFilter.setRange({ from: priceFrom, to: priceTo });

  const cards = await categoryPage.products.readCards();
  expect(cards.length).toBeGreaterThan(0);
  expect(cards.filter((card) => card.price < priceFrom || card.price > priceTo)).toEqual([]);
});

test('price filter: only from', async ({ page, isMobile }) => {
  const categoryPage = new CategoryPage(page, isMobile);
  await categoryPage.open();

  const pricesBefore = await categoryPage.products.prices();
  expect(pricesBefore.length, AT_LEAST_4_PRODUCTS).toBeGreaterThanOrEqual(4);
  const priceFrom = percentile(pricesBefore, 50);
  expect(priceFrom, 'The category must have products cheaper than the lower bound').toBeGreaterThan(Math.min(...pricesBefore));

  await categoryPage.priceFilter.setRange({ from: priceFrom });

  const cards = await categoryPage.products.readCards();
  expect(cards.length).toBeGreaterThan(0);
  expect(cards.filter((card) => card.price < priceFrom)).toEqual([]);
});

test('price filter: only to', async ({ page, isMobile }) => {
  const categoryPage = new CategoryPage(page, isMobile);
  await categoryPage.open();

  const pricesBefore = await categoryPage.products.prices();
  expect(pricesBefore.length, AT_LEAST_4_PRODUCTS).toBeGreaterThanOrEqual(4);
  const priceTo = percentile(pricesBefore, 50);
  expect(priceTo, 'The category must have products more expensive than the upper bound').toBeLessThan(Math.max(...pricesBefore));

  await categoryPage.priceFilter.setRange({ to: priceTo });

  const cards = await categoryPage.products.readCards();
  expect(cards.length).toBeGreaterThan(0);
  expect(cards.filter((card) => card.price > priceTo)).toEqual([]);
});

// Presets are split into three equivalence classes by the kind of bound. One preset from each class.

test('price filter: preset with upper bound only ("Менше X")', async ({ page, isMobile }) => {
  const categoryPage = new CategoryPage(page, isMobile);
  await categoryPage.open();

  const presets = await categoryPage.priceFilter.presets();
  await checkPreset(categoryPage, presets.find((p) => p.range.from === undefined && p.range.to !== undefined));
});

test('price filter: preset with both bounds ("X - Y")', async ({ page, isMobile }) => {
  const categoryPage = new CategoryPage(page, isMobile);
  await categoryPage.open();

  // The range preset that contains the median price of the category, so it surely has products.
  const median = percentile(await categoryPage.products.prices(), 50);
  const presets = await categoryPage.priceFilter.presets();
  await checkPreset(
    categoryPage,
    presets.find((p) => p.range.from !== undefined && p.range.to !== undefined && isInRange(median, p.range)),
  );
});

test('price filter: preset with lower bound only ("Більше X")', async ({ page, isMobile }) => {
  const categoryPage = new CategoryPage(page, isMobile);
  await categoryPage.open();

  const presets = await categoryPage.priceFilter.presets();
  await checkPreset(categoryPage, presets.find((p) => p.range.from !== undefined && p.range.to === undefined));
});

// A separate test, so the reset is checked even when the prices in the list are wrong
// (the card price bug, see BUGS.md). It does not check that prices are in range: other tests do it.
test('price filter: the tag above the list removes the filter', async ({ page, isMobile }) => {
  const categoryPage = new CategoryPage(page, isMobile);
  await categoryPage.open();
  const { priceFilter, products } = categoryPage;

  const presets = await priceFilter.presets();
  const preset = presets.find((p) => p.range.from === undefined && p.range.to !== undefined);
  if (preset === undefined) throw new Error('The page has no "Менше X" preset');

  await test.step(`apply the preset "${preset.label}"`, async () => {
    await priceFilter.choosePreset(preset);
    await expect(priceFilter.filterTag).toBeVisible();
  });

  await test.step('click the tag', async () => {
    await priceFilter.removeWithTag();
  });

  await test.step('the filter is removed', async () => {
    await expect(priceFilter.filterTag).toBeHidden();
    expect(priceFilter.urlShows({}), 'The URL must not keep the price filter').toBe(true);
    const prices = await products.prices();
    expect(
      prices.some((price) => !isInRange(price, preset.range)),
      'Without the filter the list must have prices outside the preset range',
    ).toBe(true);
  });
});

/** Applies the preset and checks that all prices are in its range. */
async function checkPreset(categoryPage: CategoryPage, preset: Preset | undefined): Promise<void> {
  if (preset === undefined) throw new Error('The page has no preset of this kind');
  const { priceFilter, products } = categoryPage;

  await test.step(`apply the preset "${preset.label}"`, async () => {
    await priceFilter.choosePreset(preset);
  });

  await test.step('all prices are in the preset range', async () => {
    const cards = await products.readCards();
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.filter((card) => !isInRange(card.price, preset.range))).toEqual([]);
  });
}
