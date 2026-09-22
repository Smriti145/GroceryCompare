import prisma from '../src/config/prisma';
import { evaluateWatches } from '../src/services/alerts.service';
evaluateWatches()
  .then(result => {
    console.info(result);
    if (result.failed) process.exitCode = 1;
  })
  .catch(() => {
    console.error('Alert evaluation failed');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
