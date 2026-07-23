import { useEffect } from "react";
import type { ToolbarActionId, ToolbarActionMap } from "./toolbar.types";

export function resolveShortcutAction(event: KeyboardEvent): ToolbarActionId | null {
  if (event.key === "F10" && !event.ctrlKey) return "save";
  if (event.ctrlKey && event.key.toLowerCase() === "d") return "draft";
  if (event.key === "F3" && !event.ctrlKey) return "new";
  if (event.ctrlKey && event.key.toLowerCase() === "k") return "duplicate";
  if (event.ctrlKey && event.key.toLowerCase() === "t") return "tools";
  if (event.key === "F4" && !event.ctrlKey) return "edit";
  if (event.ctrlKey && event.key === "Delete") return "delete";
  if (event.ctrlKey && event.key === "Home") return "first";
  if (event.key === "PageUp") return "previous";
  if (event.key === "PageDown") return "next";
  if (event.ctrlKey && event.key === "End") return "last";
  if (event.ctrlKey && event.key === "F11") return "approve";
  if (event.key === "F7" && !event.ctrlKey) return "unapprove";
  if (event.ctrlKey && event.key.toLowerCase() === "p") return "print";
  if (event.key === "F9" && !event.ctrlKey) return "exit";
  return null;
}

function canExecuteAction(
  actionId: ToolbarActionId,
  actions: ToolbarActionMap,
): boolean {
  const action = actions[actionId];
  if (!action) return false;
  return (
    action.supported !== false &&
    action.allowed !== false &&
    action.stateEnabled !== false &&
    action.loading !== true &&
    typeof action.onClick === "function"
  );
}

export function useToolbarShortcuts(
  actions: ToolbarActionMap,
  onToggleTools?: () => void,
) {
  useEffect(() => {
    function handleKeyboardShortcut(event: KeyboardEvent) {
      const shortcutAction = resolveShortcutAction(event);
      if (!shortcutAction) return;
      if (!canExecuteAction(shortcutAction, actions)) return;

      event.preventDefault();
      event.stopPropagation();

      if (shortcutAction === "tools") {
        onToggleTools?.();
        return;
      }

      void actions[shortcutAction]?.onClick?.();
    }

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, [actions, onToggleTools]);
}
