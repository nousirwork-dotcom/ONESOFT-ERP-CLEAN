import {
  extractCertificateSignature,
  generateCreditNoteXml,
  generateInvoiceXml,
  signInvoice,
  type CreditNoteData,
  type InvoiceData,
} from '@talha7k/zatca';

type InvoiceItemInput = {
  id: number;
  productName: string | null;
  quantity: string | number | null;
  unit: string | null;
  unitPrice: string | number | null;
  total: string | number | null;
  taxAmount: string | number | null;
  taxPercent: string | number | null;
  discountAmount: string | number | null;
};

type InvoiceInput = {
  invoiceNumber: string;
  invoiceType: string;
  invoiceDate: Date | string | null;
  customerName: string | null;
  customerTaxNumber: string | null;
  currency: string | null;
  subtotal: string | number | null;
  discountAmount: string | number | null;
  taxAmount: string | number | null;
  total: string | number | null;
  notes: string | null;
  refInvoiceId: number | null;
};

type SellerInput = {
  nameAr: string;
  nameEn: string;
  vatNumber: string;
  crNumber?: string;
  street: string;
  building: string;
  district: string;
  city: string;
  postalCode: string;
  countryCode: string;
};

export type BuildSignedInvoiceInput = {
  invoice: InvoiceInput;
  items: InvoiceItemInput[];
  seller: SellerInput;
  uuid: string;
  invoiceCounter: number;
  previousInvoiceHash: string;
  submissionType: 'reporting' | 'clearance';
  privateKeyPem: string;
  certificatePem: string;
  originalInvoice?: {
    invoiceNumber: string;
    uuid: string;
    invoiceDate: Date | string | null;
  };
};

export type SignedInvoiceSubmission = {
  unsignedXml: string;
  signedXml: string;
  invoiceHash: string;
  signatureValue: string;
  invoiceBase64: string;
};

function numberValue(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) throw new Error('قيمة مالية غير صالحة في الفاتورة');
  return parsed;
}

function dateParts(value: Date | string | null): { date: string; time: string; iso: string } {
  if (!value) throw new Error('تاريخ الفاتورة مطلوب للإرسال الرسمي');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('تاريخ الفاتورة غير صالح');
  return {
    date: date.toISOString().slice(0, 10),
    time: date.toISOString().slice(11, 19),
    iso: date.toISOString(),
  };
}

function certificatePem(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('شهادة CSID غير متوفرة للتوقيع');
  if (trimmed.includes('BEGIN CERTIFICATE')) return trimmed;

  const decoded = Buffer.from(trimmed, 'base64');
  const text = decoded.toString('utf8').trim();
  if (text.includes('BEGIN CERTIFICATE')) return text;

  const body = decoded[0] === 0x30 ? decoded.toString('base64') : trimmed.replace(/\s+/g, '');
  return `-----BEGIN CERTIFICATE-----\n${body.match(/.{1,64}/g)?.join('\n') ?? body}\n-----END CERTIFICATE-----`;
}

function assertSeller(seller: SellerInput) {
  if (!seller.vatNumber || !/^3\d{13}3$/.test(seller.vatNumber)) {
    throw new Error('الرقم الضريبي للبائع غير صالح للتوقيع الرسمي');
  }
  if (!seller.nameEn || !seller.city || !seller.street || !seller.building || !seller.postalCode) {
    throw new Error('بيانات عنوان البائع غير مكتملة للتوقيع الرسمي');
  }
}

export function getSimulationInvoiceTypeCode(invoiceType: string): '381' | '383' | '388' {
  if (invoiceType === 'return' || invoiceType === 'credit_note') return '381';
  if (invoiceType === 'debit_note') return '383';
  return '388';
}

