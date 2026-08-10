import { z } from 'zod';
import { eq, and, asc } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { documentTemplates } from '../schema.js';

const POS01_CONFIG = JSON.stringify({
  type: "pos_config_v1",
  paperWidth: "80mm",
  primaryColor: "#406B93",
  taxPct: 15,
  taxInclusive: true,
  show: {
    logo: false, taxNumber: true, commercialReg: true,
    address: true, phone: true, customerName: false,
    cashierName: true, itemCode: false, discount: true,
    prices: true, branchName: true, qr: true,
    amountInWords: false, thankYou: true,
    paymentMethod: true, changeAmount: true,
  },
  printMode: "detailed",
  thankYouMsg: "شكراً لتسوقكم معنا",
  copies: 1,
});

const INV01_CONFIG = JSON.stringify({
  version: 1,
  type: "config_v1",
  renderer: "sales_invoice_reference_v1",
  paperSize: "A4",
  orientation: "landscape",
  language: "bilingual",
  primaryColor: "#1B4F8E",
  columns: {
    num: true, code: true, name: true, unit: false,
    qty: true, price: true, discount: true,
    taxable: true, taxRate: true, taxAmt: true, total: true,
  },
  minRows: 5,
  sections: {
    sellerInfo: true, customerInfo: true,
    amountInWords: true, pageNumber: true, signatures: false,
  },
  elements: [
    { id: "e_qr",    type: "qr",           x: 5,   y: 5,   w: 28,  h: 28,  border: false },
    { id: "e_title", type: "text",          x: 71,  y: 6,   w: 68,  h: 20,  content: "فاتورة ضريبية\nTAX INVOICE", fontSize: 14, fontWeight: "bold", textAlign: "center", color: "#1B4F8E" },
    { id: "e_co",    type: "company_info",  x: 112, y: 4,   w: 93,  h: 30,  fontSize: 9 },
    { id: "e_d1",    type: "line",          x: 5,   y: 37,  w: 200, h: 1,   color: "#1B4F8E" },
    { id: "e_inv",   type: "invoice_info",  x: 5,   y: 40,  w: 200, h: 14,  fontSize: 9 },
    { id: "e_d2",    type: "line",          x: 5,   y: 56,  w: 200, h: 1,   color: "#dddddd" },
    { id: "e_cust",  type: "customer_info", x: 5,   y: 59,  w: 98,  h: 34,  fontSize: 9, border: true },
    { id: "e_d3",    type: "line",          x: 5,   y: 95,  w: 200, h: 1,   color: "#dddddd" },
    { id: "e_items", type: "items_table",   x: 5,   y: 98,  w: 200, h: 120, fontSize: 9 },
    { id: "e_total", type: "totals",        x: 118, y: 222, w: 87,  h: 50,  fontSize: 10, border: true },
    { id: "e_words", type: "notes",         x: 5,   y: 222, w: 109, h: 15,  content: "المبلغ كتابةً: {{AmountInWords}}", fontSize: 9 },
    { id: "e_notes", type: "notes",         x: 5,   y: 239, w: 109, h: 12,  content: "ملاحظات: {{Notes}}", fontSize: 9 },
    { id: "e_d4",    type: "line",          x: 5,   y: 275, w: 200, h: 1,   color: "#dddddd" },
    { id: "e_foot",  type: "text",          x: 5,   y: 278, w: 200, h: 8,   content: "OneSoft ERP  ·  صفحة 1 من 1 / Page 1 of 1", fontSize: 7.5, textAlign: "center", color: "#999999" },
  ],
});

