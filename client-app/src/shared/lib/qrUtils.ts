/**
 * qrUtils.ts — مولّد QR Code المرن
 * يدعم: ZATCA (السعودية) | ETA (مصر) | Custom (مخصص)
 * مصمَّم لإضافة دول جديدة مستقبلاً بدون تعديل جوهري
 */

// ─── أنواع الأنظمة ───────────────────────────────────────────────────────────

export type QrSystem = 'zatca' | 'eta' | 'custom';

export interface QrSettings {
  isEnabled: boolean;
  countrySystem: QrSystem;
  sellerName?: string;
  taxNumber?: string;
  customFormat?: string;
  showOnSalesInvoice: boolean;
  showOnPurchaseInvoice: boolean;
  showOnReceiptVoucher: boolean;
  /** توافق داخلي: كل مستندات دورة المبيعات تستخدم showOnSalesInvoice. */
  /** حقول توافق قديمة؛ الحجم والموضع يحددهما قالب الطباعة. */
  qrSize?: number;
  qrPosition?: string;
}

export interface QrInvoiceData {
  sellerName: string;
  taxNumber: string;
  invoiceDateTime: string;
  totalAmount: number;
  vatAmount: number;
  invoiceNumber?: string;
  buyerName?: string;
  buyerTaxNumber?: string;
}

// ─── ZATCA TLV Encoder ───────────────────────────────────────────────────────
// المعيار: ZATCA e-invoice TLV (Tag-Length-Value) → Base64
// Tag 1: اسم المنشأة
// Tag 2: الرقم الضريبي
// Tag 3: تاريخ ووقت الفاتورة (ISO 8601)
// Tag 4: الإجمالي شامل الضريبة
// Tag 5: قيمة ضريبة القيمة المضافة

function encodeTLV(tag: number, value: string): Uint8Array {
  const enc = new TextEncoder();
  const valueBytes = enc.encode(value);
  const result = new Uint8Array(2 + valueBytes.length);
  result[0] = tag;
  result[1] = valueBytes.length;
  result.set(valueBytes, 2);
  return result;
}

export function generateZATCAQrContent(data: QrInvoiceData): string {
  const tlv1 = encodeTLV(1, data.sellerName);
  const tlv2 = encodeTLV(2, data.taxNumber);
  const tlv3 = encodeTLV(3, data.invoiceDateTime);
  const tlv4 = encodeTLV(4, data.totalAmount.toFixed(2));
  const tlv5 = encodeTLV(5, data.vatAmount.toFixed(2));

  const totalLen = tlv1.length + tlv2.length + tlv3.length + tlv4.length + tlv5.length;
  const combined = new Uint8Array(totalLen);
  let offset = 0;
  for (const tlv of [tlv1, tlv2, tlv3, tlv4, tlv5]) {
    combined.set(tlv, offset);
    offset += tlv.length;
  }

  return btoa(String.fromCharCode(...Array.from(combined)));
}

// ─── ETA (مصر) ───────────────────────────────────────────────────────────────
// يستخدم JSON مُضغَّط أو رقم UUID مع بيانات الفاتورة

export function generateETAQrContent(data: QrInvoiceData): string {
  const payload = {
    issuer: data.sellerName,
    taxId: data.taxNumber,
    invNo: data.invoiceNumber ?? '',
    date: data.invoiceDateTime,
    total: data.totalAmount.toFixed(2),
    vat: data.vatAmount.toFixed(2),
    buyer: data.buyerName ?? '',
  };
  return JSON.stringify(payload);
}

// ─── Custom ───────────────────────────────────────────────────────────────────
// يستخدم قالب نصي مع متغيرات {{variable}}

export function generateCustomQrContent(data: QrInvoiceData, template: string): string {
  return template
    .replace(/\{\{sellerName\}\}/g, data.sellerName)
    .replace(/\{\{taxNumber\}\}/g, data.taxNumber)
    .replace(/\{\{invoiceDateTime\}\}/g, data.invoiceDateTime)
    .replace(/\{\{totalAmount\}\}/g, data.totalAmount.toFixed(2))
    .replace(/\{\{vatAmount\}\}/g, data.vatAmount.toFixed(2))
    .replace(/\{\{invoiceNumber\}\}/g, data.invoiceNumber ?? '')
    .replace(/\{\{buyerName\}\}/g, data.buyerName ?? '');
}

