import React from "react";
import { NavBar } from "./components/NavBar.js";
import { StatusBar } from "./components/StatusBar.js";
import { AppProvider, useAppContext } from "./context/AppContext.js";
import { BuildConsole } from "./views/BuildConsole.js";
import { DeployDashboard } from "./views/DeployDashboard.js";
import { InteractiveDesignCanvas } from "./components/design/InteractiveDesignCanvas.js";
import { DriftDetection } from "./views/DriftDetection.js";
import { EvaluationLab } from "./views/EvaluationLab.js";
import { FeedbackLoop } from "./views/FeedbackLoop.js";
import { LiveWorkflow } from "./views/LiveWorkflow.js";
import { MonitorPanel } from "./views/MonitorPanel.js";

// Import workflow designer styles
import "./styles/workflow-designer.css";

function ViewRouter() {
	const { activeView } = useAppContext();

	switch (activeView) {
		case "design":
			return <InteractiveDesignCanvas />;
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
			return <InteractiveDesignCanvas />;
	}
}

export default function App() {
	return (
		<AppProvider>
			<div className="app-shell">
				<NavBar />
				<main className="main-content">
					<ViewRouter />
				</main>
				<StatusBar />
			</div>
		</AppProvider>
	);
}
