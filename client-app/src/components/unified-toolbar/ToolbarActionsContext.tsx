import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  ToolbarActionId,
  ToolbarActionMap,
  ToolbarToolItem,
} from "./toolbar.types";

interface ToolbarState {
  actions: ToolbarActionMap;
  tools: ToolbarToolItem[];
  activeAction?: ToolbarActionId;
}

interface ToolbarActionsApi {
  state: ToolbarState;
  setActions: (actions: ToolbarActionMap) => void;
  setTools: (tools: ToolbarToolItem[]) => void;
  setActiveAction: (id?: ToolbarActionId) => void;
}

const ToolbarActionsContext = createContext<ToolbarActionsApi | null>(null);
const EMPTY_ACTIONS: ToolbarActionMap = {};
const EMPTY_TOOLS: ToolbarToolItem[] = [];

export function ToolbarActionsProvider({
  children,
  initialActions = {},
  initialTools = [],
}: {
  children: ReactNode;
  initialActions?: ToolbarActionMap;
  initialTools?: ToolbarToolItem[];
}) {
  const [state, setState] = useState<ToolbarState>({
    actions: initialActions,
    tools: initialTools,
    activeAction: undefined,
  });

  // Bail out when reference hasn't changed — prevents infinite loops when
  // useToolbarActions re-fires the effect after a parent re-render.
  const setActions = useCallback((newActions: ToolbarActionMap) => {
    setState((prev) =>
      prev.actions === newActions ? prev : { ...prev, actions: newActions },
    );
  }, []);

  const setTools = useCallback((newTools: ToolbarToolItem[]) => {
    setState((prev) =>
      prev.tools === newTools ? prev : { ...prev, tools: newTools },
    );
  }, []);

  const setActiveAction = useCallback((id?: ToolbarActionId) => {
    setState((prev) =>
      prev.activeAction === id ? prev : { ...prev, activeAction: id },
    );
  }, []);

  const api = useMemo<ToolbarActionsApi>(
    () => ({ state, setActions, setTools, setActiveAction }),
    [state, setActions, setTools, setActiveAction],
  );

  return (
    <ToolbarActionsContext.Provider value={api}>
      {children}
    </ToolbarActionsContext.Provider>
  );
}

/**
 * Register toolbar actions from a screen component.
 * Cleans up automatically on unmount.
 * Wrap `actions` and `tools` in useMemo to avoid re-registering every render.
 */
export function useToolbarActions(
  actions: ToolbarActionMap,
  tools?: ToolbarToolItem[],
  activeAction?: ToolbarActionId,
) {
  const ctx = useContext(ToolbarActionsContext);
  if (!ctx) {
    throw new Error(
      "useToolbarActions must be used within a ToolbarActionsProvider",
    );
  }

  // Destructure stable setters (useCallback []) so the effect only re-fires
  // when actions/tools change, NOT on every context state update.
  const { setActions, setTools, setActiveAction } = ctx;

  // Register the current screen state without clearing the toolbar first.
  // Clearing on every dependency change briefly unmounts the toolbar and its
  // Radix Presence tree; when a screen updates several fields together this
  // can turn into a maximum-update-depth loop.
  useEffect(() => {
    setActions(actions);
    if (tools !== undefined) setTools(tools);
    setActiveAction(activeAction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActions, setTools, setActiveAction, actions, tools, activeAction]);

  // Clear only when the registering screen actually unmounts.
  useEffect(() => {
    return () => {
      setActions(EMPTY_ACTIONS);
      setTools(EMPTY_TOOLS);
      setActiveAction(undefined);
    };
  }, [setActions, setTools, setActiveAction]);
}

export function useToolbarState(): ToolbarState {
  const ctx = useContext(ToolbarActionsContext);
  if (!ctx) {
    throw new Error(
      "useToolbarState must be used within a ToolbarActionsProvider",
    );
  }
  return ctx.state;
}
