import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import prisma from '../../src/config/prisma';
import { importFeed } from '../../src/integrations/import-feed';
import { normalizedFeedAdapter } from '../../src/integrations/retailer-feed';
import { evaluateWatch, watchSchema } from '../../src/services/alerts.service';

test('ingestion snapshots and persisted alerts are atomic, deduplicated, and account-owned', async () => {
  const id = randomUUID(),
    accountId = randomUUID(),
    email = `${randomUUID()}@example.test`;
  const adapter = normalizedFeedAdapter('ZEPTO');
  const offer = {
    sku: id,
    productId: id,
    location: '560001',
    storeId: id,
    sellerId: id,
    packSize: '1l',
    pricePaise: 19900,
    mrpPaise: null,
    inStock: true,
    stockQuantity: 10,
    etaMinutes: null,
    feesPaise: null,
    minimumOrderPaise: null,
    observedAt: new Date(Date.now() - 60000).toISOString(),
  };
  try {
    await prisma.product.create({
      data: {
        id,
        name: 'Insight test',
        brand: 'Test',
        category: 'Dairy',
        quantity: '1l',
      },
    });
    await prisma.account.create({ data: { id: accountId, email } });
    await importFeed(adapter, { retailer: 'ZEPTO', offers: [offer] });
    const config = watchSchema.parse({
      kind: 'PRICE_DROP',
      pincode: '560001',
      productId: id,
      retailer: 'ZEPTO',
      sku: id,
      storeId: id,
      sellerId: id,
    });
    const watch = await prisma.watch.create({
      data: { accountId, kind: config.kind, config },
    });
    await evaluateWatch(watch.id);
    assert.equal(await prisma.alert.count({ where: { accountId } }), 0);
    const lower = {
      ...offer,
      pricePaise: 17900,
      observedAt: new Date(Date.now() - 1000).toISOString(),
    };
    await importFeed(adapter, { retailer: 'ZEPTO', offers: [lower] });
    await Promise.all([evaluateWatch(watch.id), evaluateWatch(watch.id)]);
    await evaluateWatch(watch.id);
    const alerts = await prisma.alert.findMany({ where: { accountId } });
    assert.equal(alerts.length, 1);
    assert.match(alerts[0].message, /20.00/);
    await importFeed(adapter, { retailer: 'ZEPTO', offers: [lower] });
    assert.equal(
      await prisma.priceSnapshot.count({ where: { productId: id } }),
      2,
    );
    await prisma.account.delete({ where: { id: accountId } });
    assert.equal(await prisma.alert.count({ where: { accountId } }), 0);
    assert.equal(await prisma.watch.count({ where: { accountId } }), 0);
  } finally {
    await prisma.account.deleteMany({ where: { id: accountId } });
    await prisma.priceSnapshot.deleteMany({ where: { productId: id } });
    await prisma.retailerOffer.deleteMany({ where: { productId: id } });
    await prisma.product.deleteMany({ where: { id } });
    await prisma.$disconnect();
  }
});
