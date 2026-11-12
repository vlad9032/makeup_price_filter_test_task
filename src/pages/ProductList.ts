import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { parsePrice, type PriceRange } from '../price';

export type ProductCard = { title: string; price: number };

/** The grid of products on a category page. */
export class ProductList {
  /** Cards of the main grid, without sponsored ones (ads). */
  readonly cards: Locator;
  private readonly cardPrices: Locator;
  private readonly loadingSkeleton: Locator;

  constructor(private readonly page: Page) {
    // ">" — only direct children of the grid: carousels with recommendations are not affected by the filter.
    // Sponsored cards are excluded: the requirements for ads are not clear (see findings).
    this.cards = page
      .locator('[class*="Products__cards"] > [class*="ProductCard__cardContainer"]')
      .filter({ hasNot: page.locator('[class*="Sponsored__sponsored"]') });
    // The current price. The crossed-out old price is Price__priceOld, it is not taken.
    this.cardPrices = this.cards.locator('[class*="Price__priceCurrent"]');
    // Grey placeholders the site shows while a new list is loading. The old cards stay in the page meanwhile.
    this.loadingSkeleton = page.locator('[class*="ProductSkeleton__grid"]');
  }

  async waitUntilShown(): Promise<void> {
    await expect(this.cardPrices.first()).toBeVisible();
  }

  /**
   * Starts waiting for the server answer with the product list for this range.
   * Call it BEFORE the action: a fast answer can come before we start to listen.
   * A bound that is not set must not be in the request.
   */
  waitForList(range: PriceRange): Promise<Response> {
    return this.page.waitForResponse((response) => {
      const url = response.url();
      if (!url.includes('/products/?')) return false;
      const fromMatches = range.from === undefined ? !url.includes('priceFrom') : url.includes(`priceFrom=${range.from}`);
      const toMatches = range.to === undefined ? !url.includes('priceTo') : url.includes(`priceTo=${range.to}`);
      return fromMatches && toMatches;
    });
  }

  /** The answer came, now wait until the new cards are drawn. */
  async waitUntilLoaded(): Promise<void> {
    await expect(this.loadingSkeleton).toBeHidden();
  }

  /** Prices of all cards on the page, in hryvnias. Reads once, does not wait. */
  async prices(): Promise<number[]> {
    const texts = await this.cardPrices.allTextContents();
    return texts.map(parsePrice);
  }

  /**
   * Title and price of every card that shows a price. Reads once, does not wait.
   * The title is there so that a failed check says which product is wrong, not only the price.
   */
  async readCards(): Promise<ProductCard[]> {
    const rawCards = await this.cards.evaluateAll((cards) =>
      cards.map((card) => ({
        title: card.querySelector('[class*="ProductCard__title"]')?.textContent?.trim() ?? '',
        priceText: card.querySelector('[class*="Price__priceCurrent"]')?.textContent ?? null,
      })),
    );
    return rawCards
      .filter((card) => card.priceText !== null)
      .map((card) => ({ title: card.title, price: parsePrice(card.priceText as string) }));
  }
}