// ─── المُولِّد الرئيسي ────────────────────────────────────────────────────────

export function generateQrContent(system: QrSystem, data: QrInvoiceData, customTemplate?: string): string {
  switch (system) {
    case 'zatca':
      return generateZATCAQrContent(data);
    case 'eta':
      return generateETAQrContent(data);
    case 'custom':
      return generateCustomQrContent(data, customTemplate ?? '{{sellerName}}\n{{taxNumber}}\n{{totalAmount}}');
    default:
      return generateZATCAQrContent(data);
  }
}

export type DecodedQrData = Partial<QrInvoiceData> & { raw?: string };

/**
 * يفك محتوى QR التجريبي لعرض القيم المقروءة في شاشة الإعدادات.
 * لا يُستخدم في دورة إصدار الفواتير؛ خدمة الطباعة تكتفي بتوليد المحتوى.
 */
export function decodeQrContent(system: QrSystem, content: string): DecodedQrData {
  if (!content) throw new Error("محتوى QR فارغ");

  if (system === "zatca") {
    const bytes = Uint8Array.from(atob(content), char => char.charCodeAt(0));
    const decoder = new TextDecoder();
    const values: Record<number, string> = {};
    let offset = 0;
    while (offset < bytes.length) {
      const tag = bytes[offset];
      const length = bytes[offset + 1];
      if (length === undefined || offset + 2 + length > bytes.length) {
        throw new Error("بيانات ZATCA غير مكتملة");
      }
      values[tag] = decoder.decode(bytes.slice(offset + 2, offset + 2 + length));
      offset += 2 + length;
    }
    return {
      sellerName: values[1],
      taxNumber: values[2],
      invoiceDateTime: values[3],
      totalAmount: Number(values[4]),
      vatAmount: Number(values[5]),
      raw: content,
    };
  }

  if (system === "eta") {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return {
      sellerName: String(parsed.issuer ?? ""),
      taxNumber: String(parsed.taxId ?? ""),
      invoiceNumber: String(parsed.invNo ?? ""),
      invoiceDateTime: String(parsed.date ?? ""),
      totalAmount: Number(parsed.total ?? 0),
      vatAmount: Number(parsed.vat ?? 0),
      raw: content,
    };
  }

  return { raw: content };
}

// ─── نص المساعدة للنظام المخصص ───────────────────────────────────────────────

export const CUSTOM_TEMPLATE_HELP = `المتغيرات المتاحة:
{{sellerName}}      — اسم المنشأة
{{taxNumber}}       — الرقم الضريبي
{{invoiceDateTime}} — تاريخ ووقت الفاتورة
{{totalAmount}}     — إجمالي الفاتورة
{{vatAmount}}       — قيمة الضريبة
{{invoiceNumber}}   — رقم الفاتورة
{{buyerName}}       — اسم المشتري`;

// ─── أوصاف الأنظمة ───────────────────────────────────────────────────────────

export const QR_SYSTEMS: { id: QrSystem; label: string; description: string; country: string }[] = [
  {
    id: 'zatca',
    label: 'ZATCA — هيئة الزكاة والضريبة والجمارك',
    description: 'ترميز TLV → Base64 وفق معيار الفاتورة الإلكترونية السعودية',
    country: '🇸🇦 المملكة العربية السعودية',
  },
  {
    id: 'eta',
    label: 'ETA — مصلحة الضرائب المصرية',
    description: 'بيانات الفاتورة بصيغة JSON وفق معيار النظام الضريبي المصري',
    country: '🇪🇬 جمهورية مصر العربية',
  },
  {
    id: 'custom',
    label: 'نظام مخصص',
    description: 'قالب نصي حر مع متغيرات قابلة للتخصيص لأي دولة أو نظام',
    country: '🌍 عالمي / مخصص',
  },
];
