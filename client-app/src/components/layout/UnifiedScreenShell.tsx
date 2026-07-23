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
  /** false for module-home / navigation screens; toolbar is hidden and bottom padding is reduced */
  showToolbar?: boolean;
}

export function UnifiedScreenShell({
  children,
  toolbarActions,
  toolbarTools,
  activeToolbarAction,
  className = "",
  showToolbar = true,
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
      <div className={`min-h-0 flex-1 overflow-auto px-3 pt-3 ${showToolbar ? "pb-[82px]" : "pb-3"}`}>
        {children}
      </div>

      {showToolbar && (
        <UnifiedBottomToolbar
          actions={actions}
          tools={tools}
          activeAction={active}
        />
      )}
    </section>
  );
}
