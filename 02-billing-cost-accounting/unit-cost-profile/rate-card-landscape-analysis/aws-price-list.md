# AWS Price List API

## Resources considered

- https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API_pricing_GetProducts.html
- https://aws.amazon.com/blogs/aws/new-aws-price-list-api/
- AWS Price List Bulk API (offer index JSON) referenced from the above

## Overview

AWS exposes its public, forward-looking rate card through two surfaces: the **Price List Bulk API** (static JSON per service per region) and the **Price List Query API** (`GetProducts`, `GetAttributeValues`, `DescribeServices`). Both publish the same underlying document: a dictionary of SKUs, each with a typed `attributes` bag describing the thing being priced, and a `terms` section describing how it is priced (On Demand, Reserved). This is the canonical example of "a real, production rate-card API backing a heterogeneous compute offering," and it is the closest existing analog to what a federation node should expose.

## How it models pricing / cost

Top-level document has three sections: `formatVersion`, `publicationDate`, `products`, and `terms`.

`products[SKU]` example (EC2):

```json
"JRTCKXETXF": {
  "sku": "JRTCKXETXF",
  "productFamily": "Compute Instance",
  "attributes": {
    "servicecode": "AmazonEC2",
    "location": "US East (N. Virginia)",
    "instanceType": "m5.xlarge",
    "vcpu": "4",
    "memory": "16 GiB",
    "operatingSystem": "Linux",
    "tenancy": "Shared",
    "capacitystatus": "Used",
    "preInstalledSw": "NA"
  }
}
```

`terms.OnDemand[SKU][offerTermCode].priceDimensions[rateCode]`:

```json
"JRTCKXETXF.JRTCKXETXF.6YS6EN2CT7": {
  "rateCode": "JRTCKXETXF.JRTCKXETXF.6YS6EN2CT7",
  "description": "$0.192 per On Demand Linux m5.xlarge Instance Hour",
  "beginRange": "0",
  "endRange": "Inf",
  "unit": "Hrs",
  "pricePerUnit": { "USD": "0.1920000000" },
  "appliesTo": [],
  "effectiveDate": "2025-01-01T00:00:00Z"
}
```

Key fields: `unit` (`Hrs`, `GB-Mo`, `Requests`), `pricePerUnit.<currency>`, `beginRange`/`endRange` for tiered pricing, `description` (human readable), `appliesTo` (SKU cross-refs), `effectiveDate`.

## Heterogeneity handling

Heterogeneity is encoded entirely in `productFamily` + `attributes`. Different resource kinds (compute instance, EBS volume, snapshot, load balancer) get different `productFamily` values and different attribute schemas. There is no global typed schema; consumers filter by `(servicecode, productFamily, <attr>)` tuples. `location` strings localize pricing by region.

## Preemption / tiers

- **Preemption**: Spot prices are **not** in the Price List API. They live in a separate real-time feed (`DescribeSpotPriceHistory`). The Price List is the "committed/list" surface; volatile preemptible pricing is explicitly out of scope.
- **Tiers**: Volume tiers are represented as **multiple `priceDimensions` entries under one term**, each with its own `beginRange`/`endRange` and `pricePerUnit`. S3 storage is the canonical example (first 50 TB, next 450 TB, over 500 TB).
- **Commitment tiers**: `terms.Reserved` parallels `terms.OnDemand` with extra term attributes (`LeaseContractLength`, `PurchaseOption`, `OfferingClass`).

## Relevance to a federated rate card

Very high as a structural model. AWS's split of `products` (what is priced) vs `terms` (how it is priced) maps cleanly onto a federation where a node catalogs its resource classes once and attaches one or more pricing terms (on-demand, preemptible, allocation-backed). The `beginRange`/`endRange`/`unit`/`pricePerUnit` idiom is battle-tested for tiered usage billing.

## What's missing

- No abstract-credit concept; `pricePerUnit` is always a fiat currency keyed by ISO code.
- No preemption representation in the rate card itself.
- No governance tier (data-access class, human-subjects premium).
- No exchange rate between providers — AWS is a single issuer.
- Attribute schemas are per-`productFamily` and not globally typed, which shifts validation burden to consumers.

## Proposed mapping to our schema

| Our field         | AWS Price List field                                     |
| ----------------- | -------------------------------------------------------- |
| `sku_id`          | `products[SKU].sku`                                      |
| `resource_class`  | `productFamily`                                          |
| `attributes.*`    | `attributes.*` (instanceType, vcpu, memory, location)    |
| `region`          | `attributes.location` (normalized)                       |
| `unit`            | `priceDimensions.unit`                                   |
| `price_per_unit`  | `priceDimensions.pricePerUnit.<currency>`                |
| `currency`        | key of `pricePerUnit` (USD) or `CREDITS`                 |
| `tier_begin/end`  | `beginRange` / `endRange`                                |
| `effective_from`  | `effectiveDate`                                          |
| `description`     | `description`                                            |
| `term_kind`       | `terms.OnDemand` vs `terms.Reserved` vs `x_preemptible`  |
