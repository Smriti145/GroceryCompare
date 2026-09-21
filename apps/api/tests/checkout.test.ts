import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  optimizeBasket,
  quoteStore,
  StoreInput,
  Tariff,
} from '../src/domain/checkout';
const now = new Date('2026-09-21T12:00:00Z');
const expiry = '2026-09-21T12:10:00Z';
const tariff: Tariff = {
  deliveryFeePaise: 2000,
  handlingFeePaise: 0,
  surgeFeePaise: 0,
  smallCartFeePaise: 0,
  smallCartThresholdPaise: 0,
  minimumOrderPaise: 0,
  freeDeliveryThresholdPaise: null,
  coupon: null,
  membership: null,
  taxInclusive: true,
};
function store(id: string, prices = [20000, 56600]): StoreInput {
  return {
    store: {
      id,
      retailer: id === 'z' ? 'ZEPTO' : 'BLINKIT',
      storeId: id,
      sellerId: 'seller',
      pincode: '560001',
      etaMinutes: 12,
      expiresAt: expiry,
    },
    tariff: { ...tariff },
    offers: prices.map((pricePaise, i) => ({
      productId: String(i),
      pricePaise,
      stockQuantity: 10,
      expiresAt: expiry,
    })),
  };
}
const items = [
  { productId: '0', quantity: 1 },
  { productId: '1', quantity: 1 },
];
test('finds ₹786 single and ₹742 split with ₹44 savings after both delivery fees', () => {
  const z = store('z');
  const b = store('b', [60000, 50000]);
  b.tariff!.deliveryFeePaise = 2200;
  const r = optimizeBasket('560001', items, [z, b], now);
  assert.equal(r.bestSingle?.finalPayablePaise, 78600);
  assert.equal(r.bestSplit?.finalPayablePaise, 74200);
  assert.equal(r.savingsPaise, 4400);
  assert.equal(r.recommended?.deliveryCount, 2);
  assert.equal(r.search.complete, true);
});
test('fees can make one delivery cheaper and unknown fees cannot win', () => {
  const z = store('z');
  const b = store('b', [60000, 50000]);
  b.tariff!.deliveryFeePaise = 10000;
  assert.equal(
    optimizeBasket('560001', items, [z, b], now).recommended?.deliveryCount,
    1,
  );
  z.tariff = null;
  assert.equal(quoteStore(z, items, now), null);
});
test('quantities, minimum order, free delivery, small-cart, surge and handling are included', () => {
  const s = store('z', [1000, 2000]);
  s.tariff = {
    ...tariff,
    handlingFeePaise: 100,
    surgeFeePaise: 300,
    smallCartFeePaise: 500,
    smallCartThresholdPaise: 5000,
    minimumOrderPaise: 2500,
    freeDeliveryThresholdPaise: 4000,
  };
  assert.equal(quoteStore(s, [items[0]], now), null);
  assert.equal(quoteStore(s, items, now)?.costs.finalPayablePaise, 5900);
  assert.equal(
    quoteStore(s, [{ productId: '1', quantity: 3 }], now)?.costs
      .finalPayablePaise,
    6400,
  );
});
test('membership requires verified entitlement and nonstacking benefits choose the better discount', () => {
  const s = store('z');
  s.tariff!.membership = {
    entitlement: 'z-member',
    deliveryDiscountPaise: 2000,
    stacksWithCoupon: false,
  };
  s.tariff!.coupon = {
    code: 'SAVE',
    discountPaise: 1000,
    minimumSubtotalPaise: 1000,
    automatic: false,
  };
  assert.equal(quoteStore(s, items, now)?.costs.membershipBenefitPaise, 0);
  const q = quoteStore(s, items, now, ['z-member'], 'SAVE')!;
  assert.equal(q.costs.membershipBenefitPaise, 2000);
  assert.equal(q.costs.couponDiscountPaise, 0);
});
test('rejects expired coverage, stale offers, unknown stock and insufficient stock', () => {
  for (const field of ['coverage', 'offer', 'unknown', 'short']) {
    const s = store('z');
    if (field === 'coverage') s.store.expiresAt = now.toISOString();
    if (field === 'offer') s.offers[0].expiresAt = now.toISOString();
    if (field === 'unknown') s.offers[0].stockQuantity = null;
    if (field === 'short') s.offers[0].stockQuantity = 0;
    assert.equal(quoteStore(s, items, now), null);
  }
});
test('does not mix stores or reuse a retailer discount across two deliveries', () => {
  const a = store('a');
  const b = store('b');
  a.offers = [a.offers[0]];
  b.offers = [b.offers[1]];
  assert.equal(optimizeBasket('560001', items, [a, b], now).recommended, null);
});
test('reports truncation instead of claiming optimality for a large search', () => {
  const a = store('z');
  const b = store('b');
  const basket = Array.from({ length: 20 }, (_, i) => ({
    productId: String(i),
    quantity: 1,
  }));
  for (const s of [a, b])
    s.offers = basket.map(i => ({
      productId: i.productId,
      pricePaise: 1000,
      stockQuantity: 1,
      expiresAt: expiry,
    }));
  const r = optimizeBasket('560001', basket, [a, b], now);
  assert.equal(r.search.complete, false);
  assert.equal(r.search.evaluated, 50000);
});
