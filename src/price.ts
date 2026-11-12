/** A bound that is not given is not set. */
export type PriceRange = { from?: number; to?: number };

/** "1328 ₴" -> 1328. Prices on the site are whole hryvnias, without kopecks. */
export function parsePrice(text: string): number {
  return Number(text.replace(/\D/g, ''));
}

/**
 * The price below which the given percent of prices lie.
 * percentile([100, 200, 300, 400], 50) -> 300
 */
export function percentile(prices: number[], percent: number): number {
  const sorted = [...prices].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length * percent) / 100)];
}

/** Bounds are inclusive. A bound that is not set does not limit. */
export function isInRange(price: number, range: PriceRange): boolean {
  return (range.from === undefined || price >= range.from) && (range.to === undefined || price <= range.to);
}

/** "Менше 50 ₴" -> { to: 50 }, "50 ₴ - 100 ₴" -> { from: 50, to: 100 }, "Більше 5000 ₴" -> { from: 5000 } */
export function parsePresetLabel(label: string): PriceRange {
  const prices = label.split('-').map(parsePrice);
  if (prices.length === 2) return { from: prices[0], to: prices[1] };
  if (label.includes('Менше')) return { to: prices[0] };
  if (label.includes('Більше')) return { from: prices[0] };
  throw new Error(`Unknown preset "${label}"`);
}
