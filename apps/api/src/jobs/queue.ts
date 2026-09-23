import { Queue } from 'bullmq';
import { queueConnection } from '../infrastructure/redis';
export const queue = process.env.REDIS_URL ? new Queue('grocery-jobs', { connection: { ...queueConnection(), maxRetriesPerRequest: 1 },
  defaultJobOptions: { attempts: 4, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: { age: 86400, count: 10000 }, removeOnFail: { age: 7*86400, count: 10000 } },
}) : null;
queue?.on('error', () => {});
