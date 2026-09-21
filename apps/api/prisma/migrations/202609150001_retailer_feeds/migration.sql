CREATE TABLE "RetailerOffer" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "retailer" TEXT NOT NULL CHECK ("retailer" IN ('BLINKIT','ZEPTO','SWIGGY','BIGBASKET','DMART_READY')),
 "sku" TEXT NOT NULL, "location" TEXT NOT NULL, "storeId" TEXT NOT NULL,
 "sellerId" TEXT NOT NULL, "productId" TEXT NOT NULL REFERENCES "Product"("id"),
 "packSize" TEXT NOT NULL,
 "pricePaise" INTEGER NOT NULL CHECK ("pricePaise" >= 0),
 "mrpPaise" INTEGER CHECK ("mrpPaise" >= "pricePaise"),
 "inStock" BOOLEAN NOT NULL,
 "stockQuantity" INTEGER CHECK ("stockQuantity" >= 0),
 "etaMinutes" INTEGER CHECK ("etaMinutes" > 0),
 "feesPaise" INTEGER CHECK ("feesPaise" >= 0),
 "minimumOrderPaise" INTEGER CHECK ("minimumOrderPaise" >= 0),
 "observedAt" TIMESTAMP(3) NOT NULL,
 "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (NOT "inStock" OR "stockQuantity" IS NULL OR "stockQuantity" > 0)
);
CREATE UNIQUE INDEX "RetailerOffer_retailer_sku_location_storeId_sellerId_key" ON "RetailerOffer"("retailer","sku","location","storeId","sellerId");
CREATE INDEX "RetailerOffer_productId_location_observedAt_idx" ON "RetailerOffer"("productId","location","observedAt");
