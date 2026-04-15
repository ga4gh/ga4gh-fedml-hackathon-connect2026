# Kill Bill

This review closes a loop opened by a collaborator in the sibling
`02-billing-cost-accounting/costing-standard/` directory. Kill Bill is a
mature, enterprise-grade billing backend — interesting as a reference point
but heavier than a federated ML hackathon needs.

## Resources considered

- https://killbill.io/
- https://docs.killbill.io/
- https://docs.killbill.io/latest/catalog.html
- https://docs.killbill.io/latest/userguide_subscription.html

## Overview

Kill Bill is an Apache-2.0-licensed subscription and billing platform,
originally built at Ning in 2010 and actively maintained. It's Java
(Tomcat/Jetty) backed by MySQL/Postgres, with an extensive REST API and a
plugin architecture (Stripe, PayPal, Avalara, custom). It solves the "full
billing platform" problem: catalog definition, subscription lifecycle,
usage billing, invoicing, payments, refunds, entitlements, and tax. Of the
four platforms reviewed in this directory, Kill Bill is the oldest, most
featureful, and most operationally heavy.

## How it models pricing / billing

Kill Bill's distinguishing feature is its **XML catalog** — a versioned,
declarative description of products, plans, phases, and prices. Core
entities: **Product** (what is sold), **Plan** (a priced offering of a
Product, possibly multi-phase: trial -> evergreen), **PlanPhase** (with its
own pricing and billing period), **Price** (amount in one or more
currencies), **Usage** (a metered component of a plan, either CONSUMABLE
like API calls or CAPACITY like "up to N seats"), **Tier** / **Block** for
stepped pricing, **Account** (customer), **Subscription**, **Invoice**,
**Payment**.

Minimal catalog excerpt:

```xml
<plan name="gpu-standard">
  <product>GpuCompute</product>
  <finalPhase type="EVERGREEN">
    <duration><unit>UNLIMITED</unit></duration>
    <usages>
      <usage name="gpu-hours" billingMode="IN_ARREAR" usageType="CONSUMABLE">
        <billingPeriod>MONTHLY</billingPeriod>
        <tiers>
          <tier><blocks><tieredBlock>
            <unit>gpu-hour</unit><size>1</size>
            <prices><price><currency>USD</currency><value>2.50</value></price></prices>
            <max>100</max>
          </tieredBlock></blocks></tier>
        </tiers>
      </usage>
    </usages>
  </finalPhase>
</plan>
```

Catalog changes are versioned; old subscriptions keep their price until
explicitly migrated. This is genuinely powerful for long-lived grants or
allocations.

## Usage metering

Kill Bill does **not** ingest arbitrary per-event streams the way Lago and
Flexprice do. Instead, clients push **pre-aggregated usage records** via
`POST /1.0/kb/usages` with `subscriptionId`, `unitType`, `amount`, and a
`recordDate`. The expectation is that an upstream metering system (or your
own service) does per-event aggregation and reports periodic rollups.
CONSUMABLE usage (API calls, GPU-hours) is summed and priced; CAPACITY
usage (peak concurrent seats) uses the reported max within a period. This
makes Kill Bill less convenient as a direct sink for raw job telemetry.

## Relevance to a federated compute rate card

Kill Bill is a billing backend, not a rate-card standard. However, its XML
catalog is the **most interesting schema artifact** of the four reviewed
here: it's the closest existing OSS analog to the kind of rate card
`/api/rates` will return. The concepts `Usage` + `usageType`
(CONSUMABLE/CAPACITY) + `Tier` + `Block` + `billingMode` (IN_ARREAR /
IN_ADVANCE) map cleanly onto federated compute primitives (GPU-hour is
CONSUMABLE, reserved-node slots are CAPACITY). Catalog versioning also
solves the "prices change mid-grant" problem that naive approaches fumble.

## What's missing

No multi-site federation. No concept that a plan's price depends on where
the work runs. No preemption/spot semantics. No academic chargeback, grant
accounting, or cost-center overlays. The XML format and Java runtime are
operationally heavy for a hackathon — spinning up Kill Bill for a demo is
an afternoon's work, not a five-minute Docker run like Lago.

## Proposed role

Do not adopt Kill Bill as our billing backend for the hackathon — too
heavy. But **do steal from its catalog vocabulary** when designing the
`/api/rates` response schema. Specifically: the CONSUMABLE vs CAPACITY
distinction, IN_ARREAR vs IN_ADVANCE billing modes, the `Tier` +
`TieredBlock` structure, and catalog versioning (effectiveDate on price
changes) are all directly applicable to federated compute and would
strengthen our schema. If a future group needs a reference invoice
backend for institutional deployments (as opposed to Lago for lighter
cases), Kill Bill is the right choice because its catalog model already
accommodates the things a rate card actually needs to express.
