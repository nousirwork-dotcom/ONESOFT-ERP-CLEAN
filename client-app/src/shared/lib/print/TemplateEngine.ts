/**
 * TemplateEngine.ts — محرك النماذج
 * مسؤول عن تحليل إعدادات القالب والتحقق منها.
 * لا يُستخدم trpc مباشرةً — استخدم hook usePrintTemplate للجلب.
 */
import type { InvDocTemplateConfig } from "@/shared/lib/buildInvoiceHtml";

export const DEFAULT_TEMPLATE_CONFIG: InvDocTemplateConfig = {
  type:         "config_v1",
  language:     "bilingual",
  primaryColor: "#406B93",
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
};

export const TemplateEngine = {
  /**
   * يحلل layoutJson من قاعدة البيانات ويتحقق من صحته.
   * يُعيد null إذا كان غير صالح أو فارغاً.
   */
  parseConfig(layoutJson: string | null | undefined): InvDocTemplateConfig | null {
    if (!layoutJson) return null;
    try {
      const parsed = JSON.parse(layoutJson);
      return parsed?.type === "config_v1" ? (parsed as InvDocTemplateConfig) : null;
    } catch {
      return null;
    }
  },

  /**
   * يُعيد الإعداد المحلل أو القيمة الافتراضية.
   */
  resolveConfig(layoutJson: string | null | undefined): InvDocTemplateConfig {
    return this.parseConfig(layoutJson) ?? DEFAULT_TEMPLATE_CONFIG;
  },
};
