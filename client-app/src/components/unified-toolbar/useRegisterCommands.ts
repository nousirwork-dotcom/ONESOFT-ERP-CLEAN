/**
 * useRegisterCommands — hook لتسجيل أوامر الشاشة عبر UnifiedCommandSystem.
 *
 * useRegisterCommands(handlers, screenState, tools?)
 *
 * - handlers   : وظائف الشاشة فقط، مستقرة عبر useMemo([]) أو ref-wrapper.
 * - screenState: حالة الشاشة مُغلَّفة في useMemo([deps]).
 * - tools      : قائمة الأدوات للقائمة المنسدلة (اختياري).
 *
 * يجمع computeButtonStates + useToolbarActions في خطوة واحدة.
 */

import { useMemo } from "react";
import { useToolbarActions } from "./ToolbarActionsContext";
import { computeButtonStates } from "./UnifiedCommandSystem";
import type { CommandHandlers, ScreenState } from "./UnifiedCommandSystem";
import type { ToolbarToolItem } from "./toolbar.types";

export function useRegisterCommands(
  handlers: CommandHandlers,
  screenState: ScreenState,
  tools?: ToolbarToolItem[],
): void {
  const actions = useMemo(() => {
    const base = computeButtonStates(handlers, screenState);
    const hasTools = Array.isArray(tools) && tools.length > 0;
    return {
      ...base,
      tools: hasTools
        ? { supported: true as const, stateEnabled: true }
        : { supported: false as const },
    };
    // handlers/screenState يجب أن تكون مستقرة من الشاشة (useMemo/ref)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlers, screenState, tools]);

  useToolbarActions(actions, tools);
}

// re-export للاستخدام في الشاشات دون استيراد من UnifiedCommandSystem مباشرةً
export type { CommandHandlers, ScreenState } from "./UnifiedCommandSystem";
