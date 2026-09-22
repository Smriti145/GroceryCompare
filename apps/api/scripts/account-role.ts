import { z } from 'zod';
import prisma from '../src/config/prisma';
async function main() {
  const [email, role] = z
    .tuple([
      z
        .string()
        .email()
        .transform(v => v.toLowerCase()),
      z.enum(['USER', 'ADMIN']),
    ])
    .parse(process.argv.slice(2));
  const result = await prisma.account.update({
    where: { email },
    data: { role },
  });
  console.info(
    JSON.stringify({
      event: 'account_role_changed',
      accountId: result.id,
      role,
      at: new Date().toISOString(),
    }),
  );
}
main()
  .catch(() => {
    console.error(
      'Role update failed. Usage: account:role email USER|ADMIN (existing verified account only)',
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
