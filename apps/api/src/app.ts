import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env';
import prisma from './config/prisma';
import productRoutes from './routes/products.routes';
import comparisonRoutes from './routes/comparison.routes';
import { checkoutRoutes } from './routes/checkout.routes';
import { ApiError, errorHandler } from './middleware/errors';
const requestIdPattern = /^[A-Za-z0-9_-]{8,64}$/;
export function createApp() {
  const app = express();
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
    res.on('finish', () =>
      console.info(
        JSON.stringify({
          level: 'info',
          event: 'request',
          requestId: res.locals.requestId,
          method: _req.method,
          path: _req.originalUrl.split('?')[0],
          status: res.statusCode,
          durationMs: Math.round(performance.now() - start),
        }),
      ),
    );
    next();
  });
  app.use(helmet());
  const origins = env.CORS_ORIGINS.split(',')
    .map(value => value.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origins.includes(origin)) callback(null, true);
        else
          callback(
            new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed'),
          );
      },
    }),
  );
  app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });
  app.use(
    '/api',
    rateLimit({
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
  if (env.NODE_ENV !== 'production') app.use('/api/compare', comparisonRoutes);
  app.use((_req, _res, next) =>
    next(new ApiError(404, 'NOT_FOUND', 'Endpoint not found')),
  );
  app.use(errorHandler);
  return app;
}
