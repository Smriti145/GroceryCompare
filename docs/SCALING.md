# Scaling and operations

## Local startup

Use Node 22.13+ and PostgreSQL 16+. Run `npm ci` and `npm run db:setup` for the local development database. For a separately provisioned database, explicitly configure `DATABASE_URL`, generate Prisma, and run `npm run db:migrate --workspace @grocerycompare/api`.

Start Redis using `redis-server --bind 127.0.0.1 --port 6379 --appendonly yes --maxmemory-policy noeviction`, or the `redis` service in `compose.ops.yaml`. In separate terminals:

```sh
REDIS_URL=redis://127.0.0.1:6379 npm run api:dev
REDIS_URL=redis://127.0.0.1:6379 npm run worker --workspace @grocerycompare/api
npm start
npm run android
```

Open `http://localhost:5001/admin/`. Login requires `AUTH_SECRET`, SMTP configuration and a verified account promoted using `npm run account:role --workspace @grocerycompare/api -- EMAIL ADMIN`. Dashboard tokens remain in memory; reload requires login. Ordinary users cannot access admin APIs.

No retailer feed is enabled without authorized feed credentials. No live prices are fabricated. Development servers and unauthenticated local Redis must remain private.

## Caching and durable work

Redis is optional in development and required in production. Search/offer caches use 10-second TTLs, coverage/ETA 15 seconds, popularity 30–60 seconds. Keys include pincode, filters, store identity and GPS coordinates where applicable. Imports and reviewed catalog/mapping edits increment location revisions. TTL bounds stale reads after failed invalidation. Checkout rechecks expiry without refreshing source timestamps. Coalescing is per process. Cache failures fall back to Postgres; configured Redis API/login rate limiting fails closed.

BullMQ runs price refresh/notification evaluation each minute, snapshots/reconciliation hourly, and cleanup daily. Jobs retry four times with exponential backoff, use distributed locks and bounded batches, and retain successes for one day and failures for seven days (10,000-record caps). Notifications use the existing in-app inbox; push/email delivery is not configured. Snapshots preserve source observation time and use uniqueness constraints, never manufactured timestamps. Reconciliation quarantines conflicting mappings.

Production Redis needs TLS, authentication, persistence, backups, memory monitoring and `noeviction`. Local cache and queue share Redis; isolate them when workload/memory budgets warrant it. Durable work has no in-memory substitute.

## Database/search

New models cover retailers, stores/warehouses, retailer listings, delivery-estimate observations, saved carts, expiring shared baskets, search aliases/trends, reports and audit records. Store/listing foreign keys and unique identities protect offers. Catalog/store/listing/saved-cart soft deletes are available. Accounts use deletion with anonymous audit references.

Full-text and trigram indexes support category/brand/title search and typo tolerance, with curated common-name/Hindi aliases. Search filters serviceability, stock and freshness before pagination. Cursor fingerprints bind location/query/filter/limit; traversal is capped at 10,000 results. Recent searches stay on-device; aggregate popularity is per pincode. Matching still has its separate 10,000-product candidate limit. OpenSearch remains a measured future upgrade, not a deployed component.

CI applies migrations to fresh Postgres. The manual production migration workflow is restricted to main and the GitHub `production` environment, using `MIGRATION_DATABASE_URL`. Configure environment reviewers and test backup restoration first. Provision `pg_trgm` through your database administrator if extension creation is restricted. Run migrations once before deploying API/workers. On an already large/busy database, stage index creation concurrently rather than applying this initial migration during peak traffic.

## Mobile/admin

Mobile adds system/light/dark themes, skeletons, cached images with fallback, infinite scrolling, recent/popular search, saved/shared baskets, and same-brand/title/variant/category pack alternatives. Existing offline cart, quantities, location selector, pull-to-refresh and retry states remain. Equivalent packs require exact physical quantity and user confirmation. Per-item savings exclude fees; final savings require basket comparison. Shared links include items/quantities/pincode, expire after seven days and require the installed app. HTTPS universal links need a verified domain and are not configured.

The admin dashboard shows provider health, unmatched/ambiguous listings, stale offers, catalog/image quality, reports, alert volumes, job counts, API latency and audit evidence. Mapping/product overrides require reasons. Mapping changes invalidate old current offers pending reimport. Overview tables are bounded; large deployments need pagination/filtering.

## Monitoring

Set the same random `METRICS_TOKEN` in API/worker processes and ignored `ops/monitoring/metrics-token`. API `/metrics` and the worker listener require bearer authentication. Worker metrics default to loopback port 5002; configure `WORKER_METRICS_HOST` for a private Docker-reachable interface. Labels use route patterns, not raw URLs or user IDs. Logs omit request bodies and credentials.

Set a unique `GRAFANA_ADMIN_PASSWORD`, then:

```sh
docker compose -f compose.yaml -f compose.ops.yaml --profile monitoring up -d
```

Prometheus targets host ports 5001/5002; adjust for your topology. Grafana runs on loopback port 3001 with the provisioned dashboard. Blackbox probes readiness; rules cover readiness/scrape failure, p95 latency, errors and job failures. Alertmanager currently uses a local sink: configure and test a receiver before relying on notifications. These are deployment templates, not a deployed monitoring service.

`SENTRY_DSN` enables sanitized error reports; `OTEL_EXPORTER_OTLP_ENDPOINT` enables allowlisted OTLP traces, excluding SQL, URL queries, headers, exception events and user attributes. The local collector prints basic trace summaries; configure durable storage for production. Health/metrics endpoints bypass public HTTPS enforcement for internal scraping and must be network-restricted. Public production API/admin traffic requires HTTPS and correctly configured trusted-proxy hops.

## Security and retention

Helmet/CSP, schema/size limits, RBAC and distributed rate limiting are enforced in code. Use verified TLS for Redis/Postgres and inject secrets from a managed store. Hosting must provide TLS certificates, encrypted storage/backups, network controls, restore tests and secret rotation. `ops/database/roles.sql` defines a runtime role without DDL or audit-evidence update permissions; adapt database name and provision login secrets separately.

CodeQL, Dependabot and audit workflows run after these changes reach GitHub. Do not treat a local build as enterprise certification. Patched dependency overrides must be checked during future Metro/Prisma upgrades.

Daily cleanup removes expired shares, challenges/sessions one day after expiry, alerts after 90 days, deleted saved carts after 30 days, inactive search trends after 30 days, and current offers older than 30 days. Raw price history, audit evidence and user reports require an operator-defined retention policy before launch. See [privacy template](PRIVACY.md).

## Verification

```sh
npm run check
npm run test:integration
REDIS_URL=redis://localhost:6379/9 npm run test:redis --workspace @grocerycompare/api
```

Use isolated Redis DB 9 for tests. Legacy demo integration tests need fresh development fixtures (`npm run db:refresh`). Never seed production. Verify native builds and monitoring against your deployment environment.
