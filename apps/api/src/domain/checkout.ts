import { z } from 'zod';
import {
  Preferences,
  defaultPreferences,
} from '../../../../packages/contracts/preferences';
import { rankPlans } from './preferences';
import {
  BasketLine,
  BasketPlan,
  CheckoutComparison,
  DeliveryPlan,
  ServiceStore,
} from '../../../../packages/contracts/checkout';
const money = z.number().int().min(0).max(2147483647);
// Complete, tax-inclusive provider tariff; null means unknown, never zero.
export const tariffSchema = z
  .object({
    deliveryFeePaise: money,
    handlingFeePaise: money,
    surgeFeePaise: money,
    smallCartFeePaise: money,
    smallCartThresholdPaise: money,
    minimumOrderPaise: money,
    freeDeliveryThresholdPaise: money.nullable(),
    coupon: z
      .object({
        code: z.string().min(1).max(64),
        discountPaise: money,
        minimumSubtotalPaise: money,
        automatic: z.boolean(),
      })
      .strict()
      .nullable(),
    membership: z
      .object({
        entitlement: z.string().min(1).max(64),
        deliveryDiscountPaise: money,
        stacksWithCoupon: z.boolean(),
      })
      .strict()
      .nullable(),
    taxInclusive: z.literal(true),
  })
  .strict();
export type Tariff = z.infer<typeof tariffSchema>;
export interface StoreInput {
  store: ServiceStore;
  tariff: Tariff | null;
  offers: {
    productId: string;
    pricePaise: number;
    stockQuantity: number | null;
    expiresAt: string;
  }[];
}
export function quoteStore(
  input: StoreInput,
  items: BasketLine[],
  now: Date,
  entitlements: readonly string[] = [],
  couponCode?: string,
): DeliveryPlan | null {
  if (
    !items.length ||
    !input.tariff ||
    Date.parse(input.store.expiresAt) <= now.getTime()
  )
    return null;
  const tariff = tariffSchema.parse(input.tariff);
  const itemCosts: { productId: string; totalPaise: number }[] = [];
  let subtotal = 0;
  let until = Date.parse(input.store.expiresAt);
  for (const item of items) {
    const offer = input.offers
      .filter(
        o =>
          o.productId === item.productId &&
          Number.isSafeInteger(o.pricePaise) &&
          o.pricePaise >= 0 &&
          Date.parse(o.expiresAt) > now.getTime() &&
          o.stockQuantity !== null &&
          o.stockQuantity >= item.quantity,
      )
      .sort((a, b) => a.pricePaise - b.pricePaise)[0];
    if (!offer) return null;
    subtotal += offer.pricePaise * item.quantity;
    itemCosts.push({
      productId: item.productId,
      totalPaise: offer.pricePaise * item.quantity,
    });
    until = Math.min(until, Date.parse(offer.expiresAt));
  }
  if (!Number.isSafeInteger(subtotal) || subtotal < tariff.minimumOrderPaise)
    return null;
  const delivery =
    tariff.freeDeliveryThresholdPaise !== null &&
    subtotal >= tariff.freeDeliveryThresholdPaise
      ? 0
      : tariff.deliveryFeePaise;
  const small =
    subtotal < tariff.smallCartThresholdPaise ? tariff.smallCartFeePaise : 0;
  const coupon =
    tariff.coupon &&
    (tariff.coupon.automatic || tariff.coupon.code === couponCode) &&
    subtotal >= tariff.coupon.minimumSubtotalPaise
      ? Math.min(subtotal, tariff.coupon.discountPaise)
      : 0;
  const member =
    tariff.membership && entitlements.includes(tariff.membership.entitlement)
      ? Math.min(delivery, tariff.membership.deliveryDiscountPaise)
      : 0;
  const stacks = tariff.membership?.stacksWithCoupon ?? true;
  const couponDiscountPaise = stacks || coupon >= member ? coupon : 0;
  const membershipBenefitPaise = stacks || member > coupon ? member : 0;
  const finalPayablePaise =
    subtotal +
    delivery +
    tariff.handlingFeePaise +
    tariff.surgeFeePaise +
    small -
    couponDiscountPaise -
    membershipBenefitPaise;
  if (!Number.isSafeInteger(finalPayablePaise) || finalPayablePaise < 0)
    return null;
  return {
    itemCosts,
    store: input.store,
    items,
    validUntil: new Date(until).toISOString(),
    costs: {
      itemSubtotalPaise: subtotal,
      deliveryFeePaise: delivery,
      handlingFeePaise: tariff.handlingFeePaise,
      surgeFeePaise: tariff.surgeFeePaise,
      smallCartFeePaise: small,
      couponDiscountPaise,
      membershipBenefitPaise,
      finalPayablePaise,
    },
  };
}
const plan = (deliveries: DeliveryPlan[]): BasketPlan => ({
  deliveries,
  deliveryCount: deliveries.length,
  finalPayablePaise: deliveries.reduce(
    (sum, d) => sum + d.costs.finalPayablePaise,
    0,
  ),
});

