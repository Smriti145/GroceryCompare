import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { priceAnalytics } from '../domain/analytics';
import { RETAILERS } from '../../../../packages/contracts/checkout';
import { ApiError } from '../middleware/errors';
export const historyRoutes = Router();
historyRoutes.get('/:productId', async (req, res) => {
  const productId = z.string().uuid().parse(req.params.productId);
  const q = z
    .object({
      pincode: z.string().regex(/^[1-9][0-9]{5}$/),
      retailer: z.enum(RETAILERS),
      storeId: z.string().min(1).max(200),
      sellerId: z.string().min(1).max(200),
      sku: z.string().min(1).max(200),
      days: z.coerce
        .number()
        .pipe(z.union([z.literal(7), z.literal(30)]))
        .default(7),
    })
    .strict()
    .parse(req.query);
  const points = await prisma.priceSnapshot.findMany({
    where: {
      productId,
      location: q.pincode,
      retailer: q.retailer,
      storeId: q.storeId,
      sellerId: q.sellerId,
      sku: q.sku,
      observedAt: {
        gte: new Date(Date.now() - q.days * 86400000),
        lte: new Date(),
      },
    },
    orderBy: { observedAt: 'asc' },
    take: 10001,
  });
  if (points.length > 10000)
    throw new ApiError(
      422,
      'HISTORY_LIMIT',
      'Too many observations; use a shorter window',
    );
  const lowest = await prisma.priceSnapshot.aggregate({
    where: {
      productId,
      location: q.pincode,
      retailer: q.retailer,
      storeId: q.storeId,
      sellerId: q.sellerId,
      sku: q.sku,
      inStock: true,
      observedAt: { lte: new Date() },
    },
    _min: { pricePaise: true },
  });
  res.json({
    lowestEverPaise: lowest._min.pricePaise,
    ...priceAnalytics(points, q.days),
    scope: { productId, ...q },
    currency: 'INR',
    timezone: 'UTC',
    includesCheckoutFees: false,
  });
});
// Enumerate precise store/SKU series so unlike stores are never combined into a misleading graph.
historyRoutes.get('/:productId/series', async (req, res) => {
  const productId = z.string().uuid().parse(req.params.productId);
  const pincode = z
    .string()
    .regex(/^[1-9][0-9]{5}$/)
    .parse(req.query.pincode);
  res.json(
    await prisma.priceSnapshot.findMany({
      where: {
        productId,
        location: pincode,
        observedAt: { gte: new Date(Date.now() - 30 * 86400000) },
      },
      distinct: ['retailer', 'sku', 'storeId', 'sellerId'],
      select: { retailer: true, sku: true, storeId: true, sellerId: true },
      take: 100,
    }),
  );
});