const PINV01_CONFIG = JSON.stringify({
  version: 1,
  type: "config_v1",
  paperSize: "A4",
  orientation: "portrait",
  language: "bilingual",
  primaryColor: "#4A5568",
  columns: {
    num: true, code: true, name: true, unit: false,
    qty: true, price: true, discount: true,
    taxable: true, taxRate: true, taxAmt: true, total: true,
  },
  minRows: 5,
  sections: {
    sellerInfo: true, customerInfo: true,
    amountInWords: true, pageNumber: true, signatures: false,
  },
  elements: [
    { id: "e_qr",    type: "qr",           x: 5,   y: 5,   w: 28,  h: 28,  border: false },
    { id: "e_title", type: "text",          x: 71,  y: 6,   w: 68,  h: 20,  content: "فاتورة مشتريات\nPURCHASE INVOICE", fontSize: 14, fontWeight: "bold", textAlign: "center", color: "#4A5568" },
    { id: "e_co",    type: "company_info",  x: 112, y: 4,   w: 93,  h: 30,  fontSize: 9 },
    { id: "e_d1",    type: "line",          x: 5,   y: 37,  w: 200, h: 1,   color: "#4A5568" },
    { id: "e_inv",   type: "invoice_info",  x: 5,   y: 40,  w: 200, h: 14,  fontSize: 9 },
    { id: "e_d2",    type: "line",          x: 5,   y: 56,  w: 200, h: 1,   color: "#dddddd" },
    { id: "e_cust",  type: "customer_info", x: 5,   y: 59,  w: 98,  h: 34,  fontSize: 9, border: true },
    { id: "e_d3",    type: "line",          x: 5,   y: 95,  w: 200, h: 1,   color: "#dddddd" },
    { id: "e_items", type: "items_table",   x: 5,   y: 98,  w: 200, h: 120, fontSize: 9 },
    { id: "e_total", type: "totals",        x: 118, y: 222, w: 87,  h: 50,  fontSize: 10, border: true },
    { id: "e_words", type: "notes",         x: 5,   y: 222, w: 109, h: 15,  content: "المبلغ كتابةً: {{AmountInWords}}", fontSize: 9 },
    { id: "e_notes", type: "notes",         x: 5,   y: 239, w: 109, h: 12,  content: "ملاحظات: {{Notes}}", fontSize: 9 },
    { id: "e_d4",    type: "line",          x: 5,   y: 275, w: 200, h: 1,   color: "#dddddd" },
    { id: "e_foot",  type: "text",          x: 5,   y: 278, w: 200, h: 8,   content: "OneSoft ERP  ·  صفحة 1 من 1 / Page 1 of 1", fontSize: 7.5, textAlign: "center", color: "#999999" },
  ],
});

const POD01_CONFIG = JSON.stringify({
  version: 1,
  type: "config_v1",
  paperSize: "A4",
  orientation: "portrait",
  language: "bilingual",
  primaryColor: "#1565C0",
  columns: {
    num: true, code: true, name: true, unit: true,
    qty: true, price: true, discount: false,
    taxable: false, taxRate: false, taxAmt: false, total: true,
  },
  minRows: 5,
  sections: {
    sellerInfo: true, customerInfo: true,
    amountInWords: true, pageNumber: true, signatures: true,
  },
  elements: [
    { id: "e_title", type: "text",          x: 60,  y: 5,   w: 90,  h: 20,  content: "أمر شراء\nPURCHASE ORDER", fontSize: 15, fontWeight: "bold", textAlign: "center", color: "#1565C0" },
    { id: "e_co",    type: "company_info",  x: 112, y: 4,   w: 93,  h: 30,  fontSize: 9 },
    { id: "e_d1",    type: "line",          x: 5,   y: 37,  w: 200, h: 1,   color: "#1565C0" },
    { id: "e_inv",   type: "invoice_info",  x: 5,   y: 40,  w: 200, h: 14,  fontSize: 9 },
    { id: "e_d2",    type: "line",          x: 5,   y: 56,  w: 200, h: 1,   color: "#dddddd" },
    { id: "e_cust",  type: "customer_info", x: 5,   y: 59,  w: 98,  h: 34,  fontSize: 9, border: true },
    { id: "e_d3",    type: "line",          x: 5,   y: 95,  w: 200, h: 1,   color: "#dddddd" },
    { id: "e_items", type: "items_table",   x: 5,   y: 98,  w: 200, h: 120, fontSize: 9 },
    { id: "e_total", type: "totals",        x: 130, y: 222, w: 75,  h: 40,  fontSize: 10, border: true },
    { id: "e_words", type: "notes",         x: 5,   y: 222, w: 120, h: 15,  content: "المبلغ كتابةً: {{AmountInWords}}", fontSize: 9 },
    { id: "e_notes", type: "notes",         x: 5,   y: 239, w: 120, h: 12,  content: "ملاحظات: {{Notes}}", fontSize: 9 },
    { id: "e_d4",    type: "line",          x: 5,   y: 275, w: 200, h: 1,   color: "#dddddd" },
    { id: "e_foot",  type: "text",          x: 5,   y: 278, w: 200, h: 8,   content: "OneSoft ERP  ·  صفحة 1 من 1 / Page 1 of 1", fontSize: 7.5, textAlign: "center", color: "#999999" },
  ],
});

