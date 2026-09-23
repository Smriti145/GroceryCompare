import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import prisma from '../../src/config/prisma';
import { createApp } from '../../src/app';
import { importServiceability } from '../../src/integrations/serviceability';
import {
  correctMapping,
  matchListing,
} from '../../src/services/matching.service';
import { servingStores } from '../../src/services/location.service';
test('HTTP serviceability and checkout respect coverage and fee-inclusive split costs', async () => {
  const ids = [randomUUID(), randomUUID()];
  const stores = [randomUUID(), randomUUID()];
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${
    (server.address() as AddressInfo).port
  }/api/checkout`;
  const pincode = '999991';
  const observedAt = new Date(Date.now() - 1000).toISOString();
  const expiresAt = new Date(Date.now() + 600000).toISOString();
  const tariff = {
    deliveryFeePaise: 2000,
    handlingFeePaise: 0,
    surgeFeePaise: 0,
    smallCartFeePaise: 0,
    smallCartThresholdPaise: 0,
    minimumOrderPaise: 0,
    freeDeliveryThresholdPaise: null,
    coupon: null,
    membership: null,
    taxInclusive: true,
  };
  const coverage = stores.map((s, i) => ({
    retailer: i ? 'BLINKIT' : 'ZEPTO',
    storeId: s,
    sellerId: s,
    warehouseId: s,
    pincode,
    entirePincode: true,
    latitude: null,
    longitude: null,
    radiusMeters: null,
    serving: true,
    etaMinutes: 10 + i,
    source: 'INTEGRATION_TEST',
    observedAt,
    expiresAt,
    tariff: { ...tariff, deliveryFeePaise: i ? 2200 : 2000 },
  }));
  const post = (path: string, body: unknown) =>
    fetch(`${base}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  try {
    for (const [i, id] of ids.entries())
      await prisma.product.create({
        data: {
          id,
          name: `Test ${i}`,
          brand: 'TEST',
          category: 'Test',
          quantity: '1l',
          variantName: 'Plain',
        },
      });
    await importServiceability(coverage);
    const prices = [
      [20000, 56600],
      [60000, 50000],
    ];
    for (const c of coverage) for (const id of ids) await prisma.retailerProduct.create({data:{retailer:c.retailer,sku:id,title:'Test',packSize:'1l',canonicalId:id,status:'MATCHED'}});
    for (const [s, c] of coverage.entries())
      for (const [i, productId] of ids.entries())
        await prisma.retailerOffer.create({
          data: {
            retailer: c.retailer,
            sku: productId,
            storeId: c.storeId,
            sellerId: c.sellerId,
            productId,
            location: pincode,
            packSize: '1000ml',
            pricePaise: prices[s][i],
            inStock: true,
            stockQuantity: 10,
            observedAt: new Date(observedAt),
          },
        });
    assert.equal(
      (await (await post('location', { pincode })).json()).data.stores.length,
      2,
    );
    assert.equal((await post('location', { pincode: 'DEMO' })).status, 400);
    assert.equal(
      (await post('location', { latitude: 12, longitude: 77 })).status,
      503,
    );
    const body = {
      location: { pincode },
      items: ids.map(productId => ({ productId, quantity: 1 })),
      maxDeliveries: 2,
    };
    const response = await post('compare', body);
    assert.equal(response.status, 200);
    const result = (await response.json()).data;
    assert.equal(result.bestSingle.finalPayablePaise, 78600);
    assert.equal(result.bestSplit.finalPayablePaise, 74200);
    assert.equal(result.savingsPaise, 4400);
    const listing = {
      retailer: 'ZEPTO',
      sku: ids[0],
      title: 'Test 0 pack',
      brand: 'TEST',
      category: 'Test',
      packSize: '1l',
      variant: 'Plain',
    };
    await correctMapping({
      listing,
      productId: ids[0],
      reviewedBy: 'test',
      reason: 'Verified test identity',
    });
    assert.equal((await matchListing(listing)).method, 'MANUAL');
    await prisma.serviceArea.updateMany({
      where: { storeId: { in: stores } },
      data: {
        entirePincode: false,
        latitude: 12,
        longitude: 77,
        radiusMeters: 100,
      },
    });
    assert.equal((await servingStores({ pincode })).length, 0);
    assert.equal(
      (await servingStores({ pincode, latitude: 12, longitude: 77 })).length,
      2,
    );
    assert.equal(
      (await servingStores({ pincode, latitude: 13, longitude: 78 })).length,
      0,
    );
    assert.equal(
      (await (await post('compare', body)).json()).data.recommended,
      null,
    );
    await prisma.serviceArea.updateMany({
      where: { storeId: { in: stores } },
      data: { entirePincode: true, expiresAt: new Date(Date.now() - 1) },
    });
    assert.equal(
      (await (await post('location', { pincode })).json()).data.stores.length,
      0,
    );
  } finally {
    await prisma.canonicalMapping.deleteMany({ where: { sku: { in: ids } } });
    await prisma.retailerOffer.deleteMany({
      where: { productId: { in: ids } },
    });
    await prisma.serviceArea.deleteMany({ where: { storeId: { in: stores } } });
    await prisma.product.deleteMany({ where: { id: { in: ids } } });
    await new Promise<void>((resolve, reject) =>
      server.close(e => (e ? reject(e) : resolve())),
    );
    await prisma.$disconnect();
  }
});
