import { invalidateLocations } from '../infrastructure/redis';
import { z } from 'zod';
import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';
import { RETAILERS } from '../../../../packages/contracts/checkout';
import { tariffSchema } from '../domain/checkout';
import { pincodeSchema } from '../services/location.service';
const id = z.string().trim().min(1).max(200);
export const serviceRecord = z
  .object({
    retailer: z.enum(RETAILERS),
    storeId: id,
    sellerId: id,
    warehouseId: id.nullable(),
    pincode: pincodeSchema,
    entirePincode: z.boolean(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    radiusMeters: z.number().int().min(1).max(100000).nullable(),
    serving: z.boolean(),
    etaMinutes: z.number().int().min(1).max(10080),
    source: id,
    observedAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }),
    tariff: tariffSchema.nullable(),
  })
  .strict()
  .refine(
    r =>
      r.entirePincode ||
      (r.latitude !== null && r.longitude !== null && r.radiusMeters !== null),
    'Coverage geometry required',
  );
export async function importServiceability(payload: unknown) {
  const rows = z.array(serviceRecord).min(1).max(1000).parse(payload);
  const now = Date.now();
  const seen = new Set<string>();
  for (const r of rows) {
    if (
      Date.parse(r.observedAt) > now ||
      Date.parse(r.observedAt) < now - 86400000 ||
      Date.parse(r.expiresAt) <= now ||
      Date.parse(r.expiresAt) > Date.parse(r.observedAt) + 86400000
    )
      throw new Error('Invalid coverage validity');
    const key = JSON.stringify([r.retailer, r.storeId, r.sellerId, r.pincode]);
    if (seen.has(key)) throw new Error('Duplicate coverage record');
    seen.add(key);
  }
  const result = await prisma.$transaction(
    async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1847292)`;
      let imported = 0;
      for (const r of rows) {
        await tx.retailerStore.upsert({ where: { retailer_storeId_sellerId: { retailer: r.retailer, storeId: r.storeId, sellerId: r.sellerId } }, create: { retailer: r.retailer, storeId: r.storeId, sellerId: r.sellerId, warehouseId: r.warehouseId }, update: { warehouseId: r.warehouseId } });
        const where = {
          retailer_storeId_sellerId_pincode: {
            retailer: r.retailer,
            storeId: r.storeId,
            sellerId: r.sellerId,
            pincode: r.pincode,
          },
        };
        const previous = await tx.serviceArea.findUnique({ where });
        if (previous && previous.observedAt >= new Date(r.observedAt)) continue;
        const data = {
          ...r,
          observedAt: new Date(r.observedAt),
          expiresAt: new Date(r.expiresAt),
          tariff: r.tariff ?? Prisma.DbNull,
        };
        await tx.serviceArea.upsert({ where, create: data, update: data });
        await tx.deliveryEstimate.createMany({ data: [{ retailer: r.retailer, storeId: r.storeId, sellerId: r.sellerId, pincode: r.pincode, etaMinutes: r.etaMinutes, observedAt: data.observedAt, expiresAt: data.expiresAt }], skipDuplicates: true });
        imported++;
      }
      return { imported, skipped: rows.length - imported };
    },
    { timeout: 30000 },
  );
  await invalidateLocations(rows.map(r => r.pincode));
  return result;
}
