import { readFileSync, statSync } from 'node:fs';
import prisma from '../src/config/prisma';
import { importServiceability } from '../src/integrations/serviceability';
import { correctMapping, matchListing } from '../src/services/matching.service';
async function main() {
  const action = process.argv[2];
  const file = process.argv[3];
  if (!file || statSync(file).size > 5 * 1024 * 1024)
    throw new Error('Provide a JSON file under 5 MB');
  const payload: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (action === 'coverage') console.log(await importServiceability(payload));
  else if (action === 'match') console.log(await matchListing(payload));
  else if (action === 'correct') {
    await correctMapping(payload);
    console.log('Correction saved');
  } else throw new Error('Use coverage, match, or correct');
}
main()
  .catch(() => {
    console.error(
      'Catalog operation failed; check schema, source validity, product mapping and database configuration.',
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
