ALTER TABLE "Product" ADD COLUMN "variantName" TEXT NOT NULL DEFAULT '';
CREATE TABLE "ServiceArea" (
 "id" TEXT PRIMARY KEY,
 "retailer" TEXT NOT NULL CHECK ("retailer" IN ('BLINKIT','ZEPTO','SWIGGY','BIGBASKET','DMART_READY')),
 "storeId" TEXT NOT NULL, "sellerId" TEXT NOT NULL, "warehouseId" TEXT,
 "pincode" TEXT NOT NULL CHECK ("pincode" ~ '^[1-9][0-9]{5}$'),
 "entirePincode" BOOLEAN NOT NULL DEFAULT false,
 "latitude" DOUBLE PRECISION CHECK ("latitude" BETWEEN -90 AND 90),
 "longitude" DOUBLE PRECISION CHECK ("longitude" BETWEEN -180 AND 180),
 "radiusMeters" INTEGER CHECK ("radiusMeters" > 0),
 "serving" BOOLEAN NOT NULL,
 "etaMinutes" INTEGER NOT NULL CHECK ("etaMinutes" > 0),
 "observedAt" TIMESTAMP(3) NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
 "source" TEXT NOT NULL, "tariff" JSONB,
 CHECK ("expiresAt" > "observedAt"),
 CHECK ("entirePincode" OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND "radiusMeters" IS NOT NULL))
);
CREATE UNIQUE INDEX "ServiceArea_retailer_storeId_sellerId_pincode_key" ON "ServiceArea"("retailer","storeId","sellerId","pincode");
CREATE INDEX "ServiceArea_pincode_serving_expiresAt_idx" ON "ServiceArea"("pincode","serving","expiresAt");
CREATE TABLE "CanonicalMapping" (
 "id" TEXT PRIMARY KEY,
 "retailer" TEXT NOT NULL CHECK ("retailer" IN ('BLINKIT','ZEPTO','SWIGGY','BIGBASKET','DMART_READY')),
 "sku" TEXT NOT NULL, "productId" TEXT NOT NULL REFERENCES "Product"("id"),
 "fingerprint" TEXT NOT NULL, "reason" TEXT NOT NULL, "reviewedBy" TEXT NOT NULL,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "CanonicalMapping_retailer_sku_key" ON "CanonicalMapping"("retailer","sku");
