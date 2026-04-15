# Lago

This review closes a loop opened by a collaborator in the sibling
`02-billing-cost-accounting/costing-standard/` directory. Lago is a billing
backend, not a rate-card standard, so its relevance to `/api/rates` is on the
*invoice* side of the rate × usage loop rather than the schema side.

## Resources considered

- https://getlago.com/
- https://docs.getlago.com/
- https://github.com/getlago/lago

## Overview

Lago is an open-source usage-based billing and metering platform, frequently
positioned as the OSS alternative to Stripe Billing and Metronome. The core
is AGPLv3 (a proprietary enterprise edition exists with extra connectors and
SLA support). It's Ruby-on-Rails + Postgres + Redis + ClickHouse, shipped as
Docker images with a REST API and webhooks. The problem it solves: ingesting
per-event usage, defining billable metrics over those events, attaching them
to subscription plans with multiple pricing models, and emitting invoices and
tax-ready line items.

## How it models pricing / billing

Core entities: **Organization**, **Customer**, **BillableMetric** (how to
turn events into a billable quantity), **Plan** (a subscription blueprint),
**Charge** (a BillableMetric attached to a Plan with a pricing model),
**Subscription**, **Wallet** (prepaid credits), **Coupon**, **Invoice**.
Pricing models on a Charge include **standard** (flat per-unit),
**graduated**, **package** (bundles of N), **percentage**, and **volume**
(bulk tiers). Plans can be `pay_in_advance` or `pay_in_arrears`, and can
combine flat recurring fees with metered charges.

Example billable metric + charge (abbreviated JSON):

```json
{
  "billable_metric": {
    "code": "gpu_hours",
    "aggregation_type": "sum_agg",
    "field_name": "gpu_hours"
  },
  "charge": {
    "billable_metric_code": "gpu_hours",
    "charge_model": "graduated",
    "properties": {
      "graduated_ranges": [
        {"from_value": 0, "to_value": 100, "per_unit_amount": "2.50"},
        {"from_value": 101, "to_value": null, "per_unit_amount": "1.75"}
      ]
    }
  }
}
```

## Usage metering

Lago ingests per-event usage via `POST /api/v1/events` with a payload
carrying `transaction_id` (idempotency key), `external_subscription_id`,
`code` (matching a billable metric), `timestamp`, and free-form
`properties`. Aggregations include `count_agg`, `sum_agg`, `max_agg`,
`unique_count_agg`, `weighted_sum_agg` (time-weighted, useful for "peak
GB-hours"), and `latest_agg`. A `/customers/:id/current_usage` endpoint
returns live usage-to-date. This is a true per-event ingestion model, with
ClickHouse as the analytical backend for large volumes.

## Relevance to a federated compute rate card

Lago is a **billing backend**, not a rate-card standard. It does not help
define what a "rate card" means for heterogeneous compute; it defines how to
price and invoice given a billable metric and a stream of events. It is,
however, a plausible downstream consumer of our `/api/rates` endpoint:
`/api/rates` defines meters + prices + units, and an adapter translates each
rate into a Lago BillableMetric + Plan + Charge. Per-job OGF Usage Records
from federation nodes map cleanly to Lago events via `properties`.

## What's missing

No concept of: multi-site federation, per-site rate variation, GPU family
granularity as a first-class dimension (has to be encoded in `properties`),
preemption/spot pricing, grant/cost-center accounting, academic chargeback,
or data-locality pricing. Lago is tenant-shaped (one customer, one plan, one
subscription); a federated compute user is "one PI, many sites, many
allocation sources" which Lago models only awkwardly.

## Proposed role

Do not adopt Lago's schema as the rate-card standard. **But Lago is the
strongest candidate among the four reviewed here for a reference
implementation of the invoice side.** Concrete proposal: add a small
`lago_adapter.py` next to the `/api/rates` FastAPI app that, given a rate
card, provisions Lago BillableMetrics and a Plan; add a usage-forwarder that
takes job-completion events and pushes them to `POST /api/v1/events`. This
gives the hackathon a demonstrable end-to-end loop (rate card -> usage ->
invoice) with a real open-source backend, and it validates that the
`/api/rates` schema is expressive enough to drive a production billing
system. The borrowed vocabulary (BillableMetric, Charge, aggregation type,
charge_model) is also worth considering when naming fields in our own
schema, even if we don't adopt Lago itself.
