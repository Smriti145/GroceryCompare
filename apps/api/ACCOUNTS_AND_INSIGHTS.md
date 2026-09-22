# Preferences, history, accounts, alerts and resilient feeds

These features use the existing PostgreSQL API and React Native app. No retailer
connection, SMTP account, social client, or push-notification service is provisioned
by this change. Empty history and unavailable-provider states are intentional.

## Start locally

Use Node >=22.13 (the JWT library uses Node's ESM interoperability).

```sh
npm install
npm run db:setup
npm run api:dev
# Separate terminal: polls configured feeds, then evaluates watches every 60 seconds
npm run worker --workspace @grocerycompare/api
```

Production: generate Prisma, review/apply migrations, build, then start the API and
`npm run worker:start --workspace @grocerycompare/api` as separate supervised processes.
The worker handles SIGINT/SIGTERM, completes its current pass, and does not overlap
passes. Use one active feed worker initially; caches and circuit breakers are local
to the process. Per-watch database locks and unique snapshot keys protect overlapping
workers, but distributed provider quota enforcement is not implemented.

One-off commands:

```sh
npm run alerts:run --workspace @grocerycompare/api
npm run feeds:poll --workspace @grocerycompare/api
npm run check
npm run test:integration
```

## Preferences and substitutions

Home → Shopping preferences persists guest preferences on the device. Signed-in users
also save to their account. Login loads account preferences. `/api/account/preferences`
accepts validated PUTs. `/api/checkout/compare` accepts optional `preferences`; a valid
Bearer session supplies saved preferences when no override is given.

- CHEAPEST ranks full payable amounts; FASTEST ranks the last delivery's ETA.
- BALANCED ranks payable paise + ETA minutes × 100 (₹1 per minute). The displayed
  payable amount is unchanged; the UI explains the tradeoff.
- Single-platform, excluded retailers and maximum ETA are hard constraints applied
  before searching. No result is better than silently ignoring a constraint.
- Dietary tags require trusted catalog tags. Unknown tags are excluded. Tags are
  not inferred from names and are not a medical/allergy guarantee.
- Preferred brands prioritize substitution suggestions, not an already selected
  product. Alternatives require matching normalized core title, category, variant
  and pack size; the brand may differ. The user confirms a replacement, and the
  next comparison checks availability/fees. No silent substitutions occur.
- `/api/checkout/substitutions` takes `productId` and `preferences`; candidate
  retrieval is capped at 100 and returns at most 10 suggestions.

The existing bounded search (50,000 states) still discloses truncation. 'Best' now
means best for the selected ranking mode. Savings are relative to that mode's best
single-store plan, not necessarily the cheapest possible single-store plan.

## Price snapshots and analytics

Each validated feed observation inserts an immutable `PriceSnapshot` in the same
transaction as the current offer. The source retailer/SKU/location/store/seller/time
key deduplicates replay. Older observations are retained without replacing newer
current offers. Invalid feeds roll back both current offers and history. Conflicting
values with an identical observation key retain the first accepted observation.
Historical data begins at ingestion; existing prices are not backdated.

`GET /api/history/:productId/series?pincode=560001` enumerates available series.
`GET /api/history/:productId` additionally requires `retailer`, `sku`, `storeId`,
`sellerId`, and `days=7|30`. It never blends different stores or pack identities.

The mobile Product insights screen shows 7/30-day bar graphs, daily latest observed
in-stock prices, window/all-time lows, today's drop vs yesterday, a typical-price
median and volatility. Missing days stay missing. Metrics exclude checkout fees.
UTC calendar days are used. 'Usually' requires at least three prior observed days;
volatility is the coefficient of variation of daily prices, capped at 100. Deal
confidence is an evidence label (3–6 prior days LOW, 7+ HIGH), not a calibrated
probability. Fewer than three days produce INSUFFICIENT_DATA. Last observation time
is visible; history does not establish current stock or guarantee a live quote.
Queries cap at 10,000 observations per series/window and reject excessive windows.
For high-volume feeds, add database-side daily rollups and partition archival before
raising limits. Source snapshots currently have no automatic retention deletion.

## Login and account security

Set these on the API (never in the mobile bundle, Git, or chat):

- `AUTH_SECRET`: at least 32 cryptographically random bytes, stored as a secret string.
- `SMTP_URL`: authenticated SMTP URL; TLS is required by the transport.
- `SMTP_FROM`: authorized sender address.

Email OTP endpoints: `POST /api/account/otp` (`email`), then
`POST /api/account/verify` (`challengeId`, six-digit `code`, `deviceName`).
Codes expire in 10 minutes, allow five attempts, and are HMAC-hashed in the database.
Issuance is limited to five per email/hour with a database lock; endpoint IP limits
are per-process. Codes are never returned to the client or logged. Integration tests
inject an in-memory mail transport and send no email.

Access JWTs last 10 minutes and validate algorithm, issuer, audience and required
claims. Every authenticated request also checks the live device session/account.
Refresh tokens are opaque, hashed, single-use and rotate through
`POST /api/account/refresh`. Reusing a spent token revokes the whole device session.
Clients must serialize refreshes; mobile uses a shared refresh promise. Sessions
have an absolute 30-day expiry. Changing AUTH_SECRET invalidates current tokens.

`GET /api/account/sessions`, `DELETE /api/account/sessions/:id` and
`DELETE /api/account/sessions` support device revocation. Export is
`GET /api/account/export`, excluding all token/OTP hashes. Deletion is
`DELETE /api/account/me` with `{ "confirmation": "DELETE" }`, cascading sessions,
identities, preferences, watches and alerts. Login challenges for the email are
removed too. Retailer market-price history is not personal account data.

Mobile tokens deliberately remain in memory; app restarts require sign-in. Native
Keychain/Keystore persistence and biometric unlock are future integrations. The
mobile app includes email-code login, account export via the native share sheet,
account deletion confirmation, sessions and revocation. It does not yet include
provider-specific native social-login buttons.

Social backend: configure `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL` (HTTPS).
`POST /api/account/social/challenge` returns a one-use challenge/nonce. Use that nonce
in the selected provider's native OIDC flow, then submit `challengeId`, `idToken`,
`deviceName` to `/api/account/social`. Verification pins issuer, audience, RS256/ES256,
JWKS, token age and nonce; verified email is mandatory. Provider identities use
issuer+subject, not email. A new identity never silently merges into an existing
email account; sign in via OTP instead. Provider setup and native SDK testing remain.

Roles are USER/ADMIN; public registration cannot choose a role. An operator with
trusted database access can promote an existing verified account:

```sh
npm run account:role --workspace @grocerycompare/api -- admin@example.com ADMIN
```

Role changes are logged without tokens; authorization reads the current database
role so demotions take effect immediately. Admin-only provider operations are
`GET /api/providers/health` and `POST /api/providers/refresh/:retailer`.

## Alerts

Authenticated `/api/alerts/watches` supports GET/POST, with DELETE by watch ID.
There are up to 100 watches per account. Product PRICE_DROP/BACK_IN_STOCK watches
require an exact product, retailer, SKU, store, seller and pincode. CART_CHEAPER,
ETA_IMPROVEMENT and DEAL watches save items, preferences, pincode and optional coupon.
The default price-drop threshold is 100 paise. Cart alerts recompute full checkout
fees and require a complete search. DEAL means increased eligible coupon/membership
discount on that saved cart; private coupons are not inferred.

The first available observation establishes a baseline without notifying. Later
transitions create a durable inbox alert with transactional baseline update and
unique dedupe key. Unknown/stale data does not become a price or stock change.
Provider stock flags drive stock alerts; they are not order reservations. Unavailable
observations are retried on the next worker pass. Watches retain the preferences at
creation; remove/recreate a watch to change its basket or settings.

`GET /api/alerts?cursor=...` returns newest first, 50 per page. A cursor must belong
to the signed-in account. `PATCH /api/alerts/:id/read` acknowledges an alert.
Deleting a watch removes its associated inbox alerts. Account IDs are always taken
from the authenticated session, never request bodies. Mobile supports product watches,
cart watches, paginated inbox, acknowledgement and watch removal.

Delivery is the in-app inbox only. SMTP is used for sign-in codes, not unsolicited
alert email. Push/email alert delivery requires a provider, user opt-in, delivery
retry/outbox handling, and notification preferences; it is not claimed as complete.

## Resilient retailer ingestion

Each configured endpoint must return the existing authorized normalized feed format:

```text
FEED_BLINKIT_URL=https://your-authorized-feed.example/normalized
FEED_BLINKIT_TOKEN=<server-side token>
```

Equivalent variables exist for ZEPTO, SWIGGY, BIGBASKET and DMART_READY. These are
operator-configured feeds, not retailer APIs discovered or reverse-engineered here.
Authorized provider-specific mapping adapters still need actual retailer contracts.

The shared runner provides 3-second attempts, up to two transient retries,
exponential backoff with jitter, schema validation, a 60-second fallback cache,
and a 30-second circuit after three failed calls. Permanent errors and invalid
schemas are not retried. Same-key calls coalesce; cache keys must include any
request-dependent identity. Feed URLs are server configuration only, redirects are
rejected, bodies cap at 5 MB, and credentials never reach mobile.

Cached results keep original observation times and are not re-imported as fresh.
Existing database offers remain independently subject to expiry. One failed provider
does not cancel successful providers. Health records are shared through PostgreSQL
between worker and API, including failures, calls, latency and success timestamps.
Counters/circuits reset with the worker process; they are operational indicators,
not a durable monitoring time series. Health older than five minutes becomes unknown.
The comparison UI shows unavailable-provider messages alongside remaining quotes.

Before public rollout: connect real providers and SMTP, configure social/native
secure storage if needed, test on native devices, load-test account/watch volume,
use shared rate limiting across API replicas, define audit/retention policies, and
verify actual retailer checkout semantics. Automated checks are not a security audit.
