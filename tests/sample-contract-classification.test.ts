import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { classifyDocument } from "../mcp-servers/contract-intake-mcp/src/engine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_DIR = resolve(__dirname, "../data/sample-contracts");

describe("sample contract classification fixtures", () => {
	it("classifies the added contract family fixtures correctly", async () => {
		const fixtures = [
			["ServicesAgreement-Consulting-2026.txt", "Services Agreement"],
			["SalesAgreement-Equipment-2026.txt", "Sales Agreement"],
			["DistributionAgreement-Regional-2026.txt", "Distribution Agreement"],
			["SupplyAgreement-Materials-2026.txt", "Supply Agreement"],
			["LicenseAgreement-Platform-2026.txt", "License Agreement"],
			["SaaS-CloudServices-2026.txt", "SaaS / Cloud Services Agreement"],
			["PromissoryNote-BridgeLoan-2026.txt", "Promissory Note"],
			["LoanAgreement-TermLoan-2026.txt", "Loan Agreement"],
		] as const;

		for (const [filename, expectedType] of fixtures) {
			const text = await readFile(resolve(SAMPLE_DIR, filename), "utf-8");
			const result = await classifyDocument(text);

			expect(result.type).toBe(expectedType);
			expect(result.confidence).toBeGreaterThanOrEqual(0.7);
		}
	});
});