/**
 * PrinterService.ts — خدمة إعدادات الطابعة
 *
 * تحتفظ بتفضيلات الطابعة لكل نوع مستند.
 * تُخزّن في localStorage وتُستعاد تلقائياً.
 */
import type { PrinterConfig } from "./types";

const STORAGE_KEY = "onesoft_printer_config";

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  paperSize:   "A4",
  orientation: "portrait",
  margins:     { top: 10, right: 8, bottom: 10, left: 8 },
  scale:       1,
};

const DEFAULTS_BY_DOC: Partial<Record<string, Partial<PrinterConfig>>> = {
  receipt_voucher: { paperSize: "A5", orientation: "portrait" },
  payment_voucher: { paperSize: "A5", orientation: "portrait" },
  product_label:   { paperSize: "thermal80", orientation: "portrait" },
  trial_balance:   { paperSize: "A4", orientation: "landscape" },
  ledger_report:   { paperSize: "A4", orientation: "landscape" },
};

export const PrinterService = {
  /**
   * يُعيد إعدادات الطابعة المحفوظة أو القيمة الافتراضية.
   */
  getConfig(docType?: string): PrinterConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const base: PrinterConfig = stored
        ? { ...DEFAULT_PRINTER_CONFIG, ...JSON.parse(stored) }
        : { ...DEFAULT_PRINTER_CONFIG };

      if (docType && DEFAULTS_BY_DOC[docType]) {
        return { ...base, ...DEFAULTS_BY_DOC[docType] };
      }
      return base;
    } catch {
      return { ...DEFAULT_PRINTER_CONFIG };
    }
  },

  /**
   * يُحفظ إعدادات الطابعة في localStorage.
   */
  saveConfig(config: Partial<PrinterConfig>): void {
    try {
      const current = this.getConfig();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...config }));
    } catch {}
  },

  /**
   * يُعيد حجم الورقة بالـ mm لاستخدامه في CSS.
   */
  getPaperWidth(paperSize: PrinterConfig["paperSize"]): string {
    const widths: Record<string, string> = {
      A4:        "210mm",
      A5:        "148mm",
      thermal80: "80mm",
      thermal57: "57mm",
    };
    return widths[paperSize] ?? "210mm";
  },

  /**
   * يُعيد قائمة أحجام الورق المدعومة.
   */
  getPaperSizes(): { value: PrinterConfig["paperSize"]; label: string }[] {
    return [
      { value: "A4",        label: "A4 (210×297 mm)" },
      { value: "A5",        label: "A5 (148×210 mm)" },
      { value: "thermal80", label: "حرارية 80mm" },
      { value: "thermal57", label: "حرارية 57mm" },
    ];
  },
};
