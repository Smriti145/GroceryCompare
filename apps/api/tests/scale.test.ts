import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equivalentCount } from '../src/services/pack.service';
import { normalizeQuery } from '../src/services/search.service';
test('pack equivalence preserves physical quantity and rejects incompatible or fractional packs', () => {
  assert.equal(equivalentCount('1l', '500ml', 1), 2);
  assert.equal(equivalentCount('500g', '1kg', 2), 1);
  assert.equal(equivalentCount('1l', '500g', 1), null);
  assert.equal(equivalentCount('500ml', '1l', 1), null);
  assert.equal(equivalentCount('1l', '10ml', 1), null);
});
test('search normalization preserves Hindi vowel marks and removes query punctuation', () => {
  assert.equal(normalizeQuery('  दूध  '), 'दूध');
  assert.equal(normalizeQuery('Amul; MILK!'), 'amul milk');
});
