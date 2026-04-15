# Kubernetes

## Resources considered

- Resource management for pods and containers: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
- ResourceQuota: https://kubernetes.io/docs/concepts/policy/resource-quotas/
- LimitRange: https://kubernetes.io/docs/concepts/policy/limit-range/
- PriorityClass and preemption: https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/
- Taints and tolerations: https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/
- Node labels and nodeSelector/affinity: https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/
- Device plugins / GPUs: https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/device-plugins/
- NVIDIA device plugin: https://github.com/NVIDIA/k8s-device-plugin

## Overview

Kubernetes is the dominant container orchestrator for cloud-native and hybrid workloads. A cluster is a set of nodes exposing CPU, memory, ephemeral storage, and (via device plugins) accelerators; workloads declare resource requirements in Pod specs, and the scheduler binds Pods to Nodes. It is deployed in every major public cloud (EKS, GKE, AKS), on-prem (OpenShift, Rancher, vanilla kubeadm), and increasingly in biomedical research settings fronting TES implementations (Funnel, TESK, GA4GH Compute clusters).

Unlike Slurm, Kubernetes has no native concept of price, cost, or billing. It is a scheduler and API surface only. All pricing information in Kubernetes ecosystems is bolted on externally — by the cloud provider's bill, by OpenCost/Kubecost, or by a federation-layer component like the rate card we are designing. This is an important distinction: Slurm ships a billing primitive (`TRESBillingWeights`); Kubernetes does not.

Kubernetes does, however, provide a rich and well-structured model of what is being consumed, which is the raw material a rate card needs.

## How it models pricing / cost

There is no pricing. There is only accounting of requested and limited resources, at pod granularity:

```yaml
apiVersion: v1
kind: Pod
spec:
  priorityClassName: preemptible-batch
  nodeSelector:
    node-pool: gpu-a100
  tolerations:
    - key: "nvidia.com/gpu"
      operator: "Exists"
      effect: "NoSchedule"
  containers:
    - name: worker
      image: ghcr.io/example/worker:1.0
      resources:
        requests:
          cpu: "4"
          memory: "16Gi"
          nvidia.com/gpu: "1"
        limits:
          cpu: "8"
          memory: "32Gi"
          nvidia.com/gpu: "1"
```

Cluster-level guardrails come from `ResourceQuota` (per-namespace caps on total requests/limits and object counts) and `LimitRange` (per-container default/min/max). Both govern admission, not price. Cost attribution tools compute `(container request or usage) * (externally supplied unit price) * duration`, typically joining node instance-type labels against a cloud price list.

## Heterogeneity

Heterogeneity is modeled via:

- **Node labels** (e.g. `node.kubernetes.io/instance-type=m5.xlarge`, `nvidia.com/gpu.product=A100-SXM4-40GB`, custom `node-pool=gpu-a100`). Pods target them with `nodeSelector` or `nodeAffinity`.
- **Taints and tolerations**: nodes taint themselves (e.g. `nvidia.com/gpu:NoSchedule`, `cloud.google.com/gke-preemptible:NoSchedule`), pods opt in.
- **Extended resources via device plugins**: GPUs appear as first-class schedulable resources (`nvidia.com/gpu`, `amd.com/gpu`), as do FPGAs, RDMA devices, etc. MIG partitions appear as distinct resource names (`nvidia.com/mig-1g.5gb`).
- **Node pools / machine sets**: cluster-level abstractions (EKS managed node groups, GKE node pools, Karpenter NodePools) that group homogeneous nodes and carry labels/taints.

A Kubernetes rate card therefore naturally keys on (node pool or label selector, extended resource name).

## Preemption / priority / QOS

Kubernetes has two overlapping concepts:

1. **PriorityClass** with `preemptionPolicy: PreemptLowerPriority | Never`. Higher-priority pending pods can evict lower-priority running pods to free resources.
2. **Pod QoS class** (derived, not declared): `Guaranteed` (requests == limits), `Burstable`, `BestEffort`. Affects OOM-kill order under node pressure, not scheduling price.

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: preemptible-batch
value: 100
preemptionPolicy: PreemptLowerPriority
globalDefault: false
description: "Cheap tier; may be evicted by interactive or production pods."
```

Cloud-specific preemption (spot/preemptible VMs) is orthogonal and surfaces as node taints plus lifecycle signals (node shutdown, `NodeTerminating` conditions). The rate card must capture both: intra-cluster priority preemption and underlying spot eviction.

## Relevance to a federated rate card

Borrow:
- The resource-name vocabulary (`cpu`, `memory`, `nvidia.com/gpu`, `nvidia.com/mig-1g.5gb`, `ephemeral-storage`) as canonical SKU names. It is already widely adopted and extensible.
- Node labels as the natural key for tier/pool identification.
- `PriorityClass` as the preemption/tier mechanism — maps cleanly to Slurm QOS.
- Requests-vs-limits distinction: our schema should say whether price is charged on request, limit, or measured usage.

Skip:
- `ResourceQuota`/`LimitRange` — these are admission controls, not pricing.
- QoS classes (`Guaranteed`/`Burstable`/`BestEffort`) — too coarse and not preemption-priced.

## What's missing

- No price. At all. Anywhere. This is the whole reason OpenCost exists.
- No currency, no minimum billable duration, no rounding rules.
- No standard way to publish a node pool's cost profile — each tool (OpenCost, Kubecost, Karpenter) reinvents it.
- No native link from a Pod to "which tier did this run on" for post-hoc billing; must be reconstructed from node labels at scheduling time.
- No data-egress, storage-class, or network pricing concept.
- Preemption in Kubernetes does not imply a discount; the discount only exists if the underlying node is spot, which is cloud-specific metadata.

## Proposed mapping to our schema

| Kubernetes concept                  | Our rate card field                         |
|-------------------------------------|---------------------------------------------|
| Node label selector / node pool     | `tier.selector` (how a job lands in a tier) |
| Extended resource name              | `resources[].sku` (use k8s names verbatim)  |
| `resources.requests.cpu`            | billable unit = `cpu`, charged per second   |
| `resources.requests.memory`         | billable unit = `memory` in GiB-seconds     |
| `nvidia.com/gpu` + product label    | `resources[].sku = "gpu.a100"` etc.         |
| `PriorityClass` + `preemptionPolicy`| `tier.preemption = {preempt,never}`         |
| Spot/preemptible node taint         | `tier.spot = true`, `tier.multiplier < 1`   |
| Pod QoS class                       | (ignore for rate card)                      |
| (none)                              | `currency`, `min_billable_seconds`, `rounding` — we must add |
