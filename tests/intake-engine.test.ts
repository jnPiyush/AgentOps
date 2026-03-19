import { describe, expect, it } from "vitest";
import { classifyDocument, extractMetadata, uploadContract } from "../mcp-servers/contract-intake-mcp/src/engine.js";

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

	it("extracts enriched intake routing metadata for commercial and corporate signals", async () => {
		const result = await extractMetadata(
			"MASTER SERVICES AGREEMENT between Acme Corp and Beta Inc effective January 1, 2026 under New York law for USD 250000 with GDPR and procurement requirements.",
		);

		expect(result.contract_category).toBe("Commercial");
		expect(result.industry).toBeNull();
		expect(result.risk_level).toBe("MEDIUM");
		expect(result.compliance_needs).toEqual(expect.arrayContaining(["data_privacy", "procurement_controls"]));
		expect(result.counterparty_type).toBe("vendor-customer");
		expect(result.currency).toBe("USD");
		expect(result.value).toBe(250000);
		expect(result.effective_date).toBe("2026-01-01");
	});

	it("detects email and API sourced contracts during upload", async () => {
		const emailUpload = await uploadContract(
			"From: legal@contoso.com\nSubject: Loan Agreement\nLOAN AGREEMENT where Lender agrees to lend and Borrower shall repay under Delaware law.",
			"loan.msg",
		);
		const apiUpload = await uploadContract(
			'{"source":"webhook","payload":"CLOUD SERVICES AGREEMENT for hosted support with AI governance controls."}',
			"contract.json",
		);

		expect(emailUpload.metadata.source_channel).toBe("email");
		expect(emailUpload.metadata.contract_category).toBe("Corporate");
		expect(apiUpload.metadata.source_channel).toBe("api");
	});
});
