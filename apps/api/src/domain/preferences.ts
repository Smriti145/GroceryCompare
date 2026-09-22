import { z } from 'zod';
import { RETAILERS, BasketPlan } from '../../../../packages/contracts/checkout';
import { Preferences } from '../../../../packages/contracts/preferences';
export const preferencesSchema = z
  .object({
    mode: z.enum(['CHEAPEST', 'FASTEST', 'BALANCED']).default('CHEAPEST'),
    singlePlatformOnly: z.boolean().default(false),
    avoidedRetailers: z.array(z.enum(RETAILERS)).max(5).default([]),
    maxEtaMinutes: z.number().int().min(1).max(10080).nullable().default(null),
    preferredBrands: z
      .array(z.string().trim().min(1).max(100))
      .max(20)
      .default([]),
    substitutionsAllowed: z.boolean().default(false),
    dietaryTags: z
      .array(z.enum(['VEGETARIAN', 'VEGAN', 'ORGANIC', 'GLUTEN_FREE']))
      .max(4)
      .default([]),
  })
  .strict();
export const eta = (plan: BasketPlan) =>
  Math.max(...plan.deliveries.map(d => d.store.etaMinutes));
// Balanced uses an explicit, stable tradeoff: one minute of waiting costs ₹1 in ranking only.
export function rankPlans(preferences: Preferences) {
  return (a: BasketPlan, b: BasketPlan) => {
    const score = (p: BasketPlan) =>
      preferences.mode === 'FASTEST'
        ? eta(p)
        : p.finalPayablePaise +
          (preferences.mode === 'BALANCED' ? eta(p) * 100 : 0);
    return (
      score(a) - score(b) ||
      a.finalPayablePaise - b.finalPayablePaise ||
      eta(a) - eta(b) ||
      a.deliveryCount - b.deliveryCount ||
      a.deliveries
        .map(d => d.store.id)
        .join()
        .localeCompare(b.deliveries.map(d => d.store.id).join())
    );
  };
}