export function optimizeBasket(
  pincode: string,
  items: BasketLine[],
  stores: StoreInput[],
  now = new Date(),
  maxDeliveries = 2,
  entitlements: readonly string[] = [],
  couponCode?: string,
  preferences: Preferences = defaultPreferences,
): CheckoutComparison {
  if (
    !items.length ||
    items.length > 100 ||
    new Set(items.map(i => i.productId)).size !== items.length ||
    items.some(
      i => !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 99,
    )
  )
    throw new Error('Invalid basket');
  if (![1, 2, 3].includes(maxDeliveries))
    throw new Error('Invalid delivery limit');
  const order = rankPlans(preferences);
  stores = stores.filter(
    s =>
      s.store.pincode === pincode &&
      !preferences.avoidedRetailers.includes(s.store.retailer) &&
      (preferences.maxEtaMinutes === null ||
        s.store.etaMinutes <= preferences.maxEtaMinutes),
  );
  if (preferences.singlePlatformOnly) maxDeliveries = 1;
  const unavailable: CheckoutComparison['unavailable'] = [];
  const singles: BasketPlan[] = [];
  for (const store of stores) {
    const quote = quoteStore(store, items, now, entitlements, couponCode);
    if (quote) singles.push(plan([quote]));
    else
      unavailable.push({
        storeId: store.store.id,
        reason: store.tariff
          ? 'STOCK_FRESHNESS_OR_MINIMUM_ORDER'
          : 'CHECKOUT_FEES_UNKNOWN',
      });
  }
  singles.sort(order);
  let bestSplit: BasketPlan | null = null;
  let evaluated = 0;
  // Explicit bounded exhaustive search over whole product lines. Never label a truncated search optimal.
  const eligibleStores = stores
    .filter(s => s.tariff && Date.parse(s.store.expiresAt) > now.getTime())
    .sort((a, b) => a.store.id.localeCompare(b.store.id));
  const groups = new Map<number, BasketLine[]>();
  let complete = true;
  const limit = 50000;
  function visit(index: number) {
    if (evaluated >= limit) {
      complete = false;
      return;
    }
    evaluated++;
    if (index === items.length) {
      if (groups.size < 2) return;
      const deliveries: DeliveryPlan[] = [];
      for (const [s, lines] of groups) {
        const quote = quoteStore(
          eligibleStores[s],
          lines,
          now,
          entitlements,
          couponCode,
        );
        if (!quote) return;
        deliveries.push(quote);
      }
      const candidate = plan(deliveries);
      if (!bestSplit || order(candidate, bestSplit) < 0) bestSplit = candidate;
      return;
    }
    for (let s = 0; s < eligibleStores.length; s++) {
      if (!complete) return;
      const current = groups.get(s);
      if (!current && groups.size >= maxDeliveries) continue;
      // One store per retailer avoids invalid coupon/membership reuse across stores.
      if (
        !current &&
        [...groups.keys()].some(
          k =>
            eligibleStores[k].store.retailer ===
            eligibleStores[s].store.retailer,
        )
      )
        continue;
      const item = items[index];
      if (
        !eligibleStores[s].offers.some(
          o =>
            o.productId === item.productId &&
            o.stockQuantity !== null &&
            o.stockQuantity >= item.quantity &&
            Date.parse(o.expiresAt) > now.getTime(),
        )
      )
        continue;
      groups.set(s, [...(current || []), item]);
      visit(index + 1);
      if (current) groups.set(s, current);
      else groups.delete(s);
    }
  }
  if (maxDeliveries > 1) visit(0);
  const bestSingle = singles[0] ?? null;
  const best =
    [bestSingle, bestSplit]
      .filter((p): p is BasketPlan => p !== null)
      .sort(order)[0] ?? null;
  return {
    pincode,
    singles,
    bestSingle,
    bestSplit,
    recommended: best,
    savingsPaise:
      bestSingle && best
        ? Math.max(0, bestSingle.finalPayablePaise - best.finalPayablePaise)
        : 0,
    status: best ? 'QUOTED' : 'NO_VERIFIED_CHECKOUT',
    comparedAt: now.toISOString(),
    search: { complete, evaluated, maxDeliveries, wholeLinesOnly: true },
    unavailable,
  };
}
