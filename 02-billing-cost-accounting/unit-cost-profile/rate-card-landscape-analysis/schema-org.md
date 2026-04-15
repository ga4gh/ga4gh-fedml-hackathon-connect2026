# schema.org UnitPriceSpecification

## Resources considered

- https://schema.org/UnitPriceSpecification
- https://schema.org/PriceSpecification
- https://schema.org/Offer
- https://schema.org/Service
- https://schema.org/QuantitativeValue
- https://schema.org/PriceTypeEnumeration
- UN/CEFACT Recommendation 20 (unit codes): https://unece.org/trade/uncefact/cl-recommendations

## Overview

schema.org is a collaborative vocabulary for structured data on the web, originally launched by Google, Microsoft, Yahoo, and Yandex in 2011 and now governed by the W3C Schema.org Community Group. It is actively maintained (schema.org v25+ as of 2024) and is the de facto semantic-web vocabulary for commerce, events, and creative works. `UnitPriceSpecification` is a subclass of `PriceSpecification` designed for per-unit pricing (e.g. $/hour, $/GB), which is exactly the shape of a compute rate card.

Serialization is typically JSON-LD, though RDFa and Microdata are also valid. Because it is JSON-LD, any document carrying `@context: "https://schema.org"` becomes RDF-graphable with zero additional work.

## How it models pricing / cost

Key fields on `UnitPriceSpecification`:

- `price` (number) — the numeric amount
- `priceCurrency` (ISO 4217 code, e.g. `USD`, `EUR`)
- `unitCode` (UN/CEFACT Rec 20 code — `HUR` = hour, `GB` = gigabyte, `MIN` = minute, `C62` = unit, `KWH` = kilowatt-hour)
- `unitText` (human-readable fallback)
- `referenceQuantity` (a `QuantitativeValue` — e.g. "per 1 hour of 1 vCPU")
- `billingDuration` / `billingIncrement` / `billingStart` — for subscription-style accrual
- `minPrice` / `maxPrice` — for tiered or negotiated ranges
- `priceType` (`ListPrice`, `MinimumPrice`, `SalePrice`, `InvoicePrice`)
- `validFrom` / `validThrough` — ISO 8601 timestamps for rate-card versioning
- `eligibleQuantity` / `eligibleTransactionVolume` — tiered thresholds

Example:

```json
{
  "@context": "https://schema.org",
  "@type": "Offer",
  "itemOffered": {
    "@type": "Service",
    "name": "vCPU-hour on UVA Rivanna (CPU partition)"
  },
  "priceSpecification": {
    "@type": "UnitPriceSpecification",
    "price": 0.032,
    "priceCurrency": "USD",
    "unitCode": "HUR",
    "referenceQuantity": {
      "@type": "QuantitativeValue",
      "value": 1,
      "unitCode": "C62",
      "unitText": "vCPU"
    },
    "priceType": "https://schema.org/ListPrice",
    "validFrom": "2026-01-01",
    "validThrough": "2026-12-31"
  }
}
```

## Relevance to a federated rate card

Strongly relevant. Aligning on schema.org gives us:

1. **Free semantic-web compatibility.** Any federation consumer that speaks JSON-LD can ingest a node's rate card without bespoke parsing.
2. **ISO 4217 + UN/CEFACT codes** are already what NIH, cloud vendors, and ERP systems use. No custom unit enum to maintain.
3. **Composable with `Offer` and `Service`**, which lets a node advertise *what* it sells (GPU-hour on A100, TB-month of cold storage) alongside *at what price*, in the same document.
4. **Low adoption cost.** A FastAPI endpoint can emit JSON-LD simply by adding a `@context` key.

## What's missing

- No compute-specific vocabulary. `Service` is generic; there is no `GpuType`, `MemoryPerCore`, `InterconnectFabric`, etc. We will need a federation-local extension.
- No notion of **allocation vs. on-demand vs. preemptible** pricing tiers. `priceType` covers list/sale/invoice, not spot-vs-reserved.
- No **cost model** (subsidy, chargeback, showback, grant-funded). Academic HPC commonly has $0 list price but a real internal unit cost — schema.org cannot express that duality.
- No **commitment/minimum-spend** mechanics beyond `eligibleQuantity`.
- No **usage-record linkage**; schema.org is the price side only.

## Proposed mapping to our schema

| Our field | schema.org equivalent |
|---|---|
| `rate.amount` | `price` |
| `rate.currency` | `priceCurrency` (ISO 4217) |
| `rate.unit` | `unitCode` (UN/CEFACT) + `unitText` |
| `rate.per` (vCPU, GPU, GB, job) | `referenceQuantity` (`QuantitativeValue`) |
| `rate.valid_from` / `valid_to` | `validFrom` / `validThrough` |
| `rate.tier` | `priceType` + `eligibleQuantity` |
| `resource` (service being priced) | `itemOffered` (`Service`) inside `Offer` |
| `node_id` / `provider` | `seller` on the enclosing `Offer` (`Organization`) |

Recommendation: emit each rate card entry as a schema.org `Offer` with an embedded `UnitPriceSpecification`, wrap the whole response as a JSON-LD `@graph`, and carry our federation-specific fields (GPU model, partition, preemptible flag, subsidy model) under a namespaced extension (e.g. `ga4gh:gpuModel`). This keeps us standards-compliant by default and extension-rich where compute demands it.
