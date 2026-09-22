import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { requireAccount } from '../auth/service';
import { ApiError } from '../middleware/errors';
import { watchSchema, evaluateWatch } from '../services/alerts.service';
export const alertsRoutes = Router();
alertsRoutes.use(requireAccount);
alertsRoutes.get('/watches', async (_req, res) => {
  res.json(
    await prisma.watch.findMany({
      where: { accountId: res.locals.account.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  );
});
alertsRoutes.post('/watches', async (req, res) => {
  const config = watchSchema.parse(req.body),
    accountId = res.locals.account.id;
  const row = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${accountId}))`;
    if ((await tx.watch.count({ where: { accountId } })) >= 100)
      throw new ApiError(422, 'WATCH_LIMIT', 'You can save up to 100 watches');
    return tx.watch.create({ data: { accountId, kind: config.kind, config } });
  });
  // Save first, then prime: an unavailable retailer must not lose the user's watch.
  try {
    await evaluateWatch(row.id);
  } catch {
    /* Worker retries observation later. */
  }
  res.status(201).json(row);
});
alertsRoutes.delete('/watches/:id', async (req, res) => {
  await prisma.watch.deleteMany({
    where: {
      id: z.string().uuid().parse(req.params.id),
      accountId: res.locals.account.id,
    },
  });
  res.status(204).end();
});
alertsRoutes.get('/', async (req, res) => {
  const q = z
    .object({ cursor: z.string().uuid().optional() })
    .strict()
    .parse(req.query);
  const cursor = q.cursor
    ? await prisma.alert.findFirst({
        where: { id: q.cursor, accountId: res.locals.account.id },
      })
    : null;
  if (q.cursor && !cursor)
    throw new ApiError(400, 'INVALID_CURSOR', 'Alert cursor is invalid');
  const rows = await prisma.alert.findMany({
    where: {
      accountId: res.locals.account.id,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 51,
  });
  res.json({
    alerts: rows.slice(0, 50),
    nextCursor: rows.length > 50 ? rows[49].id : null,
  });
});
alertsRoutes.patch('/:id/read', async (req, res) => {
  await prisma.alert.updateMany({
    where: {
      id: z.string().uuid().parse(req.params.id),
      accountId: res.locals.account.id,
    },
    data: { readAt: new Date() },
  });
  res.status(204).end();
});
