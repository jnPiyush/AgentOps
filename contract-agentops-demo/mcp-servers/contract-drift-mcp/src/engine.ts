import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../../data");

interface DriftTimeline {
	week: string;
	accuracy: number;
}

interface DriftAlert {
	type: string;
	message: string;
	severity: "info" | "warning" | "critical";
	detected_at: string;
}

interface LlmDrift {
	id: string;
	type: string;
	timeline: DriftTimeline[];
	distribution: Record<string, number>;
	alerts: DriftAlert[];
	generated_at: string;
}

interface DataDrift {
	id: string;
	type: string;
	timeline: DriftTimeline[];
	distribution: Record<string, number>;
	alerts: DriftAlert[];
	generated_at: string;
}

interface ModelSwap {
	id: string;
	type: string;
	gpt4o: { accuracy: number; latency_ms: number; cost_per_contract: number };
	gpt4o_mini: {
		accuracy: number;
		latency_ms: number;
		cost_per_contract: number;
	};
	comparison: {
		accuracy_delta: number;
		latency_delta: number;
		cost_delta: number;
	};
}

interface DriftFile {
	llm_drift: LlmDrift;
	data_drift: DataDrift;
	model_swap: ModelSwap;
}

let cachedData: DriftFile | null = null;

async function loadDrift(): Promise<DriftFile> {
	if (cachedData) return cachedData;
	const raw = await readFile(resolve(DATA_DIR, "drift.json"), "utf-8");
	cachedData = JSON.parse(raw);
	return cachedData!;
}

export async function detectLlmDrift(): Promise<{
	drift_detected: boolean;
	current_accuracy: number;
	threshold: number;
	timeline: DriftTimeline[];
	alerts: DriftAlert[];
	recommendation: string;
}> {
	const data = await loadDrift();
	const timeline = data.llm_drift.timeline;
	const latest = timeline[timeline.length - 1];
	const threshold = 0.85;
	const driftDetected = latest.accuracy < threshold;

	return {
		drift_detected: driftDetected,
		current_accuracy: latest.accuracy,
		threshold,
		timeline,
		alerts: data.llm_drift.alerts,
		recommendation: driftDetected
			? "Accuracy below threshold. Consider retraining prompts or evaluating model updates."
			: "Accuracy within acceptable range. Continue monitoring.",
	};
}

export async function detectDataDrift(): Promise<{
	shift_detected: boolean;
	distribution: Record<string, number>;
	new_types: string[];
	timeline: DriftTimeline[];
	alerts: DriftAlert[];
	recommendation: string;
}> {
	const data = await loadDrift();
	const knownTypes = ["NDA", "MSA", "SOW", "Amendment", "SLA"];
	const dist = data.data_drift.distribution;
	const newTypes = Object.keys(dist).filter((k) => !knownTypes.includes(k));

	return {
		shift_detected: newTypes.length > 0,
		distribution: dist,
		new_types: newTypes,
		timeline: data.data_drift.timeline,
		alerts: data.data_drift.alerts,
		recommendation:
			newTypes.length > 0
				? `New contract types detected: ${newTypes.join(", ")}. Update training data and compliance rules.`
				: "No new contract types detected. Distribution stable.",
	};
}

export async function simulateModelSwap(): Promise<{
	current_model: string;
	candidate_model: string;
	current: { accuracy: number; latency_ms: number; cost_per_contract: number };
	candidate: {
		accuracy: number;
		latency_ms: number;
		cost_per_contract: number;
	};
	delta: { accuracy: string; latency: string; cost: string };
	verdict: "ACCEPTABLE" | "DEGRADED";
	reasoning: string;
}> {
	const data = await loadDrift();
	const swap = data.model_swap;
	const accuracyThreshold = 0.05; // 5% max acceptable drop

	const verdict =
		Math.abs(swap.comparison.accuracy_delta) <= accuracyThreshold ? ("ACCEPTABLE" as const) : ("DEGRADED" as const);

	return {
		current_model: "GPT-5.4",
		candidate_model: "GPT-4o-mini",
		current: swap.gpt4o,
		candidate: swap.gpt4o_mini,
		delta: {
			accuracy: `${(swap.comparison.accuracy_delta * 100).toFixed(1)}%`,
			latency: `${(swap.comparison.latency_delta * 100).toFixed(0)}%`,
			cost: `${(swap.comparison.cost_delta * 100).toFixed(0)}%`,
		},
		verdict,
		reasoning:
			verdict === "ACCEPTABLE"
				? `Accuracy drop of ${Math.abs(swap.comparison.accuracy_delta * 100).toFixed(1)}% within threshold. Save ${Math.abs(swap.comparison.cost_delta * 100).toFixed(0)}% cost.`
				: `Accuracy drop of ${Math.abs(swap.comparison.accuracy_delta * 100).toFixed(1)}% exceeds ${accuracyThreshold * 100}% threshold. Keep current model.`,
	};
}
