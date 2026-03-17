import { describe, expect, it } from "vitest";
import { classifyDocument } from "../mcp-servers/contract-intake-mcp/src/engine.js";

describe("contract intake classifier", () => {
	it("classifies the newly supported contract families", async () => {
		const testCases = [
			{
				expectedType: "Services Agreement",
				text: "PROFESSIONAL SERVICES AGREEMENT between Alpha Consulting and Beta Retail for advisory services.",
			},
			{
				expectedType: "Sales Agreement",
				text: "SALES AGREEMENT under which Seller agrees to sell equipment to Buyer.",
			},
			{
				expectedType: "Distribution Agreement",
				text: "DISTRIBUTION AGREEMENT appointing Gamma LLC as authorized distributor in North America.",
			},
			{
				expectedType: "Supply Agreement",
				text: "SUPPLY AGREEMENT where Supplier shall supply raw materials to Manufacturer.",
			},
			{
				expectedType: "License Agreement",
				text: "SOFTWARE LICENSE AGREEMENT that grants a non-exclusive license to use the platform.",
			},
			{
				expectedType: "SaaS / Cloud Services Agreement",
				text: "CLOUD SERVICES AGREEMENT for software as a service subscriptions and hosted support.",
			},
			{
				expectedType: "Promissory Note",
				text: "PROMISSORY NOTE. Borrower promises to pay Lender the principal sum of $250,000.",
			},
			{
				expectedType: "Loan Agreement",
				text: "LOAN AGREEMENT where Lender agrees to lend and Borrower shall repay in monthly installments.",
			},
		] as const;

		for (const testCase of testCases) {
			const result = await classifyDocument(testCase.text);
			expect(result.type).toBe(testCase.expectedType);
			expect(result.confidence).toBeGreaterThanOrEqual(0.7);
		}
	});

	it("uses UNKNOWN when no contract pattern matches", async () => {
		const result = await classifyDocument("This document contains meeting notes and no contractual language.");

		expect(result).toEqual({ type: "UNKNOWN", confidence: 0.5 });
	});
});