import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ResilientProvider,
  ProviderFailure,
  partialProviders,
} from '../src/integrations/resilience';
const options = {
  timeoutMs: 10,
  retries: 2,
  baseDelayMs: 1,
  cacheMs: 1000,
  circuitMs: 1000,
  failureThreshold: 1,
};
const validate = (value: unknown) => {
  if (typeof value !== 'number') throw new Error('schema');
  return value;
};
test('retries transient errors, falls back without renewing cache age, and opens circuit', async () => {
  const runner = new ResilientProvider<number>(options);
  let calls = 0;
  const live = await runner.run('ZEPTO:560001:store', async () => 42, validate);
  const fallback = await runner.run(
    'ZEPTO:560001:store',
    async () => {
      calls++;
      throw new ProviderFailure(true);
    },
    validate,
  );
  assert.equal(calls, 3);
  assert.equal(fallback.status, 'CACHED');
  assert.equal(fallback.cachedAt, live.cachedAt);
  await runner.run(
    'ZEPTO:560001:store',
    async () => {
      calls++;
      return 1;
    },
    validate,
  );
  assert.equal(calls, 3);
  assert.equal(runner.health()[0].circuitOpen, true);
  assert.equal(
    (
      await runner.run(
        'ZEPTO:other',
        async () => {
          throw new ProviderFailure(false);
        },
        validate,
      )
    ).data,
    null,
  );
});
test('invalid schemas are not retried and hung providers time out with partial results', async () => {
  const runner = new ResilientProvider<number>({ ...options, retries: 0 });
  let calls = 0;
  assert.equal(
    (
      await runner.run(
        'bad',
        async () => {
          calls++;
          return 'bad';
        },
        validate,
      )
    ).status,
    'UNAVAILABLE',
  );
  assert.equal(calls, 1);
  assert.equal(
    (await runner.run('hung', () => new Promise(() => {}), validate)).status,
    'UNAVAILABLE',
  );
  const results = await partialProviders({
    BLINKIT: async () => 10,
    ZEPTO: async () => {
      throw new Error('down');
    },
  });
  assert.equal(results[0].result, 10);
  assert.equal(results[1].error, 'Temporarily unavailable');
});

test('concurrent callers share one request and expired fallback is unavailable', async () => {
  const runner = new ResilientProvider<number>({ ...options, cacheMs: 1 });
  let calls = 0;
  const fetcher = async () => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 2));
    return 7;
  };
  const values = await Promise.all([
    runner.run('same', fetcher, validate),
    runner.run('same', fetcher, validate),
  ]);
  assert.equal(calls, 1);
  assert.equal(values[0].data, values[1].data);
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(
    (
      await runner.run(
        'same',
        async () => {
          throw new ProviderFailure(false);
        },
        validate,
      )
    ).status,
    'UNAVAILABLE',
  );
});