const PRN01_CONFIG = JSON.stringify({
  version: 1,
  type: "config_v1",
  paperSize: "A4",
  orientation: "portrait",
  language: "bilingual",
  primaryColor: "#C0392B",
  columns: {
    num: true, code: true, name: true, unit: false,
    qty: true, price: true, discount: true,
    taxable: false, taxRate: true, taxAmt: true, total: true,
  },
  minRows: 5,
  sections: {
    sellerInfo: true, customerInfo: true,
    amountInWords: true, pageNumber: true, signatures: false,
  },
  elements: [
    { id: "e_title", type: "text",          x: 60,  y: 5,   w: 90,  h: 20,  content: "مردود مشتريات\nPURCHASE RETURN", fontSize: 14, fontWeight: "bold", textAlign: "center", color: "#C0392B" },
    { id: "e_co",    type: "company_info",  x: 112, y: 4,   w: 93,  h: 30,  fontSize: 9 },
    { id: "e_d1",    type: "line",          x: 5,   y: 37,  w: 200, h: 1,   color: "#C0392B" },
    { id: "e_inv",   type: "invoice_info",  x: 5,   y: 40,  w: 200, h: 14,  fontSize: 9 },
    { id: "e_d2",    type: "line",          x: 5,   y: 56,  w: 200, h: 1,   color: "#dddddd" },
    { id: "e_cust",  type: "customer_info", x: 5,   y: 59,  w: 98,  h: 34,  fontSize: 9, border: true },
    { id: "e_d3",    type: "line",          x: 5,   y: 95,  w: 200, h: 1,   color: "#dddddd" },
    { id: "e_items", type: "items_table",   x: 5,   y: 98,  w: 200, h: 120, fontSize: 9 },
    { id: "e_total", type: "totals",        x: 118, y: 222, w: 87,  h: 50,  fontSize: 10, border: true },
    { id: "e_words", type: "notes",         x: 5,   y: 222, w: 109, h: 15,  content: "المبلغ كتابةً: {{AmountInWords}}", fontSize: 9 },
    { id: "e_notes", type: "notes",         x: 5,   y: 239, w: 109, h: 12,  content: "ملاحظات: {{Notes}}", fontSize: 9 },
    { id: "e_d4",    type: "line",          x: 5,   y: 275, w: 200, h: 1,   color: "#dddddd" },
    { id: "e_foot",  type: "text",          x: 5,   y: 278, w: 200, h: 8,   content: "OneSoft ERP  ·  صفحة 1 من 1 / Page 1 of 1", fontSize: 7.5, textAlign: "center", color: "#999999" },
  ],
});

