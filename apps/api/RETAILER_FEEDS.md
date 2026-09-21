# Authorized retailer feeds

Status: no retailer API access is configured. Blinkit, Zepto, Swiggy Instamart,
BigBasket, and DMart Ready are supported identifiers, not active integrations.
Do not describe this module as live retailer connectivity.

`RetailerAdapter` isolates each provider's payload mapping. Implement a dedicated
adapter against the provider's authorized documentation when access is obtained.
The supplied normalized interchange adapter only accepts our own JSON format;
it does not guess private retailer endpoints or payloads.

Apply the reviewed migration with `npm run db:migrate --workspace @grocerycompare/api`
against the intended database. Import an authorized normalized export with:

```sh
npm run feed:import --workspace @grocerycompare/api -- BLINKIT /absolute/path/feed.json
```

The document is `{ "retailer": "BLINKIT", "offers": [...] }`. Every offer requires:
`sku`, `location`, `storeId`, `sellerId`, canonical `productId`, `packSize`,
`pricePaise`, `mrpPaise`, `inStock`, `stockQuantity`, `etaMinutes`, `feesPaise`,
`minimumOrderPaise`, and ISO 8601 `observedAt`. Money is integer INR paise.
MRP, stock quantity, ETA, fees, and minimum order can be explicitly null when
unknown. Unknown fees never become zero. Fees are source observations, not a
calculated basket checkout quote.

Imports accept at most 1,000 offers and 5 MB per file, require existing curated
product mappings and equivalent packs, and reject future or day-old observations.
An invalid record rolls back the whole transaction. Retailer/SKU/location/store/
seller identify a record. Equal or older timestamps cannot overwrite newer data.
Missing records are not inferred to be out of stock; providers must explicitly
publish stock changes. The original observation time is preserved across retries.

Imported records remain separate from the app's legacy Variant catalog. The
[checkout engine](CHECKOUT_ENGINE.md) consumes them with verified store coverage,
stock quantity checks, tariff-based checkout totals, minimum-order eligibility,
and freshness filtering. Offer `location` must equal the coverage pincode; ETA
comes from coverage, and checkout fees come from its complete tariff.
Live connectivity still requires provider-specific authenticated fetching with bounded retries, pagination,
rate limits, ingestion monitoring, and credentials supplied through a secret manager.
Request data redistribution rights, location/store semantics, quotas, freshness
guarantees, and sample payloads from each provider before implementing its adapter.
