# Migration 0070 — Move outbound debit notes to sales

## Audit performed before migration

The development database was checked before applying migration `0070`:

```sql
SELECT count(*)
FROM purchase_invoices
WHERE invoice_type = 'debit_note';
```

Result: **0 rows**.

No purchase debit-note data was moved, deleted, or rewritten.

## Correction

- Adds `debit_note` to the shared sales invoice type enum.
- Adds a database check constraint that rejects `debit_note` in `purchase_invoices`.
- Keeps the ZATCA transaction lifecycle attached to `sales_invoices`.
- The outbound ZATCA document uses code `383`.
- Purchase invoices, purchase returns, and supplier adjustments remain internal documents and are not sent to ZATCA.

Migration `0069` is unchanged.