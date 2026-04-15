# Kubecost

## Resources considered

- https://www.kubecost.com/
- https://docs.kubecost.com/install-and-configure/install/multi-cluster
- https://docs.kubecost.com/install-and-configure/install/federated-etl
- https://docs.kubecost.com/using-kubecost/navigating-the-kubecost-ui/cost-allocation
- https://docs.kubecost.com/using-kubecost/navigating-the-kubecost-ui/cloud-costs-explorer/cloud-cost-configuration

## Overview

Kubecost is the commercial product from which OpenCost was extracted. It is maintained by Kubecost, Inc. (acquired by IBM in 2024) and is **not a CNCF project** — only the donated OpenCost core is. Kubecost ships as a Helm chart with free, Business, and Enterprise tiers; the free tier is essentially OpenCost plus a UI, while Business/Enterprise unlock the features most relevant to a federation: multi-cluster rollup, federated ETL, SSO, long-term retention, and cloud-bill reconciliation.

From a rate-card perspective, Kubecost is interesting because it is the only mature OSS-adjacent system that has already solved "many clusters, heterogeneous providers, one dashboard" — exactly the shape of a GA4GH TES federation.

## How it models pricing / cost

Kubecost inherits OpenCost's two-tier price model (flat JSON defaults + per-instance CSV overrides) but adds four important layers on top:

1. **Cloud CUR reconciliation.** Kubecost ingests AWS Cost and Usage Reports, GCP Billing Export (BigQuery), and Azure Cost Management exports. Per-pod allocations computed from on-cluster metrics are then reconciled against the invoice so reported costs match what the cloud provider actually bills — including reserved-instance and savings-plan amortization, which OpenCost cannot see.
2. **Custom price books.** Enterprise users can upload a per-cluster JSON price sheet that overrides `default.json` with negotiated rates, internal showback rates, or fully synthetic on-prem rates (e.g. `$0.02/CPU-hour` chosen by finance). This is the closest existing analog to a federation "rate card."
3. **Shared cost allocation.** Idle capacity, cluster overhead (kube-system), and shared namespaces can be redistributed across tenants by weighted, even, or custom rules — producing chargeback-ready numbers rather than raw metered cost.
4. **Chargeback / showback reports.** Allocations roll up by label, namespace, team, or arbitrary `aggregateBy` dimension and can be exported as CSV/JSON or scheduled email/Slack reports.

Example custom pricing snippet (same shape as OpenCost, extended):

```json
{
  "provider": "custom",
  "description": "UVA Rivanna on-prem rate card (FY26)",
  "CPU": "0.008",
  "RAM": "0.001",
  "GPU": "1.20",
  "spotCPU": "0.002",
  "storage": "0.00002",
  "currencyCode": "USD"
}
```

## Heterogeneity

Kubecost's **multi-cluster architecture** is explicitly designed for heterogeneous environments:

- **Primary / secondary topology.** One "primary" Kubecost instance aggregates data from N "secondary" agents. Each secondary runs its own OpenCost-style collector with its own price book — so an AWS secondary can price via the AWS API while an on-prem secondary uses a custom JSON, and both roll up to one primary.
- **Federated ETL.** Each agent writes compressed Parquet files (metrics + allocations) to a shared object store (S3, GCS, or Azure Blob). The primary reads the **union** of these files on query. Agents never call each other directly, which is important across firewalled hospital networks — the only shared trust anchor is an object-store bucket.
- **Per-cluster labels.** The `cluster` dimension is first-class in every query, so the same workload label on two clusters stays distinguishable.

## Preemption / spot

Same mechanism as OpenCost — `spotCPU` / `spotRAM` keys plus cloud-specific node labels — but Kubecost additionally reconciles actual spot prices from the CUR, so the reported cost reflects what was billed (which varies by the minute on AWS) rather than a static default. For federation purposes this only matters post-hoc; the published rate card is still a point-in-time flat number.

## Relevance to a federated rate card

Kubecost is essentially a **working prototype of what we're building**, minus the TES/GA4GH integration:

- Federated ETL to a shared bucket is a viable architecture for aggregating rate cards and actuals across hospitals and HPC centers that can't expose inbound APIs to each other.
- The primary/secondary split maps cleanly onto a federation coordinator + per-site rate-card publisher.
- Custom price books already express the "site posts its own rates" pattern.
- CUR reconciliation is the answer to "advertised rate vs actual charge" — a gap our schema should anticipate with an `effective_rate` vs `list_rate` distinction.

## What's missing

- **Closed-source and commercial.** The multi-cluster and federated-ETL features are paid Enterprise features; we cannot depend on them as substrate.
- **Kubernetes-only.** No Slurm, no bare-metal workstation, no HPC queue awareness. A TES endpoint backed by Slurm gets no help from Kubecost.
- **No standardized currency or tier taxonomy.** `currencyCode` exists but is not enforced; tiering beyond on-demand/spot is ad hoc.
- **No signed / verifiable rate documents.** Rate books are trust-the-filesystem.
- **Opaque reconciliation logic.** CUR reconciliation is a black box to downstream consumers.

## Proposed mapping to our schema

| Our `/api/rates` concept | Kubecost source |
|---|---|
| Per-site rate card | Custom price book JSON on each secondary |
| Federation aggregation | Federated ETL bucket + primary reader |
| `list_rate` vs `effective_rate` | `default.json` rate vs CUR-reconciled rate |
| `currency` | `currencyCode` (promote to required) |
| `tier` (on-demand / spot / backfill) | `CPU` / `spotCPU` keys (extend with named tiers) |
| Shared / overhead cost | Kubecost shared-cost allocation rules |
| Provenance | Kubecost ETL file timestamps (formalize as `effective_from`/`effective_until`) |

Recommendation: borrow the **primary/secondary + shared-bucket** pattern and the **list-vs-effective** distinction, but keep the wire format open (OpenCost-compatible JSON) rather than adopt Kubecost's proprietary parquet layout.
