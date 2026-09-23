import { redisRateStore } from '../infrastructure/redis';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import prisma from '../config/prisma';
import { preferencesSchema } from '../domain/preferences';
import {
  requireAccount,
  requestOtp,
  verifyOtp,
  rotate,
  socialChallenge,
  socialLogin,
  EmailSender,
} from '../auth/service';
const email = z
  .string()
  .email()
  .max(254)
  .transform(v => v.toLowerCase());
const deviceName = z.string().trim().min(1).max(100);
export function accountRoutes(sender?: EmailSender) {
  const router = Router();
  router.use(
    rateLimit({
      store: redisRateStore('account'), passOnStoreError: false, windowMs: 60000,
      limit: 30,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );
  router.post('/otp', async (req, res) => {
    const body = z.object({ email }).strict().parse(req.body);
    res.json(await requestOtp(body.email, sender));
  });
  router.post('/verify', async (req, res) => {
    const b = z
      .object({
        challengeId: z.string().uuid(),
        code: z.string().regex(/^\d{6}$/),
        deviceName,
      })
      .strict()
      .parse(req.body);
    res.json(await verifyOtp(b.challengeId, b.code, b.deviceName));
  });
  router.post('/refresh', async (req, res) => {
    const b = z
      .object({ refreshToken: z.string().min(40).max(100) })
      .strict()
      .parse(req.body);
    res.json(await rotate(b.refreshToken));
  });
  router.post('/social/challenge', async (_req, res) => {
    res.json(await socialChallenge());
  });
  router.post('/social', async (req, res) => {
    const b = z
      .object({
        challengeId: z.string().uuid(),
        idToken: z.string().min(1).max(16000),
        deviceName,
      })
      .strict()
      .parse(req.body);
    res.json(await socialLogin(b.challengeId, b.idToken, b.deviceName));
  });
  router.use(requireAccount);
  router.get('/me', (_req, res) => {
    const a = res.locals.account;
    res.json({
      id: a.id,
      email: a.email,
      role: a.role,
      preferences: preferencesSchema.parse(a.preferences),
    });
  });
  router.put('/preferences', async (req, res) => {
    const preferences = preferencesSchema.parse(req.body);
    await prisma.account.update({
      where: { id: res.locals.account.id },
      data: { preferences },
    });
    res.json(preferences);
  });
  router.get('/sessions', async (_req, res) => {
    res.json(
      await prisma.deviceSession.findMany({
        where: { accountId: res.locals.account.id },
        select: {
          id: true,
          deviceName: true,
          createdAt: true,
          expiresAt: true,
          revokedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  });
  router.delete('/sessions/:id', async (req, res) => {
    await prisma.deviceSession.updateMany({
      where: {
        id: z.string().uuid().parse(req.params.id),
        accountId: res.locals.account.id,
      },
      data: { revokedAt: new Date() },
    });
    res.status(204).end();
  });
  router.delete('/sessions', async (_req, res) => {
    await prisma.deviceSession.updateMany({
      where: { accountId: res.locals.account.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.status(204).end();
  });
  router.get('/export', async (_req, res) => {
    const accountId = res.locals.account.id;
    const [sessions, watches, alerts, identities, savedCarts, reports] = await Promise.all([
      prisma.deviceSession.findMany({
        where: { accountId },
        select: {
          id: true,
          deviceName: true,
          createdAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      }),
      prisma.watch.findMany({ where: { accountId } }),
      prisma.alert.findMany({ where: { accountId } }),
      prisma.socialIdentity.findMany({
        where: { accountId },
        select: { issuer: true, subject: true },
      }),
      prisma.savedCart.findMany({ where: { accountId } }),
      prisma.userReport.findMany({ where: { accountId } }),
    ]);
    res
      .attachment('grocerycompare-account.json')
      .json({
        account: res.locals.account,
        sessions,
        watches,
        alerts,
        identities, savedCarts, reports,
      });
  });
  router.delete('/me', async (req, res) => {
    z.object({ confirmation: z.literal('DELETE') })
      .strict()
      .parse(req.body);
    await prisma.$transaction(async tx => {
      await tx.loginChallenge.deleteMany({
        where: { email: res.locals.account.email },
      });
      await tx.account.delete({ where: { id: res.locals.account.id } });
    });
    res.status(204).end();
  });
  return router;
}
