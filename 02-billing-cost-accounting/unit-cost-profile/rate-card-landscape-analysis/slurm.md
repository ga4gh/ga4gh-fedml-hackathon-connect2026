# Slurm

## Resources considered

- Slurm `slurm.conf` reference: https://slurm.schedmd.com/slurm.conf.html
- TRES and billing weights: https://slurm.schedmd.com/tres.html
- QOS configuration: https://slurm.schedmd.com/qos.html
- Preemption: https://slurm.schedmd.com/preempt.html
- Generic resources (GRES): https://slurm.schedmd.com/gres.html
- Accounting: https://slurm.schedmd.com/accounting.html, `sacct`, `sacctmgr` man pages
- Partitions: https://slurm.schedmd.com/slurm.conf.html#SECTION_PARTITION-CONFIGURATION

## Overview

Slurm (Simple Linux Utility for Resource Management) is the dominant open-source workload manager for HPC clusters. It schedules batch jobs across a static, administrator-defined pool of compute nodes, supporting MPI, GPU workloads, and fair-share accounting. It is the de facto scheduler at most academic HPC centers, DOE national labs, NSF ACCESS resources, and many hospital research clusters.

Slurm is operated by systems administrators, not end users. Sites configure partitions (job queues), QOS levels, accounts, and billing weights centrally in `slurm.conf` and the SlurmDBD accounting database. Users submit jobs with `sbatch` against a partition and (optionally) a QOS; the system tracks usage in TRES (Trackable Resources) units and charges associations in abstract "billing" units recorded by `sacct`.

Because Slurm is the native idiom for most academic/HPC federation members, understanding its model is essential: a federated rate card must translate Slurm's TRES billing into something portable across cloud and k8s nodes.

## How it models pricing / cost

The core mechanism is `TRESBillingWeights`, a per-partition expression that converts resource usage into an abstract "billing" TRES. Weights apply per-resource-per-second (or per allocated unit, depending on `PriorityFlags=MAX_TRES`).

Example `slurm.conf` snippet:

```
# Global
AccountingStorageTRES=cpu,mem,gres/gpu,gres/gpu:a100,gres/gpu:v100
PriorityFlags=MAX_TRES,NO_FAIR_TREE
PreemptType=preempt/qos
PreemptMode=REQUEUE

# Partition for GPU work
PartitionName=gpu \
  Nodes=gpu[01-16] \
  DefaultTime=01:00:00 MaxTime=48:00:00 \
  TRESBillingWeights="CPU=1.0,Mem=0.25G,GRES/gpu:a100=10.0,GRES/gpu:v100=4.0" \
  QOS=normal \
  PreemptMode=REQUEUE

PartitionName=preemptible \
  Nodes=gpu[01-16] \
  TRESBillingWeights="CPU=0.25,Mem=0.0625G,GRES/gpu:a100=2.5" \
  PreemptMode=CANCEL \
  PriorityTier=1
```

QOS objects (created with `sacctmgr`) layer additional multipliers via `UsageFactor`, plus hard caps (`GrpTRES`, `MaxWall`). Accounting (`sacct -o JobID,TRESUsageInTot,AllocTRES,ElapsedRaw`) records actual billed TRES-seconds per job. Most sites use these numbers internally for fair-share, but some (e.g. commercial-facing centers) convert them to dollars via an external multiplier.

## Heterogeneity

Heterogeneity is handled via (a) node `Features` and `Gres` definitions, (b) partitions that group similar nodes, and (c) per-GRES-type billing weights (e.g. `GRES/gpu:a100` vs `GRES/gpu:v100`). A single cluster routinely advertises many partitions with different weights, time limits, and hardware. Jobs request features with `--constraint=` or specific GRES with `--gres=gpu:a100:2`.

This means "price" in Slurm is not one number — it is a function of (partition, QOS, TRES mix, node features).

## Preemption / priority / QOS

Slurm supports preemption via `PreemptMode` set at partition or QOS level, with modes `OFF`, `CANCEL`, `REQUEUE`, `SUSPEND`, `GANG`. `PreemptType=preempt/qos` or `preempt/partition_prio` decides the ordering. Priority tiers (`PriorityTier`) let a lower-cost preemptible partition share nodes with a protected partition. QOS records carry `UsageFactor` (charge multiplier), `Preempt=`, `GrpTRESMins`, and `Flags=DenyOnLimit`.

This is conceptually identical to cloud spot / k8s `PriorityClass` — a discount in exchange for eviction risk.

## Relevance to a federated rate card

Borrow:
- The `TRESBillingWeights` idea: a small vector of weights (cpu, mem, gpu-by-type) that linearly combine with usage to produce a charge. This is exactly what `/api/rates` should expose per node.
- Partition + QOS as a two-level structure: tier (partition-like) and modifier (QOS-like `UsageFactor`, preemption).
- GRES typing (`gpu:a100`) as precedent for not collapsing "GPU" into one SKU.
- Minimum billable duration encoded per-partition (`DefMemPerCPU`, `MinTime` equivalents) rather than globally.

Skip:
- SlurmDBD-specific schema and fair-share trees — out of scope.
- Per-association limits (`GrpTRES`) — those are budget/quota, not rate card.

## What's missing

- No currency or exchange-rate concept; billing TRES is a dimensionless internal unit.
- No standard way to expose the rate card outside the cluster — `scontrol show partition` is human-oriented.
- No notion of egress, storage, or data-transfer pricing.
- No cross-cluster federation of rates; Slurm federation (`FederationParameters`) federates scheduling, not pricing.
- No machine-readable schema; weights live in a text config.

## Proposed mapping to our schema

| Slurm concept              | Our rate card field                          |
|----------------------------|----------------------------------------------|
| Partition                  | `tier` (name, description, default)          |
| `TRESBillingWeights` entry | `resources[]` with `unit`, `price_per_unit`  |
| `GRES/gpu:a100`            | `resources[].sku = "gpu.a100"`               |
| QOS `UsageFactor`          | `tier.multiplier` or `modifier.multiplier`   |
| `PreemptMode`              | `tier.preemption = {cancel,requeue,suspend}` |
| `DefaultTime` / `MinTime`  | `min_billable_seconds`, `default_walltime`   |
| `sacct` TRES-seconds       | usage record (OGF UR mapping), not rate card |
| (none)                     | `currency` — we must add; Slurm has none     |
