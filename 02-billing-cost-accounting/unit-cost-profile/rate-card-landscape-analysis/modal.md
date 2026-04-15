# Modal

## Resources considered

- https://modal.com/pricing
- https://modal.com/docs/guide/cold-start
- https://modal.com/docs
- https://modal.com/docs/guide/gpu
- https://modal.com/docs/reference/modal.App
- https://modal.com/docs/guide/region-selection

## Overview

Modal (modal.com) is a serverless compute platform operated by Modal Labs, optimized for running Python workloads - particularly AI/ML inference, training, batch jobs, and web endpoints. Users decorate Python functions with `@app.function(...)` specifying resource requirements, and Modal schedules the container on its own multi-cloud fleet. The platform is notable in the federation context because it has no notion of "instance types" from the user's perspective: you request arbitrary `(cpu, memory, gpu)` tuples, and the platform bin-packs them onto underlying hardware. Primary use cases are LLM inference endpoints, fine-tuning jobs, scientific batch workloads, and ephemeral web services.

## How it models pricing / cost

Modal quotes all compute rates in dollars per second. Base prices are for preemptible (spot) capacity; non-preemptible capacity is exactly 3x the base rate. Non-US regions carry a 1.25x-2.5x region multiplier.

GPU rates (preemptible, $/sec):

| GPU          | $/hr   | $/sec       |
|--------------|--------|-------------|
| B200         | 6.25   | 0.001736    |
| H200         | 4.54   | 0.001261    |
| H100         | 3.95   | 0.001097    |
| A100 80GB    | 2.50   | 0.000694    |
| A100 40GB    | 2.10   | 0.000583    |
| L40S         | 1.95   | 0.000542    |
| A10G         | 1.10   | 0.000306    |
| L4           | 0.80   | 0.000222    |
| T4           | 0.59   | 0.000164    |

- CPU: $0.0000131/physical-core/sec ($0.0472/core/hr). Minimum 0.125 cores per container.
- Memory: $0.00000222/GiB/sec ($0.008/GiB/hr).
- Non-preemptible multiplier: 3.0x (applied uniformly to CPU, memory, and GPU lines).
- Region multiplier: 1.25x-2.5x for non-default regions.

Total per-second cost is the straight sum of CPU + memory + GPU lines - they are fully decoupled.

## Billing granularity

Modal bills per-second with no minimum duration. A 400ms function invocation is billed for ~0.4 seconds of resource time. This contrasts sharply with:

- AWS EC2 on-demand (post-2017): 60-second minimum, then per-second.
- AWS Lambda: 1ms granularity but with a fixed per-request fee.
- Slurm accounting: typically whole-minute TRES rollups (`AccountingStorageTRES`).
- GCP: per-second with a 60-second minimum.

For a federated rate card, Modal is the strongest argument for a `min_billable_seconds` field (with 0 as a legal value) rather than assuming a floor.

## Resource packing

Modal exposes arbitrary tuples via decorator kwargs: `@app.function(cpu=2.5, memory=8192, gpu="H100")`. There are no fixed SKUs like `g5.xlarge`. The scheduler translates requests into slots on underlying hardware. Consequence for our schema: the offering model should allow a node to advertise independent `cpu_rate`, `memory_rate`, and `gpu_rate` entries rather than forcing a Cartesian product of pre-bundled SKUs.

## Preemption

Modal's model is notably clean: all base prices are preemptible, and non-preemptible capacity is a single `non_preemptible_multiplier = 3.0` applied uniformly. There is no separate SKU list for spot vs on-demand. This contrasts with OpenCost, which maintains parallel `CPU`/`spotCPU`, `GPU`/`spotGPU` fields and lets them drift independently. A single multiplier is expressive enough for Modal's entire fleet and dramatically simpler to federate.

## Cold start / idle economics

Modal does not charge a separate cold-start fee. Container startup (image pull, interpreter boot, model weight load) is simply billed as wall time at the normal per-second rate. For keep-warm behavior, users set `min_containers=N`, which reserves N containers and bills them at the full rate even when idle - there is no discounted "reserved but idle" tier. This motivates an explicit `idle_rate_multiplier` field in our schema (Modal = 1.0; a cluster with pre-purchased reservations might report < 1.0).

## Relevance to a federated rate card

Borrow from Modal:

- Per-second rates as the canonical unit (`min_billable_seconds = 0`).
- Decoupled CPU, memory, GPU line items rather than bundled SKUs.
- Single `non_preemptible_multiplier` instead of parallel spot/on-demand tables.
- Explicit region multiplier as a first-class field.
- Cold-start treated as billable wall time; keep-warm surfaced via `idle_rate_multiplier`.

## What's missing

- No allocation, quota, or credit model - Modal is strictly pay-as-you-go, so it does not inform how to represent HPC fairshare, hospital chargeback budgets, or grant-backed credits.
- No multi-tenant federation primitives - a Modal workspace is a single billing entity.
- Single-vendor, single-operator: it cannot demonstrate cross-operator rate reconciliation.
- No data egress or storage pricing surfaced in the compute rate card (priced separately).

## Proposed mapping to our schema

A Modal-backed federation node would expose `/api/rates` roughly as:

```json
{
  "node_id": "modal-us-east",
  "currency": "USD",
  "min_billable_seconds": 0,
  "non_preemptible_multiplier": 3.0,
  "region_multiplier": 1.0,
  "idle_rate_multiplier": 1.0,
  "offerings": [
    {"resource": "cpu",    "unit": "physical_core_sec", "rate": 1.31e-5, "min_units": 0.125},
    {"resource": "memory", "unit": "GiB_sec",           "rate": 2.22e-6},
    {"resource": "gpu",    "model": "H100",             "unit": "sec", "rate": 1.097e-3},
    {"resource": "gpu",    "model": "A100-80GB",        "unit": "sec", "rate": 6.94e-4},
    {"resource": "gpu",    "model": "L4",               "unit": "sec", "rate": 2.22e-4}
  ]
}
```

All offerings are preemptible base rates; clients multiply by `non_preemptible_multiplier` when submitting a guaranteed job. This shape round-trips cleanly with SLURM- and OpenCost-backed nodes (which set `min_billable_seconds=60` and carry an `idle_rate_multiplier<1` for reserved capacity).
