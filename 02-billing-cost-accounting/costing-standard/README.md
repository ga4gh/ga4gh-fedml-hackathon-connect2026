# Overview

Here we contemplate a standard model for costing and billing. Below we collect references and resources related to existing models, standards, and tools we could draw from.

## Open Source Costing
1. [Flexprice](https://flexprice.io/): features include AI metering
2. [Lagos](https://getlago.com/)
2. [Kill Bill](https://killbill.io/)
3. [OpenCost](https://opencost.io/)
4. [OpenSourceBilling](https://opensourcebilling.org/)


## Standards

### 1. ISO Standards for Billing

#### ISO 14452:2012 – Network Services Billing – Requirements

This standard specifies minimum requirements for billing consumption‑based utility network services (e.g., electricity, water, gas, telecoms, Internet) to domestic customers, including content, structure, and handling of billing documents (paper or electronic).

It is not limited to transport or payments but focuses on how bills are produced, what they must contain, and how disputes or corrections are handled.

#### ISO 12855:2022 – Electronic Fee Collection – Information Exchange

This standard defines interfaces and data‑exchange formats between electronic‑fee‑collection back‑office systems, such as between a service provider and a toll‑charging operator (e.g., road‑toll, parking, access control systems).

It covers billing‑related data such as toll declarations, billing details, and confirmation messages, with defined syntax and semantics.

#### ISO/IEC JTC 1 – Cloud Metering and Billing

ISO/IEC 17788 and related “cloud service metering and billing elements” work define how cloud resource usage should be measured, controlled, and reported so that CSPs can bill customers based on actual consumption.

These standards are not full “online billing protocols” per se but provide the conceptual and semantic basis for metering and billing in cloud services.

### 2. W3C Standards

W3C does not maintain a generic "billing standard" in the same way ISO does, but it does host activities that support online billing and payment flows:

#### W3C Web Payments

W3C's Web Payments Working and Interest Groups have developed standards like the **Payment Request API** to help browsers and merchants interoperate on payment flows, receipts, and tokenized transactions.

These standards focus on payment and checkout interoperability rather than the detailed structure of billing documents or long‑term billing cycles.

#### General W3C Web Standards

W3C's broader web‑architecture and data‑format standards (e.g., **JSON‑LD**, digital receipts, and machine‑readable invoices) are often reused or mapped into billing systems, even if they are not "billing standards" in name.