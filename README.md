# GroceryCompare

React Native grocery basket comparison for Blinkit, Zepto, and Swiggy, backed by Express and PostgreSQL. This repository is a development foundation with sample offers; it does not fetch live retailer prices or transfer baskets to retailer checkout.

## Quick start with installed PostgreSQL

PostgreSQL is now configured as a project-owned local database. With PostgreSQL binaries on your PATH:

```sh
npm run db:setup       # First run: create, migrate and seed the database
npm run backend:dev   # Terminal 1: API on port 5001
npm start             # Terminal 2: Metro
npm run android       # Terminal 3: Android emulator/device
```

On subsequent runs use `npm run db:start`. Use `npm run db:stop` to stop it without deleting data, and `npm run db:status` to inspect it. The database listens only on 127.0.0.1:55440, uses local trust authentication for development, and stores data in ignored `backend/.local/`. This is not a production database configuration.

Generated `backend/.env.local` selects this database for backend development while preserving your existing `.env`. Explicit environment variables take precedence; production ignores `.env.local`. `db:setup` passes the correct database URL to Prisma migrations. When running Prisma CLI directly, explicitly set `DATABASE_URL` for the intended database because Prisma does not load `.env.local` automatically. Rerunning setup refreshes the sample catalog without deleting products.

The mobile app now includes category filtering, product price cards, visible basket quantities, confirmation before clearing the basket, and highlighted best-value comparisons. Categories are filtered by the API across the full catalog, not just the loaded page.

## Local setup

Use Node 22.11+ and the React Native native build prerequisites. Backend and mobile have separate lockfiles.

```sh
npm ci
npm ci --prefix backend
cp backend/.env.example backend/.env
# Requires Docker Compose; alternatively provision a local PostgreSQL database.
docker compose up -d --wait
npm --prefix backend run prisma:generate
npm --prefix backend run db:migrate
npm --prefix backend run db:seed
npm --prefix backend run dev
```

In separate terminals run `npm start` and `npm run android` or `npm run ios`. For iOS, run `bundle install` and then `bundle exec pod install` from `ios` after adding native dependencies. AsyncStorage is a native dependency and requires a native rebuild.

Development defaults use the Android emulator host or iOS simulator localhost. For a physical device, generate public configuration before building:

```sh
API_BASE_URL=http://YOUR_LAN_IP:5001/api DEFAULT_LOCATION=DEMO npm run configure
```

Only public settings belong in mobile configuration. Never put credentials in the app bundle. Release requests require HTTPS. Example release configuration:

```sh
NODE_ENV=production API_BASE_URL=https://api.example.com/api DEFAULT_LOCATION=560001 npm run configure
```

Area codes identify offer datasets; they do not currently perform address geocoding or retailer serviceability checks. The DEMO catalog expires after `OFFER_MAX_AGE_SECONDS`; rerun the demo seed to refresh it. Demo seeding is disabled with `NODE_ENV=production`. Seeding upserts deterministic sample products and DEMO offers in a transaction without deleting the catalog.

## Verification

```sh
npm run check
# Integration checks require a migrated, seeded test database; never point tests at production.
DATABASE_URL=postgresql://USER:PASSWORD@HOST/TEST_DB npm --prefix backend run test:integration
```

`check` runs mobile type checking, lint, the mobile render test, backend type checking, comparison regression tests, and the backend build. CI additionally provisions PostgreSQL, runs migrations and the seed, then exercises the HTTP API. Native simulator/device builds remain a separate release check.

## Architecture and API

- `shared/contracts.ts`: shared request/response types, money represented in integer paise.
- `src`: mobile screens, persisted cart/preferences, paginated server search, cancellable API requests and retry states.
- `backend/src/domain`: deterministic comparison and request validation.
- `backend/src/repositories`: bounded database queries for requested products and paginated catalog retrieval.
- `backend/prisma`: relational schema, migrations and sample data.

Endpoints:

| Endpoint | Input / behavior |
| --- | --- |
| `GET /health/live` | Process liveness |
| `GET /health/ready` | Database readiness; 503 when unavailable |
| `GET /api/products` | `location` required; optional `search`, `category`, UUID `cursor`, `limit` (1–100) |
| `GET /api/products/:id` | UUID product ID and required `location` |
| `POST /api/compare` | `{ "location": "DEMO", "items": [{ "productId": "UUID", "quantity": 2 }] }` |

Comparisons accept 1–100 distinct product IDs and quantities of 1–99. A platform is eligible only if every line has an available, fresh offer at the requested location with an equivalent pack size. Matching does not infer product identity. Totals exclude checkout fees and discounts. Delivery estimates use the slowest item estimate, not a sum or a retailer delivery guarantee. Equal totals prefer faster delivery, then a deterministic platform ordering. No eligible platform returns a null recommendation.

Responses include request IDs. Errors return a stable code and safe message without internal exception details. The backend applies bounded request bodies, per-process rate limits, security headers, an explicit browser-origin allowlist and graceful shutdown.

## Database rollout

For a fresh database, use `db:migrate`. For an existing database created using the original schema, take a backup and compare it with `202609090001_baseline` before baselining with Prisma migrate resolve; do not apply the CREATE TABLE baseline over existing tables. Review the hardening migration on a restored staging copy first. It intentionally fails on duplicate retailer SKU/location records or invalid prices rather than deleting data. Ambiguous legacy pack sizes remain ineligible until curated.

Production: generate the Prisma client, run the build, apply reviewed migrations as a separate release step, then `npm --prefix backend start`. Compiled entry point is `backend/dist/backend/src/server.js`; compiled shared contracts are in the same dist tree. Do not run development seed jobs in production.

## Production work still required

This code has not been certified for enterprise operation. Before a real launch:

- Integrate authorized retailer feeds with location, pack identity, stock, freshness, retries and ingestion monitoring. No ingestion worker or retailer credentials are included.
- Provision managed PostgreSQL with connection limits, backups and tested restores; establish staging migration and rollback procedures.
- Terminate HTTPS at a trusted gateway, configure CORS and exact trusted proxy hops, manage backend secrets, and disable demo data.
- Replace per-process rate limiting with a gateway/shared store before scaling to multiple replicas. Set capacity targets and run load tests before choosing cache or replica sizes.
- Collect structured logs and metrics centrally, alert on latency, readiness failures and stale offers, and agree on service objectives.
- Add authentication and authorization when introducing accounts, administrative tools or private data. Current catalog and comparison endpoints are intentionally public, and there are no administrative write endpoints.
- Verify Android/iOS builds, accessibility and user journeys on supported devices. Add signing, release distribution and native end-to-end tests to the release pipeline.
