import React from "react";
import { AppProvider, useAppContext } from "./context/AppContext.js";
import { NavBar } from "./components/NavBar.js";
import { StatusBar } from "./components/StatusBar.js";
import { DesignCanvas } from "./views/DesignCanvas.js";
import { BuildConsole } from "./views/BuildConsole.js";
import { LiveWorkflow } from "./views/LiveWorkflow.js";
import { MonitorPanel } from "./views/MonitorPanel.js";
import { DeployDashboard } from "./views/DeployDashboard.js";
import { EvaluationLab } from "./views/EvaluationLab.js";
import { DriftDetection } from "./views/DriftDetection.js";
import { FeedbackLoop } from "./views/FeedbackLoop.js";

function ViewRouter() {
  const { activeView } = useAppContext();

  switch (activeView) {
    case "design":
      return <DesignCanvas />;
    case "build":
      return <BuildConsole />;
    case "deploy":
      return <DeployDashboard />;
    case "live":
      return <LiveWorkflow />;
    case "monitor":
      return <MonitorPanel />;
    case "evaluation":
      return <EvaluationLab />;
    case "drift":
      return <DriftDetection />;
    case "feedback":
      return <FeedbackLoop />;
    default:
      return <DesignCanvas />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 bg-gray-50">
          <ViewRouter />
        </main>
        <StatusBar />
      </div>
    </AppProvider>
  );
}
