/**
 * usePrintTemplate — hook مركزي لجلب القالب الافتراضي لأي نوع مستند.
 *
 * الاستخدام:
 *   const { templateConfig } = usePrintTemplate("sales_invoice");
 *   const { templateConfig } = usePrintTemplate("purchase_invoice");
 */
import { useMemo } from "react";
import { trpc } from "@/shared/lib/trpc";
import { TemplateEngine } from "@/shared/lib/print/TemplateEngine";
import type { InvDocTemplateConfig } from "@/shared/lib/print/types";
import type { PrintDocumentType } from "@/shared/lib/print/types";

export function usePrintTemplate(docType: PrintDocumentType, templateCode?: string) {
  const defaultQuery = trpc.documentTemplates.getDefault.useQuery(
    { docType },
    { staleTime: 5 * 60_000 },
  );
  const selectedQuery = trpc.documentTemplates.getByCode.useQuery(
    { docType, code: templateCode ?? "" },
    { staleTime: 5 * 60_000, enabled: !!templateCode },
  );
  // إذا كان كود القالب قديماً أو غير موجود، نرجع للقالب الافتراضي بدلاً من
  // إنتاج معاينة بلا تصميم.
  const tpl = selectedQuery.data ?? defaultQuery.data;

  const templateConfig = useMemo<InvDocTemplateConfig | null>(
    () => TemplateEngine.parseConfig(tpl?.layoutJson),
    [tpl?.layoutJson],
  );

  return {
    templateConfig,
    isLoading: selectedQuery.isLoading || defaultQuery.isLoading,
    template: tpl,
  };
}
