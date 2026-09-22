import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import prisma from '../../src/config/prisma';
import { createApp } from '../../src/app';
import { requestOtp, verifyOtp, rotate } from '../../src/auth/service';

test('OTP attempts, refresh replay, account ownership, RBAC, export and deletion', async () => {
  process.env.AUTH_SECRET = 'integration-only-secret-'.repeat(3);
  const email = `${randomUUID()}@example.test`;
  const otherEmail = `${randomUUID()}@example.test`;
  let code = '';
  const sender = {
    async send(_email: string, value: string) {
      code = value;
    },
  };
  const server = createApp({ emailSender: sender }).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const request = (
    path: string,
    token: string,
    method = 'GET',
    body?: unknown,
  ) =>
    fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    const invalid = await requestOtp(email, sender);
    const realCode = code;
    for (let i = 0; i < 5; i++)
      await assert.rejects(verifyOtp(invalid.challengeId, '000000', 'Test'));
    await assert.rejects(verifyOtp(invalid.challengeId, realCode, 'Test'));
    const challenge = await requestOtp(email, sender);
    const first = await verifyOtp(challenge.challengeId, code, 'Test device');
    await assert.rejects(verifyOtp(challenge.challengeId, code, 'Test device'));
    assert.equal((await request('/account/me', first.accessToken)).status, 200);
    const second = await rotate(first.refreshToken);
    await assert.rejects(rotate(first.refreshToken));
    assert.equal(
      (await request('/account/me', second.accessToken)).status,
      401,
    );
    await assert.rejects(rotate(second.refreshToken));
    const again = await requestOtp(email, sender);
    const session = await verifyOtp(again.challengeId, code, 'New device');
    assert.equal(
      (await request('/providers/health', session.accessToken)).status,
      403,
    );
    const prefs = await request(
      '/account/preferences',
      session.accessToken,
      'PUT',
      { mode: 'FASTEST', maxEtaMinutes: 20 },
    );
    assert.equal(prefs.status, 200);
    const otherChallenge = await requestOtp(otherEmail, sender);
    const otherSession = await verifyOtp(
      otherChallenge.challengeId,
      code,
      'Other account',
    );
    const foreignId = otherSession.sessionId;
    assert.equal(
      (
        await request(
          `/account/sessions/${foreignId}`,
          session.accessToken,
          'DELETE',
        )
      ).status,
      204,
    );
    assert.equal(
      (await request('/account/me', session.accessToken)).status,
      200,
    );
    assert.equal(
      (await request('/account/me', otherSession.accessToken)).status,
      200,
    );
    assert.equal(
      (await request('/account/me', 'invalid.jwt.value')).status,
      401,
    );
    const watch = await request(
      '/alerts/watches',
      session.accessToken,
      'POST',
      {
        kind: 'PRICE_DROP',
        pincode: '560001',
        productId: randomUUID(),
        retailer: 'ZEPTO',
        sku: 'sku',
        storeId: 'store',
        sellerId: 'seller',
      },
    );
    assert.equal(watch.status, 201);
    const ownedWatch = await watch.json();
    await request(
      `/alerts/watches/${ownedWatch.id}`,
      otherSession.accessToken,
      'DELETE',
    );
    assert.equal(await prisma.watch.count({ where: { id: ownedWatch.id } }), 1);
    assert.equal(
      (
        await (
          await request('/alerts/watches', otherSession.accessToken)
        ).json()
      ).length,
      0,
    );

    const exported = await (
      await request('/account/export', session.accessToken)
    ).json();
    assert.equal(exported.account.email, email);
    assert.equal(exported.watches.length, 1);
    assert.equal(JSON.stringify(exported).includes('secretHash'), false);
    assert.equal(JSON.stringify(exported).includes('refreshToken'), false);
    assert.equal(
      (
        await request('/account/me', session.accessToken, 'DELETE', {
          confirmation: 'DELETE',
        })
      ).status,
      204,
    );
    assert.equal(
      (await request('/account/me', session.accessToken)).status,
      401,
    );
    assert.equal(await prisma.account.count({ where: { email } }), 0);
  } finally {
    await prisma.account.deleteMany({
      where: { email: { in: [email, otherEmail] } },
    });
    await prisma.loginChallenge.deleteMany({
      where: { email: { in: [email, otherEmail] } },
    });
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve())),
    );
    await prisma.$disconnect();
  }
});
