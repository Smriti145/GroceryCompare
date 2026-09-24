import { invalidateLocations } from '../infrastructure/redis';
import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';
import { normalizePack } from '../domain/comparison';
import { RetailerAdapter, validateFeed } from './retailer-feed';

export async function importFeed(adapter: RetailerAdapter, payload: unknown) {
  const offers = validateFeed(adapter, payload);
  const result = await prisma.$transaction(
    async tx => {
      // Serialize imports so an older concurrent delivery cannot overwrite a newer one.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1847291)`;
      const products = await tx.product.findMany({
        where: { id: { in: offers.map(o => o.productId) }, deletedAt: null },
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
        await tx.retailerStore.upsert({
          where: {
            retailer_storeId_sellerId: {
              retailer: adapter.retailer,
              storeId: offer.storeId,
              sellerId: offer.sellerId,
            },
          },
          create: {
            retailer: adapter.retailer,
            storeId: offer.storeId,
            sellerId: offer.sellerId,
          },
          update: {},
        });
        const listingKey = {
          retailer_sku: { retailer: adapter.retailer, sku: offer.sku },
        };
        const listing = await tx.retailerProduct.findUnique({
          where: listingKey,
        });
        if (
          listing &&
          (listing.deletedAt || listing.canonicalId !== offer.productId)
        )
          throw new Error(
            'Retailer listing requires reviewed canonical mapping',
          );
        await tx.retailerProduct.upsert({
          where: listingKey,
          create: {
            retailer: adapter.retailer,
            sku: offer.sku,
            title: products.find(p => p.id === offer.productId)!.name,
            packSize: offer.packSize,
            canonicalId: offer.productId,
            status: 'MATCHED',
          },
          update: {},
        });
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
      await tx.auditLog.create({
        data: {
          action: 'FEED_IMPORTED',
          objectType: 'Retailer',
          objectId: adapter.retailer,
          reason: `${imported} current offers; ${offers.length} source observations`,
        },
      });
      return { imported, skipped: offers.length - imported };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 30000,
    },
  );
  await invalidateLocations(offers.map(o => o.location));
  return result;
}
