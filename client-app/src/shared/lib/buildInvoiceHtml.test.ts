import { describe, expect, it } from "vitest";
import { buildInvoiceHtml, type InvDocTemplateConfig, type InvPrintData } from "./buildInvoiceHtml";

const data: InvPrintData = {
  invoiceNumber: "INV-TEST-001",
  invoiceDate: "2026-08-02",
  invoiceTime: "12:00:00",
  customerName: "عميل نقدي",
  paymentType: "cash",
  currency: "SAR",
  lines: [{
    productCode: "P-001",
    productName: "خدمة اختبار",
    quantity: "1",
    unit: "وحدة",
    unitPrice: "100",
    discountPct: "0",
    taxPct: "15",
    taxAmt: "15",
    total: "115",
  }],
  subtotal: 100,
  discountTotal: 0,
  taxTotal: 15,
  grandTotal: 115,
  paidAmount: 115,
  remainingAmount: 0,
  sellerName: "مؤسسة اختبار",
  sellerTaxNumber: "300000000000003",
};

const positionedConfig: InvDocTemplateConfig = {
  type: "config_v1",
  renderer: "sales_invoice_reference_v1",
  language: "bilingual",
  primaryColor: "#406B93",
  columns: {
    num: true, code: true, name: true, unit: false, qty: true, price: true,
    discount: true, taxable: true, taxRate: true, taxAmt: true, total: true,
  },
  minRows: 5,
  sections: {
    sellerInfo: true, customerInfo: true, amountInWords: true,
    pageNumber: true, signatures: false,
  },
  elements: [
    { id: "qr", type: "qr", x: 5, y: 5, w: 28, h: 28 },
    { id: "items", type: "items_table", x: 5, y: 40, w: 200, h: 120 },
  ],
};

describe("sales invoice QR print output", () => {
  it("uses the attached landscape sales invoice design for sales invoices", () => {
    const html = buildInvoiceHtml(data, positionedConfig, undefined, "ZATCA QR", 100, "sales_invoice");

    expect(html).toContain('id="sales-invoice-print"');
    expect(html).toContain("A4 landscape");
    expect(html).toContain("P-001");
    expect(html).toContain("مؤسسة اختبار");
    expect(html).toContain("data:image/svg+xml");
    expect(html).not.toContain("class=\"page\"");
  });

  it("embeds the generated data URL in positioned invoice HTML", () => {
    const qrDataUrl = "data:image/png;base64,TEST_QR_DATA";
    const html = buildInvoiceHtml(
      data,
      {
        ...positionedConfig,
        renderer: undefined,
        elements: [
          { id: "qr", type: "qr", x: 5, y: 5, w: 40, h: 28 },
          { id: "items", type: "items_table", x: 5, y: 40, w: 200, h: 120 },
        ],
      },
      qrDataUrl,
      "ZATCA QR",
      100,
      "sales_invoice",
    );

    expect(html).toContain(`<img src="${qrDataUrl}"`);
    expect(html).toContain("ZATCA QR");
    expect(html).toContain('width="91"');
    expect(html).toContain('height="91"');
    expect(html).toContain("width:24mm;height:24mm");
  });

  it("does not emit an empty QR image when generation has no data URL", () => {
    const html = buildInvoiceHtml(data, positionedConfig, undefined, "ZATCA QR", 100, "sales_invoice");

    expect(html).not.toContain("<img src=\"undefined\"");
    expect(html).not.toContain("<img src=\"\"");
  });

  it("uses the normal configurable renderer when the selected template has no renderer", () => {
    const html = buildInvoiceHtml(data, { ...positionedConfig, renderer: undefined });

    expect(html).toContain('class="page"');
    expect(html).not.toContain('id="sales-invoice-print"');
  });
});