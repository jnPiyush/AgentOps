import React from "react";
import { useAppContext } from "../context/AppContext.js";

export function StatusBar() {
  const { demoMode, contractCount } = useAppContext();

  return (
    <div className="bg-gray-100 border-t border-gray-200 px-4 py-2 flex items-center justify-between text-xs text-gray-500">
      <div className="flex gap-4">
        <span>Mode: <strong className="text-gray-700">{demoMode}</strong></span>
        <span>Contracts: <strong className="text-gray-700">{contractCount}</strong></span>
      </div>
      <span>Gateway: localhost:8000</span>
    </div>
  );
}
