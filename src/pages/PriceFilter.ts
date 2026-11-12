import { expect, type Locator, type Page } from '@playwright/test';
import { parsePresetLabel, type PriceRange } from '../price';
import type { ProductList } from './ProductList';

/** A preset is a ready range under the "Вартість" title, for example "500 ₴ - 750 ₴". */
export type Preset = { label: string; range: PriceRange; button: Locator };

/**
 * The price filter. On the site the block is called "Вартість": presets and two fields, "Від" and "До".
 * Desktop: the block is always on the page.
 * Mobile: the "Фільтр" button opens a full-screen panel, "Застосувати" closes it.
 */
export class PriceFilter {
  /** The tag above the list with the active filter, for example "від 250 до 500". A click removes the filter. */
  readonly filterTag: Locator;
  private readonly fromField: Locator;
  private readonly toField: Locator;
  private readonly presetButtons: Locator;
  private readonly filterButton: Locator;
  private readonly applyButton: Locator;

  constructor(
    private readonly page: Page,
    private readonly products: ProductList,
    private readonly isMobile: boolean,
  ) {
    // The fields have no label, placeholder or name. The only thing next to a field is the text "Від" / "До".
    // Exact text (^...$): the common container PriceSelector__fields also contains "Від".
    this.fromField = page.locator('[class*="PriceSelector__field"]').filter({ hasText: /^Від$/ }).getByRole('textbox');
    this.toField = page.locator('[class*="PriceSelector__field"]').filter({ hasText: /^До$/ }).getByRole('textbox');
    this.presetButtons = page.locator('[class*="PriceSelector__priceButton"]');
    this.filterTag = page.locator('[class*="Tags__list"] button');
    // "Фільтр" at the end: "Зняти фільтри" is a different button.
    this.filterButton = page.getByRole('button', { name: /Фільтр$/ });
    this.applyButton = page.getByRole('button', { name: 'Застосувати' });
  }

  /** Types the bounds into the fields and waits for the new product list. */
  async setRange(range: PriceRange): Promise<void> {
    const newList = this.products.waitForList(range);
    if (range.from !== undefined) await this.typePrice(this.fromField, 'price_from', range.from);
    if (range.to !== undefined) await this.typePrice(this.toField, 'price_to', range.to);
    await newList;
    await this.closePanel();
    await this.products.waitUntilLoaded();
  }

  /** Reads the presets from the page, so the test does not depend on the ranges the shop chose. */
  async presets(): Promise<Preset[]> {
    await expect(this.presetButtons.first()).toBeAttached();
    const labels = await this.presetButtons.allTextContents();
    return labels.map((label, index) => ({
      label,
      range: parsePresetLabel(label),
      button: this.presetButtons.nth(index),
    }));
  }

  /** Clicks the preset and waits for the new product list. */
  async choosePreset(preset: Preset): Promise<void> {
    const newList = this.products.waitForList(preset.range);
    // Same reason as in typePrice: a click right after the page load can be lost.
    // The click is repeated only if the URL does not show the range yet: a second click on an active preset could switch it off.
    await expect(async () => {
      await this.openPanel(preset.button);
      if (!this.urlShows(preset.range)) await preset.button.click({ timeout: 1000 });
      await expect.poll(() => this.urlShows(preset.range), { timeout: 1000 }).toBe(true);
    }).toPass();
    await newList;
    await this.closePanel();
    await this.products.waitUntilLoaded();
  }

  /** Clicks the tag above the list and waits for the full product list. */
  async removeWithTag(): Promise<void> {
    const fullList = this.products.waitForList({});
    await this.filterTag.click();
    await fullList;
    await this.products.waitUntilLoaded();
  }

  /** The site keeps the filter in the URL: #price_from=250&price_to=500. A bound that is not set must be absent. */
  urlShows(range: PriceRange): boolean {
    const parameters = new URLSearchParams(new URL(this.page.url()).hash.slice(1));
    return (
      parameters.get('price_from') === (range.from === undefined ? null : String(range.from)) &&
      parameters.get('price_to') === (range.to === undefined ? null : String(range.to))
    );
  }

  /**
   * The site applies a value when the field loses focus (Enter does nothing).
   * Right after the page load the site is not interactive yet and loses typed text without an error,
   * so the attempt is repeated until the URL shows the value.
   */
  private async typePrice(field: Locator, urlParameter: string, price: number): Promise<void> {
    await expect(async () => {
      await this.openPanel(field);
      await field.fill(String(price), { timeout: 1000 });
      await field.blur();
      await expect(this.page).toHaveURL(new RegExp(`${urlParameter}=${price}`), { timeout: 1000 });
    }).toPass();
  }

  /** Mobile: opens the panel if the element is hidden. The site can close a panel opened before the page became interactive. */
  private async openPanel(element: Locator): Promise<void> {
    if (!this.isMobile || (await element.isVisible())) return;
    await this.filterButton.click({ timeout: 1000 });
  }

  /** Mobile: closes the panel. The filter is already applied at this moment, the button only closes the panel. */
  private async closePanel(): Promise<void> {
    if (!this.isMobile) return;
    await this.applyButton.click();
    await expect(this.fromField).toBeHidden();
  }
}
