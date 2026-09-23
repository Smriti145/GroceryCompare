import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';
import { timingSafeEqual } from 'node:crypto';
import { RequestHandler } from 'express';
export const registry = new Registry();
collectDefaultMetrics({ register: registry });
export const requests = new Counter({ name: 'gc_http_requests_total', help: 'HTTP requests by route and status', labelNames: ['method', 'route', 'status'], registers: [registry] });
export const latency = new Histogram({ name: 'gc_http_duration_seconds', help: 'API response duration', labelNames: ['method', 'route'], buckets: [.01, .05, .1, .25, .5, 1, 3, 10], registers: [registry] });
export const jobs = new Counter({ name: 'gc_jobs_total', help: 'Background job outcomes', labelNames: ['kind', 'status'], registers: [registry] });
export const metricsEndpoint: RequestHandler = async (req, res) => {
  const expected = process.env.METRICS_TOKEN, supplied = req.header('authorization')?.replace(/^Bearer /, '');
  if (!expected || !supplied || Buffer.byteLength(expected) !== Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) { res.status(401).end(); return; }
  res.setHeader('Content-Type', registry.contentType); res.end(await registry.metrics());
};
