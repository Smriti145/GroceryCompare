import '../config/env';
import IORedis from 'ioredis';
import { createHash } from 'node:crypto';
import { RedisStore } from 'rate-limit-redis';
const url = process.env.REDIS_URL;
export const redis = url
  ? new IORedis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 1500,
      commandTimeout: 1500,
      maxRetriesPerRequest: 1,
      retryStrategy: n => Math.min(200 * n, 3000),
    })
  : null;
redis?.on('error', () => {}); // Errors are counted by operations; never log credential-bearing URLs.
if (redis) void redis.connect().catch(() => {});
export function locationKey(
  namespace: string,
  location: string,
  identity: unknown,
  cacheRevision = '0',
) {
  return `gc:v1:${namespace}:${location}:${cacheRevision}:${createHash('sha256')
    .update(JSON.stringify(identity))
    .digest('hex')}`;
}
async function revision(location: string) {
  return redis ? (await redis.get(`gc:revision:${location}`)) || '0' : '0';
}
export async function invalidateLocations(locations: string[]) {
  if (!redis) return;
  try {
    const pipeline = redis.pipeline();
    for (const location of new Set(locations))
      pipeline.incr(`gc:revision:${location}`);
    await pipeline.exec();
  } catch {
    /* TTL bounds stale reads after recovery. */
  }
}
const pending = new Map<string, Promise<unknown>>();
export async function cached<T>(
  namespace: string,
  location: string,
  identity: unknown,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  if (!redis || redis.status !== 'ready') return load();
  let key: string;
  try {
    key = locationKey(namespace, location, identity, await revision(location));
    const found = await redis.get(key);
    if (found !== null) return JSON.parse(found) as T;
  } catch {
    return load();
  }
  if (pending.has(key)) return pending.get(key) as Promise<T>;
  const operation = load()
    .then(async value => {
      try {
        await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      } catch {
        /* Cache failure must not mask database results. */
      }
      return value;
    })
    .finally(() => pending.delete(key));
  if (pending.size < 1000) pending.set(key, operation);
  return operation;
}
export function redisRateStore(prefix: string) {
  return redis
    ? new RedisStore({
        prefix: `gc:limit:${prefix}:`,
        sendCommand: (...args: string[]) =>
          redis!.call(args[0], ...args.slice(1)) as Promise<number>,
      })
    : undefined;
}
export function queueConnection() {
  if (!url) throw new Error('REDIS_URL is required for background jobs');
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: decodeURIComponent(u.username) || undefined,
    password: decodeURIComponent(u.password) || undefined,
    db: Number(u.pathname.slice(1) || 0),
    ...(u.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}
