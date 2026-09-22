import prisma from '../src/config/prisma';
import { pollAll } from '../src/integrations/poll-feed';
pollAll()
  .then(results => {
    console.info(JSON.stringify(results));
    if (results.some(r => r.error)) process.exitCode = 1;
  })
  .catch(() => {
    console.error('Feed polling failed');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
