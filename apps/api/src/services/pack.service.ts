import prisma from '../config/prisma';
import { normalizePack } from '../domain/comparison';
import { normalizeText } from '../domain/matching';
import { servingStores } from './location.service';
import { env } from '../config/env';
export function equivalentCount(
  source: string,
  target: string,
  quantity: number,
) {
  const a = /^(\d+(?:\.\d+)?)(g|ml)$/.exec(normalizePack(source));
  const b = /^(\d+(?:\.\d+)?)(g|ml)$/.exec(normalizePack(target));
  if (!a || !b || a[2] !== b[2] || Number(b[1]) <= 0) return null;
  const count = (Number(a[1]) * quantity) / Number(b[1]);
  return Number.isInteger(count) && count > 0 && count <= 99 ? count : null;
}
export async function packAlternatives(
  productId: string,
  quantity: number,
  pincode: string,
) {
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
  });
  if (!product) return [];
  const stores = await servingStores({ pincode });
  if (!stores.length) return [];
  const candidates = await prisma.product.findMany({
    where: {
      deletedAt: null,
      brand: product.brand,
      category: product.category,
      variantName: product.variantName,
    },
    take: 100,
  });
  // Exact canonical title and variant only. Different flavours/formulations never become quantity substitutes.
  const compatible = candidates.filter(
    p =>
      normalizeText(p.name) === normalizeText(product.name) &&
      equivalentCount(product.quantity, p.quantity, quantity) !== null,
  );
  const offers = await prisma.retailerOffer.findMany({
    where: {
      productId: { in: compatible.map(p => p.id) },
      location: pincode,
      inStock: true,
      listing: { deletedAt: null, status: 'MATCHED' },
      observedAt: {
        lte: new Date(),
        gt: new Date(Date.now() - env.OFFER_MAX_AGE_SECONDS * 1000),
      },
      OR: stores.map(s => ({
        retailer: s.retailer,
        storeId: s.storeId,
        sellerId: s.sellerId,
      })),
    },
    take: 1000,
  });
  return offers
    .flatMap(o => {
      const p = compatible.find(v => v.id === o.productId)!;
      const count = equivalentCount(product.quantity, p.quantity, quantity)!;
      if (
        o.stockQuantity === null ||
        o.stockQuantity < count ||
        normalizePack(o.packSize) !== normalizePack(p.quantity)
      )
        return [];
      const original = offers
        .filter(
          a =>
            a.productId === productId &&
            a.retailer === o.retailer &&
            a.storeId === o.storeId &&
            a.sellerId === o.sellerId &&
            a.stockQuantity !== null &&
            a.stockQuantity >= quantity,
        )
        .sort((a, b) => a.pricePaise - b.pricePaise)[0];
      return [
        {
          product: { ...p, variants: [] },
          quantity: count,
          retailer: o.retailer,
          storeId: o.storeId,
          itemTotalPaise: count * o.pricePaise,
          savingsPaise: original
            ? original.pricePaise * quantity - count * o.pricePaise
            : null,
          explanation: `${count} × ${p.quantity} supplies the same quantity as ${quantity} × ${product.quantity}. Recompare your basket for fees and preference eligibility.`,
        },
      ];
    })
    .filter(p => p.product.id !== productId)
    .sort((a, b) => a.itemTotalPaise - b.itemTotalPaise)
    .slice(0, 10);
}
