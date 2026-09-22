import prisma from '../src/config/prisma';
import { pollAll } from '../src/integrations/poll-feed';
import { evaluateWatches } from '../src/services/alerts.service';
let stopped = false;
let wake: (() => void) | undefined;
const stop = () => {
  stopped = true;
  wake?.();
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
async function main() {
  const interval = Number(process.env.WORKER_INTERVAL_SECONDS || '60');
  if (!Number.isInteger(interval) || interval < 30 || interval > 3600)
    throw new Error('Invalid worker interval');
  while (!stopped) {
    try {
      const feeds = await pollAll();
      const alerts = await evaluateWatches();
      console.info(JSON.stringify({ event: 'worker_tick', feeds, alerts }));
    } catch {
      console.error(JSON.stringify({ event: 'worker_tick_failed' }));
    }
    if (!stopped)
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, interval * 1000);
        wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
  }
}
main()
  .catch(() => {
    console.error('Worker configuration failed');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
