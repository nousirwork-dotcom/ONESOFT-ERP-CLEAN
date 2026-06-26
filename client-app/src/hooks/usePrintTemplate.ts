/**
 * usePrintTemplate — hook مركزي لجلب القالب الافتراضي لأي نوع مستند.
 *
 * الاستخدام:
 *   const { templateConfig } = usePrintTemplate("sales_invoice");
 *   const { templateConfig } = usePrintTemplate("purchase_invoice");
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { TemplateEngine } from "@/lib/print/TemplateEngine";
import type { InvDocTemplateConfig } from "@/lib/print/types";
import type { PrintDocumentType } from "@/lib/print/types";

export function usePrintTemplate(docType: PrintDocumentType) {
  const { data: tpl, isLoading } = trpc.documentTemplates.getDefault.useQuery(
    { docType },
    { staleTime: 5 * 60_000 },
  );

  const templateConfig = useMemo<InvDocTemplateConfig | null>(
    () => TemplateEngine.parseConfig(tpl?.layoutJson),
    [tpl?.layoutJson],
  );

  return { templateConfig, isLoading, template: tpl };
}
