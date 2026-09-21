import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  retailers,
  normalizedFeedAdapter,
  validateFeed,
} from '../src/integrations/retailer-feed';
const now = new Date('2026-09-15T10:00:00Z');
const offer = {
  sku: 'milk',
  location: '560001',
  storeId: 'store-1',
  sellerId: 'seller-1',
  productId: '10000000-0000-4000-8000-000000000001',
  packSize: '1l',
  pricePaise: 6000,
  mrpPaise: 6500,
  inStock: true,
  stockQuantity: null,
  etaMinutes: 15,
  feesPaise: null,
  minimumOrderPaise: null,
  observedAt: now.toISOString(),
};
for (const retailer of retailers)
  test(`${retailer} preserves unknown fees and source time`, () => {
    assert.deepEqual(
      validateFeed(
        normalizedFeedAdapter(retailer),
        { retailer, offers: [offer] },
        now,
      ),
      [offer],
    );
  });
test('rejects stale, future, fractional money and invalid stock observations', () => {
  for (const change of [
    { observedAt: '2020-01-01T00:00:00Z' },
    { observedAt: '2030-01-01T00:00:00Z' },
    { pricePaise: 1.5 },
    { stockQuantity: 0 },
    { mrpPaise: 1 },
  ]) {
    assert.throws(() =>
      validateFeed(
        normalizedFeedAdapter('BLINKIT'),
        { retailer: 'BLINKIT', offers: [{ ...offer, ...change }] },
        now,
      ),
    );
  }
});
test('rejects duplicate identities but accepts separate stores', () => {
  const adapter = normalizedFeedAdapter('BLINKIT');
  assert.throws(() =>
    validateFeed(adapter, { retailer: 'BLINKIT', offers: [offer, offer] }, now),
  );
  assert.equal(
    validateFeed(
      adapter,
      {
        retailer: 'BLINKIT',
        offers: [offer, { ...offer, storeId: 'store-2' }],
      },
      now,
    ).length,
    2,
  );
});
