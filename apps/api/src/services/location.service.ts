import { cached } from '../infrastructure/redis';
import { z } from 'zod';
import prisma from '../config/prisma';
import { ApiError } from '../middleware/errors';
import {
  DeliveryLocation,
  RETAILERS,
} from '../../../../packages/contracts/checkout';
export const pincodeSchema = z.string().regex(/^[1-9][0-9]{5}$/);
const coordinates = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .strict();
export const locationInput = z.union([
  z.object({ pincode: pincodeSchema }).strict(),
  coordinates,
  z.object({ address: z.string().trim().min(10).max(500) }).strict(),
]);
export interface Geocoder {
  resolve(
    input: { address: string } | { latitude: number; longitude: number },
  ): Promise<DeliveryLocation[]>;
}
export async function resolveLocation(
  input: z.infer<typeof locationInput>,
  geocoder?: Geocoder,
): Promise<DeliveryLocation> {
  if ('pincode' in input) return input;
  if (!geocoder)
    throw new ApiError(
      503,
      'GEOCODER_NOT_CONFIGURED',
      'Address and GPS lookup are unavailable. Enter your six-digit pincode.',
    );
  const matches = await geocoder.resolve(input);
  if (matches.length !== 1)
    throw new ApiError(
      422,
      'LOCATION_AMBIGUOUS',
      'Choose a precise address or enter your pincode.',
    );
  const match = z
    .object({
      pincode: pincodeSchema,
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .strict()
    .parse(matches[0]);
  return match;
}
function meters(a: DeliveryLocation, lat: number, lon: number) {
  const rad = Math.PI / 180;
  const x =
    Math.sin(((lat - a.latitude!) * rad) / 2) ** 2 +
    Math.cos(a.latitude! * rad) *
      Math.cos(lat * rad) *
      Math.sin(((lon - a.longitude!) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, x)));
}
export async function servingStores(
  location: DeliveryLocation,
  now = new Date(),
) {
  const stored = await cached(
    'coverage-eta',
    location.pincode,
    location,
    15,
    () =>
      prisma.serviceArea.findMany({
        where: {
          pincode: location.pincode,
          serving: true,
          directory: { deletedAt: null, provider: { deletedAt: null } },
          observedAt: { lte: now },
          expiresAt: { gt: now },
        },
        orderBy: { id: 'asc' },
        take: 101,
      }),
  );
  const rows = stored
    .map(r => ({
      ...r,
      observedAt: new Date(r.observedAt),
      expiresAt: new Date(r.expiresAt),
    }))
    .filter(r => r.expiresAt > now && r.observedAt <= now);
  if (rows.length > 100)
    throw new ApiError(
      503,
      'COVERAGE_LIMIT',
      'Too many delivery stores; narrow the delivery location.',
    );
  return rows.filter(
    row =>
      RETAILERS.includes(row.retailer as (typeof RETAILERS)[number]) &&
      (row.entirePincode ||
        (location.latitude !== undefined &&
          location.longitude !== undefined &&
          row.latitude !== null &&
          row.longitude !== null &&
          row.radiusMeters !== null &&
          meters(location, row.latitude, row.longitude) <= row.radiusMeters)),
  );
}
