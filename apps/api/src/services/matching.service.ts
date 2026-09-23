import { invalidateLocations } from '../infrastructure/redis';
import { z } from 'zod';
import prisma from '../config/prisma';
import { fingerprint, matchProduct } from '../domain/matching';
import { RETAILERS } from '../../../../packages/contracts/checkout';
const text = z.string().trim().min(1).max(200);
export const listingSchema = z
  .object({
    retailer: z.enum(RETAILERS),
    sku: text,
    brand: text,
    title: text,
    packSize: text,
    variant: z.string().trim().max(200),
    category: text,
  })
  .strict();
async function candidates() {
  // Fail explicitly until a larger catalog has an indexed candidate retrieval strategy.
  const rows = await prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: { id: 'asc' },
    take: 10001,
  });
  if (rows.length > 10000)
    throw new Error('Matching catalog exceeds bounded candidate capacity');
  return rows.map(p => ({
    id: p.id,
    title: p.name,
    brand: p.brand,
    packSize: p.quantity,
    variant: p.variantName,
    category: p.category,
  }));
}
export async function matchListing(payload: unknown) {
  const listing = listingSchema.parse(payload);
  const [products, manual] = await Promise.all([
    candidates(),
    prisma.canonicalMapping.findUnique({
      where: { retailer_sku: { retailer: listing.retailer, sku: listing.sku } },
    }),
  ]);
  return matchProduct(listing, products, manual ?? undefined);
}
export async function correctMapping(payload: unknown) {
  const correction = z
    .object({
      listing: listingSchema,
      productId: z.string().uuid(),
      reviewedBy: text,
      reason: z.string().trim().min(5).max(1000),
    })
    .strict()
    .parse(payload);
  const manual = {
    productId: correction.productId,
    fingerprint: fingerprint(correction.listing),
  };
  if (
    matchProduct(correction.listing, await candidates(), manual).method !==
    'MANUAL'
  )
    throw new Error(
      'Correction violates brand, pack, variant or category boundaries',
    );
  const data = {
    ...manual,
    retailer: correction.listing.retailer,
    sku: correction.listing.sku,
    reviewedBy: correction.reviewedBy,
    reason: correction.reason,
  };
  const result = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1847291)`;
    const mapping = await tx.canonicalMapping.upsert({ where: { retailer_sku: { retailer: data.retailer, sku: data.sku } }, create: data, update: data });
    await tx.retailerProduct.upsert({ where: { retailer_sku: { retailer: data.retailer, sku: data.sku } }, create: { retailer: data.retailer, sku: data.sku, title: correction.listing.title, packSize: correction.listing.packSize, canonicalId: data.productId, status: 'MATCHED' }, update: { canonicalId: data.productId, status: 'MATCHED' } });
    // Current observations mapped to the old canonical identity must be re-imported after review.
    await tx.retailerOffer.updateMany({ where: { retailer: data.retailer, sku: data.sku, productId: { not: data.productId } }, data: { inStock: false, stockQuantity: 0 } });
    const actor = await tx.account.findUnique({ where: { id: correction.reviewedBy }, select: { id: true } });
    await tx.auditLog.create({ data: { actorId: actor?.id, action: 'MAPPING_CORRECTED', objectType: 'CanonicalMapping', objectId: mapping.id, reason: correction.reason } });
    return mapping;
  });
  const locations = await prisma.retailerOffer.findMany({ where: { retailer: data.retailer, sku: data.sku }, distinct: ['location'], select: { location: true } });
  await invalidateLocations(locations.map(l=>l.location)); return result;
}
