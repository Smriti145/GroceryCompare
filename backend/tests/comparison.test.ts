import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateComparison, normalizePack } from '../src/domain/comparison';
import { comparisonSchema } from '../src/domain/validation';
import { Product, ComparisonRequest, PLATFORMS } from '../../shared/contracts';
const now = new Date('2026-09-10T00:00:00Z');
const id = '10000000-0000-4000-8000-000000000001';
const request: ComparisonRequest = {
  location: 'DEMO',
  items: [{ productId: id, quantity: 2 }],
};
function product(): Product {
  return {
    id,
    name: 'Milk',
    brand: 'Test',
    category: 'Dairy',
    quantity: '1l',
    variants: PLATFORMS.map((platform, i) => ({
      id: platform,
      platform,
      platformName: 'Milk',
      quantity: '1000ml',
      pricePaise: 1000 + i * 100,
      deliveryTime: 10 - i,
      available: true,
      location: 'DEMO',
      updatedAt: now.toISOString(),
      isDemo: true,
    })),
  };
}
function compare(p: Product[]) {
  return calculateComparison(request, p, now, 60000);
}
test('uses quantities and integer money', () => {
  const result = compare([product()]);
  assert.equal(result.recommendedPlatform, 'BLINKIT');
  assert.equal(result.platforms[0].subtotalPaise, 2000);
  assert.equal(result.savingsPaise, 400);
});
test('incomplete platforms cannot win', () => {
  const p = product();
  p.variants.shift();
  const result = compare([p]);
  assert.equal(result.platforms[0].subtotalPaise, null);
  assert.equal(result.recommendedPlatform, 'ZEPTO');
});
test('unknown products and empty baskets have no winner', () => {
  assert.equal(compare([]).recommendedPlatform, null);
  assert.equal(
    calculateComparison({ ...request, items: [] }, [], now, 60000)
      .recommendedPlatform,
    null,
  );
});
for (const reason of ['stale', 'future', 'unavailable', 'location', 'pack'])
  test(`rejects ${reason} offers`, () => {
    const p = product();
    p.variants.forEach(o => {
      if (reason === 'stale')
        o.updatedAt = new Date(now.getTime() - 60001).toISOString();
      if (reason === 'future')
        o.updatedAt = new Date(now.getTime() + 1).toISOString();
      if (reason === 'unavailable') o.available = false;
      if (reason === 'location') o.location = 'OTHER';
      if (reason === 'pack') o.quantity = '500ml';
    });
    assert.equal(compare([p]).recommendedPlatform, null);
  });
test('ties prefer faster delivery', () => {
  const p = product();
  p.variants.forEach(o => {
    o.pricePaise = 1000;
  });
  assert.equal(compare([p]).recommendedPlatform, 'SWIGGY');
});
test('delivery estimate uses maximum instead of sum', () => {
  const p = product(),
    other = { ...product(), id: '20000000-0000-4000-8000-000000000002' };
  const result = calculateComparison(
    {
      ...request,
      items: [...request.items, { productId: other.id, quantity: 1 }],
    },
    [p, other],
    now,
    60000,
  );
  assert.equal(result.platforms[0].deliveryTime, 10);
});
test('normalizes equivalent units without matching different packs', () => {
  assert.equal(normalizePack('1 KG'), normalizePack('1000g'));
  assert.notEqual(normalizePack('2x500g'), normalizePack('1kg'));
});
test('validates request limits and duplicate IDs', () => {
  assert.equal(comparisonSchema.safeParse(request).success, true);
  for (const items of [
    [],
    [{ productId: id, quantity: 0 }],
    [{ productId: id, quantity: 100 }],
    [...request.items, ...request.items],
  ]) {
    assert.equal(
      comparisonSchema.safeParse({ ...request, items }).success,
      false,
    );
  }
});
