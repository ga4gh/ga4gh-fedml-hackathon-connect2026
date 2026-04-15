# OpenSourceBilling (OSB)

This review closes a loop opened by a collaborator in the sibling
`02-billing-cost-accounting/costing-standard/` directory. Of the four tools
reviewed here, OpenSourceBilling is the least relevant to a federated
compute rate card, and it's worth documenting why rather than leaving the
question open.

## Resources considered

- https://opensourcebilling.org/
- https://github.com/vteams/open-source-billing

## Overview

OpenSourceBilling ("OSB") is a Ruby-on-Rails web application for
small-business invoicing. It's MIT-licensed and sponsored by vteams
(originally 247ne). Feature set per the landing page: create and send
invoices to clients, partial payment tracking, accept payments via PayPal
and credit card, invoice dispute management, and basic reports (payments
collected, revenue by client, aged accounts receivable, item sales). It
solves the problem of "a contractor or small agency needs to issue PDF
invoices and chase payments," not the problem of "a metering backend for
usage-priced infrastructure."

## How it models pricing / billing

Core entities: **Client**, **Item** (a named line-item template with
default rate and description), **Invoice** (a collection of line items for
a client, with status draft/sent/partial/paid/disputed), **Payment**
(applied against an invoice), **Tax** (rate applied per line or per
invoice), **Company** (the user's own business). There is no subscription
engine, no catalog, no metered billing primitive. An invoice line item is
quantity × rate, optionally taxed. Recurring invoices exist as templates
that copy forward, not as a subscription lifecycle. No public REST API of
note — the product is a hosted/self-hosted web app driven by its own UI.

## Usage metering

OpenSourceBilling has **no usage metering**. There is no event ingestion
endpoint, no billable metric concept, no aggregation engine. A user types
(or imports) line items into an invoice. This is the fundamental reason
it's not a peer of Lago, Flexprice, or Kill Bill: those are metering-first
platforms; OSB is an invoice-first bookkeeping app.

## Relevance to a federated compute rate card

Essentially none, directly. A rate-card API produces machine-consumable
pricing definitions meant to be multiplied by metered usage; OSB has no
mechanism to consume either side of that. You could imagine a very thin
integration — a nightly cron that takes computed charges from *another*
system, builds PDF invoices in OSB, and mails them to PIs — but OSB
contributes nothing to the rate-card schema, the metering pipeline, or the
rating calculation. It is strictly a presentation/AR layer for already-
computed amounts.

## What's missing

Everything that matters for federated compute: per-event ingestion,
aggregation, tiered pricing, catalog versioning, subscription state,
multi-site awareness, preemption, cost centers, grants. Also: no active
development cadence worth relying on, no REST API documentation, Rails
stack is older than the peers reviewed here, and the project appears to
be in maintenance mode on GitHub.

## Proposed role

**No role.** Do not adopt any part of OSB's schema; do not propose it as a
reference implementation. The honest finding for the collaborator in
`costing-standard/` is that OSB is a different category of software from
Lago/Flexprice/Kill Bill — it is an invoicing UI for humans, not a
metering/billing backend for systems. If the downstream need is
"eventually produce a human-readable invoice PDF," that's better solved
as a render step on top of Lago or Kill Bill output than by wiring in
OSB. This file exists mainly to document that the question was asked and
answered negatively.
