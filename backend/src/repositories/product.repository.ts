import { Prisma } from '@prisma/client';
import { Product, PLATFORMS, Platform } from '../../../shared/contracts';
import prisma from '../config/prisma';
import { env } from '../config/env';
import { z } from 'zod';
import { productQuerySchema } from '../domain/validation';
type ProductRecord = Prisma.ProductGetPayload<{ include: { variants: true } }>;
export function toProduct(row: ProductRecord): Product {
  return { id: row.id, name: row.name, brand: row.brand, category: row.category, quantity: row.quantity,
    variants: row.variants.filter(v => PLATFORMS.includes(v.platform as Platform)).map(v => ({
      id: v.id, platform: v.platform as Platform, platformName: v.platformName, quantity: v.quantity,
      pricePaise: v.price.mul(100).toNumber(), deliveryTime: v.deliveryTime, available: v.available,
      location: v.location, updatedAt: v.updatedAt.toISOString(), isDemo: v.isDemo,
    })) };
}
function offers(location: string) { return { location, ...(env.ALLOW_DEMO_DATA ? {} : { isDemo: false }) }; }
export async function getAllProducts(query: z.infer<typeof productQuerySchema>) {
  const where: Prisma.ProductWhereInput = {
    ...(query.cursor ? { id: { gt: query.cursor } } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.search ? { OR: ['name', 'brand'].map(field => ({ [field]: { contains: query.search, mode: 'insensitive' } })) } : {}),
    variants: { some: offers(query.location) },
  };
  const rows = await prisma.product.findMany({ where, orderBy: { id: 'asc' }, take: query.limit + 1,
    include: { variants: { where: offers(query.location) } } });
  const hasMore = rows.length > query.limit;
  const page = rows.slice(0, query.limit);
  return { products: page.map(toProduct), nextCursor: hasMore ? page[page.length - 1].id : null };
}
export async function getProductById(id: string, location: string) {
  const row = await prisma.product.findFirst({ where: { id, variants: { some: offers(location) } },
    include: { variants: { where: offers(location) } } });
  return row ? toProduct(row) : null;
}
export async function getProductsByIds(ids: string[], location: string) {
  const rows = await prisma.product.findMany({ where: { id: { in: ids } },
    include: { variants: { where: offers(location) } } });
  return rows.map(toProduct);
}
