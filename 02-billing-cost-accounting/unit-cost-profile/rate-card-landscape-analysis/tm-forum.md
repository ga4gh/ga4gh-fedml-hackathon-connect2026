# TM Forum SID / Open APIs (TMF620, TMF635, TMF636)

## Resources considered

- TM Forum Information Framework (SID): https://www.tmforum.org/open-digital-architecture/information-framework-sid/
- TMF620 Product Catalog Management API: https://www.tmforum.org/resources/standard/tmf620-product-catalog-management-api-user-guide-v4-0-0/
- TMF635 Usage Management API: https://www.tmforum.org/resources/standard/tmf635-usage-management-api-user-guide-v4-0-0/
- TMF636 Billing Management API: https://www.tmforum.org/resources/interface/tmf636-billing-management-api-rest-specification-r14-5-0/
- Open API reference implementations: https://github.com/tmforum-apis

## Overview

TM Forum is a global industry association for telecommunications operators (AT&T, Vodafone, Orange, BT, etc.), founded in 1988. It publishes the **Information Framework (SID)** — a comprehensive entity-relationship model for telecom business — and a companion suite of **Open APIs** (TMF620-series) that REST-ify SID. TMF governance is active, versioned (currently v4/v5), and widely implemented in carrier OSS/BSS stacks.

For our purposes, SID contains the **most mature formal rate-card and usage-billing model in existence**, because telcos have been monetizing metered consumption (minutes, SMS, GB) at continental scale since the 1990s. That maturity comes at a price: the vocabulary is telco-heavy, the model is enormous (hundreds of entities), and the learning curve is steep.

## How it models pricing / cost

The relevant SID entities (exposed via TMF620 Product Catalog):

- **`ProductOffering`** — a thing you sell (analog: "GPU-hour on H100 partition").
- **`ProductOfferingPrice` (POP)** — the price of an offering. Rich field set:
  - `priceType` (`recurring`, `oneTime`, `usage`)
  - `recurringChargePeriod` (`month`, `day`, `hour`)
  - `price` (`Money`: `value` + `unit` ISO 4217)
  - `unitOfMeasure` (`GB`, `HUR`, `MIN`, custom)
  - `validFor` (`startDateTime` / `endDateTime`)
  - `pricingLogicAlgorithm` — references an external rating engine for complex tiering
- **`PriceAlteration`** — discounts, surcharges, commitment rebates, bundle adjustments (allowance vs. list, percentage vs. absolute).
- **`UsageSpecification`** (TMF635) — what a usage event looks like; each `UsageSpecCharacteristic` declares a metered dimension (duration, volume, count).
- **`Usage`** and **`UsageCharacteristic`** — the actual measured event.
- **`AppliedCustomerBillingRate`** (TMF636) — the rate as realized on a customer's invoice line, with the `Usage` it was applied to.

Example TMF620-shaped JSON:

```json
{
  "id": "pop-gpu-h100-hour",
  "name": "H100 GPU-hour (on-demand)",
  "priceType": "usage",
  "unitOfMeasure": "HUR",
  "price": { "unit": "USD", "value": 2.40 },
  "validFor": { "startDateTime": "2026-01-01T00:00:00Z" },
  "productOfferingTerm": [
    { "name": "on-demand", "duration": { "amount": 0, "units": "days" } }
  ],
  "prodSpecCharValueUse": [
    { "name": "gpuModel", "valueType": "string",
      "productSpecCharacteristicValue": [{ "value": "H100" }] }
  ],
  "priceAlteration": [
    { "name": "annual-commitment-20pct",
      "priceType": "discount",
      "percentage": 20,
      "applicationDuration": 365 }
  ]
}
```

## Relevance to a federated rate card

Moderately relevant. Worth **skimming and stealing from**, not **adopting wholesale**.

Things to take:

1. **Tiered pricing model.** `ProductOfferingPrice` + `PriceAlteration` is the cleanest formal expression of "list price + discount for commitment/volume/allocation" — directly applicable to NIH-allocation vs. on-demand at academic HPC sites.
2. **Separation of offering, price, and usage.** Three distinct entities keep the data model clean: *what you sell* (Offering), *what it costs* (POP), *what was consumed* (Usage). Our FastAPI should mirror this split.
3. **`priceType` enum** (`recurring` / `oneTime` / `usage`) captures the three realistic academic compute models (node reservation, setup fee, metered use).
4. **Versioning via `validFor`** matches schema.org and is ERP-friendly.

## What's missing

- **Telco bias.** Entities like `ServiceQualification`, `ResourceFunction`, `Party Role` carry mobile-network assumptions that do not translate.
- **Model weight.** Full SID is hundreds of classes; a federation node operator will not implement TMF620 from scratch.
- **No compute-native vocabulary.** No GPU model, partition, queue, CUDA version, interconnect. Must go into `prodSpecCharValueUse` (generic key-value), which loses type safety.
- **No academic/subsidy model.** TMF assumes a commercial seller-customer relationship; "this HPC is free for in-institution users, chargeback for external" is expressible but awkward.
- **Licensing.** TM Forum membership is required for authoritative access to some spec artifacts, though the Open API JSON Schemas are on GitHub under Apache-2.0.

## Proposed mapping to our schema

| Our field | TMF / SID equivalent |
|---|---|
| `resource` (the priced thing) | `ProductOffering` / `ProductSpecification` |
| `rate` (a single priced line) | `ProductOfferingPrice` |
| `rate.amount` + `rate.currency` | `price.value` + `price.unit` |
| `rate.unit` | `unitOfMeasure` |
| `rate.per` (vCPU, GPU, GB) | `prodSpecCharValueUse` |
| `rate.type` (on-demand, reserved, subsidized) | `priceType` + `PriceAlteration` |
| `rate.valid_from` / `valid_to` | `validFor.startDateTime` / `endDateTime` |
| `rate.tier` / volume discount | `PriceAlteration` (`priceType = discount`, with `applicationDuration`) |
| Usage events (external, not in rate card) | `Usage` + `UsageSpecification` (TMF635) |

Recommendation: do **not** implement full TMF620 — it is too heavy for a hackathon and misaligned with academic compute. Instead, borrow its **three-entity split** (Offering / Price / Usage) and its **PriceAlteration pattern** for tiered and commitment discounts. Name our fields so a TMF-literate integrator can recognize the mapping, but keep the payload lean and compute-native.
