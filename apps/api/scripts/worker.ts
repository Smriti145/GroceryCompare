import '../src/instrumentation';
import prisma from '../src/config/prisma';
import { Worker } from 'bullmq';
import { z } from 'zod';
import { redis, queueConnection } from '../src/infrastructure/redis';
import { queue as configuredQueue } from '../src/jobs/queue';
import { pollFeed } from '../src/integrations/poll-feed';
import { retailers } from '../src/integrations/retailer-feed';
import { evaluateWatch } from '../src/services/alerts.service';
import { cleanup, snapshotPage, reconcilePage } from '../src/jobs/maintenance';
import express from 'express';
import { metricsEndpoint } from '../src/infrastructure/metrics';
import { jobs } from '../src/infrastructure/metrics';
async function main() {
  const queue = configuredQueue;
  if (!queue) throw new Error('REDIS_URL is required for durable jobs');
  const worker = new Worker(
    'grocery-jobs',
    async job => {
      const data = z
        .object({
          retailer: z.enum(retailers).optional(),
          cursor: z.string().uuid().optional(),
          watchId: z.string().uuid().optional(),
        })
        .strict()
        .parse(job.data);
      switch (job.name) {
        case 'price-refresh':
          for (const retailer of retailers)
            if (process.env[`FEED_${retailer}_URL`])
              await queue.add(
                'feed-ingestion',
                { retailer },
                { jobId: `feed-${retailer}-${Math.floor(Date.now() / 60000)}` },
              );
          break;
        case 'feed-ingestion': {
          if (!data.retailer) throw new Error('Missing retailer');
          const result = await pollFeed(data.retailer);
          if (result.status === 'UNAVAILABLE' || result.status === 'CACHED')
            throw new Error('Provider refresh unavailable');
          break;
        }
        case 'notifications': {
          const watches = await prisma.watch.findMany({
            where: data.cursor ? { id: { gt: data.cursor } } : {},
            select: { id: true },
            orderBy: { id: 'asc' },
            take: 100,
          });
          for (const w of watches)
            await queue.add(
              'notify-watch',
              { watchId: w.id },
              { jobId: `watch-${w.id}-${Math.floor(Date.now() / 60000)}` },
            );
          if (watches.length === 100)
            await queue.add('notifications', { cursor: watches[99].id });
          break;
        }
        case 'notify-watch':
          if (!data.watchId) throw new Error('Missing watch');
          await evaluateWatch(data.watchId);
          break;
        case 'historical-snapshots': {
          const cursor = await snapshotPage(data.cursor);
          if (cursor) await queue.add(job.name, { cursor });
          break;
        }
        case 'reconciliation': {
          const cursor = await reconcilePage(data.cursor);
          if (cursor) await queue.add(job.name, { cursor });
          break;
        }
        case 'stale-cleanup':
          await cleanup();
          break;
        default:
          throw new Error('Unknown job type');
      }
    },
    {
      connection: { ...queueConnection(), maxRetriesPerRequest: null },
      concurrency: 4,
      limiter: { max: 20, duration: 1000 },
    },
  );
  worker.on('completed', job => {
    jobs.inc({ kind: job.name, status: 'completed' });
    console.info(
      JSON.stringify({ event: 'job_completed', kind: job.name, jobId: job.id }),
    );
  });
  worker.on('failed', job => {
    jobs.inc({ kind: job?.name || 'unknown', status: 'failed' });
    console.error(
      JSON.stringify({
        event: 'job_failed',
        kind: job?.name,
        jobId: job?.id,
        attempts: job?.attemptsMade,
      }),
    );
  });
  worker.on('error', () =>
    console.error(JSON.stringify({ event: 'worker_connection_error' })),
  );
  for (const [name, every] of [
    ['price-refresh', 60000],
    ['notifications', 60000],
    ['historical-snapshots', 3600000],
    ['reconciliation', 3600000],
    ['stale-cleanup', 86400000],
  ] as const)
    await queue.upsertJobScheduler(name, { every }, { name, data: {} });
  console.info(JSON.stringify({ event: 'worker_ready', concurrency: 4 }));
  const metricsApp = express();
  metricsApp.get('/metrics', metricsEndpoint);
  const metricsServer = metricsApp.listen(
    Number(process.env.WORKER_METRICS_PORT || 5002),
    process.env.WORKER_METRICS_HOST || '127.0.0.1',
  );
  metricsServer.on('error', () => {
    console.error('Worker metrics listener failed');
    void stop();
  });
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await new Promise<void>(resolve => metricsServer.close(() => resolve()));
    await worker.close();
    await queue.close();
    await redis?.quit();
    await prisma.$disconnect();
  };
  process.once('SIGINT', () => {
    void stop();
  });
  process.once('SIGTERM', () => {
    void stop();
  });
}
main().catch(() => {
  console.error(
    'Worker startup failed: check Redis and database configuration',
  );
  process.exit(1);
});
