import {
  Comparison,
  ComparisonRequest,
  Product,
  PLATFORMS,
  PlatformComparison,
} from '../../../shared/contracts';
// Conservative equivalence: normalize mass/volume, never infer product identity or multipacks.
export function normalizePack(value: string): string {
  const text = value.toLowerCase().replace(/\s+/g, '');
  const match = /^(\d+(?:\.\d+)?)(kg|g|l|ml)$/.exec(text);
  if (!match) return text;
  const amount = Number(match[1]);
  if (amount <= 0) return '';
  const unit = match[2];
  return `${
    Math.round(amount * (unit === 'kg' || unit === 'l' ? 1000 : 1) * 1000) /
    1000
  }${unit === 'kg' ? 'g' : unit === 'l' ? 'ml' : unit}`;
}
export function calculateComparison(
  request: ComparisonRequest,
  products: Product[],
  now: Date,
  maxAgeMs: number,
): Comparison {
  const byId = new Map(products.map(product => [product.id, product]));
  const platforms: PlatformComparison[] = PLATFORMS.map(platform => {
    let subtotal = 0,
      eta = 0,
      oldest = now.getTime(),
      isDemo = false;
    const missingItems: PlatformComparison['missingItems'] = [];
    for (const line of request.items) {
      const product = byId.get(line.productId);
      if (!product) {
        missingItems.push({
          productId: line.productId,
          reason: 'PRODUCT_NOT_FOUND',
        });
        continue;
      }
      const offers = product.variants
        .filter(offer => {
          const age = now.getTime() - Date.parse(offer.updatedAt);
          return (
            offer.platform === platform &&
            offer.location === request.location &&
            offer.available &&
            normalizePack(product.quantity) !== '' &&
            normalizePack(product.quantity) === normalizePack(offer.quantity) &&
            Number.isSafeInteger(offer.pricePaise) &&
            offer.pricePaise >= 0 &&
            Number.isInteger(offer.deliveryTime) &&
            offer.deliveryTime > 0 &&
            age >= 0 &&
            age <= maxAgeMs
          );
        })
        .sort(
          (a, b) =>
            a.pricePaise - b.pricePaise ||
            a.deliveryTime - b.deliveryTime ||
            a.id.localeCompare(b.id),
        );
      const offer = offers[0];
      if (!offer) {
        missingItems.push({
          productId: line.productId,
          reason: 'NO_VALID_OFFER',
        });
        continue;
      }
      subtotal += offer.pricePaise * line.quantity;
      if (!Number.isSafeInteger(subtotal))
        throw new RangeError('Basket total exceeds supported precision');
      eta = Math.max(eta, offer.deliveryTime);
      oldest = Math.min(oldest, Date.parse(offer.updatedAt));
      isDemo ||= offer.isDemo;
    }
    const eligible = request.items.length > 0 && missingItems.length === 0;
    return {
      platform,
      eligible,
      subtotalPaise: eligible ? subtotal : null,
      deliveryTime: eligible ? eta : null,
      missingItems,
      oldestPriceAt: eligible ? new Date(oldest).toISOString() : null,
      isDemo,
    };
  });
  const eligible = platforms
    .filter(p => p.eligible)
    .sort(
      (a, b) =>
        a.subtotalPaise! - b.subtotalPaise! ||
        a.deliveryTime! - b.deliveryTime! ||
        a.platform.localeCompare(b.platform),
    );
  return {
    platforms,
    recommendedPlatform: eligible[0]?.platform ?? null,
    savingsPaise:
      eligible.length > 1
        ? eligible[eligible.length - 1].subtotalPaise! -
          eligible[0].subtotalPaise!
        : 0,
    location: request.location,
    currency: 'INR',
    excludesFees: true,
    comparedAt: now.toISOString(),
  };
}
