CREATE TABLE "ProviderHealth" (
  "retailer" TEXT NOT NULL PRIMARY KEY,
  "snapshot" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