const RVCH01_CONFIG = JSON.stringify({
  version: 1,
  type: "config_v1",
  paperSize: "A4",
  orientation: "portrait",
  language: "bilingual",
  primaryColor: "#16A34A",
  columns: {
    num: false, code: false, name: true, unit: false,
    qty: false, price: false, discount: false,
    taxable: false, taxRate: false, taxAmt: false, total: false,
  },
  minRows: 3,
  sections: {
    sellerInfo: true, customerInfo: false,
    amountInWords: true, pageNumber: false, signatures: true,
  },
  elements: [
    { id: "e_title", type: "text",          x: 60,  y: 8,   w: 90,  h: 20,  content: "سند قبض\nRECEIPT VOUCHER", fontSize: 16, fontWeight: "bold", textAlign: "center", color: "#16A34A" },
    { id: "e_co",    type: "company_info",  x: 112, y: 6,   w: 93,  h: 28,  fontSize: 9 },
    { id: "e_d1",    type: "line",          x: 5,   y: 38,  w: 200, h: 1,   color: "#16A34A" },
    { id: "e_inv",   type: "invoice_info",  x: 5,   y: 42,  w: 200, h: 14,  fontSize: 9 },
    { id: "e_d2",    type: "line",          x: 5,   y: 58,  w: 200, h: 1,   color: "#dddddd" },
    { id: "e_total", type: "totals",        x: 60,  y: 65,  w: 140, h: 40,  fontSize: 12, border: true },
    { id: "e_words", type: "notes",         x: 5,   y: 115, w: 200, h: 15,  content: "المبلغ كتابةً: {{AmountInWords}}", fontSize: 10 },
    { id: "e_notes", type: "notes",         x: 5,   y: 135, w: 200, h: 12,  content: "البيان: {{Notes}}", fontSize: 9 },
    { id: "e_d4",    type: "line",          x: 5,   y: 275, w: 200, h: 1,   color: "#dddddd" },
    { id: "e_foot",  type: "text",          x: 5,   y: 278, w: 200, h: 8,   content: "OneSoft ERP  ·  سند قبض / Receipt Voucher", fontSize: 7.5, textAlign: "center", color: "#999999" },
  ],
});

const PVCH01_CONFIG = JSON.stringify({
  version: 1,
  type: "config_v1",
  paperSize: "A4",
  orientation: "portrait",
  language: "bilingual",
  primaryColor: "#DC2626",
  columns: {
    num: false, code: false, name: true, unit: false,
    qty: false, price: false, discount: false,
    taxable: false, taxRate: false, taxAmt: false, total: false,
  },
  minRows: 3,
  sections: {
    sellerInfo: true, customerInfo: false,
    amountInWords: true, pageNumber: false, signatures: true,
  },
  elements: [
    { id: "e_title", type: "text",          x: 60,  y: 8,   w: 90,  h: 20,  content: "سند صرف\nPAYMENT VOUCHER", fontSize: 16, fontWeight: "bold", textAlign: "center", color: "#DC2626" },
    { id: "e_co",    type: "company_info",  x: 112, y: 6,   w: 93,  h: 28,  fontSize: 9 },
    { id: "e_d1",    type: "line",          x: 5,   y: 38,  w: 200, h: 1,   color: "#DC2626" },
    { id: "e_inv",   type: "invoice_info",  x: 5,   y: 42,  w: 200, h: 14,  fontSize: 9 },
    { id: "e_d2",    type: "line",          x: 5,   y: 58,  w: 200, h: 1,   color: "#dddddd" },
    { id: "e_total", type: "totals",        x: 60,  y: 65,  w: 140, h: 40,  fontSize: 12, border: true },
    { id: "e_words", type: "notes",         x: 5,   y: 115, w: 200, h: 15,  content: "المبلغ كتابةً: {{AmountInWords}}", fontSize: 10 },
    { id: "e_notes", type: "notes",         x: 5,   y: 135, w: 200, h: 12,  content: "البيان: {{Notes}}", fontSize: 9 },
    { id: "e_d4",    type: "line",          x: 5,   y: 275, w: 200, h: 1,   color: "#dddddd" },
    { id: "e_foot",  type: "text",          x: 5,   y: 278, w: 200, h: 8,   content: "OneSoft ERP  ·  سند صرف / Payment Voucher", fontSize: 7.5, textAlign: "center", color: "#999999" },
  ],
});

