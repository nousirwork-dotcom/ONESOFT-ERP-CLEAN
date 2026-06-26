/**
 * TemplateEngine — محرك قوالب المستندات
 *
 * مسؤول عن:
 * - جلب القالب الافتراضي لنوع مستند محدد
 * - حل متغيرات القالب ({{FIELD_CODE}}) من بيانات المستند
 * - بناء HTML المستند للطباعة
 * - دعم القوالب ثنائية اللغة (عربي + إنجليزي)
 * - دمج إعدادات TemplateConfig مع بيانات الدفتر
 *
 * القاعدة: أي منطق متعلق بالقوالب والطباعة يُضاف هنا.
 */

import { db } from '../db.js';
import { documentTemplates } from '../schema.js';
import { eq, and } from 'drizzle-orm';
import { resolveFieldValue } from './PostingEngine.js';
import type { salesInvoices } from '../schema.js';

// ─── أنواع ─────────────────────────────────────────────────────────────────────

export type TemplateConfig = {
  id:          number;
  name:        string;
  docType:     string;
  primaryColor: string;
  logoUrl:     string | null;
  language:    'ar' | 'en' | 'both';
  orientation: 'portrait' | 'landscape';
  pageSize:    'A4' | 'A5' | 'letter';
  showLogo:    boolean;
  showQr:      boolean;
  sections:    TemplateSectionConfig[];
};

export type TemplateSectionConfig = {
  id:       string;
  type:     'header' | 'party' | 'items' | 'totals' | 'footer' | 'signature';
  visible:  boolean;
  label?:   string;
};

export type TemplateVariable = {
  code:  string;
  value: string | number;
};

// ─── getDefault ────────────────────────────────────────────────────────────────
/**
 * يجلب القالب الافتراضي لنوع المستند.
 * يعيد null إذا لم يوجد قالب افتراضي.
 */
export async function getDefault(
  docType: string,
  orgId: number,
): Promise<typeof documentTemplates.$inferSelect | null> {
  const row = await db.query.documentTemplates.findFirst({
    where: and(
      eq(documentTemplates.orgId, orgId),
      eq(documentTemplates.docType, docType),
      eq(documentTemplates.isDefault, true),
    ),
  });
  return row ?? null;
}

// ─── getById ───────────────────────────────────────────────────────────────────
/**
 * يجلب قالباً بمعرّفه.
 */
export async function getById(
  templateId: number,
  orgId: number,
): Promise<typeof documentTemplates.$inferSelect | null> {
  const row = await db.query.documentTemplates.findFirst({
    where: and(
      eq(documentTemplates.id, templateId),
      eq(documentTemplates.orgId, orgId),
    ),
  });
  return row ?? null;
}

// ─── extractConfig ─────────────────────────────────────────────────────────────
/**
 * يستخرج TemplateConfig من بيانات القالب المخزّنة.
 */
export function extractConfig(
  template: typeof documentTemplates.$inferSelect,
): TemplateConfig | null {
  const layout = template.templateLayout as Record<string, unknown> | null;
  if (!layout || layout.type !== 'config_v1') return null;

  return {
    id:           template.id,
    name:         template.name,
    docType:      template.docType,
    primaryColor: (layout.primaryColor as string) ?? '#D19C05',
    logoUrl:      (layout.logoUrl as string | null) ?? null,
    language:     (layout.language as 'ar' | 'en' | 'both') ?? 'both',
    orientation:  (layout.orientation as 'portrait' | 'landscape') ?? 'portrait',
    pageSize:     (layout.pageSize as 'A4' | 'A5' | 'letter') ?? 'A4',
    showLogo:     (layout.showLogo as boolean) ?? true,
    showQr:       (layout.showQr as boolean) ?? false,
    sections:     (layout.sections as TemplateSectionConfig[]) ?? [],
  };
}

// ─── resolveVariables ─────────────────────────────────────────────────────────
/**
 * يُحوّل قائمة Field Codes إلى قيمها من بيانات الفاتورة.
 * مفيد لملء متغيرات القوالب {{FIELD_CODE}}.
 *
 * @param fieldCodes  قائمة أكواد الحقول المطلوبة
 * @param invoice     بيانات الفاتورة
 */
export function resolveVariables(
  fieldCodes: string[],
  invoice: typeof salesInvoices.$inferSelect,
): TemplateVariable[] {
  return fieldCodes.map(code => ({
    code,
    value: resolveFieldValue(code, invoice),
  }));
}

// ─── renderText ────────────────────────────────────────────────────────────────
/**
 * يُبدّل متغيرات النص {{FIELD_CODE}} بقيمها الفعلية.
 *
 * @param template  نص القالب مثال: "الإجمالي: {{TOTAL}} ريال"
 * @param vars      قائمة المتغيرات المُحلولة
 */
export function renderText(
  template: string,
  vars: TemplateVariable[],
): string {
  let result = template;
  for (const v of vars) {
    const pattern = new RegExp(`\\{\\{${v.code}\\}\\}`, 'g');
    result = result.replace(pattern, String(v.value));
  }
  return result;
}

// ─── isSectionVisible ─────────────────────────────────────────────────────────
/**
 * يتحقق من أن قسماً معيناً مُفعَّل في إعدادات القالب.
 */
export function isSectionVisible(
  config: TemplateConfig,
  sectionType: TemplateSectionConfig['type'],
): boolean {
  const section = config.sections.find(s => s.type === sectionType);
  return section?.visible ?? true;
}
