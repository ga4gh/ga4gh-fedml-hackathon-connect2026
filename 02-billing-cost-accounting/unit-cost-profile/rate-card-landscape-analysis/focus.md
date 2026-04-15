# FOCUS (FinOps Open Cost & Usage Specification)

## Resources considered

- https://focus.finops.org/focus-specification/
- https://github.com/FinOps-Open-Cost-and-Usage-Spec/FOCUS_Spec
- https://focus.finops.org/ (landing, v1.2 GA announcement; v1.3 ratified Dec 2025)

## Overview

FOCUS is an open specification, stewarded by the FinOps Foundation, that normalizes the schema of **billing and usage data** emitted by cloud providers and SaaS vendors. It is not primarily a rate card (forward-looking "what will this cost?") but a **cost-and-usage record** (backward-looking "what was charged?"). Version 1.2 is GA; v1.3 was ratified in December 2025. FOCUS matters to a federated rate card because (a) its column names are already being adopted by AWS, Azure, GCP, and OCI exports, so aligning our rate-card fields with FOCUS terminology reduces translation friction, and (b) several FOCUS columns straddle the line between a rate card (price per unit) and a bill (quantity times price).

## How it models pricing / cost

FOCUS specifies a flat, wide row schema. Fields directly relevant to rates:

- `ChargeCategory` — enum: `Usage`, `Purchase`, `Tax`, `Credit`, `Adjustment`.
- `ChargeFrequency` — `One-Time`, `Recurring`, `Usage-Based`.
- `ChargeDescription` — human-readable, e.g. `"$0.0464 per On Demand Linux m5.xlarge Instance Hour"`.
- `PricingUnit` — normalized unit of sale, e.g. `Hours`, `GB`, `GB-Hours`, `Requests`.
- `PricingQuantity` — numeric count in `PricingUnit`.
- `ListUnitPrice` — public list rate per `PricingUnit`, in `BillingCurrency`.
- `ContractedUnitPrice` — negotiated/committed rate per `PricingUnit`.
- `EffectiveCost` — amortized realized cost after discounts, RIs, SPs.
- `BilledCost` — what appears on the invoice.
- `BillingCurrency` — ISO 4217 (`USD`, `EUR`).
- `SkuId`, `SkuPriceId` — stable identifiers for the priced SKU and its specific price point (region, term, tier).
- `ServiceName`, `ServiceCategory` — e.g. `Amazon EC2`, `Compute`.
- `ResourceId`, `RegionId`, `AvailabilityZone`.
- `CommitmentDiscountType` — `Reserved`, `SavingsPlan`, `Spot` effects land in price fields, not here.

Vendor/site extensions use an `x_` prefix (e.g. `x_uva_node_class`, `x_ga4gh_tier`).

## Heterogeneity handling

FOCUS normalizes across vendors by forcing each row into the same columns, but heterogeneity of *resource kind* is handled loosely via `ServiceCategory`, `ServiceName`, and free-form `ChargeDescription`. It does not define a typed compute-shape schema (vcpu count, GPU model, memory). Those end up in provider-specific `x_` columns.

## Preemption / tiers

No first-class field for preemption. Spot/preemptible usage surfaces as a distinct `SkuPriceId` and typically as a distinct `ChargeDescription`. Volume/usage tiers are expressed by **multiple rows with different `SkuPriceId`s**, each carrying its own `ListUnitPrice`; FOCUS does not carry `beginRange`/`endRange` in the billing row (those live in the upstream price sheet).

## Relevance to a federated rate card

High. If our `/api/rates` responses reuse FOCUS field names (`PricingUnit`, `ListUnitPrice`, `BillingCurrency`, `SkuId`, `ServiceName`, `RegionId`), downstream FinOps tooling can ingest federation usage records with minimal adaptation. It also provides a canonical vocabulary (`ChargeCategory`, `ChargeFrequency`) that disambiguates one-time allocation purchases from hourly usage.

## What's missing

- No structured compute-shape fields (cores, GPU type, memory).
- No notion of an **abstract credit** (see ACCESS) distinct from a currency.
- No preemption tier taxonomy.
- No field for governance/tier (public vs controlled-access data, human-subjects premium).
- No expression of exchange rates between sites.

## Proposed mapping to our schema

| Our field              | FOCUS field                               |
| ---------------------- | ----------------------------------------- |
| `sku_id`               | `SkuId`                                   |
| `price_point_id`       | `SkuPriceId`                              |
| `unit`                 | `PricingUnit`                             |
| `list_price`           | `ListUnitPrice`                           |
| `negotiated_price`     | `ContractedUnitPrice`                     |
| `currency`             | `BillingCurrency` (or `"CREDITS"` ext)    |
| `service`              | `ServiceName`                             |
| `region`               | `RegionId`                                |
| `description`          | `ChargeDescription`                       |
| `charge_kind`          | `ChargeCategory` + `ChargeFrequency`      |
| `node_class`, `gpu`, `tier`, `preemptible` | `x_ga4gh_*` extensions       |
