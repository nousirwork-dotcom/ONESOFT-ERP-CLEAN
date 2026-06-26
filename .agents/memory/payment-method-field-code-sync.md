---
name: Payment method ↔ field dictionary code sync
description: How payment method codes must align with field dictionary codes for journal posting to work correctly
---

## The Rule
Payment method `code` (e.g. `POIN`) must exactly match the `postingName` used in document journal account links AND the field dictionary code. All three must use the same string.

## Why
`resolveInvoiceFieldValue` (posting.ts default case) looks up `breakdown[fieldCode]`. The breakdown keys are payment method codes. If account link uses `POINT_1` but PM code is `POIN`, the lookup returns undefined → line resolves to 0 → journal unbalanced.

## How to apply
1. When a custom payment method is created, `paymentMethods.create` now auto-inserts a matching field dictionary entry with code = pm.code (category: Payment Fields).
2. In DocumentJournalsPage account links UI, users must choose the field code that matches the PM code exactly.
3. The auto-balance in `buildSalesInvoiceLines` now fetches all org payment methods dynamically (not hardcoded CASH/CARD/BANK list) to detect uncovered methods.
4. Historical mismatch fix: Run SQL to update journal account links from old custom code to correct PM code.
