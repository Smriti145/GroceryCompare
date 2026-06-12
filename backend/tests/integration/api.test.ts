import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app';
import prisma from '../../src/config/prisma';
import { AddressInfo } from 'node:net';
test('HTTP catalog, comparison, validation and health contracts', async () => {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    assert.equal((await fetch(`${base}/health/ready`)).status, 200);
    const response = await fetch(`${base}/api/products?location=DEMO&limit=2`);
    const page = await response.json();
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('x-request-id'));
    assert.equal(page.data.products.length, 2);
    assert.ok(page.data.nextCursor);
    const second = await (
      await fetch(
        `${base}/api/products?location=DEMO&limit=2&cursor=${page.data.nextCursor}`,
      )
    ).json();
    assert.ok(
      second.data.products.every(
        (p: { id: string }) =>
          !page.data.products.some((q: { id: string }) => p.id === q.id),
      ),
    );
    const comparison = await fetch(`${base}/api/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'DEMO',
        items: [{ productId: page.data.products[0].id, quantity: 2 }],
      }),
    });
    const result = await comparison.json();
    assert.equal(comparison.status, 200);
    assert.equal(result.data.recommendedPlatform, 'ZEPTO');
    assert.ok(
      result.data.platforms.every((p: { eligible: boolean }) => p.eligible),
    );
    const invalid = await fetch(`${base}/api/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, 'INVALID_JSON');
    const empty = await fetch(`${base}/api/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"items":[],"location":"DEMO"}',
    });
    assert.equal(empty.status, 400);
    assert.equal(
      (await fetch(`${base}/api/products?location=DEMO&limit=10000`)).status,
      400,
    );
    assert.equal((await fetch(`${base}/missing`)).status, 404);
    const other = await (
      await fetch(`${base}/api/products?location=OTHER`)
    ).json();
    assert.deepEqual(other.data.products, []);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve())),
    );
    await prisma.$disconnect();
  }
});
