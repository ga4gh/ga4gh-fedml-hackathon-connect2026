# OGF Usage Record (GFD.98 / GFD.204)

## Resources considered

- OGF Usage Record 1.0 (GFD.98): https://ogf.org/documents/GFD.98.pdf
- OGF Usage Record 2.0 (GFD.204): https://ogf.org/documents/GFD.204.pdf
- OGF document index: https://ogf.org/ogf/doku.php/documents/documents.html
- APEL (accounting tool that consumes UR): https://apel.github.io/
- EGI Accounting Portal: https://accounting.egi.eu/
- WLCG accounting documentation: https://wlcg.web.cern.ch/

## Overview

The Open Grid Forum (OGF) Usage Record (UR) is an XML schema for reporting the *consumption* of compute resources. UR 1.0 was published as GFD.98 in 2006; UR 2.0 (GFD.204) extended it in 2013 with cloud-era fields. OGF itself has been dormant since ~2017, but the specification is actively used in production: APEL, EGI, WLCG, and the broader European grid ecosystem have reported billions of usage records against it for two decades. The XML namespace is `http://schema.ogf.org/urf/2003/09/urf`.

UR is the **usage half** of the accounting loop. It has no concept of price — only "who ran what, where, for how long, using how much of which resource." A rate card multiplied by a Usage Record yields an invoice.

## How it models pricing / cost

There is no `Price` element. What UR provides is a rigorous, standardized vocabulary of *consumption dimensions* that a rate card must price against:

- `CpuDuration` (seconds, with `usageType` = `user` / `system` / `all`)
- `WallDuration` (seconds)
- `Memory` (KB, with `storageUnit`, `metric` = `max` / `average` / `total`)
- `Disk` (KB, similar qualifiers)
- `Network` (inbound/outbound bytes)
- `Nodes`, `Processors` (`consumptionRate`, `metric`)
- `ServiceLevel` (a free-form tier label, e.g. "premium", "preemptible")
- `SubmitHost`, `MachineName`, `Host`, `Queue`
- `UserIdentity` (DN, local username, VO/project)
- `ProjectName`, `Charge` (optional opaque site-specific number)
- `StartTime`, `EndTime`, `RecordIdentity`

Example (abbreviated):

```xml
<UsageRecord xmlns="http://schema.ogf.org/urf/2003/09/urf">
  <RecordIdentity urf:recordId="rivanna-2026-04-15-00001"
                  urf:createTime="2026-04-15T10:30:00Z"/>
  <JobIdentity><GlobalJobId>slurm.rivanna.12345</GlobalJobId></JobIdentity>
  <UserIdentity>
    <LocalUserId>nsheff</LocalUserId>
    <GlobalUserName>nsheff@virginia.edu</GlobalUserName>
    <ProjectName>sheffield_lab</ProjectName>
  </UserIdentity>
  <MachineName>rivanna.hpc.virginia.edu</MachineName>
  <Queue>standard</Queue>
  <WallDuration>PT3600S</WallDuration>
  <CpuDuration urf:usageType="user">PT14400S</CpuDuration>
  <Memory urf:storageUnit="KB" urf:metric="max">8388608</Memory>
  <Processors urf:metric="total">4</Processors>
  <ServiceLevel urf:type="partition">cpu</ServiceLevel>
  <StartTime>2026-04-15T09:30:00Z</StartTime>
  <EndTime>2026-04-15T10:30:00Z</EndTime>
</UsageRecord>
```

APEL extends this with a `CloudUsageRecord` variant for VM-style accounting (IaaS: `CloudType`, `ImageId`, `VMStatus`).

## Relevance to a federated rate card

High. UR is the closest thing to a grid-scale, production-hardened consumption schema, and WLCG is a biomedical-grid cousin of GA4GH workloads. Three reasons to take it seriously:

1. **Unit alignment.** If our rate card prices `vCPU-hour` and `GB-hour`, the *units must match* what UR reports — otherwise invoices diverge. Adopting UR's dimensions (CpuDuration, WallDuration, Memory as max/avg/total) forces us to be precise about *what* we are charging per.
2. **Proven at scale.** 20 years of WLCG / EGI deployment across hundreds of heterogeneous sites — exactly our federation shape (academic HPC + national centers).
3. **Identity model** (`UserIdentity`, `ProjectName`, `VO`) maps cleanly onto GA4GH Passport/AAI.

## What's missing

- **No pricing.** UR is consumption-only by design.
- **XML only.** No official JSON-LD or OpenAPI binding; modern consumers have to wrap it.
- **Stale governance.** OGF has not published since ~2017; bug-fixes happen downstream in APEL.
- **No GPU-first vocabulary.** `Processors` was built for CPU cores; GPU accounting in APEL is a convention layered on top, not a first-class field.
- **No storage tiering** (hot/warm/cold/archive) beyond raw `Disk`.
- **No network egress pricing dimensions** matching cloud reality (per-region, per-destination).

## Proposed mapping to our schema

We should treat UR as the **target usage shape** that our rate card *multiplies against*, not as a rate card itself. Concretely:

| Our rate-card unit | Must price the UR field |
|---|---|
| `rate.per = "cpu_hour"` | `CpuDuration` (convert PT...S to hours) |
| `rate.per = "wall_hour"` | `WallDuration` |
| `rate.per = "gb_hour_memory"` | `Memory` (max or avg) × `WallDuration` |
| `rate.per = "gb_month_storage"` | `Disk` sampled over billing window |
| `rate.per = "gb_egress"` | `Network` (outbound) |
| `rate.per = "gpu_hour"` | APEL GPU extension field |
| `rate.service_level` | UR `ServiceLevel` (same free-form tier label) |
| `rate.queue` / `partition` | UR `Queue` |
| `rate.project` | UR `ProjectName` |

Recommendation: publish a small "unit dictionary" alongside our `/api/rates` response that declares, for each priced unit, the exact UR field and metric (e.g. `Memory@metric=max`) it consumes. This makes the federation's rate × usage = invoice pipeline unambiguous and gives APEL/EGI-native sites a drop-in integration path.
