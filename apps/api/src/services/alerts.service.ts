import { createHash } from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { RETAILERS } from '../../../../packages/contracts/checkout';
import { preferencesSchema } from '../domain/preferences';
import { comparisonSchema } from '../domain/validation';
import { checkout } from './checkout.service';
import { env } from '../config/env';
import { eta } from '../domain/preferences';
export const watchSchema = z
  .object({
    kind: z.enum([
      'PRICE_DROP',
      'BACK_IN_STOCK',
      'ETA_IMPROVEMENT',
      'CART_CHEAPER',
      'DEAL',
    ]),
    pincode: z.string().regex(/^[1-9][0-9]{5}$/),
    productId: z.string().uuid().optional(),
    retailer: z.enum(RETAILERS).optional(),
    storeId: z.string().min(1).max(200).optional(),
    sellerId: z.string().min(1).max(200).optional(),
    sku: z.string().min(1).max(200).optional(),
    items: comparisonSchema.shape.items.optional(),
    preferences: preferencesSchema.default(() => preferencesSchema.parse({})),
    maxDeliveries: z.number().int().min(1).max(3).default(2),
    couponCode: z.string().min(1).max(64).optional(),
    minimumDropPaise: z.number().int().min(1).max(2147483647).default(100),
  })
  .strict()
  .refine(
    v =>
      ['PRICE_DROP', 'BACK_IN_STOCK'].includes(v.kind)
        ? Boolean(v.productId && v.retailer && v.storeId && v.sellerId && v.sku)
        : Boolean(v.items?.length),
    'Product alerts require an exact offer identity; cart alerts require basket items',
  );
export interface Observation {
  price: number;
  stock: boolean;
  eta: number | null;
  discount: number;
  at: string;
}
export function alertMessage(
  kind: string,
  before: Observation | null,
  after: Observation,
  minimumDrop: number,
): string | null {
  if (!before || before.at === after.at) return null;
  if (kind === 'BACK_IN_STOCK' && !before.stock && after.stock)
    return 'Your watched item is back in stock';
  if (
    kind === 'PRICE_DROP' &&
    after.stock &&
    before.stock &&
    before.price - after.price >= minimumDrop
  )
    return `Price dropped ₹${((before.price - after.price) / 100).toFixed(2)}`;
  if (kind === 'CART_CHEAPER' && before.price - after.price >= minimumDrop)
    return `Your cart is ₹${((before.price - after.price) / 100).toFixed(
      2,
    )} cheaper after fees`;
  if (
    kind === 'ETA_IMPROVEMENT' &&
    before.eta !== null &&
    after.eta !== null &&
    after.eta < before.eta
  )
    return `Delivery estimate improved from ${before.eta} to ${after.eta} minutes`;
  if (kind === 'DEAL' && after.discount > before.discount)
    return `An eligible coupon or deal now saves ₹${(
      after.discount / 100
    ).toFixed(2)} on your cart`;
  return null;
}
async function observe(
  config: z.infer<typeof watchSchema>,
): Promise<Observation | null> {
  if (config.kind === 'PRICE_DROP' || config.kind === 'BACK_IN_STOCK') {
    const row = await prisma.retailerOffer.findUnique({
      where: {
        retailer_sku_location_storeId_sellerId: {
          retailer: config.retailer!,
          sku: config.sku!,
          location: config.pincode,
          storeId: config.storeId!,
          sellerId: config.sellerId!,
        },
      },
    });
    if (
      !row ||
      row.productId !== config.productId ||
      row.observedAt > new Date() ||
      row.observedAt.getTime() < Date.now() - env.OFFER_MAX_AGE_SECONDS * 1000
    )
      return null;
    return {
      price: row.pricePaise,
      stock: row.inStock && row.stockQuantity !== 0,
      eta: null,
      discount: 0,
      at: row.observedAt.toISOString(),
    };
  }
  const result = await checkout(
    { pincode: config.pincode },
    config.items!,
    config.maxDeliveries,
    config.couponCode,
    config.preferences,
  );
  const p = result.recommended;
  if (!p || !result.search.complete) return null;
  return {
    price: p.finalPayablePaise,
    stock: true,
    eta: eta(p),
    discount: p.deliveries.reduce(
      (n, d) =>
        n + d.costs.couponDiscountPaise + d.costs.membershipBenefitPaise,
      0,
    ),
    at: result.comparedAt,
  };
}
export async function evaluateWatch(id: string) {
  return prisma.$transaction(
    async tx => {
      const locks = await tx.$queryRaw<
        { locked: boolean }[]
      >`SELECT pg_try_advisory_xact_lock(hashtext(${id})) AS locked`;
      if (!locks[0].locked) return;
      const watch = await tx.watch.findUnique({ where: { id } });
      if (!watch) return;
      const config = watchSchema.parse(watch.config);
      const next = await observe(config);
      if (!next) {
        await tx.watch.update({
          where: { id },
          data: { lastCheckedAt: new Date() },
        });
        return;
      }
      const previous = watch.baseline as unknown as Observation | null;
      const message = alertMessage(
        watch.kind,
        previous,
        next,
        config.minimumDropPaise,
      );
      if (message) {
        const dedupeKey = createHash('sha256')
          .update(JSON.stringify([id, previous, next]))
          .digest('hex');
        await tx.alert.createMany({
          data: [
            { accountId: watch.accountId, watchId: id, message, dedupeKey },
          ],
          skipDuplicates: true,
        });
      }
      await tx.watch.update({
        where: { id },
        data: {
          baseline: next as unknown as Prisma.InputJsonValue,
          lastCheckedAt: new Date(),
        },
      });
    },
    { timeout: 30000 },
  );
}
export async function evaluateWatches() {
  // Cursor pagination prevents a busy account from starving later watches.
  let cursor: string | undefined;
  let checked = 0,
    failed = 0;
  for (;;) {
    const rows: { id: string }[] = await prisma.watch.findMany({
      where: cursor ? { id: { gt: cursor } } : {},
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true },
    });
    if (!rows.length) break;
    for (const row of rows) {
      try {
        await evaluateWatch(row.id);
        checked++;
      } catch {
        failed++;
      }
    }
    cursor = rows[rows.length - 1].id;
  }
  return { checked, failed };
}
