# OpenCost

## Resources considered

- https://github.com/opencost/opencost/blob/develop/configs/pricing_schema.csv
- https://github.com/opencost/opencost/blob/develop/configs/default.json
- https://github.com/opencost/opencost/blob/develop/core/pkg/opencost/allocation.go
- https://www.opencost.io/docs/specification/
- https://www.opencost.io/docs/integrations/api

## Overview

OpenCost is an open-source (Apache 2.0) cost monitoring and allocation project for Kubernetes. It was donated to the CNCF by Kubecost and is currently a CNCF **incubating** project (promoted from sandbox in 2024). It is maintained primarily by Kubecost/IBM engineers with community contributions, and ships both a Go daemon and a specification (the OpenCost Spec) that defines how Kubernetes workload cost should be calculated.

OpenCost scrapes Kubernetes node and pod metrics (via Prometheus), joins them against a pricing model (cloud-provider APIs or a user-supplied custom price book), and emits per-allocation cost breakdowns over a time window.

## How it models pricing / cost

OpenCost uses a **two-tier price model**:

1. **Flat default rates** in `configs/default.json`, keyed per resource and hourly:

```json
{
    "provider": "custom",
    "description": "Default prices based on GCP us-central1",
    "CPU": "0.031611",
    "spotCPU": "0.006655",
    "RAM": "0.004237",
    "spotRAM": "0.000892",
    "GPU": "0.95",
    "storage": "0.00005479452",
    "zoneNetworkEgress": "0.01",
    "regionNetworkEgress": "0.01",
    "internetNetworkEgress": "0.12",
    "natGatewayEgress": "0.045",
    "natGatewayIngress": "0.045"
}
```

Note: **all prices are JSON strings**, not floats, to avoid binary-float drift in accounting arithmetic. Units: `$/CPU-hour`, `$/GB-RAM-hour` (GiB), `$/GPU-hour`, `$/GB-storage-hour`, `$/GB-egress`.

2. **Per-instance overrides** in `configs/pricing_schema.csv`:

```
EndTimestamp,InstanceID,Region,AssetClass,InstanceIDField,InstanceType,MarketPriceHourly,Version
2019-04-17 23:34:22 UTC,gke-standard-cluster-1-pool-1-91dc432d-cg69,,node,metadata.name,,0.1337,
2019-04-17 23:34:22 UTC,Quadro_RTX_4000,,gpu,nvidia.com/gpu_type,,0.75,
2019-04-17 23:34:22 UTC,Quadro_RTX_4001,,gpu,gpu.nvidia.com/class,,0.80,
```

Resolution: a node's `providerID` (or a Kubernetes label indicated by `InstanceIDField`) is matched against a CSV row; if matched, `MarketPriceHourly` overrides the flat default. GPU rows let operators attach a price to a device-plugin label.

The `/allocation` endpoint (see `core/pkg/opencost/allocation.go`) returns per-workload records with the following cost fields, all as `float64` dollars over the queried window:

```go
CPUCoreHours, CPUCost, CPUCostAdjustment
RAMByteHours, RAMCost, RAMCostAdjustment
GPUHours,     GPUCost, GPUCostAdjustment
PVs (map), PVCostAdjustment
NetworkCost, NetworkCrossZoneCost, NetworkCrossRegionCost, NetworkInternetCost
NetworkNatGatewayEgressCost, NetworkNatGatewayIngressCost
LoadBalancerCost, SharedCost, ExternalCost
```

Each cost is computed as `usage_hours * rate`, where the rate comes from the two-tier lookup above.

## Heterogeneity

Heterogeneity is handled by joining node metadata to price rows. The join key is flexible: `metadata.name`, `providerID`, or any node label specified in `InstanceIDField`. This lets a single cluster mix on-prem baremetal (priced via node name), cloud VMs (priced via instance type), and GPU devices (priced via device-plugin class) in one CSV. Cross-region heterogeneity is supported via the `Region` column.

## Preemption / spot

Handled via **parallel key pairs** in `default.json`: `CPU`/`spotCPU` and `RAM`/`spotRAM`. OpenCost decides which pair applies by reading a node label (typically `node.kubernetes.io/instance-type` combined with a cloud-specific preemptible label, e.g. `cloud.google.com/gke-preemptible=true`, `eks.amazonaws.com/capacityType=SPOT`). There is no separate `spotGPU` key; GPU pricing is flat unless overridden in the CSV.

## Relevance to a federated rate card

OpenCost's schema is a near-perfect match for a per-node `/api/rates` endpoint:

- The resource taxonomy (CPU, RAM, GPU, storage, egress tiers) is the same taxonomy a TES node needs to advertise.
- Prices-as-strings sidestep currency-precision headaches.
- The CSV+JSON layering already expresses the "site default + instance override" pattern that heterogeneous HPC, hospital clusters, and cloud VMs require.
- The OpenCost Spec gives us a stable, CNCF-blessed vocabulary we can cite rather than reinvent.

## What's missing

- **No currency field.** OpenCost implicitly assumes USD; federation across EU/UK sites needs an explicit `currency` tag.
- **No tier / priority pricing** beyond spot-vs-on-demand. Academic HPC often has "backfill / scavenger / priority" tiers that don't map to AWS spot.
- **No time-of-day or queue-wait modeling.** Prices are flat-hourly; HPC fairshare is invisible.
- **No granularity for fractional GPU** (MIG slices) or CPU architecture (arm64 vs x86_64, AVX-512).
- **No provenance / validity window.** `EndTimestamp` exists but there is no `effective_from`/`effective_until` pair or signature.
- **No non-Kubernetes support.** Rates are keyed to k8s nodes; a Slurm or bare workstation site needs a shim.

## Proposed mapping to our schema

| Our `/api/rates` field | OpenCost source |
|---|---|
| `currency` | (add; OpenCost is USD-implicit) |
| `cpu.on_demand` ($/core-hour) | `default.json:CPU` or CSV `MarketPriceHourly` for a node |
| `cpu.spot` | `default.json:spotCPU` |
| `memory.on_demand` ($/GiB-hour) | `default.json:RAM` |
| `memory.spot` | `default.json:spotRAM` |
| `gpu[*].rate` | `default.json:GPU` or CSV row with `AssetClass=gpu` |
| `gpu[*].model` | CSV `InstanceID` (e.g. `Quadro_RTX_4000`) |
| `storage.rate` ($/GiB-hour) | `default.json:storage` |
| `egress.intra_zone` / `intra_region` / `internet` | `zoneNetworkEgress` / `regionNetworkEgress` / `internetNetworkEgress` |
| `nat.egress` / `nat.ingress` | `natGatewayEgress` / `natGatewayIngress` |
| `node_match` (selector) | CSV `InstanceIDField` + `InstanceID` |
| `effective_until` | CSV `EndTimestamp` |

Recommendation: adopt OpenCost's resource key names verbatim and extend with `currency`, `tier`, `arch`, and explicit validity windows.
