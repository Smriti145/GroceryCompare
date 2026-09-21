import { readFileSync, statSync } from 'node:fs';
import { z } from 'zod';
import prisma from '../src/config/prisma';
import {
  retailers,
  normalizedFeedAdapter,
} from '../src/integrations/retailer-feed';
import { importFeed } from '../src/integrations/import-feed';

async function main() {
  const retailer = z.enum(retailers).parse(process.argv[2]);
  const file = process.argv[3];
  if (!file || statSync(file).size > 5 * 1024 * 1024)
    throw new Error('Provide a JSON feed of at most 5 MB');
  const payload: unknown = JSON.parse(readFileSync(file, 'utf8'));
  console.log(await importFeed(normalizedFeedAdapter(retailer), payload));
}
main()
  .catch(() => {
    console.error(
      'Import failed: check feed validation, product mapping, freshness, and database configuration.',
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
