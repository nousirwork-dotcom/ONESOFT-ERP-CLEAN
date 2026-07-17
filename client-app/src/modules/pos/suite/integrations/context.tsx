import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import type { ConnectionTestResult, IntegrationConnection, IntegrationConnectionSettings, ProductMapping } from './types';

type IntegrationAction =
  | { type: 'ADD_CONNECTION'; connection: IntegrationConnection }
  | { type: 'REMOVE_CONNECTION'; id: string }
  | { type: 'UPDATE_CONNECTION'; id: string; patch: Partial<IntegrationConnection> }
  | { type: 'UPDATE_CONN_SETTINGS'; id: string; settings: Partial<IntegrationConnectionSettings> }
  | { type: 'UPDATE_CONN_MAPPINGS'; id: string; mappings: ProductMapping[] }
  | { type: 'SET_ENABLED'; id: string; enabled: boolean }
  | { type: 'RECORD_SYNC'; id: string; result: ConnectionTestResult };

interface IntegrationState {
  connections: IntegrationConnection[];
}

const initialState: IntegrationState = { connections: [] };

function reducer(state: IntegrationState, action: IntegrationAction): IntegrationState {
  switch (action.type) {
    case 'ADD_CONNECTION':
      return { ...state, connections: [...state.connections, action.connection] };

    case 'REMOVE_CONNECTION':
      return { ...state, connections: state.connections.filter((c) => c.id !== action.id) };

    case 'UPDATE_CONNECTION':
      return {
        ...state,
        connections: state.connections.map((c) =>
          c.id === action.id ? { ...c, ...action.patch } : c,
        ),
      };

    case 'UPDATE_CONN_SETTINGS':
      return {
        ...state,
        connections: state.connections.map((c) =>
          c.id === action.id
            ? { ...c, settings: { ...c.settings, ...action.settings } }
            : c,
        ),
      };

    case 'UPDATE_CONN_MAPPINGS':
      return {
        ...state,
        connections: state.connections.map((c) =>
          c.id === action.id
            ? {
                ...c,
                productMappings: action.mappings,
                unmappedProductCount: action.mappings.filter((m) => m.onesoftProductId === null).length,
              }
            : c,
        ),
      };

    case 'SET_ENABLED':
      return {
        ...state,
        connections: state.connections.map((c) =>
          c.id === action.id
            ? {
                ...c,
                enabled: action.enabled,
                status: action.enabled ? 'pending' : 'paused',
              }
            : c,
        ),
      };

    case 'RECORD_SYNC': {
      const now = new Date().toISOString();
      return {
        ...state,
        connections: state.connections.map((c) =>
          c.id === action.id
            ? {
                ...c,
                lastSyncAt: now,
                lastSyncStatus: action.result.success ? 'success' : 'error',
                lastSyncError: action.result.success ? undefined : action.result.message,
                status: action.result.success ? 'connected' : 'error',
              }
            : c,
        ),
      };
    }

    default:
      return state;
  }
}

interface IntegrationContextValue {
  connections: IntegrationConnection[];
  addConnection: (connection: IntegrationConnection) => void;
  removeConnection: (id: string) => void;
  updateConnection: (id: string, patch: Partial<IntegrationConnection>) => void;
  updateConnectionSettings: (id: string, settings: Partial<IntegrationConnectionSettings>) => void;
  updateConnectionMappings: (id: string, mappings: ProductMapping[]) => void;
  setEnabled: (id: string, enabled: boolean) => void;
  recordSync: (id: string, result: ConnectionTestResult) => void;
}

const IntegrationContext = createContext<IntegrationContextValue | null>(null);

export function IntegrationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const addConnection = useCallback(
    (connection: IntegrationConnection) => dispatch({ type: 'ADD_CONNECTION', connection }),
    [],
  );

  const removeConnection = useCallback(
    (id: string) => dispatch({ type: 'REMOVE_CONNECTION', id }),
    [],
  );

  const updateConnection = useCallback(
    (id: string, patch: Partial<IntegrationConnection>) =>
      dispatch({ type: 'UPDATE_CONNECTION', id, patch }),
    [],
  );

  const updateConnectionSettings = useCallback(
    (id: string, settings: Partial<IntegrationConnectionSettings>) =>
      dispatch({ type: 'UPDATE_CONN_SETTINGS', id, settings }),
    [],
  );

  const updateConnectionMappings = useCallback(
    (id: string, mappings: ProductMapping[]) =>
      dispatch({ type: 'UPDATE_CONN_MAPPINGS', id, mappings }),
    [],
  );

  const setEnabled = useCallback(
    (id: string, enabled: boolean) => dispatch({ type: 'SET_ENABLED', id, enabled }),
    [],
  );

  const recordSync = useCallback(
    (id: string, result: ConnectionTestResult) => dispatch({ type: 'RECORD_SYNC', id, result }),
    [],
  );

  const value = useMemo<IntegrationContextValue>(
    () => ({
      connections: state.connections,
      addConnection,
      removeConnection,
      updateConnection,
      updateConnectionSettings,
      updateConnectionMappings,
      setEnabled,
      recordSync,
    }),
    [
      state.connections,
      addConnection,
      removeConnection,
      updateConnection,
      updateConnectionSettings,
      updateConnectionMappings,
      setEnabled,
      recordSync,
    ],
  );

  return <IntegrationContext.Provider value={value}>{children}</IntegrationContext.Provider>;
}

export function useIntegration(): IntegrationContextValue {
  const ctx = useContext(IntegrationContext);
  if (!ctx) throw new Error('useIntegration must be used inside IntegrationProvider');
  return ctx;
}
