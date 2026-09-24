import { env } from './config/env';
import path from 'node:path';
import { adminRoutes } from './routes/admin.routes';
import { searchRoutes } from './routes/search.routes';
import { cartRoutes, shareRoutes, reportRoutes } from './routes/cart.routes';
// Load explicit/local configuration before Prisma's dependency graph initializes.
import { redis, redisRateStore } from './infrastructure/redis';
import { requests, latency, metricsEndpoint } from './infrastructure/metrics';
import { providerRoutes } from './integrations/poll-feed';
import { accountRoutes } from './routes/account.routes';
import { historyRoutes } from './routes/history.routes';
import { alertsRoutes } from './routes/alerts.routes';
import { EmailSender } from './auth/service';
import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import prisma from './config/prisma';
import productRoutes from './routes/products.routes';
import comparisonRoutes from './routes/comparison.routes';
import { checkoutRoutes } from './routes/checkout.routes';
import { ApiError, errorHandler } from './middleware/errors';
const requestIdPattern = /^[A-Za-z0-9_-]{8,64}$/;
export function createApp(options: { emailSender?: EmailSender } = {}) {
  const app = express();
  if (env.NODE_ENV === 'production' && !redis)
    throw new Error('REDIS_URL required in production');
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.use((_req, res, next) => {
    const start = performance.now();
    const suppliedRequestId = _req.header('x-request-id');
    res.locals.requestId =
      suppliedRequestId && requestIdPattern.test(suppliedRequestId)
        ? suppliedRequestId
        : randomUUID();
    res.setHeader('X-Request-ID', res.locals.requestId);
    res.setHeader('Cache-Control', 'no-store');
    res.on('finish', () => {
      const route = reqRoute(_req.baseUrl, _req.route?.path);
      requests.inc({
        method: _req.method,
        route,
        status: String(res.statusCode),
      });
      latency.observe(
        { method: _req.method, route },
        (performance.now() - start) / 1000,
      );
      console.info(
        JSON.stringify({
          level: 'info',
          event: 'request',
          requestId: res.locals.requestId,
          method: _req.method,
          route,
          status: res.statusCode,
          durationMs: Math.round(performance.now() - start),
        }),
      );
    });
    next();
  });
  app.use(helmet());
  const origins = env.CORS_ORIGINS.split(',')
    .map(value => value.trim())
    .filter(Boolean);
  app.use(
    cors<express.Request>((req, callback) => {
      const origin = req.header('origin');
      if (
        !origin ||
        origin === `${req.protocol}://${req.get('host')}` ||
        origins.includes(origin)
      )
        callback(null, { origin: true });
      else
        callback(
          new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed'),
        );
    }),
  );
  app.get('/metrics', metricsEndpoint);
  app.use((req, _res, next) => {
    if (
      env.NODE_ENV === 'production' &&
      !req.secure &&
      !req.path.startsWith('/health/')
    )
      return next(new ApiError(426, 'HTTPS_REQUIRED', 'HTTPS is required'));
    next();
  });
  app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      if (redis) await redis.ping();
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });
  app.use(
    '/api',
    rateLimit({
      store: redisRateStore('api'),
      passOnStoreError: false,
      windowMs: 60_000,
      limit: env.RATE_LIMIT_MAX,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, res) =>
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests; please try again shortly',
          },
          requestId: res.locals.requestId,
        }),
    }),
  );
  app.use(express.json({ limit: '32kb' }));
  if (env.NODE_ENV !== 'production') app.use('/api/products', productRoutes);
  app.use('/api/checkout', checkoutRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/carts', cartRoutes);
  app.use('/api/shares', shareRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/admin', adminRoutes);
  app.use(
    '/admin',
    express.static(path.resolve(process.cwd(), '../admin/public')),
  );
  app.use('/api/account', accountRoutes(options.emailSender));
  app.use('/api/history', historyRoutes);
  app.use('/api/alerts', alertsRoutes);
  app.use('/api/providers', providerRoutes);
  if (env.NODE_ENV !== 'production') app.use('/api/compare', comparisonRoutes);
  app.use((_req, _res, next) =>
    next(new ApiError(404, 'NOT_FOUND', 'Endpoint not found')),
  );
  app.use(errorHandler);
  return app;
}

function reqRoute(base: string, route: unknown): string {
  return typeof route === 'string' ? base + route : 'unmatched';
}
