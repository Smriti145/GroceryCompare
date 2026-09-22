import {
  randomBytes,
  randomInt,
  createHmac,
  timingSafeEqual,
} from 'node:crypto';
import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError } from '../middleware/errors';

const denied = () =>
  new ApiError(
    401,
    'INVALID_CREDENTIALS',
    'Credentials are invalid or expired',
  );
function key() {
  const value = process.env.AUTH_SECRET;
  if (!value || Buffer.byteLength(value) < 32)
    throw new ApiError(
      503,
      'AUTH_NOT_CONFIGURED',
      'Account login is not configured',
    );
  return Buffer.from(value);
}
export const digest = (value: string) =>
  createHmac('sha256', key()).update(value).digest('hex');
const equal = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export interface EmailSender {
  send(email: string, code: string): Promise<void>;
}
export const smtpSender: EmailSender = {
  async send(email, code) {
    if (!process.env.SMTP_URL || !process.env.SMTP_FROM)
      throw new ApiError(
        503,
        'EMAIL_NOT_CONFIGURED',
        'Email login is not configured',
      );
    const transport = nodemailer.createTransport(
      {
        url: process.env.SMTP_URL,
        requireTLS: true,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      },
      { from: process.env.SMTP_FROM },
    );
    try {
      await transport.sendMail({
        to: email,
        subject: 'GroceryCompare sign-in code',
        text: `Your sign-in code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`,
      });
    } finally {
      transport.close();
    }
  },
};
export async function requestOtp(
  email: string,
  sender: EmailSender = smtpSender,
) {
  key();
  const code = String(randomInt(100000, 1000000));
  const challenge = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${email}))`;
    const count = await tx.loginChallenge.count({
      where: { email, createdAt: { gt: new Date(Date.now() - 3600000) } },
    });
    if (count >= 5)
      throw new ApiError(
        429,
        'OTP_LIMIT',
        'Please wait before requesting another code',
      );
    return tx.loginChallenge.create({
      data: {
        email,
        kind: 'EMAIL',
        secretHash: digest(code),
        expiresAt: new Date(Date.now() + 600000),
      },
    });
  });
  try {
    await sender.send(email, code);
  } catch (error) {
    await prisma.loginChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    throw error;
  }
  return { challengeId: challenge.id, expiresInSeconds: 600 };
}
async function createSession(
  tx: Prisma.TransactionClient,
  accountId: string,
  deviceName: string,
) {
  const token = randomBytes(32).toString('base64url');
  const session = await tx.deviceSession.create({
    data: {
      accountId,
      deviceName,
      expiresAt: new Date(Date.now() + 30 * 86400000),
      refreshTokens: { create: { hash: digest(token) } },
    },
  });
  return { session, token };
}
async function tokens(result: Awaited<ReturnType<typeof createSession>>) {
  return {
    accessToken: await new SignJWT({ sid: result.session.id })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(result.session.accountId)
      .setIssuer('grocerycompare')
      .setAudience('grocerycompare-api')
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(key()),
    refreshToken: result.token,
    sessionId: result.session.id,
    expiresInSeconds: 600,
  };
}
export async function verifyOtp(
  challengeId: string,
  code: string,
  deviceName: string,
) {
  const result = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${challengeId}))`;
    const row = await tx.loginChallenge.findUnique({
      where: { id: challengeId },
    });
    if (
      !row ||
      row.kind !== 'EMAIL' ||
      !row.email ||
      row.consumedAt ||
      row.expiresAt <= new Date() ||
      row.attempts >= 5
    )
      return null;
    await tx.loginChallenge.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    if (!equal(row.secretHash, digest(code))) return null;
    await tx.loginChallenge.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    const account = await tx.account.upsert({
      where: { email: row.email },
      create: { email: row.email },
      update: {},
    });
    return createSession(tx, account.id, deviceName);
  });
  if (!result) throw denied();
  return tokens(result);
}
export async function rotate(token: string) {
  const hash = digest(token);
  const result = await prisma.$transaction(async tx => {
    const found = await tx.refreshToken.findUnique({ where: { hash } });
    if (!found) return null;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${found.sessionId}))`;
    const row = await tx.refreshToken.findUnique({
      where: { hash },
      include: { session: true },
    });
    if (!row || row.session.revokedAt || row.session.expiresAt <= new Date())
      return null;
    // Commit family revocation on replay; throwing inside the transaction would undo it.
    if (row.usedAt) {
      await tx.deviceSession.update({
        where: { id: row.sessionId },
        data: { revokedAt: new Date() },
      });
      return null;
    }
    const next = randomBytes(32).toString('base64url');
    await tx.refreshToken.update({
      where: { hash },
      data: { usedAt: new Date() },
    });
    await tx.refreshToken.create({
      data: { hash: digest(next), sessionId: row.sessionId },
    });
    return { session: row.session, token: next };
  });
  if (!result) throw denied();
  return tokens(result);
}
export const requireAccount: RequestHandler = async (req, res, next) => {
  const authorization = req.header('authorization');
  if (!authorization?.startsWith('Bearer ')) throw denied();
  let payload;
  try {
    payload = (
      await jwtVerify(authorization.slice(7), key(), {
        algorithms: ['HS256'],
        issuer: 'grocerycompare',
        audience: 'grocerycompare-api',
        requiredClaims: ['exp', 'iat', 'sub', 'sid'],
      })
    ).payload;
  } catch {
    throw denied();
  }
  if (typeof payload.sid !== 'string' || typeof payload.sub !== 'string')
    throw denied();
  const session = await prisma.deviceSession.findUnique({
    where: { id: payload.sid },
    include: { account: true },
  });
  if (
    !session ||
    session.accountId !== payload.sub ||
    session.revokedAt ||
    session.expiresAt <= new Date()
  )
    throw denied();
  res.locals.account = session.account;
  res.locals.sessionId = session.id;
  next();
};
export const requireAdmin: RequestHandler = (_req, res, next) => {
  if (res.locals.account?.role !== 'ADMIN')
    throw new ApiError(403, 'FORBIDDEN', 'Administrator role required');
  next();
};
function oidcConfig() {
  const {
    OIDC_ISSUER: issuer,
    OIDC_AUDIENCE: audience,
    OIDC_JWKS_URL: url,
  } = process.env;
  if (
    !issuer ||
    !audience ||
    !url ||
    !url.startsWith('https://') ||
    !issuer.startsWith('https://')
  )
    throw new ApiError(
      503,
      'SOCIAL_NOT_CONFIGURED',
      'Social login is not configured',
    );
  return { issuer, audience, url };
}
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
export async function socialChallenge() {
  key();
  oidcConfig();
  const nonce = randomBytes(32).toString('base64url');
  const row = await prisma.loginChallenge.create({
    data: {
      kind: 'OIDC',
      secretHash: digest(nonce),
      expiresAt: new Date(Date.now() + 600000),
    },
  });
  return { challengeId: row.id, nonce };
}
export async function socialLogin(
  challengeId: string,
  idToken: string,
  deviceName: string,
) {
  const config = oidcConfig();
  jwks ??= createRemoteJWKSet(new URL(config.url), { timeoutDuration: 5000 });
  let claims;
  try {
    claims = (
      await jwtVerify(idToken, jwks, {
        issuer: config.issuer,
        audience: config.audience,
        algorithms: ['RS256', 'ES256'],
        requiredClaims: ['sub', 'exp', 'iat', 'nonce'],
        maxTokenAge: '10m',
      })
    ).payload;
  } catch {
    throw denied();
  }
  if (
    !claims.sub ||
    typeof claims.nonce !== 'string' ||
    !z.string().email().max(254).safeParse(claims.email).success ||
    typeof claims.email !== 'string' ||
    claims.email_verified !== true ||
    (claims.azp && claims.azp !== config.audience)
  )
    throw denied();
  const subject = claims.sub,
    nonce = claims.nonce,
    email = claims.email.toLowerCase();
  const result = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${challengeId}))`;
    const challenge = await tx.loginChallenge.findUnique({
      where: { id: challengeId },
    });
    if (
      !challenge ||
      challenge.kind !== 'OIDC' ||
      challenge.consumedAt ||
      challenge.expiresAt <= new Date() ||
      !equal(challenge.secretHash, digest(nonce))
    )
      return null;
    await tx.loginChallenge.update({
      where: { id: challengeId },
      data: { consumedAt: new Date() },
    });
    const identity = await tx.socialIdentity.findUnique({
      where: { issuer_subject: { issuer: config.issuer, subject } },
    });
    if (identity) return createSession(tx, identity.accountId, deviceName);
    // Never silently merge a new provider identity into an existing account.
    if (await tx.account.findUnique({ where: { email } })) return null;
    const account = await tx.account.create({
      data: {
        email,
        identities: { create: { issuer: config.issuer, subject } },
      },
    });
    return createSession(tx, account.id, deviceName);
  });
  if (!result) throw denied();
  return tokens(result);
}
