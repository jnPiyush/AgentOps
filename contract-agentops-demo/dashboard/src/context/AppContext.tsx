import React, { createContext, useContext, useState, type ReactNode } from "react";

export type ViewName =
  | "design"
  | "build"
  | "deploy"
  | "live"
  | "monitor"
  | "evaluation"
  | "drift"
  | "feedback";

interface AppState {
  activeView: ViewName;
  setActiveView: (view: ViewName) => void;
  contractCount: number;
  setContractCount: (n: number) => void;
  demoMode: string;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<ViewName>("design");
  const [contractCount, setContractCount] = useState(0);

  return (
    <AppContext.Provider
      value={{ activeView, setActiveView, contractCount, setContractCount, demoMode: "simulated" }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
