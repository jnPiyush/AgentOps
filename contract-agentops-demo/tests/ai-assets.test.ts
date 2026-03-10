import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getGroundTruth } from "../mcp-servers/contract-eval-mcp/src/engine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

async function readJson(relativePath: string): Promise<any> {
	const raw = await readFile(resolve(ROOT, relativePath), "utf-8");
	return JSON.parse(raw);
}

async function readText(relativePath: string): Promise<string> {
	return readFile(resolve(ROOT, relativePath), "utf-8");
}

describe("declarative AI asset consistency", () => {
	it("templates and examples satisfy required top-level schema fields", async () => {
		const assetSets = [
			{
				schema: "config/schemas/intake-result.json",
				template: "templates/intake-result.json",
				example: "examples/intake-examples.json",
			},
			{
				schema: "config/schemas/extraction-result.json",
				template: "templates/extraction-result.json",
				example: "examples/extraction-examples.json",
			},
			{
				schema: "config/schemas/compliance-result.json",
				template: "templates/compliance-result.json",
				example: "examples/compliance-examples.json",
			},
			{
				schema: "config/schemas/approval-result.json",
				template: "templates/approval-result.json",
				example: "examples/approval-examples.json",
			},
		];

		for (const assetSet of assetSets) {
			const schema = await readJson(assetSet.schema);
			const template = await readJson(assetSet.template);
			const examples = await readJson(assetSet.example);
			const required = schema.required as string[];

			for (const field of required) {
				expect(template).toHaveProperty(field);
				expect(examples[0].expected).toHaveProperty(field);
			}
		}
	});

	it("prompt files reference the current schema fields instead of legacy output shapes", async () => {
		const intakePrompt = await readText("prompts/intake-system.md");
		const extractionPrompt = await readText("prompts/extraction-system.md");
		const compliancePrompt = await readText("prompts/compliance-system.md");
		const approvalPrompt = await readText("prompts/approval-system.md");

		expect(intakePrompt).toContain("contract_type");
		expect(intakePrompt).toContain("confidence_score");
		expect(intakePrompt).not.toContain('"type": "CONTRACT_TYPE"');

		expect(extractionPrompt).toContain('"dates": [');
		expect(extractionPrompt).toContain('"values": [');
		expect(extractionPrompt).not.toContain('"dates": {');
		expect(extractionPrompt).not.toContain('"values": {');

		expect(compliancePrompt).toContain("overall_score");
		expect(compliancePrompt).toContain("approval_required");
		expect(compliancePrompt).not.toContain('"clause_results"');
		expect(compliancePrompt).not.toContain('"overall_risk"');

		expect(approvalPrompt).toContain("decision");
		expect(approvalPrompt).toContain("escalation_required");
		expect(approvalPrompt).not.toContain('"action": "auto_approve');
	});

	it("evaluation history latest entry matches the active ground truth corpus size", async () => {
		const evaluations = await readJson("data/evaluations.json");
		const latest = evaluations[evaluations.length - 1];
		expect(latest.total_cases).toBe(getGroundTruth().length);
		expect(latest.quality_gate).toMatch(/^(PASS|FAIL)$/);
	});

	it("extraction example uses array-based dates and labeled values", async () => {
		const examples = await readJson("examples/extraction-examples.json");
		const expected = examples[0].expected;
		expect(Array.isArray(expected.dates)).toBe(true);
		expect(Array.isArray(expected.values)).toBe(true);
		expect(expected.values[0]).toHaveProperty("label");
		expect(expected.values[0]).toHaveProperty("value");
		expect(expected.clauses[0]).toHaveProperty("type");
		expect(expected.clauses[0]).toHaveProperty("text");
		expect(expected.clauses[0]).toHaveProperty("section");
	});
});