async function ensureSalesReferenceTemplate(
  template: typeof documentTemplates.$inferSelect | null | undefined,
  orgId: number,
) {
  if (!template || template.docType !== 'sales_invoice' || template.code !== 'INV01') {
    return template ?? null;
  }

  let isLegacy = false;
  try {
    const parsed = template.layoutJson
      ? JSON.parse(template.layoutJson) as Record<string, unknown>
      : null;
    isLegacy = parsed?.type === 'config_v1' && !parsed?.renderer;
  } catch { /* لا نغيّر قالباً غير صالح تلقائياً */ }

  if (!isLegacy) return template;

  const [updated] = await db.update(documentTemplates)
    .set({ layoutJson: INV01_CONFIG, orientation: 'landscape', updatedAt: new Date() })
    .where(and(eq(documentTemplates.id, template.id), eq(documentTemplates.orgId, orgId)))
    .returning();

  return updated ?? { ...template, layoutJson: INV01_CONFIG, orientation: 'landscape' };
}

export const documentTemplatesRouter = router({

  list: protectedProcedure
    .input(z.object({ docType: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where = input?.docType
        ? and(eq(documentTemplates.orgId, ctx.user.orgId), eq(documentTemplates.docType, input.docType), eq(documentTemplates.isActive, true))
        : and(eq(documentTemplates.orgId, ctx.user.orgId), eq(documentTemplates.isActive, true));
      return db.query.documentTemplates.findMany({
        where,
        orderBy: [asc(documentTemplates.sortOrder), asc(documentTemplates.id)],
      });
    }),

  getByCode: protectedProcedure
    .input(z.object({ docType: z.string(), code: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const template = await db.query.documentTemplates.findFirst({
        where: and(
          eq(documentTemplates.orgId, ctx.user.orgId),
          eq(documentTemplates.docType, input.docType),
          eq(documentTemplates.code, input.code),
          eq(documentTemplates.isActive, true),
        ),
      }) ?? null;
      return ensureSalesReferenceTemplate(template, ctx.user.orgId);
    }),

  getDefault: protectedProcedure
    .input(z.object({ docType: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      let tpl: typeof documentTemplates.$inferSelect | null = (await db.query.documentTemplates.findFirst({
        where: and(
          eq(documentTemplates.orgId, orgId),
          eq(documentTemplates.docType, input.docType),
          eq(documentTemplates.isDefault, true),
          eq(documentTemplates.isActive, true),
        ),
      })) ?? null;
      tpl = await ensureSalesReferenceTemplate(tpl, orgId);
      // إذا لم يوجد نموذج افتراضي، أنشئه تلقائياً (seed)
      if (!tpl) {
        const defMap: Record<string, { code: string; nameAr: string; nameEn: string; paperSize: string; layoutJson: string }> = {
          sales_invoice: {
            code: 'INV01', nameAr: 'نموذج المبيعات الأساسي', nameEn: 'Standard Sales Invoice',
            paperSize: 'A4', layoutJson: INV01_CONFIG,
          },
          purchase_invoice: {
            code: 'PINV01', nameAr: 'نموذج المشتريات الأساسي', nameEn: 'Standard Purchase Invoice',
            paperSize: 'A4', layoutJson: PINV01_CONFIG,
          },
          purchase_order: {
            code: 'POD01', nameAr: 'نموذج أوامر الشراء الأساسي', nameEn: 'Standard Purchase Order',
            paperSize: 'A4', layoutJson: POD01_CONFIG,
          },
          purchase_return: {
            code: 'PRN01', nameAr: 'نموذج مردود المشتريات الأساسي', nameEn: 'Standard Purchase Return',
            paperSize: 'A4', layoutJson: PRN01_CONFIG,
          },
          receipt_voucher: {
            code: 'RVCH01', nameAr: 'نموذج سند القبض الأساسي', nameEn: 'Standard Receipt Voucher',
            paperSize: 'A4', layoutJson: RVCH01_CONFIG,
          },
          payment_voucher: {
            code: 'PVCH01', nameAr: 'نموذج سند الصرف الأساسي', nameEn: 'Standard Payment Voucher',
            paperSize: 'A4', layoutJson: PVCH01_CONFIG,
          },
          pos_receipt: {
            code: 'POS01', nameAr: 'نموذج نقاط البيع الحراري', nameEn: 'POS Thermal Receipt',
            paperSize: '80mm', layoutJson: POS01_CONFIG,
          },
        };
        const def = defMap[input.docType];
        if (def) {
          const existing = await db.query.documentTemplates.findFirst({
            where: and(eq(documentTemplates.orgId, orgId), eq(documentTemplates.code, def.code)),
          });
          if (existing) {
            tpl = await ensureSalesReferenceTemplate(existing, orgId);
            // وجد لكن ليس افتراضياً — اجعله افتراضياً
            await db.update(documentTemplates)
              .set({ isDefault: true, updatedAt: new Date() })
              .where(and(eq(documentTemplates.id, existing.id), eq(documentTemplates.orgId, orgId)));
            tpl = tpl ? { ...tpl, isDefault: true } : tpl;
          } else {
            const [row] = await db.insert(documentTemplates).values({
              orgId, code: def.code, nameAr: def.nameAr, nameEn: def.nameEn,
              docType: input.docType, paperSize: def.paperSize,
              orientation: input.docType === 'sales_invoice' ? 'landscape' : 'portrait',
              isDefault: true, isActive: true, sortOrder: 1,
              layoutJson: def.layoutJson,
            }).returning();
            tpl = row;
          }
        }
      }
      return tpl ?? null;
    }),

  seedDefault: protectedProcedure
    .input(z.object({ docType: z.string(), forceReset: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const defMap: Record<string, { code: string; nameAr: string; nameEn: string; paperSize: string; layoutJson: string; notes: string }> = {
        sales_invoice: {
          code: 'INV01', nameAr: 'نموذج المبيعات الأساسي', nameEn: 'Standard Sales Invoice',
          paperSize: 'A4', layoutJson: INV01_CONFIG,
          notes: 'النموذج الافتراضي — فاتورة ضريبية ثنائية اللغة',
        },
        purchase_invoice: {
          code: 'PINV01', nameAr: 'نموذج المشتريات الأساسي', nameEn: 'Standard Purchase Invoice',
          paperSize: 'A4', layoutJson: PINV01_CONFIG,
          notes: 'النموذج الافتراضي — فاتورة مشتريات ثنائية اللغة',
        },
        purchase_order: {
          code: 'POD01', nameAr: 'نموذج أوامر الشراء الأساسي', nameEn: 'Standard Purchase Order',
          paperSize: 'A4', layoutJson: POD01_CONFIG,
          notes: 'النموذج الافتراضي — أمر شراء ثنائي اللغة',
        },
        purchase_return: {
          code: 'PRN01', nameAr: 'نموذج مردود المشتريات الأساسي', nameEn: 'Standard Purchase Return',
          paperSize: 'A4', layoutJson: PRN01_CONFIG,
          notes: 'النموذج الافتراضي — مردود مشتريات ثنائي اللغة',
        },
        receipt_voucher: {
          code: 'RVCH01', nameAr: 'نموذج سند القبض الأساسي', nameEn: 'Standard Receipt Voucher',
          paperSize: 'A4', layoutJson: RVCH01_CONFIG,
          notes: 'النموذج الافتراضي — سند قبض',
        },
        payment_voucher: {
          code: 'PVCH01', nameAr: 'نموذج سند الصرف الأساسي', nameEn: 'Standard Payment Voucher',
          paperSize: 'A4', layoutJson: PVCH01_CONFIG,
          notes: 'النموذج الافتراضي — سند صرف',
        },
        pos_receipt: {
          code: 'POS01', nameAr: 'نموذج نقاط البيع الحراري', nameEn: 'POS Thermal Receipt',
          paperSize: '80mm', layoutJson: POS01_CONFIG,
          notes: 'إيصال حراري لنقاط البيع — ZATCA/ETA QR',
        },
      };
      const def = defMap[input.docType];
      if (!def) return { seeded: false };
      const existing = await db.query.documentTemplates.findFirst({
        where: and(eq(documentTemplates.orgId, orgId), eq(documentTemplates.code, def.code)),
      });
      if (!existing) {
        await db.insert(documentTemplates).values({
          orgId, code: def.code, nameAr: def.nameAr, nameEn: def.nameEn,
          docType: input.docType, paperSize: def.paperSize,
          orientation: input.docType === 'sales_invoice' ? 'landscape' : 'portrait',
          isDefault: true, isActive: true, sortOrder: 1,
          layoutJson: def.layoutJson, notes: def.notes,
        });
        return { seeded: true };
      } else if (!existing.layoutJson || input.forceReset) {
        await db.update(documentTemplates)
          .set({
            layoutJson: def.layoutJson,
            isDefault: true,
            ...(input.docType === 'sales_invoice' ? { orientation: 'landscape' } : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(documentTemplates.id, existing.id), eq(documentTemplates.orgId, orgId)));
        return { seeded: true };
      }
      if (input.docType === 'sales_invoice' && existing.code === 'INV01') {
        const upgraded = await ensureSalesReferenceTemplate(existing, orgId);
        if (upgraded?.layoutJson !== existing.layoutJson) return { seeded: true };
      }
      return { seeded: false };
    }),

  seedDefaults: protectedProcedure
    .mutation(async ({ ctx }) => {
      const defaults = [
        {
          code: 'INV01', nameAr: 'نموذج المبيعات الأساسي', nameEn: 'Standard Sales Invoice',
          docType: 'sales_invoice', paperSize: 'A4', layoutJson: INV01_CONFIG,
          notes: 'النموذج الافتراضي — فاتورة ضريبية ثنائية اللغة',
        },
        {
          code: 'PINV01', nameAr: 'نموذج المشتريات الأساسي', nameEn: 'Standard Purchase Invoice',
          docType: 'purchase_invoice', paperSize: 'A4', layoutJson: PINV01_CONFIG,
          notes: 'النموذج الافتراضي — فاتورة مشتريات ثنائية اللغة',
        },
        {
          code: 'POD01', nameAr: 'نموذج أوامر الشراء الأساسي', nameEn: 'Standard Purchase Order',
          docType: 'purchase_order', paperSize: 'A4', layoutJson: POD01_CONFIG,
          notes: 'النموذج الافتراضي — أمر شراء ثنائي اللغة',
        },
        {
          code: 'PRN01', nameAr: 'نموذج مردود المشتريات الأساسي', nameEn: 'Standard Purchase Return',
          docType: 'purchase_return', paperSize: 'A4', layoutJson: PRN01_CONFIG,
          notes: 'النموذج الافتراضي — مردود مشتريات ثنائي اللغة',
        },
        {
          code: 'RVCH01', nameAr: 'نموذج سند القبض الأساسي', nameEn: 'Standard Receipt Voucher',
          docType: 'receipt_voucher', paperSize: 'A4', layoutJson: RVCH01_CONFIG,
          notes: 'النموذج الافتراضي — سند قبض',
        },
        {
          code: 'PVCH01', nameAr: 'نموذج سند الصرف الأساسي', nameEn: 'Standard Payment Voucher',
          docType: 'payment_voucher', paperSize: 'A4', layoutJson: PVCH01_CONFIG,
          notes: 'النموذج الافتراضي — سند صرف',
        },
        {
          code: 'POS01', nameAr: 'نموذج نقاط البيع الحراري', nameEn: 'POS Thermal Receipt',
          docType: 'pos_receipt', paperSize: '80mm', layoutJson: POS01_CONFIG,
          notes: 'إيصال حراري لنقاط البيع — ZATCA/ETA QR',
        },
      ];
      let seededCount = 0;
      for (const def of defaults) {
        const existing = await db.query.documentTemplates.findFirst({
          where: and(
            eq(documentTemplates.orgId, ctx.user.orgId),
            eq(documentTemplates.code, def.code),
          ),
        });
        if (!existing) {
          await db.insert(documentTemplates).values({
            orgId: ctx.user.orgId, code: def.code, nameAr: def.nameAr, nameEn: def.nameEn,
            docType: def.docType, paperSize: def.paperSize,
            orientation: def.docType === 'sales_invoice' ? 'landscape' : 'portrait',
            isDefault: true, isActive: true, sortOrder: 1,
            layoutJson: def.layoutJson, notes: def.notes,
          });
          seededCount++;
        } else if (!existing.layoutJson) {
          // تحديث النموذج الموجود إذا كان بدون تصميم
          await db.update(documentTemplates)
            .set({
              layoutJson: def.layoutJson,
              isDefault: true,
              ...(def.docType === 'sales_invoice' ? { orientation: 'landscape' } : {}),
              updatedAt: new Date(),
            })
            .where(and(eq(documentTemplates.id, existing.id), eq(documentTemplates.orgId, ctx.user.orgId)));
          seededCount++;
        } else if (def.docType === 'sales_invoice' && def.code === 'INV01') {
          const upgraded = await ensureSalesReferenceTemplate(existing, ctx.user.orgId);
          if (upgraded?.layoutJson !== existing.layoutJson) seededCount++;
        }
      }
      return { seeded: seededCount > 0, count: seededCount };
    }),

  create: protectedProcedure
    .input(z.object({
      code:        z.string().min(1),
      nameAr:      z.string().min(1),
      nameEn:      z.string().optional(),
      docType:     z.string().min(1),
      paperSize:   z.string().default('A4'),
      orientation: z.string().default('portrait'),
      isDefault:   z.boolean().default(false),
      layoutJson:  z.string().nullable().optional(),
      notes:       z.string().optional(),
      sortOrder:   z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.isDefault) {
        await db.update(documentTemplates)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(and(eq(documentTemplates.orgId, ctx.user.orgId), eq(documentTemplates.docType, input.docType)));
      }
      const [row] = await db.insert(documentTemplates).values({
        ...input, orgId: ctx.user.orgId, isActive: true,
      }).returning();
      return row;
    }),

  update: protectedProcedure
    .input(z.object({
      id:          z.number(),
      code:        z.string().optional(),
      nameAr:      z.string().optional(),
      nameEn:      z.string().optional(),
      docType:     z.string().optional(),
      paperSize:   z.string().optional(),
      orientation: z.string().optional(),
      isDefault:   z.boolean().optional(),
      layoutJson:  z.string().nullable().optional(),
      notes:       z.string().optional(),
      sortOrder:   z.number().optional(),
      isActive:    z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      if (data.isDefault && data.docType) {
        await db.update(documentTemplates)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(and(eq(documentTemplates.orgId, ctx.user.orgId), eq(documentTemplates.docType, data.docType)));
      }
      const [row] = await db.update(documentTemplates)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(documentTemplates.id, id), eq(documentTemplates.orgId, ctx.user.orgId)))
        .returning();
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.update(documentTemplates)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(documentTemplates.id, input.id), eq(documentTemplates.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  clone: protectedProcedure
    .input(z.object({ id: z.number(), newCode: z.string(), newNameAr: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const src = await db.query.documentTemplates.findFirst({
        where: and(eq(documentTemplates.id, input.id), eq(documentTemplates.orgId, ctx.user.orgId)),
      });
      if (!src) throw new Error('النموذج غير موجود');
      const [row] = await db.insert(documentTemplates).values({
        orgId: ctx.user.orgId, code: input.newCode, nameAr: input.newNameAr,
        nameEn: src.nameEn ? `Copy of ${src.nameEn}` : undefined,
        docType: src.docType, paperSize: src.paperSize ?? 'A4',
        orientation: src.orientation ?? 'portrait',
        isDefault: false, isActive: true,
        layoutJson: src.layoutJson, notes: src.notes,
        sortOrder: (src.sortOrder ?? 0) + 1,
      }).returning();
      return row;
    }),
});
