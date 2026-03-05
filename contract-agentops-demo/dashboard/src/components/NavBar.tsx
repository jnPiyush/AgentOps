import React from "react";
import { useAppContext, type ViewName } from "../context/AppContext.js";

const TABS: { key: ViewName; label: string }[] = [
  { key: "design", label: "Design" },
  { key: "build", label: "Build" },
  { key: "deploy", label: "Deploy" },
  { key: "live", label: "Live" },
  { key: "monitor", label: "Monitor" },
  { key: "evaluation", label: "Evaluate" },
  { key: "drift", label: "Drift" },
  { key: "feedback", label: "Feedback" },
];

export function NavBar() {
  const { activeView, setActiveView } = useAppContext();

  return (
    <nav className="bg-brand-900 text-white px-4 py-3 flex items-center gap-6">
      <h1 className="font-bold text-lg mr-4">Contract AgentOps</h1>
      <div className="flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key)}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              activeView === tab.key
                ? "bg-white/20 font-semibold"
                : "hover:bg-white/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
