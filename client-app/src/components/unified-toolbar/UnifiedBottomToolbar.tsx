import {
  type CSSProperties,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_DOCUMENT_TOOLS,
  getToolIcon,
  TOOLBAR_GROUPS,
  TOOLBAR_ITEMS,
} from "./toolbar.constants";
import type {
  ToolbarActionId,
  ToolbarActionMap,
  ToolbarToolItem,
} from "./toolbar.types";
import { useToolbarShortcuts } from "./useToolbarShortcuts";
import { useFocusedEntityRegistrySafe } from "./FocusedEntityRegistry";

import styles from "./UnifiedBottomToolbar.module.css";

interface UnifiedBottomToolbarProps {
  actions: ToolbarActionMap;
  tools?: ToolbarToolItem[];
  activeAction?: ToolbarActionId;
  className?: string;
}

function getDisabledReason(
  actionId: ToolbarActionId,
  actions: ToolbarActionMap,
): string {
  const action = actions[actionId];
  if (!action) return "هذا الأمر غير مستخدم في هذه الشاشة";
  if (action.supported === false) {
    return action.disabledReason ?? "هذا الأمر غير مستخدم في هذه الشاشة";
  }
  if (action.allowed === false) {
    return action.disabledReason ?? "ليس لديك صلاحية لتنفيذ هذا الأمر";
  }
  if (action.stateEnabled === false) {
    return action.disabledReason ?? "حالة السجل الحالية لا تسمح بتنفيذ هذا الأمر";
  }
  if (!action.onClick) {
    return action.disabledReason ?? "لم يتم ربط هذا الأمر بوظيفة في الشاشة";
  }
  return action.disabledReason ?? "";
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

export function UnifiedBottomToolbar({
  actions,
  tools = DEFAULT_DOCUMENT_TOOLS,
  activeAction,
  className = "",
}: UnifiedBottomToolbarProps) {
  const { focusedEntity, previewFocusedEntity } = useFocusedEntityRegistrySafe();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const toolsButtonRef = useRef<HTMLButtonElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  const toolsRuntime = actions.tools;
  const toolsEnabled =
    toolsRuntime?.supported !== false &&
    toolsRuntime?.allowed !== false &&
    toolsRuntime?.stateEnabled !== false &&
    toolsRuntime?.loading !== true &&
    tools.length > 0;

  useLayoutEffect(() => {
    if (!toolsOpen || !toolsButtonRef.current) return;

    const rect = toolsButtonRef.current.getBoundingClientRect();
    const menuWidth = 220;
    const estimatedMenuHeight = 320;
    const screenGap = 8;

    const left = Math.min(
      window.innerWidth - menuWidth - screenGap,
      Math.max(screenGap, rect.right - menuWidth),
    );

    let top = rect.top - estimatedMenuHeight - screenGap;
    if (top < screenGap) {
      top = rect.bottom + screenGap;
    }

    setMenuStyle({
      position: "fixed",
      top,
      left,
      width: menuWidth,
      zIndex: 100_000,
    });
  }, [toolsOpen]);

  useToolbarShortcuts(actions, () => setToolsOpen((current) => !current));

  useLayoutEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (
        toolsButtonRef.current?.contains(target) ||
        toolsMenuRef.current?.contains(target)
      ) {
        return;
      }
      setToolsOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setToolsOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function executeToolbarAction(actionId: ToolbarActionId) {
    if (actionId === "tools") {
      if (!toolsEnabled) return;
      setToolsOpen((current) => !current);
      return;
    }
    if (!canExecuteAction(actionId, actions)) return;
    setToolsOpen(false);
    await actions[actionId]?.onClick?.();
  }

  return (
    <div
      dir="rtl"
      className={`${styles.toolbarOuter} ${className}`}
      aria-label="شريط أوامر الشاشة"
    >
      <div className={styles.toolbarGroups}>
          {TOOLBAR_GROUPS.map((group) => (
            <div
              key={group.id}
              className={styles.toolbarGroup}
              aria-label={group.label}
            >
              {group.actions.map((actionId) => {
                const item = TOOLBAR_ITEMS.find((i) => i.id === actionId)!;
                const Icon = item.icon;
                 const enabled =
                  item.id === "tools"
                    ? toolsEnabled
                     : item.id === "preview"
                       ? canExecuteAction(item.id, actions) && !!focusedEntity
                       : canExecuteAction(item.id, actions);

                const isActive =
                  activeAction === item.id || (item.id === "tools" && toolsOpen);

                 const disabledReason =
                  item.id === "tools" && tools.length === 0
                    ? "لا توجد أدوات متاحة في هذه الشاشة"
                     : item.id === "preview" && !focusedEntity
                       ? "لا يوجد سجل مرتبط بالحقل الحالي"
                    : getDisabledReason(item.id, actions);

                return (
                  <button
                    key={item.id}
                    ref={item.id === "tools" ? toolsButtonRef : undefined}
                    type="button"
                    disabled={!enabled}
                    title={enabled ? item.label : disabledReason}
                    aria-label={item.label}
                    aria-disabled={!enabled}
                    aria-expanded={item.id === "tools" ? toolsOpen : undefined}
                    data-active={isActive}
                    data-tone={item.tone ?? "default"}
                    className={styles.toolbarButton}
                     onClick={() => {
                       if (item.id === "preview") {
                         previewFocusedEntity();
                         return;
                       }
                       void executeToolbarAction(item.id);
                     }}
                  >
                    <Icon
                      className={styles.toolbarIcon}
                      size={18}
                      strokeWidth={2.2}
                    />
                    <span className={styles.toolbarLabel}>{item.label}</span>
                    <span dir="ltr" className={styles.toolbarShortcut}>
                      {item.shortcut ?? "\u00A0"}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
      </div>

      {toolsOpen &&
        createPortal(
          <div
            ref={toolsMenuRef}
            dir="rtl"
            role="menu"
            style={menuStyle}
            className={styles.toolsMenu}
          >
            {tools.map((tool) => {
              const ToolIcon = getToolIcon(tool.id);
              const enabled =
                tool.enabled !== false && typeof tool.onClick === "function";

              return (
                <div key={tool.id}>
                  {tool.separatorBefore && (
                    <div className={styles.toolsSeparator} />
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!enabled}
                    title={
                      enabled ? tool.label : tool.disabledReason ?? "هذا الأمر غير متاح"
                    }
                    className={styles.toolsMenuItem}
                    onClick={async () => {
                      if (!enabled) return;
                      setToolsOpen(false);
                      await tool.onClick?.();
                    }}
                  >
                    <span>{tool.label}</span>
                    <ToolIcon size={16} strokeWidth={2} />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
