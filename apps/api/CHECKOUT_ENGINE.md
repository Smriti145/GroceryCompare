# Location, identity and checkout engines

## Current rollout

The mobile app now starts with no delivery location, accepts six-digit Indian
pincodes and uses the checkout endpoints below. DEMO preferences are discarded.
Old catalog/comparison endpoints are available only outside production for legacy
test fixtures. No retailer credentials, live coverage or live fee tariffs are
configured. An empty catalog or `NO_VERIFIED_CHECKOUT` is expected until authorized
data is imported. Test data is never used as evidence of retailer serviceability.

## Location and coverage

- `POST /api/checkout/location`: `{ "pincode": "560001" }`
- Also accepts `{ "latitude": 12.97, "longitude": 77.59 }` or `{ "address": "..." }`
  through the geocoder interface. No provider is configured; these currently return
  `503 GEOCODER_NOT_CONFIGURED`. The mobile selector currently supports pincode.
- A pincode is validated syntactically, not asserted to exist from its shape alone.
- `ServiceArea` stores retailer, seller, store, warehouse, coverage geometry,
  location-specific ETA, source observation time, expiry and complete fee tariff.
- Pincode-only lookups require the provider to guarantee coverage of the entire
  pincode. Smaller regions require resolved GPS within the recorded radius.
  Expired, future, disabled and out-of-area records never qualify.
- Coverage imports expire within 24 hours. Refresh sooner for rapidly changing ETA
  or surge fees. Unknown tariff fields must not be fabricated as zero.

Trusted operator import (not a public write endpoint):

```sh
npm run catalog --workspace @grocerycompare/api -- coverage /absolute/path/coverage.json
```

The file is an array validated by `src/integrations/serviceability.ts`.
It uses the strict tariff schema in `src/domain/checkout.ts`. A null tariff means
fees are unknown. Providers must explicitly send revoked coverage as `serving:false`;
an omission does not renew or revoke a record. Older or repeated observations are skipped.

## Product identity

`catalog match listing.json` normalizes brand, title, pack units, variant and category.
Exact unique identities match first. Fuzzy token similarity is only computed inside
the strict brand/pack/variant/category boundary and produces review candidates,
never an automatic mapping. Scores are similarity values, not calibrated probabilities.
Unknown products remain unmatched; duplicate exact identities are ambiguous.

```sh
npm run catalog --workspace @grocerycompare/api -- match /absolute/path/listing.json
npm run catalog --workspace @grocerycompare/api -- correct /absolute/path/correction.json
```

Listings require retailer, SKU, brand, title, packSize, variant, category. Corrections
contain `{ listing, productId, reviewedBy, reason }`. They persist in `CanonicalMapping`
and override title matching only while the source identity fingerprint still matches.
Corrections cannot override incompatible brand, pack, variant or category. Set canonical
`Product.variantName` when curating products. Feed import still requires an approved
canonical product ID: use the match/review result to construct that normalized feed.
These tools require trusted database/operator access; no unauthenticated mapping
or fee write API is exposed. Candidate scans are bounded at 10,000 products and
fail explicitly above that limit; indexed candidate retrieval is the next scaling step.

## Checkout and splitting

`GET /api/checkout/products?location=560001` supports search, category, cursor and limit.
`POST /api/checkout/compare` accepts:

```json
{
  "location": { "pincode": "560001" },
  "items": [{ "productId": "CANONICAL_UUID", "quantity": 1 }],
  "maxDeliveries": 2,
  "couponCode": "OPTIONAL_PUBLIC_COUPON"
}
```

Only fresh, in-stock offers with known sufficient quantity at the same retailer,
store and seller can make a delivery. Product ETA is ignored: coverage supplies ETA.
Every quote includes item subtotal, delivery, handling/platform, surge/rain, small-cart
fee, coupon discount, membership benefit, final payable and expiry. Tariffs must be
tax inclusive. Minimum orders are checked on pre-discount item subtotals; free delivery
and small-cart thresholds are evaluated separately for each delivery. Providers with
different semantics need a dedicated checkout quote adapter before activation.

Coupons represent verified public offers only. Private, first-order and user-specific
coupons are not supported by this tariff format. Membership benefits require verified
server-side entitlements; the public HTTP endpoint currently supplies none. The pure
engine supports verified entitlements and nonstacking discounts, choosing the larger
benefit when stacking is prohibited. This is a tariff-derived payable estimate, not
a retailer checkout reservation or price guarantee.

The optimizer evaluates whole-line assignments for up to three deliveries, with one
store per retailer. Fees, minimums and discounts are recalculated for every sub-basket.
It returns best single, best split, recommended plan, item assignments, delivery count
and savings relative to best single. It does not split one line's quantity across stores.
The search stops at 50,000 visited states and sets `search.complete:false`; the UI
explicitly says the lowest cost is not guaranteed when truncated. Catalog coverage
is capped at 100 stores and checkout offer retrieval at 10,000 rows.

## Validation and remaining integrations

The integration suite provisions temporary records and verifies the example ₹786
single versus ₹742 split (₹44 saved after two delivery fees), mapping corrections,
partial-pincode GPS coverage, expiry and unavailable geocoding. Cleanup removes all
temporary records. Unit tests cover stock, fees, minimums, discounts and bounded search.

Before live release: connect authorized geocoding and retailer adapters; verify public
tariff/coupon semantics against actual checkout quotes; wire account-based membership
entitlements; calibrate matching on reviewed catalog pairs; measure optimizer capacity;
and run native Android/iOS device and accessibility checks.
