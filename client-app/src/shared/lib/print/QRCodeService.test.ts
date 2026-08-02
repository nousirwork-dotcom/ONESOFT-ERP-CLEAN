import { describe, expect, it } from "vitest";
import { QRCodeService } from "./QRCodeService";

const invoiceData = {
  sellerName: "مؤسسة اختبار",
  taxNumber: "300000000000003",
  invoiceDateTime: "2026-08-02T12:00:00",
  totalAmount: 115,
  vatAmount: 15,
  invoiceNumber: "INV-TEST-001",
};

describe("QRCodeService invoice output", () => {
  it("generates a PNG data URL for an enabled sales invoice", async () => {
    const result = await QRCodeService.resolveForInvoice(
      {
        isEnabled: true,
        countrySystem: "zatca",
        showOnSalesInvoice: true,
        showOnPurchaseInvoice: false,
        showOnReceiptVoucher: false,
        qrSize: 100,
        qrPosition: "top-right",
      },
      invoiceData,
      "sales_invoice",
    );

    expect(result.show).toBe(true);
    expect(result.content).not.toBe("");
    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("does not generate a sales QR when the sales display flag is disabled", async () => {
    const result = await QRCodeService.resolveForInvoice(
      {
        isEnabled: true,
        countrySystem: "zatca",
        showOnSalesInvoice: false,
        showOnPurchaseInvoice: true,
        showOnReceiptVoucher: false,
        qrSize: 100,
        qrPosition: "top-right",
      },
      invoiceData,
      "sales_invoice",
    );

    expect(result.show).toBe(false);
    expect(result.dataUrl).toBe("");
  });
});