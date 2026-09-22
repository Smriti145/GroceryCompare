import prisma from '../config/prisma';
import { Router } from 'express';
import { z } from 'zod';
import {
  ResilientProvider,
  ProviderFailure,
  partialProviders,
} from './resilience';
import {
  NormalizedOffer,
  normalizedFeedAdapter,
  retailers,
  Retailer,
  validateFeed,
} from './retailer-feed';
import { importFeed } from './import-feed';
import { requireAccount, requireAdmin } from '../auth/service';
const runner = new ResilientProvider<NormalizedOffer[]>();
export async function providerHealth() {
  const rows = await prisma.providerHealth.findMany();
  const metricSchema = z.object({
    calls: z.number(),
    errors: z.number(),
    consecutiveFailures: z.number(),
    circuitOpen: z.boolean(),
    lastLatencyMs: z.number(),
    lastSuccessAt: z.number().nullable(),
  });
  return retailers.map(retailer => {
    const row = rows.find(r => r.retailer === retailer);
    const parsed = metricSchema.safeParse(row?.snapshot);
    return {
      retailer,
      configured: Boolean(process.env[`FEED_${retailer}_URL`] || row),
      metrics:
        parsed.success && row && Date.now() - row.updatedAt.getTime() < 300000
          ? parsed.data
          : null,
      checkedAt: row?.updatedAt.toISOString() ?? null,
    };
  });
}

export async function pollFeed(retailer: Retailer) {
  const url = process.env[`FEED_${retailer}_URL`];
  if (!url) return { retailer, status: 'NOT_CONFIGURED' };
  if (new URL(url).protocol !== 'https:')
    throw new Error('Feed URL must use HTTPS');
  const adapter = normalizedFeedAdapter(retailer);
  const result = await runner.run(
    retailer,
    async signal => {
      let response;
      try {
        response = await fetch(url, {
          signal,
          redirect: 'error',
          headers: process.env[`FEED_${retailer}_TOKEN`]
            ? {
                Authorization: `Bearer ${
                  process.env[`FEED_${retailer}_TOKEN`]
                }`,
              }
            : {},
        });
      } catch {
        throw new ProviderFailure(true);
      }
      if (!response.ok)
        throw new ProviderFailure(
          response.status === 429 || response.status >= 500,
        );
      if (!response.body) throw new ProviderFailure(false);
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.length;
          if (size > 5 * 1024 * 1024)
            throw new ProviderFailure(false, 'Feed too large');
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel();
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    },
    payload => validateFeed(adapter, payload),
  );
  try {
    if (result.status === 'LIVE')
      await importFeed(adapter, { retailer, offers: result.data });
  } catch {
    const metric = runner.health().find(h => h.key === retailer)!;
    const snapshot = {
      ...metric,
      consecutiveFailures: Math.max(1, metric.consecutiveFailures),
      errors: metric.errors + 1,
    };
    await prisma.providerHealth.upsert({
      where: { retailer },
      create: { retailer, snapshot },
      update: { snapshot },
    });
    throw new Error('Feed ingestion failed');
  }
  const snapshot = runner.health().find(h => h.key === retailer)!;
  await prisma.providerHealth.upsert({
    where: { retailer },
    create: { retailer, snapshot },
    update: { snapshot },
  });
  // Cached observations retain original timestamps. Never refresh their age by re-importing.
  return { retailer, status: result.status, lastSuccessAt: result.cachedAt };
}
export const providerRoutes = Router();
providerRoutes.use(requireAccount, requireAdmin);
providerRoutes.get('/health', async (_req, res) =>
  res.json(await providerHealth()),
);
providerRoutes.post('/refresh/:retailer', async (req, res) =>
  res.json(await pollFeed(z.enum(retailers).parse(req.params.retailer))),
);
export const pollAll = () =>
  partialProviders(
    Object.fromEntries(retailers.map(r => [r, () => pollFeed(r)])),
  );
