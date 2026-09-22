import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import prisma from '../../src/config/prisma';
import { importFeed } from '../../src/integrations/import-feed';
import { normalizedFeedAdapter } from '../../src/integrations/retailer-feed';

test('imports atomically, preserves newer observations, and rejects unmapped products', async () => {
  const productId = randomUUID();
  const adapter = normalizedFeedAdapter('BLINKIT');
  const offer = {
    sku: randomUUID(),
    location: 'TEST',
    storeId: 's1',
    sellerId: 'v1',
    productId,
    packSize: '1000ml',
    pricePaise: 6000,
    mrpPaise: null,
    inStock: true,
    stockQuantity: null,
    etaMinutes: null,
    feesPaise: null,
    minimumOrderPaise: null,
    observedAt: new Date(Date.now() - 1000).toISOString(),
  };
  try {
    await prisma.product.create({
      data: {
        id: productId,
        name: 'Feed test',
        brand: 'Test',
        category: 'Test',
        quantity: '1l',
      },
    });
    assert.equal(
      (await importFeed(adapter, { retailer: 'BLINKIT', offers: [offer] }))
        .imported,
      1,
    );
    assert.equal(
      (await importFeed(adapter, { retailer: 'BLINKIT', offers: [offer] }))
        .skipped,
      1,
    );
    assert.equal(
      (
        await importFeed(adapter, {
          retailer: 'BLINKIT',
          offers: [
            {
              ...offer,
              pricePaise: 5000,
              observedAt: new Date(Date.now() - 60000).toISOString(),
            },
          ],
        })
      ).skipped,
      1,
    );
    await assert.rejects(
      importFeed(adapter, {
        retailer: 'BLINKIT',
        offers: [
          { ...offer, storeId: 's2' },
          { ...offer, sku: 'invalid', productId: randomUUID() },
        ],
      }),
    );
    const rows = await prisma.retailerOffer.findMany({ where: { productId } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].pricePaise, 6000);
    assert.equal(await prisma.priceSnapshot.count({ where: { productId } }), 2);
  } finally {
    await prisma.priceSnapshot.deleteMany({ where: { productId } });
    await prisma.retailerOffer.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.$disconnect();
  }
});
