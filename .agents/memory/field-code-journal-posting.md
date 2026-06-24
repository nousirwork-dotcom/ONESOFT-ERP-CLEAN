---
name: Field-code journal posting pattern
description: Three coordinated changes needed to make paymentTypesConfig.accountLinks work end-to-end for sales invoice posting
---

## Rule
When adding or fixing field-code (accountLinks) posting for any document type, three places must all be updated together:

1. **Backend list endpoint** (`documentJournals.ts`): must accept `docTypes: string[]` array input so the page can query multiple docType aliases (e.g. "sales_invoice" + "sales") in one call.

2. **DocumentJournalsPage save condition**: `paymentTypesConfig` was originally gated on `selectedType === "sales"` only — must include all relevant types (`sales_invoice`, `sales_return`, `purchase_invoice`, `purchase_return`, `receipt_voucher`, `payment_voucher`).

3. **posting.ts validation** (both `autoPostSalesInvoice` and `postSalesInvoice`): legacy checks for `salesAccountId` / `cashAccountId` direct fields block posting when only `accountLinks` are configured. Must check `_hasFieldLinks` first and bypass the legacy validation if true.

**Why:** The "sales" docType was added as a workaround because paymentTypesConfig was only saved for that type. This caused SalesInvoicePage (querying "sales_invoice") to never see the configured journal, and posting to fail silently even when accountLinks were present.

**How to apply:** Any time a new document type needs field-code posting, add it to the three lists above.
