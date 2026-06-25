---
name: toLocaleString comma bug in DB writes
description: fmt() uses toLocaleString('en-US') which adds thousands commas to numbers ≥ 1000, breaking PostgreSQL decimal parsing
---

## The Rule
Never use `toLocaleString` (or any locale-aware formatter) for values destined for PostgreSQL decimal/numeric columns. Use `toFixed(N)` instead.

**Why:** `(1000).toLocaleString('en-US', {...})` → `"1,000.000"`. PostgreSQL rejects "1,000.000" as an invalid numeric literal. The error appears as "Failed query: insert into..." with no PG error code/detail (Drizzle wraps but doesn't always expose the PG fields). Numbers < 1000 work fine, making the bug intermittent and hard to spot.

**How to apply:** In SalesInvoicePage.tsx, `fmt()` is for display only. `fmtDb()` (uses `n.toFixed(4)`) is for any value written to the DB — subtotal, discountAmount, taxAmount, total, paidAmount, remainingAmount. Apply the same pattern in any other page that formats numbers for DB inserts/updates.
