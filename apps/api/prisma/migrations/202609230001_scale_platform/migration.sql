-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "imageUrl" TEXT;

-- CreateTable
CREATE TABLE "Retailer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Retailer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailerStore" (
    "id" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RetailerStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailerProduct" (
    "id" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "packSize" TEXT NOT NULL,
    "canonicalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RetailerProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryEstimate" (
    "id" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "etaMinutes" INTEGER NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedCart" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SavedCart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonShare" (
    "id" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComparisonShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchAlias" (
    "term" TEXT NOT NULL,
    "replacement" TEXT NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "SearchAlias_pkey" PRIMARY KEY ("term")
);

-- CreateTable
CREATE TABLE "SearchTrend" (
    "pincode" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchTrend_pkey" PRIMARY KEY ("pincode","term")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserReport" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "productId" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RetailerStore_retailer_storeId_sellerId_key" ON "RetailerStore"("retailer", "storeId", "sellerId");

-- CreateIndex
CREATE INDEX "RetailerProduct_status_id_idx" ON "RetailerProduct"("status", "id");

-- CreateIndex
CREATE UNIQUE INDEX "RetailerProduct_retailer_sku_key" ON "RetailerProduct"("retailer", "sku");

-- CreateIndex
CREATE INDEX "DeliveryEstimate_pincode_expiresAt_idx" ON "DeliveryEstimate"("pincode", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryEstimate_retailer_storeId_sellerId_pincode_observed_key" ON "DeliveryEstimate"("retailer", "storeId", "sellerId", "pincode", "observedAt");

-- CreateIndex
CREATE INDEX "SavedCart_accountId_deletedAt_idx" ON "SavedCart"("accountId", "deletedAt");

-- CreateIndex
CREATE INDEX "ComparisonShare_expiresAt_idx" ON "ComparisonShare"("expiresAt");

-- CreateIndex
CREATE INDEX "SearchTrend_pincode_count_idx" ON "SearchTrend"("pincode", "count");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_objectType_objectId_idx" ON "AuditLog"("objectType", "objectId");

-- CreateIndex
CREATE INDEX "UserReport_status_createdAt_idx" ON "UserReport"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "RetailerStore" ADD CONSTRAINT "RetailerStore_retailer_fkey" FOREIGN KEY ("retailer") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerProduct" ADD CONSTRAINT "RetailerProduct_retailer_fkey" FOREIGN KEY ("retailer") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerProduct" ADD CONSTRAINT "RetailerProduct_canonicalId_fkey" FOREIGN KEY ("canonicalId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCart" ADD CONSTRAINT "SavedCart_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Managed PostgreSQL must permit this extension before running migrations.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Product_search_fts" ON "Product" USING GIN (to_tsvector('simple', name || ' ' || brand || ' ' || category)) WHERE "deletedAt" IS NULL;
CREATE INDEX "Product_search_trgm" ON "Product" USING GIN ((lower(name || ' ' || brand || ' ' || category)) gin_trgm_ops) WHERE "deletedAt" IS NULL;
CREATE INDEX "Offer_location_stock" ON "RetailerOffer" (location, "inStock", "productId", "observedAt");
ALTER TABLE "DeliveryEstimate" ADD CHECK ("etaMinutes" > 0 AND "expiresAt" > "observedAt");
ALTER TABLE "SavedCart" ADD CHECK (pincode ~ '^[1-9][0-9]{5}$');
ALTER TABLE "RetailerProduct" ADD CHECK (status IN ('MATCHED','UNMATCHED','AMBIGUOUS'));
INSERT INTO "Retailer" (id, name) VALUES ('BLINKIT','Blinkit'),('ZEPTO','Zepto'),('SWIGGY','Swiggy Instamart'),('BIGBASKET','BigBasket'),('DMART_READY','DMart Ready');
INSERT INTO "RetailerStore" (id, retailer, "storeId", "sellerId")
SELECT md5(retailer || ':' || "storeId" || ':' || "sellerId"), retailer, "storeId", "sellerId"
FROM (SELECT retailer,"storeId","sellerId" FROM "RetailerOffer" UNION SELECT retailer,"storeId","sellerId" FROM "ServiceArea") s;
INSERT INTO "RetailerProduct" (id, retailer, sku, title, "packSize", "canonicalId", status)
SELECT md5(retailer || ':' || sku), retailer, sku, min(p.name), min(o."packSize"),
  CASE WHEN count(DISTINCT o."productId") = 1 THEN min(o."productId") ELSE NULL END,
  CASE WHEN count(DISTINCT o."productId") = 1 THEN 'MATCHED' ELSE 'AMBIGUOUS' END
FROM "RetailerOffer" o JOIN "Product" p ON p.id=o."productId" GROUP BY retailer,sku;
INSERT INTO "DeliveryEstimate" (id,retailer,"storeId","sellerId",pincode,"etaMinutes","observedAt","expiresAt") SELECT id,retailer,"storeId","sellerId",pincode,"etaMinutes","observedAt","expiresAt" FROM "ServiceArea";
INSERT INTO "SearchAlias" (term,replacement,kind) VALUES ('doodh','milk','COMMON_NAME'),('दूध','milk','HINDI'),('atta','flour','COMMON_NAME'),('आटा','flour','HINDI'),('chawal','rice','COMMON_NAME'),('चावल','rice','HINDI'),('aashirwad','aashirvaad','BRAND');
ALTER TABLE "RetailerOffer" ADD CONSTRAINT "RetailerOffer_retailer_storeId_sellerId_fkey" FOREIGN KEY (retailer,"storeId","sellerId") REFERENCES "RetailerStore" (retailer,"storeId","sellerId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetailerOffer" ADD CONSTRAINT "RetailerOffer_retailer_sku_fkey" FOREIGN KEY (retailer,sku) REFERENCES "RetailerProduct" (retailer,sku) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceArea" ADD CONSTRAINT "ServiceArea_retailer_storeId_sellerId_fkey" FOREIGN KEY (retailer,"storeId","sellerId") REFERENCES "RetailerStore" (retailer,"storeId","sellerId") ON DELETE RESTRICT ON UPDATE CASCADE;
