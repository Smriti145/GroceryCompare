ALTER TABLE "Product" ADD COLUMN "quantity" TEXT NOT NULL DEFAULT '';
-- Backfill only unambiguous pack sizes. Ambiguous legacy records remain ineligible.
UPDATE "Product" p SET "quantity" = q.quantity FROM (
  SELECT "productId", MIN(lower(regexp_replace(quantity, '\s+', '', 'g'))) AS quantity
  FROM "Variant" GROUP BY "productId"
  HAVING COUNT(DISTINCT lower(regexp_replace(quantity, '\s+', '', 'g'))) = 1
) q WHERE p.id = q."productId";
ALTER TABLE "Variant" ALTER COLUMN "price" TYPE DECIMAL(12,2) USING round("price"::numeric, 2);
ALTER TABLE "Variant" ADD COLUMN "location" TEXT NOT NULL DEFAULT 'DEMO',
  ADD COLUMN "available" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_price_nonnegative" CHECK (price >= 0),
  ADD CONSTRAINT "Variant_delivery_positive" CHECK ("deliveryTime" > 0),
  ADD CONSTRAINT "Variant_platform_valid" CHECK (platform IN ('BLINKIT', 'ZEPTO', 'SWIGGY'));
CREATE INDEX "Product_category_id_idx" ON "Product"("category", "id");
-- This intentionally fails on duplicate offers rather than deleting user data.
CREATE UNIQUE INDEX "Variant_platform_platformSku_location_key" ON "Variant"("platform", "platformSku", "location");
CREATE INDEX "Variant_productId_location_available_idx" ON "Variant"("productId", "location", "available");
