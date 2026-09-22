import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceAnalytics } from '../src/domain/analytics';
import { alertMessage } from '../src/services/alerts.service';
const now = new Date('2026-09-21T12:00:00Z');
test('analytics use daily observations, not ingestion frequency, and require evidence', () => {
  const points = [17, 18, 19, 20, 21].map(day => ({
    observedAt: new Date(`2026-09-${day}T10:00:00Z`),
    pricePaise: day === 21 ? 17900 : 19900,
    inStock: true,
  }));
  const result = priceAnalytics(points, 7, now);
  assert.equal(result.usualPricePaise, 19900);
  assert.equal(result.dropTodayPaise, 2000);
  assert.equal(result.lowestRecordedPaise, 17900);
  assert.equal(result.dealConfidence, 'LOW');
  assert.equal(result.isDeal, true);
  assert.equal(result.graph.length, 5);
  assert.equal(priceAnalytics([points[0]], 7, now).usualPricePaise, null);
  assert.equal(priceAnalytics([points[4]], 7, now).dropTodayPaise, null);
  assert.equal(
    priceAnalytics([{ ...points[4], inStock: false }], 7, now)
      .currentPricePaise,
    null,
  );
});
test('alerts prime quietly, detect transitions, and never repeat unchanged observations', () => {
  const before = {
    price: 19900,
    stock: true,
    eta: 30,
    discount: 0,
    at: 'before',
  };
  const after = {
    price: 17900,
    stock: true,
    eta: 20,
    discount: 500,
    at: 'after',
  };
  assert.equal(alertMessage('PRICE_DROP', null, after, 100), null);
  assert.equal(alertMessage('PRICE_DROP', before, before, 100), null);
  assert.match(alertMessage('PRICE_DROP', before, after, 100)!, /20.00/);
  assert.equal(alertMessage('PRICE_DROP', before, after, 3000), null);
  assert.match(alertMessage('CART_CHEAPER', before, after, 100)!, /after fees/);
  assert.match(
    alertMessage('ETA_IMPROVEMENT', before, after, 100)!,
    /30 to 20/,
  );
  assert.match(alertMessage('DEAL', before, after, 100)!, /5.00/);
  assert.match(
    alertMessage('BACK_IN_STOCK', { ...before, stock: false }, after, 100)!,
    /back in stock/,
  );
});

test('substitutions reject unrelated products in the same category and normalize packs', async () => {
  const { compatibleSubstitution } = await import(
    '../src/domain/substitutions'
  );
  const a = {
    name: 'Amul Toned Milk',
    brand: 'Amul',
    quantity: '1l',
    category: 'Dairy',
    variantName: 'toned',
  };
  assert.equal(
    compatibleSubstitution(a, {
      ...a,
      name: 'Mother Dairy Toned Milk',
      brand: 'Mother Dairy',
      quantity: '1000ml',
    }),
    true,
  );
  assert.equal(compatibleSubstitution(a, { ...a, name: 'Amul Yogurt' }), false);
  assert.equal(compatibleSubstitution(a, { ...a, quantity: '500ml' }), false);
  assert.equal(
    compatibleSubstitution(a, { ...a, variantName: 'full cream' }),
    false,
  );
});
