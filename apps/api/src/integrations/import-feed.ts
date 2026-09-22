import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';
import { normalizePack } from '../domain/comparison';
import { RetailerAdapter, validateFeed } from './retailer-feed';

export async function importFeed(adapter: RetailerAdapter, payload: unknown) {
  const offers = validateFeed(adapter, payload);
  return prisma.$transaction(
    async tx => {
      // Serialize imports so an older concurrent delivery cannot overwrite a newer one.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1847291)`;
      const products = await tx.product.findMany({
        where: { id: { in: offers.map(o => o.productId) } },
      });
      const packs = new Map(
        products.map(p => [p.id, normalizePack(p.quantity)]),
      );
      let imported = 0;
      for (const offer of offers) {
        if (
          !packs.get(offer.productId) ||
          packs.get(offer.productId) !== normalizePack(offer.packSize)
        ) {
          throw new Error('Unknown canonical product or mismatched pack');
        }
        const identity = {
          retailer: adapter.retailer,
          sku: offer.sku,
          location: offer.location,
          storeId: offer.storeId,
          sellerId: offer.sellerId,
        };
        const where = { retailer_sku_location_storeId_sellerId: identity };
        const previous = await tx.retailerOffer.findUnique({ where });
        const observedAt = new Date(offer.observedAt);
        await tx.priceSnapshot.createMany({
          data: [
            {
              ...identity,
              productId: offer.productId,
              packSize: offer.packSize,
              pricePaise: offer.pricePaise,
              inStock: offer.inStock,
              observedAt,
            },
          ],
          skipDuplicates: true,
        });
        if (previous && previous.observedAt >= observedAt) continue;
        const data = {
          ...offer,
          retailer: adapter.retailer,
          observedAt,
          receivedAt: new Date(),
        };
        await tx.retailerOffer.upsert({ where, create: data, update: data });
        imported++;
      }
      return { imported, skipped: offers.length - imported };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 30000,
    },
  );
}
