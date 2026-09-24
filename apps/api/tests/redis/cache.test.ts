import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Queue, QueueEvents, Worker } from 'bullmq';
import {
  cached,
  redis as configuredRedis,
  locationKey,
  invalidateLocations,
  queueConnection,
  redisRateStore,
} from '../../src/infrastructure/redis';
test('Redis cache isolates locations, coalesces misses, expires and invalidates; jobs retry durably', async () => {
  const redis = configuredRedis;
  if (!redis)
    throw new Error('Set REDIS_URL to an isolated Redis test database');
  if (redis.status !== 'ready')
    await new Promise<void>((resolve, reject) => {
      redis.once('ready', resolve);
      redis.once('error', reject);
    });
  const namespace = randomUUID(),
    name = `test-${namespace}`;
  const connection = queueConnection();
  const queue = new Queue(name, { connection });
  const events = new QueueEvents(name, { connection });
  let worker: Worker | undefined;
  try {
    assert.notEqual(
      locationKey(namespace, '560001', {}),
      locationKey(namespace, '110001', {}),
    );
    let calls = 0;
    const load = async () => {
      calls++;
      await new Promise(r => setTimeout(r, 20));
      return { calls };
    };
    const results = await Promise.all(
      Array.from({ length: 8 }, () => cached(namespace, '560001', {}, 1, load)),
    );
    assert.equal(calls, 1);
    assert.ok(results.every(r => r.calls === 1));
    await cached(namespace, '110001', {}, 1, load);
    assert.equal(calls, 2);
    await invalidateLocations(['560001']);
    await cached(namespace, '560001', {}, 1, load);
    assert.equal(calls, 3);
    await new Promise(r => setTimeout(r, 1100));
    await cached(namespace, '560001', {}, 1, load);
    assert.equal(calls, 4);
    const a = redisRateStore(namespace)!,
      b = redisRateStore(namespace)!;
    a.init({ windowMs: 60000 } as Parameters<typeof a.init>[0]);
    b.init({ windowMs: 60000 } as Parameters<typeof b.init>[0]);
    assert.equal((await a.increment('test-client')).totalHits, 1);
    assert.equal(
      (await b.increment('test-client')).totalHits,
      2,
      'limits are shared across instances',
    );
    await a.resetKey('test-client');
    await events.waitUntilReady();
    const job = await queue.add(
      'retry',
      { location: '560001' },
      { attempts: 3, backoff: { type: 'exponential', delay: 30 } },
    );
    worker = new Worker(
      name,
      async j => {
        if (j.attemptsMade === 0) throw new Error('transient');
        return j.data.location;
      },
      { connection },
    );
    worker.on('error', () => {});
    assert.equal(await job.waitUntilFinished(events, 10000), '560001');
    assert.equal((await queue.getJob(job.id!))?.attemptsMade, 2);
    await redis.quit();
    assert.equal(
      (await cached(namespace, '560001', {}, 1, load)).calls,
      5,
      'cache failure falls back to source',
    );
  } finally {
    await worker?.close();
    await events.close();
    await queue.obliterate({ force: true });
    await queue.close();
    redis.disconnect();
  }
});
