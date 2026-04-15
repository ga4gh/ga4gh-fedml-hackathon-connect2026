# Flexprice

This review closes a loop opened by a collaborator in the sibling
`02-billing-cost-accounting/costing-standard/` directory, who flagged several
commercial and open-source billing platforms as worth reviewing alongside the
`/api/rates` rate-card work. Flexprice sits on the *invoice/metering* side, not
the rate-card-schema side.

## Resources considered

- https://flexprice.io/
- https://docs.flexprice.io/
- https://github.com/flexprice/flexprice

## Overview

Flexprice is a monetization/metering backend marketed at "AI-native" SaaS
companies that need usage-based, credit-based, and hybrid pricing. The core is
open source (Apache 2.0) on GitHub; a managed hosted tier is commercial. Its
pitch is "Stripe Billing, but usage-first, with real-time metering for LLM
tokens, API calls, and compute units." The value proposition is that
rating/metering of streaming events is a first-class primitive rather than an
afterthought layered on top of subscriptions.

## How it models pricing / billing

The core objects are: **Event** (a raw usage datum), **Meter** (a definition
that filters and aggregates events into a billable quantity), **Feature**
(something a customer is entitled to, typically backed by a meter), **Price /
Plan** (tiered/volume/package pricing attached to a meter), **Customer**, and
**Subscription**. Plans can mix a flat recurring fee with per-meter usage
charges and credit grants. Tiered pricing supports volume, graduated, and
"slab" models similar to Stripe and Lago.

Example event ingest shape (simplified from docs):

```json
{
  "event_name": "llm_tokens",
  "external_customer_id": "cust_42",
  "timestamp": "2026-04-15T12:00:00Z",
  "properties": {
    "model": "gpt-4",
    "input_tokens": 1200,
    "output_tokens": 340
  }
}
```

A meter then says "sum `properties.input_tokens + properties.output_tokens`
filtered by `model=gpt-4`" and a price says "$0.01 per 1000 tokens, graduated."

## Usage metering

Flexprice ingests per-event usage via a REST `POST /events` endpoint (also
exposes bulk ingest). Events are stored and re-aggregated on demand, so meter
definitions can change without requiring re-emission. Aggregations supported
include `sum`, `count`, `unique_count`, `max`, and `latest`. Real-time balance
endpoints let callers check "how much has this customer used this period"
before issuing more work — relevant for prepaid/credit workflows. This is a
genuinely per-event ingestion model (not pre-aggregated), which makes it
plausible as a sink for per-job telemetry coming off a federation node.

## Relevance to a federated compute rate card

Flexprice is a billing backend, not a rate-card schema. It has no concept of
heterogeneous compute, sites, or scientific workflows; it only knows
"customer", "event", "meter", "price." It could, however, sit *downstream* of
our `/api/rates` endpoint: the rate card would define meters and prices, and a
small adapter would translate a `/api/rates` response into a Flexprice plan
and feature set, then push per-job usage events to `POST /events` as jobs
complete on federation nodes.

## What's missing

No notion of multi-site federation, preemption, spot-vs-on-demand pricing,
data-egress pricing tied to a location, GPU-family granularity, or academic
chargeback codes (grants, cost centers, cluster allocations). No awareness
that the same "compute unit" on different sites has different real cost. No
hooks for policy-based pricing (e.g. "use spot when possible"). Licensing is
permissive but the hosted service is the commercial pitch, so some governance
features are cloud-only.

## Proposed role

Do **not** adopt Flexprice's schema as the rate-card standard — it is too
tenant/SaaS-shaped and would force federation concepts into meter properties.
But Flexprice is a reasonable **reference target** for the invoice side of
the loop: demonstrate that a `/api/rates` response can be mechanically
compiled into Flexprice plan + meter definitions, and that OGF Usage Records
coming off a node can be mapped to Flexprice events. If we want a concrete
"what does the downstream look like" demo, Flexprice is probably the
cleanest OSS choice of the four, because its event model is the most
AI/compute-shaped.
