/**
 * DocumentComponentService — خدمة مكونات المستند
 *
 * مسؤولة عن:
 * - قراءة مكونات المستند من إعدادات الدفتر (optionsConfig.documentComponents)
 * - تصفية المكونات حسب السياق (showInDocument / showInPrint / showInTemplates / showInReports)
 * - ترتيب المكونات بـ sortOrder
 * - حل قيمة كل مكوّن من بيانات المستند (عبر PostingEngine.resolveFieldValue)
 *
 * القاعدة: أي منطق متعلق بمكونات المستند يُضاف هنا.
 */

import { resolveInvoiceFieldValue as resolveFieldValue } from './PostingEngine.js';
import type { salesInvoices } from '../schema.js';

// ─── أنواع ─────────────────────────────────────────────────────────────────────

export type DocComponent = {
  sortOrder:       number;
  fieldCode:       string;
  nameAr:          string;
  nameEn:          string;
  showInDocument:  boolean;
  showInPrint:     boolean;
  showInTemplates: boolean;
  showInReports:   boolean;
};

export type ResolvedComponent = DocComponent & {
  value: number;
};

export type ComponentContext = 'document' | 'print' | 'templates' | 'reports';

// ─── fromOptionsConfig ─────────────────────────────────────────────────────────
/**
 * يستخرج مكونات المستند من optionsConfig الخاص بالدفتر.
 * يُرجع مصفوفة فارغة إذا لم تُوجد مكونات.
 */
export function fromOptionsConfig(optionsConfig: unknown): DocComponent[] {
  if (!optionsConfig || typeof optionsConfig !== 'object') return [];
  const cfg = optionsConfig as Record<string, unknown>;
  if (!Array.isArray(cfg.documentComponents)) return [];
  return cfg.documentComponents as DocComponent[];
}

// ─── filterByContext ───────────────────────────────────────────────────────────
/**
 * يُصفّي المكونات حسب السياق (مستند / طباعة / قوالب / تقارير).
 */
export function filterByContext(
  components: DocComponent[],
  context: ComponentContext,
): DocComponent[] {
  const flagMap: Record<ComponentContext, keyof DocComponent> = {
    document:  'showInDocument',
    print:     'showInPrint',
    templates: 'showInTemplates',
    reports:   'showInReports',
  };
  const flag = flagMap[context];
  return components
    .filter(c => c[flag] === true)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

// ─── resolveAll ────────────────────────────────────────────────────────────────
/**
 * يُحسب قيمة كل مكوّن من بيانات الفاتورة.
 * المكونات التي قيمتها صفر تُحذف إذا طُلب ذلك.
 *
 * @param components  قائمة المكونات المُصفّاة
 * @param invoice     بيانات الفاتورة
 * @param skipZeros   تجاهل المكونات ذات القيمة الصفرية (افتراضي: false)
 */
export function resolveAll(
  components: DocComponent[],
  invoice: typeof salesInvoices.$inferSelect,
  skipZeros = false,
): ResolvedComponent[] {
  return components
    .map(c => ({
      ...c,
      value: resolveFieldValue(c.fieldCode, invoice),
    }))
    .filter(c => !skipZeros || c.value !== 0);
}

// ─── getForDocument ────────────────────────────────────────────────────────────
/**
 * دالة مركّبة: تجلب المكونات الخاصة بالمستند، تُصفّيها، وتحسب قيمها.
 *
 * @param optionsConfig  إعدادات الدفتر (optionsConfig JSONB)
 * @param invoice        بيانات الفاتورة
 * @param context        السياق: 'document' | 'print' | 'templates' | 'reports'
 * @param skipZeros      تجاهل الحقول الفارغة
 */
export function getForDocument(
  optionsConfig: unknown,
  invoice: typeof salesInvoices.$inferSelect,
  context: ComponentContext = 'document',
  skipZeros = false,
): ResolvedComponent[] {
  const all      = fromOptionsConfig(optionsConfig);
  const filtered = filterByContext(all, context);
  return resolveAll(filtered, invoice, skipZeros);
}
