import type { CartItem } from '../models/Cart';
import type { Product } from '../models/Product';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function product(value: unknown): value is Product {
  return (
    record(value) &&
    typeof value.id === 'string' &&
    uuid.test(value.id) &&
    ['name', 'brand', 'category', 'quantity'].every(
      key => typeof value[key] === 'string',
    ) &&
    Array.isArray(value.variants) &&
    value.variants.every(
      offer =>
        record(offer) &&
        typeof offer.id === 'string' &&
        ['BLINKIT', 'ZEPTO', 'SWIGGY'].includes(String(offer.platform)) &&
        typeof offer.platformName === 'string' &&
        typeof offer.quantity === 'string' &&
        Number.isSafeInteger(offer.pricePaise) &&
        Number(offer.pricePaise) >= 0 &&
        Number.isInteger(offer.deliveryTime) &&
        Number(offer.deliveryTime) > 0 &&
        typeof offer.available === 'boolean' &&
        typeof offer.isDemo === 'boolean' &&
        typeof offer.location === 'string' &&
        typeof offer.updatedAt === 'string',
    )
  );
}
export function restoreCart(value: unknown): CartItem[] {
  if (!record(value) || !Array.isArray(value.cart) || value.cart.length > 100) {
    throw new Error('Invalid saved cart');
  }
  const ids = new Set<string>();
  return value.cart.map(line => {
    if (
      !record(line) ||
      !product(line.product) ||
      typeof line.quantity !== 'number' ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 99 ||
      ids.has(line.product.id)
    ) {
      throw new Error('Invalid saved cart item');
    }
    ids.add(line.product.id);
    return { product: line.product, quantity: line.quantity };
  });
}
export function restoreLocation(value: unknown, fallback: string): string {
  return record(value) &&
    typeof value.location === 'string' &&
    /^[A-Za-z0-9_-]{1,64}$/.test(value.location)
    ? value.location
    : fallback;
}
