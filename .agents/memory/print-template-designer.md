---
name: PrintTemplateDesigner config_v1
description: How TemplateLayout relates to DocTemplateConfig used by InvoicePrintModal
---

`TemplateLayout` (in PrintTemplateDesigner.tsx) doubles as `DocTemplateConfig`
(expected by InvoicePrintModal.tsx). The bridge fields are:

- `type: "config_v1"` — checked by SalesInvoicePage to decide whether to pass
  the template config to InvoicePrintModal
- `language: "ar" | "bilingual"` — controls bilingual rendering
- `primaryColor: string` — header/accent color
- `columns: { num, code, name, unit, qty, price, discount, taxable, taxRate, taxAmt, total }` — visible table columns
- `sections: { sellerInfo, customerInfo, amountInWords, pageNumber, signatures }` — optional sections
- `minRows: number` — minimum blank rows in items table

`handleSave()` must emit ALL of these fields or InvoicePrintModal falls back to defaults.

**Why:** InvoicePrintModal checks `parsed.type === "config_v1"` before using any
template config; if the field is missing the whole template system is a no-op.

**How to apply:** Any future edit to handleSave or TemplateLayout must keep all
config_v1 fields in sync across both files.
