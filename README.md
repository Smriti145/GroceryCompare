# GroceryCompare

GroceryCompare is a React Native app with an Express and PostgreSQL API for location-aware grocery checkout comparison. It supports validated coverage, canonical-product matching, fee-inclusive totals, and split-basket planning. No live retailer feeds are connected yet; the app shows no verified coverage until authorized store and offer data is imported. Development sample data remains isolated from the new checkout flow.

See [Checkout engine](apps/api/CHECKOUT_ENGINE.md) for endpoints, imports, cost rules, search limits, and remaining geocoder/retailer integration work.

## Repository layout

```text
apps/
  mobile/                 React Native application (Android and iOS)
  api/                    Express API, Prisma schema, migrations, and tests
packages/
  contracts/              Types shared by the mobile app and API
.github/workflows/        Continuous integration
compose.yaml              Optional PostgreSQL container
package.json              Workspace commands
```

Generated dependencies and build output are ignored. Install JavaScript dependencies once at the repository root; npm workspaces manage both applications through a single lockfile.

## Quick start with local PostgreSQL

Use Node 22.11+ and install the React Native native build prerequisites. With PostgreSQL binaries on your `PATH`:

```sh
npm ci
npm run db:setup       # Create, migrate, and seed the project database
npm run api:dev        # Terminal 1: API on port 5001
npm start              # Terminal 2: Metro
npm run android        # Terminal 3: Android emulator or device
```

On later runs use `npm run db:start`. Use `npm run db:stop` to stop PostgreSQL without deleting data and `npm run db:status` to inspect it. The database listens on `127.0.0.1:55440` and stores its ignored local data in `apps/api/.local/`.

The generated `apps/api/.env.local` selects this database for API development while preserving an existing `.env`. Explicit environment variables take precedence. Rerunning `npm run db:setup` refreshes sample offers without deleting the catalog.

## Setup with Docker

```sh
npm ci
cp apps/api/.env.example apps/api/.env
docker compose up -d --wait
npm run prisma:generate --workspace @grocerycompare/api
npm run db:migrate --workspace @grocerycompare/api
npm run db:seed --workspace @grocerycompare/api
npm run api:dev
```

For iOS, run `bundle install` from `apps/mobile`, then `bundle exec pod install` from `apps/mobile/ios` after adding native dependencies. AsyncStorage requires a native rebuild.

Development uses the Android emulator host or iOS simulator localhost. For a physical device, generate public mobile configuration before building:

```sh
API_BASE_URL=http://YOUR_LAN_IP:5001/api npm run configure
```

Only public settings belong in the mobile bundle. Release requests require HTTPS:

```sh
NODE_ENV=production API_BASE_URL=https://api.example.com/api DEFAULT_LOCATION=560001 npm run configure
```

The mobile app requires a six-digit pincode and verified, unexpired store coverage. GPS/address resolution requires a geocoder integration. Sample offers do not populate this checkout flow; import authorized offers and coverage using [the checkout guide](apps/api/CHECKOUT_ENGINE.md). Production mode disables demo seeding and legacy demo routes.

## Commands

| Command | Purpose |
| --- | --- |
| `npm start` | Start React Native Metro |
| `npm run android` | Build and launch Android |
| `npm run ios` | Build and launch iOS |
| `npm run api:dev` | Start the API with reloads |
| `npm run db:setup` | Start, migrate, and seed local PostgreSQL |
| `npm run db:refresh` | Refresh deterministic demo offers |
| `npm run check` | Run lint, type checks, tests, and the API build |
| `npm run test:integration` | Exercise the HTTP API against a test database |

Integration checks require a migrated, seeded test database. Never point them at production:

```sh
DATABASE_URL=postgresql://USER:PASSWORD@HOST/TEST_DB npm run test:integration
```

## Architecture and API

The authorized-feed import foundation and its current limitations are documented in
[Retailer feeds](apps/api/RETAILER_FEEDS.md). No retailer is connected yet.

- `apps/mobile/src` contains screens, persisted cart preferences, paginated search, cancellable requests, and retry states.
- `apps/api/src/domain` contains deterministic comparison and request validation.
- `apps/api/src/repositories` contains bounded database queries and paginated catalog retrieval.
- `apps/api/prisma` contains the relational schema, migrations, and deterministic sample data.
- `packages/contracts/index.ts` defines shared request and response types; money uses integer paise.

| Endpoint | Input or behavior |
| --- | --- |
| `GET /health/live` | Process liveness |
| `GET /health/ready` | Database readiness; returns 503 when unavailable |
| `POST /api/checkout/location` | Resolves location and returns verified serving stores and local ETAs; GPS/address needs a configured geocoder |
| `GET /api/checkout/products` | Requires `pincode`; accepts `search`, `category`, UUID `cursor`, and `limit` |
| `POST /api/checkout/compare` | Accepts `{ "location": { "pincode": "560001" }, "items": [{ "productId": "UUID", "quantity": 2 }], "maxDeliveries": 2 }`; optional `couponCode` |

Comparisons accept 1–100 distinct products and quantities from 1–99. Plans require fresh stock, verified store coverage, equivalent packs, and a complete checkout tariff. Totals include delivery, handling, surge and small-cart fees, eligible public coupons, and minimum-order rules. The engine supports verified membership entitlements, but the public API grants none until account verification is integrated. Split plans recalculate fees for each store; bounded searches disclose when incomplete. These are tariff estimates, not reserved retailer checkout quotes. See [Checkout engine](apps/api/CHECKOUT_ENGINE.md) for matching, imports, and rollout limits. Legacy `/api/products` and `/api/compare` endpoints are available only outside production.

Responses include request IDs. Errors use stable codes and safe messages. The API applies bounded request bodies, per-process rate limits, security headers, an explicit browser-origin allowlist, and graceful shutdown. Temporary database failures return `503 DATABASE_UNAVAILABLE` with a retry hint.

## Production rollout

For a fresh database, use the API `db:migrate` script. For a database created from the original schema, back it up and compare it with migration `202609090001_baseline` before using Prisma migrate resolve. Review the hardening migration on a restored staging copy; it fails on duplicate retailer records or invalid prices instead of deleting data.

Generate the Prisma client, run the build, and apply reviewed migrations as a separate release step. Start the compiled API with `npm run start --workspace @grocerycompare/api`; its entry point is `apps/api/dist/apps/api/src/server.js`.

Before a real launch, connect authorized retailer feeds, provision managed PostgreSQL with tested backups, centralize logs and metrics, move rate limiting to shared infrastructure, add authentication for private or administrative features, run capacity tests, and validate signed Android and iOS releases on supported devices.
