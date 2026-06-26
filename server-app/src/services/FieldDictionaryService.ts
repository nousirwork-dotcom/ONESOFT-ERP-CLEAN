/**
 * FieldDictionaryService — خدمة قاموس الحقول
 *
 * مسؤولة عن:
 * - البحث عن حقل بكوده وإرجاع بياناته
 * - التحقق من وجود الكود في القاموس
 * - مزامنة الحقول النظامية (sync system fields)
 * - تجميع الحقول بالفئة (للعرض في القوائم المنسدلة)
 * - ربط fieldCode بـ postingName في الروابط المحاسبية
 *
 * القاعدة: أي منطق متعلق بقاموس الحقول يُضاف هنا.
 */

import { db } from '../db.js';
import { fieldDictionary } from '../schema.js';
import { eq, and } from 'drizzle-orm';

// ─── أنواع ─────────────────────────────────────────────────────────────────────

export type FieldRecord = {
  id:          number;
  code:        string;
  nameAr:      string;
  nameEn:      string;
  fieldType:   string;
  category:    string;
  description: string | null;
  isActive:    boolean;
  isSystem:    boolean;
  sortOrder:   number;
};

export type FieldsByCategory = Record<string, FieldRecord[]>;

// ─── getAll ────────────────────────────────────────────────────────────────────
/**
 * يجلب جميع حقول القاموس للمنظمة مرتبةً.
 */
export async function getAll(orgId: number): Promise<FieldRecord[]> {
  return db.query.fieldDictionary.findMany({
    where: eq(fieldDictionary.orgId, orgId),
    orderBy: (f, { asc }) => [asc(f.category), asc(f.sortOrder), asc(f.code)],
  }) as unknown as FieldRecord[];
}

// ─── getByCode ─────────────────────────────────────────────────────────────────
/**
 * يجلب حقلاً واحداً بكوده — يعيد null إذا لم يوجد.
 */
export async function getByCode(
  code: string,
  orgId: number,
): Promise<FieldRecord | null> {
  const row = await db.query.fieldDictionary.findFirst({
    where: and(
      eq(fieldDictionary.orgId, orgId),
      eq(fieldDictionary.code, code.toUpperCase()),
    ),
  });
  return (row as unknown as FieldRecord) ?? null;
}

// ─── exists ────────────────────────────────────────────────────────────────────
/**
 * يتحقق من وجود كود في القاموس.
 */
export async function exists(code: string, orgId: number): Promise<boolean> {
  const row = await getByCode(code, orgId);
  return row !== null;
}

// ─── groupByCategory ──────────────────────────────────────────────────────────
/**
 * يُجمّع قائمة الحقول بالفئة — مفيد لبناء القوائم المنسدلة في الواجهة.
 *
 * @example
 * const grouped = groupByCategory(fields);
 * // { "Sales Fields": [...], "Payment Fields": [...], ... }
 */
export function groupByCategory(fields: FieldRecord[]): FieldsByCategory {
  const result: FieldsByCategory = {};
  for (const f of fields) {
    if (!result[f.category]) result[f.category] = [];
    result[f.category].push(f);
  }
  return result;
}

// ─── upsertFromPaymentMethod ───────────────────────────────────────────────────
/**
 * يضيف كود وسيلة الدفع للقاموس إذا لم يكن موجوداً.
 * يُستدعى تلقائياً عند إنشاء وسيلة دفع جديدة.
 *
 * @param pmCode    كود وسيلة الدفع
 * @param nameAr    الاسم العربي
 * @param nameEn    الاسم الإنجليزي
 * @param orgId     معرّف المنظمة
 */
export async function upsertFromPaymentMethod(
  pmCode: string,
  nameAr: string,
  nameEn: string | undefined,
  orgId: number,
): Promise<void> {
  const code = pmCode.toUpperCase();
  const alreadyExists = await exists(code, orgId);
  if (alreadyExists) return;

  await db.insert(fieldDictionary).values({
    orgId,
    code,
    nameAr,
    nameEn:      nameEn ?? nameAr,
    fieldType:   'Amount',
    category:    'Payment Fields',
    isSystem:    false,
    isActive:    true,
    sortOrder:   999,
  });
}

// ─── resolveNameAr ─────────────────────────────────────────────────────────────
/**
 * يُرجع الاسم العربي للحقل من كوده — أو الكود نفسه إن لم يُوجد.
 * مفيد في عرض قوائم مكونات المستند.
 */
export async function resolveNameAr(code: string, orgId: number): Promise<string> {
  const field = await getByCode(code, orgId);
  return field?.nameAr ?? code;
}
