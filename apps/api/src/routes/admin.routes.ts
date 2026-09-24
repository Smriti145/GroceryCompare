import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { requireAccount, requireAdmin } from '../auth/service';
import { providerHealth } from '../integrations/poll-feed';
import { queue } from '../jobs/queue';
import { registry } from '../infrastructure/metrics';
import { invalidateLocations } from '../infrastructure/redis';
import {
  correctMapping,
  listingSchema,
  matchListing,
} from '../services/matching.service';
import { env } from '../config/env';
export const adminRoutes = Router();
adminRoutes.use(requireAccount, requireAdmin);
adminRoutes.get('/overview', async (_req, res) => {
  const staleBefore = new Date(Date.now() - env.OFFER_MAX_AGE_SECONDS * 1000);
  const [
    providers,
    unmatched,
    stale,
    missingImages,
    products,
    reports,
    alerts,
    audit,
    jobCounts,
    metrics,
  ] = await Promise.all([
    providerHealth(),
    prisma.retailerProduct.findMany({
      where: { deletedAt: null, status: { not: 'MATCHED' } },
      take: 50,
      orderBy: { id: 'asc' },
    }),
    prisma.retailerOffer.count({ where: { observedAt: { lt: staleBefore } } }),
    prisma.product.count({ where: { deletedAt: null, imageUrl: null } }),
    prisma.product.count({ where: { deletedAt: null } }),
    prisma.userReport.findMany({
      where: { status: 'OPEN' },
      take: 50,
      select: { id: true, productId: true, message: true, createdAt: true },
    }),
    prisma.alert.count({
      where: { createdAt: { gt: new Date(Date.now() - 86400000) } },
    }),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
    queue ? queue.getJobCounts('waiting', 'active', 'failed', 'delayed') : null,
    registry.getMetricsAsJSON(),
  ]);
  res.json({
    providers,
    unmatched,
    stale,
    missingImages,
    products,
    reports,
    alertsLast24h: alerts,
    audit,
    jobCounts,
    metrics: metrics.filter(m => m.name.startsWith('gc_http')),
  });
});
adminRoutes.post('/match', async (req, res) => {
  const listing = listingSchema.parse(req.body),
    result = await matchListing(listing);
  await prisma.retailerProduct.upsert({
    where: { retailer_sku: { retailer: listing.retailer, sku: listing.sku } },
    create: {
      retailer: listing.retailer,
      sku: listing.sku,
      title: listing.title,
      packSize: listing.packSize,
      status: result.status,
      canonicalId: result.productId,
    },
    update: {},
  });
  res.json(result);
});
adminRoutes.post('/mapping', async (req, res) => {
  const b = z
    .object({
      listing: listingSchema,
      productId: z.string().uuid(),
      reason: z.string().min(5).max(1000),
    })
    .strict()
    .parse(req.body);
  await correctMapping({ ...b, reviewedBy: res.locals.account.id });
  res.json({ status: 'corrected' });
});
adminRoutes.patch('/products/:id', async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const b = z
    .object({
      imageUrl: z
        .url()
        .refine(v => v.startsWith('https://'))
        .nullable()
        .optional(),
      dietaryTags: z
        .array(z.enum(['VEGETARIAN', 'VEGAN', 'ORGANIC', 'GLUTEN_FREE']))
        .max(4)
        .optional(),
      deleted: z.boolean().optional(),
      reason: z.string().trim().min(5).max(1000),
    })
    .strict()
    .parse(req.body);
  const row = await prisma.$transaction(async tx => {
    const product = await tx.product.update({
      where: { id },
      data: {
        ...(b.imageUrl !== undefined ? { imageUrl: b.imageUrl } : {}),
        ...(b.dietaryTags ? { dietaryTags: b.dietaryTags } : {}),
        ...(b.deleted !== undefined
          ? { deletedAt: b.deleted ? new Date() : null }
          : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: res.locals.account.id,
        action: 'PRODUCT_OVERRIDE',
        objectType: 'Product',
        objectId: id,
        reason: b.reason,
      },
    });
    return product;
  });
  const areas = await prisma.retailerOffer.findMany({
    where: { productId: id },
    distinct: ['location'],
    select: { location: true },
  });
  await invalidateLocations(areas.map(a => a.location));
  res.json(row);
});
adminRoutes.patch('/reports/:id', async (req, res) => {
  const id = z.string().uuid().parse(req.params.id),
    b = z
      .object({
        status: z.enum(['OPEN', 'RESOLVED']),
        reason: z.string().min(5).max(1000),
      })
      .strict()
      .parse(req.body);
  await prisma.$transaction(async tx => {
    await tx.userReport.update({ where: { id }, data: { status: b.status } });
    await tx.auditLog.create({
      data: {
        actorId: res.locals.account.id,
        action: 'REPORT_REVIEWED',
        objectType: 'UserReport',
        objectId: id,
        reason: b.reason,
      },
    });
  });
  res.status(204).end();
});
adminRoutes.put('/aliases', async (req, res) => {
  const b = z
    .object({
      term: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .transform(v => v.toLowerCase()),
      replacement: z.string().trim().min(1).max(100),
      kind: z.enum(['BRAND', 'HINDI', 'COMMON_NAME']),
      reason: z.string().min(5).max(1000),
    })
    .strict()
    .parse(req.body);
  await prisma.$transaction(async tx => {
    await tx.searchAlias.upsert({
      where: { term: b.term },
      create: { term: b.term, replacement: b.replacement, kind: b.kind },
      update: { replacement: b.replacement, kind: b.kind },
    });
    await tx.auditLog.create({
      data: {
        actorId: res.locals.account.id,
        action: 'SEARCH_ALIAS_UPDATED',
        objectType: 'SearchAlias',
        objectId: b.term,
        reason: b.reason,
      },
    });
  });
  res.status(204).end();
});
