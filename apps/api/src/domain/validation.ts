import { z } from 'zod';
export const locationSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);
export const comparisonSchema = z
  .object({
    location: locationSchema,
    items: z
      .array(
        z
          .object({
            productId: z.uuid(),
            quantity: z.number().int().min(1).max(99),
          })
          .strict(),
      )
      .min(1)
      .max(100)
      .refine(
        items =>
          new Set(items.map(item => item.productId)).size === items.length,
        'Duplicate products',
      ),
  })
  .strict();
export const productQuerySchema = z
  .object({
    location: locationSchema,
    search: z.string().trim().max(100).default(''),
    category: z.string().trim().min(1).max(64).optional(),
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export const productIdSchema = z.uuid();
