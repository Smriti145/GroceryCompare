import { Router } from 'express';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import prisma from '../config/prisma';
import { cached, redis } from '../infrastructure/redis';
import { normalizeQuery } from '../services/search.service';
export const searchRoutes = Router();
const location = z.string().regex(/^[1-9][0-9]{5}$/);
searchRoutes.get('/popular', async (req, res) => {
  const pincode = location.parse(req.query.pincode);
  res.json(await cached('popular-searches', pincode, {}, 60, () => prisma.searchTrend.findMany({ where: { pincode, updatedAt: { gt: new Date(Date.now()-30*86400000) } }, select: { term: true }, orderBy: [{ count: 'desc' }, { term: 'asc' }], take: 10 })));
});
searchRoutes.post('/event', async (req, res) => {
  const b = z.object({ pincode: location, term: z.string().min(2).max(40), productId: z.string().uuid().optional() }).strict().parse(req.body);
  const term = normalizeQuery(b.term);
  // Keep popularity aggregate-only. No raw IP, account ID or arbitrary email/address search history.
  if (!/^[\p{L}\p{M}\s]{2,40}$/u.test(term)) { res.status(204).end(); return; }
  if (redis) {
    const key = createHash('sha256').update([req.ip, b.pincode, term, new Date().toISOString().slice(0,10)].join('|')).digest('hex');
    try {
      if (!(await redis.set(`gc:trend-dedupe:${b.pincode}:${key}`, '1', 'EX', 86400, 'NX'))) { res.status(204).end(); return; }
      if (b.productId && await prisma.product.findFirst({ where: { id: b.productId, deletedAt: null } })) {
        await redis.zincrby(`gc:popular-products:${b.pincode}`, 1, b.productId); await redis.expire(`gc:popular-products:${b.pincode}`, 30*86400);
      }
    } catch { res.status(204).end(); return; }
  } else { res.status(204).end(); return; }
  await prisma.searchTrend.upsert({ where: { pincode_term: { pincode: b.pincode, term } }, create: { pincode: b.pincode, term }, update: { count: { increment: 1 } } });
  res.status(204).end();
});
searchRoutes.get('/popular-products', async (req, res) => {
  const pincode = location.parse(req.query.pincode);
  let ids: string[] = [];
  try { ids = await redis?.zrevrange(`gc:popular-products:${pincode}`, 0, 9) || []; } catch { /* Optional suggestions. */ }
  res.json(await cached('popular-products', pincode, ids, 30, () => prisma.product.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, name: true, brand: true, quantity: true, imageUrl: true } })));
});
