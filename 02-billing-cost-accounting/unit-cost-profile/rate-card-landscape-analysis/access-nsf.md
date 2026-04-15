# ACCESS (NSF), Successor to XSEDE

## Resources considered

- https://allocations.access-ci.org/allocations-policy
- https://allocations.access-ci.org/exchange_calculator
- https://access-ci.org/ (program overview)
- ACCESS RAMPS (Resource Allocations Marketplace and Platform Services) documentation linked from the above

## Overview

ACCESS is the NSF-funded national cyberinfrastructure allocation program that replaced XSEDE in September 2022. It coordinates allocations across a federation of heterogeneous academic HPC/HTC Resource Providers (RPs) — Expanse at SDSC, Bridges-2 at PSC, Anvil at Purdue, Jetstream2 at IU, Delta at NCSA, Stampede3 at TACC, Ookami, Darwin, and others, including GPU and storage systems. It is the clearest real-world example of a **federated compute rate card with abstract credits and per-provider exchange rates**, which is exactly the topology our `/api/rates` has to support.

## How it models pricing / cost

ACCESS uses a two-tier currency model:

1. **ACCESS Credits** — the abstract, portable unit awarded to a PI via a review (Explore/Discover/Accelerate/Maximize tiers). By definition, **1 ACCESS Credit ≈ 1 CPU-core-hour on SDSC Expanse** (the reference machine).
2. **Service Units (SUs)** — the native billing unit of each RP. SUs have RP-specific semantics: an Anvil CPU-node SU is a node-hour on a specific CPU node class; a Bridges-2 GPU SU is a V100-hour; a Jetstream2 SU is a vCPU-hour on a VM flavor.

Conversion is handled by a **published exchange rate per RP per resource**, exposed interactively by the RAMPS exchange calculator. Example shape (illustrative):

```
resource: "Expanse CPU"           1 ACCESS Credit -> 1.00 SU   (constant)
resource: "Bridges-2 GPU"         1 ACCESS Credit -> 0.021 SU  (constant)
resource: "Anvil CPU"             1 ACCESS Credit -> 0.74 SU   (constant)
resource: "Jetstream2 CPU"        1 ACCESS Credit -> 1.00 SU   (constant)
resource: "Ranch (storage)"       1 ACCESS Credit -> N GB-month
```

Some rates are constant; others are **variable** (updated periodically by the RP to reflect node mix, utilization, or hardware refresh). The calculator returns `(credits_in, su_out, rate, rate_kind: constant|variable, effective_date)`.

There is no fiat currency at the user-facing layer: PIs are awarded and spend credits. RP-internal accounting may translate SUs back to dollars for cost recovery, but that is not exposed via ACCESS.

## Heterogeneity handling

Heterogeneity is embraced at the federation level: every RP declares its own resource classes (CPU, GPU-V100, GPU-H100, large-memory, VM, storage), each with its own SU definition. The federation layer only enforces that each resource publishes an exchange rate back to ACCESS Credits. This is a **late-binding** model — the abstract credit is the lingua franca, and translation happens at allocation/consumption time.

## Preemption / tiers

- **Allocation tiers**: Explore (~400K credits, rolling review), Discover (~1.5M, quarterly), Accelerate (~3M, quarterly), Maximize (10M+, semi-annual, competitive). These are *request* tiers, not pricing tiers.
- **Preemption**: Not first-class in the exchange model. Some RPs offer **discounted queues** (scavenger, backfill, long-shared) where SUs are charged at a reduced rate; these show up as separate resources in RAMPS with their own exchange rate, not as a modifier on a base rate.
- **Quality-of-service tiers** (premium/standard/low) are similarly modeled as distinct resource entries.

## Relevance to a federated rate card

Extremely high. ACCESS is effectively a working prototype of what our federation needs: heterogeneous nodes, each with local-native units, glued together by a shared abstract currency and a table of per-node exchange rates. The federation layer does not try to normalize hardware — it normalizes *value* through a reference machine. This suggests our schema should support `currency: "CREDITS"` as a first-class option alongside ISO-4217 codes, and should model exchange rates as a separate, versioned object rather than baking them into each SKU.

## What's missing

- No typed compute-shape attributes on the rate card itself; shape is implicit in resource name.
- No preemption tier enum; discount queues are modeled by duplicating resources.
- Exchange rate history/provenance is light (effective_date, but not a full time series in the public API).
- No standardized machine-readable endpoint analogous to AWS Price List Bulk; RAMPS is primarily interactive.
- No cross-federation expression — ACCESS is a single federation, not a network of peers.

## Proposed mapping to our schema

| Our field                 | ACCESS concept                                         |
| ------------------------- | ------------------------------------------------------ |
| `node_id`                 | Resource Provider + resource (e.g. `sdsc.expanse.cpu`) |
| `sku_id`                  | RP resource key                                        |
| `unit`                    | Local SU definition (`core-hour`, `node-hour`, `GB-month`) |
| `price_per_unit`          | 1 / (credits-per-SU exchange rate)                     |
| `currency`                | `"CREDITS"` (abstract) at federation layer             |
| `exchange_rate`           | Credits per local SU, with `rate_kind` + `effective_date` |
| `tier`                    | Explore / Discover / Accelerate / Maximize (allocation) |
| `preemptible` / `qos`     | Separate SKU with its own exchange rate (scavenger queue) |
| `resource_class`          | CPU / GPU-class / large-memory / VM / storage          |
