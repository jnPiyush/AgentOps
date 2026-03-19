import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { appConfig } from "../config.js";
import type { AuditEntry, Contract, FeedbackEntry } from "../types.js";
import { JsonStore } from "./jsonStore.js";

export interface TestScenarioRecord {
	id: string;
	name: string;
	description: string;
	inputSummary: string;
	expectations: string[];
	requiredCapabilities: string[];
	requiresHumanReview: boolean;
	prefersParallel: boolean;
}

const contractTextDir = resolve(appConfig.dataDir, "contract-texts");

function getContractTextPath(contractId: string): string {
	return resolve(contractTextDir, `${contractId}.txt`);
}

export const contractStore = new JsonStore<Contract>(resolve(appConfig.dataDir, "contracts.json"));

export const auditStore = new JsonStore<AuditEntry>(resolve(appConfig.dataDir, "audit.json"));

export const feedbackStore = new JsonStore<FeedbackEntry>(resolve(appConfig.dataDir, "feedback.json"));

export const evaluationStore = new JsonStore<import("../types.js").EvaluationResult>(
	resolve(appConfig.dataDir, "evaluations.json"),
);

export const testScenarioStore = new JsonStore<TestScenarioRecord>(resolve(appConfig.dataDir, "test-scenarios.json"));

export async function saveContractText(contractId: string, text: string): Promise<void> {
	await mkdir(contractTextDir, { recursive: true });
	await writeFile(getContractTextPath(contractId), text, "utf-8");
}

export async function loadContractText(contractId: string): Promise<string | undefined> {
	try {
		return await readFile(getContractTextPath(contractId), "utf-8");
	} catch {
		return undefined;
	}
}

export async function hydrateContractText(contract: Contract | undefined): Promise<Contract | undefined> {
	if (!contract) {
		return undefined;
	}

	const text = await loadContractText(contract.id);
	return text !== undefined ? { ...contract, text } : { ...contract };
}

export async function initStores(): Promise<void> {
	await Promise.all([
		contractStore.load(),
		auditStore.load(),
		feedbackStore.load(),
		evaluationStore.load(),
		testScenarioStore.load(),
	]);
}
