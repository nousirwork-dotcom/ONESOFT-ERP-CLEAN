import { useToolbarState } from "@/components/unified-toolbar/ToolbarActionsContext";
import { UnifiedBottomToolbar } from "@/components/unified-toolbar/UnifiedBottomToolbar";

/**
 * يُقرأ من الـ ToolbarActionsProvider الداخلي لنافذة العمل
 * ويعرض UnifiedBottomToolbar في قاع النافذة.
 */
export function WorkWindowToolbarFooter() {
  const { actions, tools, activeAction } = useToolbarState();

  // إذا لم تسجّل أي إجراءات: لا نعرض شيئًا لتوفير مساحة
  const hasActions = Object.keys(actions ?? {}).length > 0;
  if (!hasActions) return null;

  return (
    <UnifiedBottomToolbar
      actions={actions}
      tools={tools}
      activeAction={activeAction}
    />
  );
}
