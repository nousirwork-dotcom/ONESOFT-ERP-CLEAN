import { createContext, useContext } from "react";

export const WorkspaceContext = createContext<HTMLElement | null>(null);

export function useWorkspaceEl(): HTMLElement | null {
  return useContext(WorkspaceContext);
}
