import { describe, expect, it } from "vitest";
import { checkPolicy, flagRisk } from "../mcp-servers/contract-compliance-mcp/src/engine.js";
import { policyEngine } from "../mcp-servers/contract-compliance-mcp/src/policyEngine.js";

describe("Dynamic Policy Engine", () => {
	describe("evaluateClause", () => {
		it("detects high liability cap exceeding policy", async () => {
			const violations = await policyEngine.evaluateClause(
				"liability",
				"The maximum liability under this agreement shall be limited to $10,000,000 USD.",
				{ section: "15.2" },
			);
			expect(violations).toHaveLength(1);
			expect(violations[0].severity).toBe("high");
			expect(violations[0].status).toBe("fail");
		});

		it("passes acceptable liability cap within policy", async () => {
			const violations = await policyEngine.evaluateClause(
				"liability",
				"The maximum liability under this agreement shall be limited to $2,000,000 USD.",
				{ section: "15.2" },
			);
			expect(violations).toHaveLength(0);
		});

		it("detects unlimited indemnification as critical", async () => {
			const violations = await policyEngine.evaluateClause(
				"indemnification",
				"Company shall provide unlimited indemnification for all claims arising from this agreement.",
				{ section: "12.1" },
			);
			expect(violations).toHaveLength(1);
			expect(violations[0].severity).toBe("critical");
			expect(violations[0].status).toBe("fail");
		});

		it("detects extended payment terms exceeding policy", async () => {
			const violations = await policyEngine.evaluateClause(
				"payment",
				"All invoices are payable net-60 days from the invoice date.",
				{ section: "8.2" },
			);
			expect(violations).toHaveLength(1);
			expect(violations[0].severity).toBe("medium");
			expect(violations[0].status).toBe("fail");
		});

		it("passes standard payment terms", async () => {
			const violations = await policyEngine.evaluateClause(
				"payment",
				"Payment is due within 30 days of invoice receipt.",
				{ section: "8.2" },
			);
			expect(violations).toHaveLength(0);
		});

		it("detects excessive data retention period", async () => {
			const violations = await policyEngine.evaluateClause(
				"data_protection",
				"Customer data will be retained for 10 years after contract termination.",
				{ section: "9.3" },
			);
			expect(violations).toHaveLength(1);
			expect(violations[0].severity).toBe("medium");
			expect(violations[0].status).toBe("fail");
		});

		it("detects non-preferred jurisdiction", async () => {
			const violations = await policyEngine.evaluateClause(
				"governing_law",
				"This agreement shall be governed by the laws of Illinois.",
				{ section: "16.1" },
			);
			expect(violations).toHaveLength(1);
			expect(violations[0].severity).toBe("low");
			expect(violations[0].status).toBe("warning");
		});

		it("detects low SLA uptime requirement", async () => {
			const violations = await policyEngine.evaluateClause(
				"sla",
				"The service level agreement guarantees 99.0% uptime availability.",
				{ section: "5.1" },
			);
			expect(violations).toHaveLength(1);
			expect(violations[0].severity).toBe("medium");
			expect(violations[0].status).toBe("fail");
		});

		it("applies stricter payment terms to sales and supply family contracts", async () => {
			const violations = await checkPolicy(
				[
					{
						type: "payment",
						text: "Payment is due within 40 days of invoice receipt.",
						section: "4.2",
					},
				],
				"Sales Agreement",
			);

			expect(violations.flags_count).toBe(1);
			expect(violations.policy_references).toContain("SALES-001");
		});

		it("does not apply sales-specific payment rule to non-sales contracts", async () => {
			const violations = await checkPolicy(
				[
					{
						type: "payment",
						text: "Payment is due within 40 days of invoice receipt.",
						section: "4.2",
					},
				],
				"Services Agreement",
			);

			expect(violations.flags_count).toBe(0);
			expect(violations.policy_references).not.toContain("SALES-001");
		});

		it("applies stricter uptime policy to SaaS agreements", async () => {
			const violations = await checkPolicy(
				[
					{
						type: "sla",
						text: "The service level agreement guarantees 99.92% uptime availability.",
						section: "5.1",
					},
				],
				"SaaS / Cloud Services Agreement",
			);

			expect(violations.flags_count).toBe(1);
			expect(violations.policy_references).toContain("SAAS-001");
		});

		it("applies license-specific IP clause policy", async () => {
			const violations = await checkPolicy(
				[
					{
						type: "ip_ownership",
						text: "Provider retains all intellectual property rights in the software.",
						section: "7.1",
					},
				],
				"License Agreement",
			);

			expect(violations.flags_count).toBe(1);
			expect(violations.policy_references).toContain("LIC-001");
		});

		it("applies interest cap to loan and promissory-note contracts", async () => {
			const violations = await checkPolicy(
				[
					{
						type: "interest",
						text: "Interest shall accrue at 24% per annum until the loan is repaid in full.",
						section: "3.1",
					},
				],
				"Loan Agreement",
			);

			expect(violations.flags_count).toBe(1);
			expect(violations.policy_references).toContain("LOAN-001");
		});
	});

	describe("checkPolicy (full compliance workflow)", () => {
		it("evaluates mixed clauses and calculates overall risk", async () => {
			const clauses = [
				{
					type: "liability",
					text: "The maximum liability under this agreement shall be limited to $10,000,000 USD.",
					section: "15.2",
				},
				{
					type: "indemnification",
					text: "Company shall provide unlimited indemnification for all claims arising from this agreement.",
					section: "12.1",
				},
				{
					type: "payment",
					text: "All invoices are payable net-30 days from the invoice date.",
					section: "8.2",
				},
			];

			const result = await checkPolicy(clauses, "service_agreement");
			expect(result.total_violations).toBeGreaterThanOrEqual(2);
			expect(result.flags_count).toBeGreaterThanOrEqual(2);
			expect(result.policy_references.length).toBeGreaterThan(0);
			expect(["high", "critical"]).toContain(result.overall_risk);
		});

		it("returns low risk for compliant clauses", async () => {
			const clauses = [
				{
					type: "payment",
					text: "Payment is due within 30 days of invoice receipt.",
					section: "8.2",
				},
			];

			const result = await checkPolicy(clauses);
			expect(result.overall_risk).toBe("low");
			expect(result.flags_count).toBe(0);
		});
	});

	describe("flagRisk", () => {
		it("returns critical risk for critical violations", async () => {
			const clauseResults = [
				{
					clause_type: "indemnification",
					status: "fail",
					policy_ref: "FIN-003",
					reason: "Unlimited indemnification",
					severity: "critical" as const,
				},
				{
					clause_type: "liability",
					status: "fail",
					policy_ref: "FIN-001",
					reason: "Exceeds cap",
					severity: "high" as const,
				},
			];

			const assessment = await flagRisk(clauseResults);
			expect(assessment.overall_risk).toBe("critical");
			expect(assessment.critical_violations.length).toBe(1);
			expect(assessment.high_violations.length).toBe(1);
		});

		it("returns low risk when all clauses pass", async () => {
			const clauseResults = [
				{
					clause_type: "payment",
					status: "pass",
					policy_ref: "",
					reason: "No violations",
				},
			];

			const assessment = await flagRisk(clauseResults);
			expect(assessment.overall_risk).toBe("low");
			expect(assessment.summary).toContain("All clauses pass");
		});
	});
});
