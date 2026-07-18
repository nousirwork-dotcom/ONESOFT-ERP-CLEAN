import { createContext, useContext } from "react";

export const TabPathContext = createContext<string>("");

export function useTabPath(): string {
  return useContext(TabPathContext);
}
