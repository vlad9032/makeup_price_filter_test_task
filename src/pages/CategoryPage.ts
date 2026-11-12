import type { Page } from '@playwright/test';
import { PriceFilter } from './PriceFilter';
import { ProductList } from './ProductList';

/** "Чоловіча парфумерія". */
const CATEGORY_PATH = '/ua/categorys/3218/';

/** A category page: the price filter and the product list. */
export class CategoryPage {
  readonly priceFilter: PriceFilter;
  readonly products: ProductList;

  constructor(
    private readonly page: Page,
    isMobile: boolean,
  ) {
    this.products = new ProductList(page);
    this.priceFilter = new PriceFilter(page, this.products, isMobile);
  }

  async open(): Promise<void> {
    await this.closePopUpsWhenTheyAppear();
    await this.page.goto(CATEGORY_PATH);
    await this.products.waitUntilShown();
  }

  /**
   * On mobile two pop-ups cover the filter: the "MAKEUP Rewards" tooltip over the "Фільтр" button
   * and the cookie banner over the "Застосувати" button. They appear at different moments,
   * so Playwright checks for them before every action and closes them.
   */
  private async closePopUpsWhenTheyAppear(): Promise<void> {
    const rewardsTooltip = this.page.locator('[class*="RewardsTooltipContent__container"]');
    await this.page.addLocatorHandler(rewardsTooltip, async () => {
      await rewardsTooltip.getByRole('button').first().click();
    });
    const cookieButton = this.page.getByRole('button', { name: 'Погоджуюсь' });
    await this.page.addLocatorHandler(cookieButton, async () => {
      await cookieButton.click();
    });
  }
}