export function buildAndSignSimulationInvoice(
  input: BuildSignedInvoiceInput,
): SignedInvoiceSubmission {
  assertSeller(input.seller);
  if (!input.privateKeyPem.trim()) throw new Error('المفتاح الخاص غير متوفر داخليًا');

  const { date, time, iso } = dateParts(input.invoice.invoiceDate);
  const currency = input.invoice.currency || 'SAR';
  if (currency !== 'SAR') throw new Error('عملة الفاتورة الرسمية يجب أن تكون SAR');

  const invoiceTypeCode = getSimulationInvoiceTypeCode(input.invoice.invoiceType);
  const invoiceTypeCodeName = input.submissionType === 'clearance' ? '0100000' : '0200000';
  const subtotal = numberValue(input.invoice.subtotal);
  const discountTotal = numberValue(input.invoice.discountAmount);
  const taxTotal = numberValue(input.invoice.taxAmount);
  const total = numberValue(input.invoice.total);
  const taxExclusive = total - taxTotal;
  const lines = input.items.map((item, index) => {
    const quantity = numberValue(item.quantity);
    const unitPrice = numberValue(item.unitPrice);
    const lineTotal = numberValue(item.total);
    const lineTax = numberValue(item.taxAmount);
    const taxPercent = numberValue(item.taxPercent);
    return {
      id: index + 1,
      quantity,
      unitCode: item.unit || 'C62',
      lineExtensionAmount: lineTotal - lineTax,
      taxAmount: lineTax,
      itemName: item.productName || 'Item',
      taxCategoryId: 'S' as const,
      taxPercent,
      priceAmount: unitPrice,
      allowanceCharges: discountAmount(item.discountAmount),
    };
  });
  if (lines.length === 0) throw new Error('لا يمكن إرسال فاتورة بلا بنود');

  const base: InvoiceData = {
    invoiceNumber: input.invoice.invoiceNumber,
    uuid: input.uuid,
    issueDate: date,
    issueTime: time,
    invoiceTypeCode,
    invoiceTypeCodeName,
    profileId: input.submissionType === 'clearance' ? 'clearance:1.0' : 'reporting:1.0',
    currencyCode: currency,
    invoiceCounter: input.invoiceCounter,
    previousInvoiceHash: input.previousInvoiceHash,
    supplier: {
      nameAr: input.seller.nameAr,
      nameEn: input.seller.nameEn,
      vatNumber: input.seller.vatNumber,
      crNumber: input.seller.crNumber,
      address: {
        street: input.seller.street,
        building: input.seller.building,
        district: input.seller.district,
        city: input.seller.city,
        postalCode: input.seller.postalCode,
        countryCode: input.seller.countryCode || 'SA',
      },
    },
    customer: {
      name: input.invoice.customerName || 'مستهلك نهائي',
      vatNumber: input.invoice.customerTaxNumber || '',
    },
    lineExtensionAmount: subtotal,
    taxExclusiveAmount: taxExclusive,
    taxInclusiveAmount: total,
    allowanceTotalAmount: discountTotal,
    payableAmount: total,
    taxAmount: taxTotal,
    taxSubtotals: [{
      taxableAmount: taxExclusive,
      taxAmount: taxTotal,
      percent: 15,
      taxCategoryId: 'S',
    }],
    invoiceLines: lines,
  };

  let unsignedXml: string;
  if (invoiceTypeCode === '381' || invoiceTypeCode === '383') {
    if (!input.originalInvoice) {
      throw new Error('مردود المبيعات الإلكتروني يتطلب فاتورة أصلية مرجعية');
    }
    const creditNote: CreditNoteData = {
      ...base,
      originalInvoiceNumber: input.originalInvoice.invoiceNumber,
      originalInvoiceUuid: input.originalInvoice.uuid,
      originalInvoiceDate: dateParts(input.originalInvoice.invoiceDate).date,
      reason: input.invoice.notes || (invoiceTypeCode === '383' ? 'Debit note' : 'Sales return'),
    };
    unsignedXml = generateCreditNoteXml(creditNote);
  } else {
    unsignedXml = generateInvoiceXml(base);
  }

  const normalizedCertificate = certificatePem(input.certificatePem);
  const signed = signInvoice({
    xml: unsignedXml,
    privateKeyPem: input.privateKeyPem,
    certificatePem: normalizedCertificate,
    qrData: {
      // The XML supplier RegistrationName is the Arabic name. QR tag 1 must
      // use the same value; sending the English display name causes Fatoora
      // to reject the invoice with sellerName_QRCODE_INVALID.
      sellerName: input.seller.nameAr,
      vatNumber: input.seller.vatNumber,
      timestamp: iso,
      totalWithVat: total.toFixed(2),
      vatTotal: taxTotal.toFixed(2),
      certificateSignature: extractCertificateSignature(normalizedCertificate),
    },
  });

  return {
    unsignedXml,
    signedXml: signed.signedXml,
    invoiceHash: signed.invoiceHash,
    signatureValue: signed.signatureValue,
    invoiceBase64: Buffer.from(signed.signedXml, 'utf8').toString('base64'),
  };
}

function discountAmount(value: string | number | null): Array<{
  chargeIndicator: false;
  reason: string;
  amount: number;
  taxCategoryId: 'S';
  taxPercent: number;
}> {
  const amount = numberValue(value);
  return amount > 0
    ? [{ chargeIndicator: false, reason: 'Discount', amount, taxCategoryId: 'S', taxPercent: 15 }]
    : [];
}