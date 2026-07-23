import type { ReactNode } from "react";

import { UnifiedBottomToolbar } from "@/components/unified-toolbar/UnifiedBottomToolbar";
import type {
  ToolbarActionId,
  ToolbarActionMap,
  ToolbarToolItem,
} from "@/components/unified-toolbar/toolbar.types";

import { useToolbarState } from "@/components/unified-toolbar/ToolbarActionsContext";

interface UnifiedScreenShellProps {
  children: ReactNode;
  toolbarActions?: ToolbarActionMap;
  toolbarTools?: ToolbarToolItem[];
  activeToolbarAction?: ToolbarActionId;
  className?: string;
}

export function UnifiedScreenShell({
  children,
  toolbarActions,
  toolbarTools,
  activeToolbarAction,
  className = "",
}: UnifiedScreenShellProps) {
  const contextState = useToolbarState();

  const actions = toolbarActions ?? contextState.actions;
  const tools = toolbarTools ?? contextState.tools;
  const active = activeToolbarAction ?? contextState.activeAction;

  return (
    <section
      dir="rtl"
      className={`relative flex h-full min-h-0 flex-col overflow-hidden ${className}`}
    >
      <div className="min-h-0 flex-1 overflow-auto px-3 pt-3 pb-[82px]">
        {children}
      </div>

      <UnifiedBottomToolbar
        actions={actions}
        tools={tools}
        activeAction={active}
      />
    </section>
  );
}
