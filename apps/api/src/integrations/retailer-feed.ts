import { z } from 'zod';

export const retailers = [
  'BLINKIT',
  'ZEPTO',
  'SWIGGY',
  'BIGBASKET',
  'DMART_READY',
] as const;
export type Retailer = (typeof retailers)[number];
const money = z.number().int().min(0).max(2147483647);
const identifier = z.string().trim().min(1).max(200);
export const offerSchema = z
  .object({
    sku: identifier,
    location: identifier,
    storeId: identifier,
    sellerId: identifier,
    productId: z.string().uuid(),
    packSize: identifier,
    pricePaise: money,
    mrpPaise: money.nullable(),
    inStock: z.boolean(),
    stockQuantity: z.number().int().min(0).max(2147483647).nullable(),
    etaMinutes: z.number().int().min(1).max(10080).nullable(),
    feesPaise: money.nullable(),
    minimumOrderPaise: money.nullable(),
    observedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .refine(
    o => o.mrpPaise === null || o.mrpPaise >= o.pricePaise,
    'MRP must be at least the selling price',
  )
  .refine(
    o => !o.inStock || o.stockQuantity !== 0,
    'In-stock offers cannot have zero stock',
  );
export type NormalizedOffer = z.infer<typeof offerSchema>;

// Each retailer supplies its own mapper after its authorized contract is known.
export interface RetailerAdapter {
  retailer: Retailer;
  normalize(payload: unknown): unknown[];
}

export function validateFeed(
  adapter: RetailerAdapter,
  payload: unknown,
  now = new Date(),
  maxAgeMs = 86400000,
) {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0)
    throw new Error('Invalid freshness limit');
  const offers = z
    .array(offerSchema)
    .min(1)
    .max(1000)
    .parse(adapter.normalize(payload));
  const identities = new Set<string>();
  for (const offer of offers) {
    const age = now.getTime() - Date.parse(offer.observedAt);
    if (!Number.isFinite(age) || age < 0 || age > maxAgeMs)
      throw new Error('Stale or future source observation');
    const key = JSON.stringify([
      offer.sku,
      offer.location,
      offer.storeId,
      offer.sellerId,
    ]);
    if (identities.has(key)) throw new Error('Duplicate offer identity');
    identities.add(key);
  }
  return offers;
}

// Explicit normalized interchange format, not a claim about a retailer's API.
export function normalizedFeedAdapter(retailer: Retailer): RetailerAdapter {
  return {
    retailer,
    normalize(payload) {
      return z
        .object({
          retailer: z.literal(retailer),
          offers: z.array(z.unknown()).max(1000),
        })
        .strict()
        .parse(payload).offers;
    },
  };
}
