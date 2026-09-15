import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from '../src/config/env';

const database = 'postgresql://user:password@localhost:5432/grocerycompare';

test('accepts a configurable API rate limit', () => {
  const result = parseEnv({
    DATABASE_URL: database,
    RATE_LIMIT_MAX: '250',
  });

  assert.equal(result.RATE_LIMIT_MAX, 250);
});

test('rejects unsafe rate-limit values', () => {
  assert.throws(
    () =>
      parseEnv({
        DATABASE_URL: database,
        RATE_LIMIT_MAX: '0',
      }),
    /Invalid configuration: RATE_LIMIT_MAX/,
  );
});
