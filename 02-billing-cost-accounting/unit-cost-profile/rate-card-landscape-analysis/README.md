# Landscape Analysis

One file per existing external approach to compute pricing, rate cards, or cost accounting. Each file follows a consistent structure: resources consulted, overview, pricing mechanism, heterogeneity, preemption, relevance, gaps, and a proposed mapping to our `/api/rates` schema.

## Approaches surveyed

### Schedulers and orchestrators (the backends that actually run jobs)

- **[slurm.md](slurm.md)** — HPC batch scheduler with first-class billing (`TRESBillingWeights`, QOS `UsageFactor`, `PreemptMode`). Dimensionless (no currency). Our offering-per-partition model comes from here.
- **[kubernetes.md](kubernetes.md)** — No native pricing; rich consumption primitives (`requests`/`limits`, `ResourceQuota`, `PriorityClass`, node labels). Cost is always bolted on.

### Cost-allocation tools (the ecosystem that prices the backends)

- **[opencost.md](opencost.md)** — CNCF incubating. Two-tier JSON+CSV (flat `default.json` defaults + per-instance `pricing_schema.csv` overrides). Prices as strings. Spot via parallel `CPU`/`spotCPU` keys. Closest existing artifact to what we're building.
- **[kubecost.md](kubecost.md)** — Commercial superset of OpenCost (IBM-acquired). Primary/secondary multi-cluster rollup and federated ETL (parquet to shared S3/GCS) are a working prototype of the federation shape. Introduces `list_rate` vs `effective_rate`.

### Cloud and serverless pricing (the rate-card shapes in the wild)

- **[aws-price-list.md](aws-price-list.md)** — `products[SKU]` + `terms.OnDemand[SKU].priceDimensions[rateCode]` with `beginRange`/`endRange` tiering. Spot lives outside the Price List.
- **[modal.md](modal.md)** — Serverless, per-second billing, no minimum duration. Preemption as a *3× multiplier* rather than parallel SKUs. Arbitrary `(cpu, memory, gpu)` tuples. Source of `min_billable_seconds`, `non_preemptible_multiplier`, `idle_rate_multiplier`.

### Academic and grid federation

- **[access-nsf.md](access-nsf.md)** — NSF ACCESS: two-tier Credits/SU model with per-RP exchange rates (RAMPS calculator). The abstract-currency + per-node exchange-rate pattern we may borrow as an optional layer.
- **[ogf-usage-record.md](ogf-usage-record.md)** — OGF UR 1.0 (GFD.98) / 2.0 (GFD.204), deployed in APEL/EGI/WLCG for 20 years. The *usage* half of the loop: `CpuDuration`, `WallDuration`, `Memory`, `Disk`, `Network`. Align unit names so rate × UR = invoice.

### Formal standards and vocabularies

- **[focus.md](focus.md)** — FinOps Open Cost & Usage Specification v1.2 GA (v1.3 ratified Dec 2025). Billing-record spec, not a rate card — but align field names (`SkuId`, `PricingUnit`, `ListUnitPrice`, `ContractedUnitPrice`, `BillingCurrency`, `EffectiveDate`) for free downstream tooling.
- **[schema-org.md](schema-org.md)** — JSON-LD `UnitPriceSpecification` + `Offer`. Fields: `price`, `priceCurrency` (ISO 4217), `unitCode` (UN/CEFACT), `billingIncrement`, `validFrom`/`validThrough`. Recommended outer envelope.
- **[tm-forum.md](tm-forum.md)** — TMF620/635/636, SID `ProductOfferingPrice`. The most complete formal rate-card model in existence, but telco-heavy. Borrow the three-entity split (Offering / Price / Usage) and `PriceAlteration` pattern; don't adopt the full SID.

## Cross-approach synthesis

**Common shape across all approaches:** a list of offerings (Slurm partition = k8s node pool = AWS instance type = Modal GPU tier), each with a per-resource price vector.

**What nothing else gives us, and we must add ourselves:**

- `currency` with optional abstract-credit layer (only ACCESS models this)
- `min_billable_seconds` (Modal=0, AWS=60, Slurm≈60)
- `non_preemptible_multiplier` (Modal-style, replaces parallel SKUs)
- `idle_rate_multiplier` (distinguishes Modal keep-warm from HPC allocation idle)
- `allow_preemption` as a first-class field
- A stable discovery mechanism (`service-info` extension for GA4GH)

**Field-name alignment strategy:**

| Layer | Vocabulary |
|---|---|
| Envelope | schema.org `Offer` + `UnitPriceSpecification` (JSON-LD) |
| Price columns | FOCUS (`PricingUnit`, `ListUnitPrice`, `BillingCurrency`, `EffectiveDate`) |
| Resource units | OGF Usage Record (`CpuDuration`, `WallDuration`, `Memory`) |
| Offering shape | Slurm partitions + OpenCost `instanceTypes[]` (isomorphic) |
| Federation extensions | `x_ga4gh_*` prefix per FOCUS vendor-extension convention |

**What to skip:** ODRL (rights policy, overkill), ISO 19086 (SLOs, wrong scope), DMTF CIMI (dead), IETF (nothing exists), full SID (too telco).

## Not yet surveyed

The sibling `../costing-standard/README.md` lists additional tools worth covering in follow-up landscape files:

- Flexprice (AI metering)
- Lago
- Kill Bill
- OpenSourceBilling

These are billing-platform products rather than compute-pricing schemas, but may inform invoice generation and metering downstream of the rate card.
