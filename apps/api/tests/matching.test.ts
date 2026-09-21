import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchProduct, fingerprint } from '../src/domain/matching';
const listing = {
  brand: 'Amul',
  title: 'Fresh Milk',
  packSize: '1l',
  variant: 'Full cream',
  category: 'Dairy',
};
const canonical = { ...listing, id: 'one', packSize: '1000ml' };
test('exact normalized matching respects pack units and identity', () => {
  assert.equal(
    matchProduct({ ...listing, brand: ' AMUL ' }, [canonical]).productId,
    'one',
  );
  for (const change of [
    { packSize: '500ml' },
    { variant: 'Toned' },
    { brand: 'Other' },
    { category: 'Produce' },
  ])
    assert.equal(
      matchProduct(listing, [{ ...canonical, ...change }]).status,
      'UNMATCHED',
    );
});
test('duplicate exact candidates and fuzzy title matches require manual review', () => {
  assert.equal(
    matchProduct(listing, [canonical, { ...canonical, id: 'two' }]).status,
    'AMBIGUOUS',
  );
  const r = matchProduct(listing, [{ ...canonical, title: 'Fresh Milk Pack' }]);
  assert.equal(r.method, 'FUZZY');
  assert.equal(r.productId, null);
});
test('manual corrections invalidate on source identity changes and cannot override pack safety', () => {
  const manual = { productId: canonical.id, fingerprint: fingerprint(listing) };
  assert.equal(matchProduct(listing, [canonical], manual).method, 'MANUAL');
  assert.notEqual(
    matchProduct({ ...listing, title: 'Different' }, [canonical], manual)
      .method,
    'MANUAL',
  );
  assert.equal(
    matchProduct(listing, [{ ...canonical, packSize: '500ml' }], manual).status,
    'UNMATCHED',
  );
});
