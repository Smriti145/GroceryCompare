import { requireAccount } from '../auth/service';
import { compatibleSubstitution } from '../domain/substitutions';
import { providerHealth } from '../integrations/poll-feed';
import { preferencesSchema } from '../domain/preferences';
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { env } from '../config/env';
import { comparisonSchema } from '../domain/validation';
import { checkout } from '../services/checkout.service';
import {
  locationInput,
  resolveLocation,
  servingStores,
} from '../services/location.service';
export const checkoutRoutes = Router();
checkoutRoutes.get('/products', async (req, res) => {
  const query = z
    .object({
      location: z.string().regex(/^[1-9][0-9]{5}$/),
      search: z.string().max(100).default(''),
      category: z.string().max(64).optional(),
      cursor: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })
    .strict()
    .parse(req.query);
  const now = new Date();
  const stores = await servingStores({ pincode: query.location }, now);
  const rows = stores.length
    ? await prisma.product.findMany({
        where: {
          ...(query.cursor ? { id: { gt: query.cursor } } : {}),
          ...(query.category ? { category: query.category } : {}),
          ...(query.search
            ? {
                OR: [
                  { name: { contains: query.search, mode: 'insensitive' } },
                  { brand: { contains: query.search, mode: 'insensitive' } },
                ],
              }
            : {}),
          retailerOffers: {
            some: {
              location: query.location,
              inStock: true,
              stockQuantity: { gt: 0 },
              observedAt: {
                lte: now,
                gt: new Date(now.getTime() - env.OFFER_MAX_AGE_SECONDS * 1000),
              },
              OR: stores.map(s => ({
                retailer: s.retailer,
                storeId: s.storeId,
                sellerId: s.sellerId,
              })),
            },
          },
        },
        orderBy: { id: 'asc' },
        take: query.limit + 1,
      })
    : [];
  const page = rows.slice(0, query.limit);
  res.json({
    success: true,
    requestId: res.locals.requestId,
    data: {
      products: page.map(p => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        quantity: p.quantity,
        variants: [],
      })),
      nextCursor: rows.length > query.limit ? page[page.length - 1].id : null,
    },
  });
});
const schema = z
  .object({
    location: locationInput,
    items: comparisonSchema.shape.items,
    maxDeliveries: z.number().int().min(1).max(3).default(2),
    couponCode: z.string().trim().min(1).max(64).optional(),
    preferences: preferencesSchema.optional(),
  })
  .strict();
checkoutRoutes.post('/location', async (req, res) => {
  const location = await resolveLocation(locationInput.parse(req.body));
  const stores = await servingStores(location);
  res.json({
    success: true,
    requestId: res.locals.requestId,
    data: {
      location,
      status: stores.length ? 'SERVING' : 'NO_VERIFIED_COVERAGE',
      stores: stores.map(s => ({
        retailer: s.retailer,
        storeId: s.storeId,
        warehouseId: s.warehouseId,
        etaMinutes: s.etaMinutes,
        expiresAt: s.expiresAt,
      })),
    },
  });
});
checkoutRoutes.post(
  '/compare',
  (req, res, next) =>
    req.header('authorization') ? requireAccount(req, res, next) : next(),
  async (req, res) => {
    const body = schema.parse(req.body);
    const location = await resolveLocation(body.location);
    res.json({
      success: true,
      requestId: res.locals.requestId,
      providers: (await providerHealth()).map(p => ({
        retailer: p.retailer,
        status: !p.configured
          ? 'NOT_CONFIGURED'
          : p.metrics?.consecutiveFailures
          ? 'TEMPORARILY_UNAVAILABLE'
          : p.metrics?.lastSuccessAt
          ? 'AVAILABLE'
          : 'NOT_CHECKED',
      })),
      data: await checkout(
        location,
        body.items,
        body.maxDeliveries,
        body.couponCode,
        preferencesSchema.parse(
          body.preferences ?? res.locals.account?.preferences ?? {},
        ),
      ),
    });
  },
);

checkoutRoutes.post('/substitutions', async (req, res) => {
  const body = z
    .object({ productId: z.string().uuid(), preferences: preferencesSchema })
    .strict()
    .parse(req.body);
  if (!body.preferences.substitutionsAllowed) {
    res.json([]);
    return;
  }
  const product = await prisma.product.findUnique({
    where: { id: body.productId },
  });
  if (!product) {
    res.json([]);
    return;
  }
  // Suggest compatible alternatives for explicit selection; never silently change a basket.
  const rows = await prisma.product.findMany({
    where: {
      id: { not: product.id },
      category: product.category,
      variantName: product.variantName,
      dietaryTags: { hasEvery: body.preferences.dietaryTags },
    },
    take: 100,
  });
  const candidates = rows.filter(p => compatibleSubstitution(product, p));
  candidates.sort(
    (a, b) =>
      Number(
        body.preferences.preferredBrands.some(
          v => v.toLowerCase() === b.brand.toLowerCase(),
        ),
      ) -
        Number(
          body.preferences.preferredBrands.some(
            v => v.toLowerCase() === a.brand.toLowerCase(),
          ),
        ) || a.name.localeCompare(b.name),
  );
  res.json(
    candidates.slice(0, 10).map(p => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      quantity: p.quantity,
      category: p.category,
      variants: [],
      requiresConfirmation: true,
    })),
  );
});
