# GroceryCompare

GroceryCompare is a React Native app with an Express and PostgreSQL API for comparing grocery baskets across Blinkit, Zepto, and Swiggy. The repository includes sample offers for development; it does not fetch live retailer prices or transfer baskets to checkout.

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
API_BASE_URL=http://YOUR_LAN_IP:5001/api DEFAULT_LOCATION=DEMO npm run configure
```

Only public settings belong in the mobile bundle. Release requests require HTTPS:

```sh
NODE_ENV=production API_BASE_URL=https://api.example.com/api DEFAULT_LOCATION=560001 npm run configure
```

Area codes identify offer datasets; they do not perform address geocoding or retailer serviceability checks. The DEMO catalog expires after `OFFER_MAX_AGE_SECONDS`; use `npm run db:refresh` to refresh its timestamps. Production mode disables demo seeding.

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

- `apps/mobile/src` contains screens, persisted cart preferences, paginated search, cancellable requests, and retry states.
- `apps/api/src/domain` contains deterministic comparison and request validation.
- `apps/api/src/repositories` contains bounded database queries and paginated catalog retrieval.
- `apps/api/prisma` contains the relational schema, migrations, and deterministic sample data.
- `packages/contracts/index.ts` defines shared request and response types; money uses integer paise.

| Endpoint | Input or behavior |
| --- | --- |
| `GET /health/live` | Process liveness |
| `GET /health/ready` | Database readiness; returns 503 when unavailable |
| `GET /api/products` | Requires `location`; accepts `search`, `category`, UUID `cursor`, and `limit` from 1 to 100 |
| `GET /api/products/:id` | Requires a UUID product ID and `location` |
| `POST /api/compare` | Accepts `{ "location": "DEMO", "items": [{ "productId": "UUID", "quantity": 2 }] }` |

Comparisons accept 1–100 distinct products and quantities from 1–99. A retailer is eligible only when every line has an available, fresh offer for the requested location with an equivalent pack size. Totals exclude checkout fees and discounts. Equal totals prefer faster delivery and then stable platform order.

Responses include request IDs. Errors use stable codes and safe messages. The API applies bounded request bodies, per-process rate limits, security headers, an explicit browser-origin allowlist, and graceful shutdown. Temporary database failures return `503 DATABASE_UNAVAILABLE` with a retry hint.

## Production rollout

For a fresh database, use the API `db:migrate` script. For a database created from the original schema, back it up and compare it with migration `202609090001_baseline` before using Prisma migrate resolve. Review the hardening migration on a restored staging copy; it fails on duplicate retailer records or invalid prices instead of deleting data.

Generate the Prisma client, run the build, and apply reviewed migrations as a separate release step. Start the compiled API with `npm run start --workspace @grocerycompare/api`; its entry point is `apps/api/dist/apps/api/src/server.js`.

Before a real launch, connect authorized retailer feeds, provision managed PostgreSQL with tested backups, centralize logs and metrics, move rate limiting to shared infrastructure, add authentication for private or administrative features, run capacity tests, and validate signed Android and iOS releases on supported devices.
