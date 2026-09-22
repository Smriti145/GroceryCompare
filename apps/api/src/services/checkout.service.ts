import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { normalizePack } from '../domain/comparison';
import { optimizeBasket, StoreInput, tariffSchema } from '../domain/checkout';
import {
  Preferences,
  defaultPreferences,
} from '../../../../packages/contracts/preferences';
import { servingStores } from './location.service';
import {
  BasketLine,
  DeliveryLocation,
  Retailer,
} from '../../../../packages/contracts/checkout';

export async function checkout(
  location: DeliveryLocation,
  items: BasketLine[],
  maxDeliveries: number,
  couponCode?: string,
  preferences: Preferences = defaultPreferences,
) {
  const now = new Date();
  const stores = await servingStores(location, now);
  const inputs: StoreInput[] = [];
  const offerFilter: Prisma.RetailerOfferWhereInput = {
    productId: { in: items.map(i => i.productId) },
    location: location.pincode,
    inStock: true,
    observedAt: {
      lte: now,
      gt: new Date(now.getTime() - env.OFFER_MAX_AGE_SECONDS * 1000),
    },
    OR: stores.map(s => ({
      retailer: s.retailer,
      storeId: s.storeId,
      sellerId: s.sellerId,
    })),
  };
  const offers = stores.length
    ? await prisma.retailerOffer.findMany({
        where: offerFilter,
        include: { product: true },
        take: 10001,
      })
    : [];
  if (offers.length > 10000) throw new Error('Offer query exceeded capacity');
  for (const row of stores) {
    const tariff = tariffSchema.safeParse(row.tariff);
    inputs.push({
      store: {
        id: row.id,
        retailer: row.retailer as Retailer,
        storeId: row.storeId,
        sellerId: row.sellerId,
        pincode: row.pincode,
        etaMinutes: row.etaMinutes,
        expiresAt: row.expiresAt.toISOString(),
      },
      tariff: tariff.success ? tariff.data : null,
      offers: offers
        .filter(
          o =>
            preferences.dietaryTags.every(tag =>
              o.product.dietaryTags.includes(tag),
            ) &&
            o.retailer === row.retailer &&
            o.storeId === row.storeId &&
            o.sellerId === row.sellerId &&
            normalizePack(o.packSize) === normalizePack(o.product.quantity) &&
            normalizePack(o.packSize) !== '',
        )
        .map(o => ({
          productId: o.productId,
          pricePaise: o.pricePaise,
          stockQuantity: o.stockQuantity,
          expiresAt: new Date(
            o.observedAt.getTime() + env.OFFER_MAX_AGE_SECONDS * 1000,
          ).toISOString(),
        })),
    });
  }
  // Membership entitlements must come from verified account/provider data, never request booleans.
  return optimizeBasket(
    location.pincode,
    items,
    inputs,
    now,
    maxDeliveries,
    [],
    couponCode,
    preferences,
  );
}
