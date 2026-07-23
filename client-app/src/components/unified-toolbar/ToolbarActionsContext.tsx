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

  const setActions = useCallback((actions: ToolbarActionMap) => {
    setState((prev) => ({ ...prev, actions }));
  }, []);

  const setTools = useCallback((tools: ToolbarToolItem[]) => {
    setState((prev) => ({ ...prev, tools }));
  }, []);

  const setActiveAction = useCallback((id?: ToolbarActionId) => {
    setState((prev) => ({ ...prev, activeAction: id }));
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

  useEffect(() => {
    ctx.setActions(actions);
    if (tools) ctx.setTools(tools);
    ctx.setActiveAction(activeAction);

    return () => {
      ctx.setActions({});
      ctx.setTools([]);
      ctx.setActiveAction(undefined);
    };
  }, [ctx, actions, tools, activeAction]);
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
