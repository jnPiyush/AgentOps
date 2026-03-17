import { type PolicyRule, PolicyViolation, policyEngine } from "./policyEngine.js";

interface ClauseInput {
	type: string;
	text: string;
	section: string;
}

interface ClauseResult {
	clause_type: string;
	status: "pass" | "warn" | "fail" | "warning";
	policy_ref: string;
	reason: string;
	severity?: "low" | "medium" | "high" | "critical";
	extracted_value?: string | number;
	policy_threshold?: string | number;
}

interface ComplianceResult {
	clause_results: ClauseResult[];
	overall_risk: "low" | "medium" | "high" | "critical";
	flags_count: number;
	warnings_count: number;
	policy_references: string[];
	total_violations: number;
}

interface RiskAssessment {
	overall_risk: "low" | "medium" | "high" | "critical";
	flags_count: number;
	warnings_count: number;
	summary: string;
	critical_violations: string[];
	high_violations: string[];
}

export async function getPolicyRules(): Promise<PolicyRule[]> {
	return await policyEngine.getPolicies();
}

export async function checkPolicy(clauses: ClauseInput[], _contractType?: string): Promise<ComplianceResult> {
	const results: ClauseResult[] = [];
	const policyRefs: Set<string> = new Set();
	let totalViolations = 0;

	for (const clause of clauses) {
		// Get all policy violations for this clause
		const violations = await policyEngine.evaluateClause(
			clause.type,
			clause.text,
			{ section: clause.section },
			_contractType,
		);

		if (violations.length === 0) {
			// No violations found
			results.push({
				clause_type: clause.type,
				status: "pass",
				policy_ref: "",
				reason: `No policy violations detected for ${clause.type} clause`,
			});
		} else {
			// Process each violation
			for (const violation of violations) {
				policyRefs.add(violation.rule_id);
				totalViolations++;

				results.push({
					clause_type: violation.clause_type,
					status: violation.status,
					policy_ref: violation.rule_id,
					reason: violation.message,
					severity: violation.severity,
					extracted_value: violation.extracted_value,
					policy_threshold: violation.policy_threshold,
				});
			}
		}
	}

	const failCount = results.filter((r) => r.status === "fail").length;
	const warnCount = results.filter((r) => r.status === "warning").length;
	const criticalCount = results.filter((r) => r.severity === "critical").length;
	const highCount = results.filter((r) => r.severity === "high").length;

	// Calculate overall risk based on severity
	let overall_risk: "low" | "medium" | "high" | "critical";
	if (criticalCount > 0) {
		overall_risk = "critical";
	} else if (highCount >= 2 || failCount >= 3) {
		overall_risk = "high";
	} else if (highCount === 1 || failCount >= 1 || warnCount >= 3) {
		overall_risk = "medium";
	} else {
		overall_risk = "low";
	}

	return {
		clause_results: results,
		overall_risk,
		flags_count: failCount,
		warnings_count: warnCount,
		policy_references: [...policyRefs],
		total_violations: totalViolations,
	};
}

export async function flagRisk(
	clauseResults: Array<{
		clause_type: string;
		status: string;
		policy_ref: string;
		reason: string;
		severity?: "low" | "medium" | "high" | "critical";
	}>,
): Promise<RiskAssessment> {
	const failCount = clauseResults.filter((r) => r.status === "fail").length;
	const warnCount = clauseResults.filter((r) => r.status === "warning").length;
	const criticalCount = clauseResults.filter((r) => r.severity === "critical").length;
	const highCount = clauseResults.filter((r) => r.severity === "high").length;

	// Enhanced risk calculation using severity levels
	let overall_risk: "low" | "medium" | "high" | "critical";
	if (criticalCount > 0) {
		overall_risk = "critical";
	} else if (highCount >= 2 || failCount >= 3) {
		overall_risk = "high";
	} else if (highCount === 1 || failCount >= 1 || warnCount >= 3) {
		overall_risk = "medium";
	} else {
		overall_risk = "low";
	}

	const criticalViolations = clauseResults
		.filter((r) => r.severity === "critical" && r.status === "fail")
		.map((r) => `${r.clause_type} (${r.policy_ref}): ${r.reason}`);

	const highViolations = clauseResults
		.filter((r) => r.severity === "high" && r.status === "fail")
		.map((r) => `${r.clause_type} (${r.policy_ref}): ${r.reason}`);

	let summary: string;
	if (criticalCount > 0) {
		summary = `CRITICAL: ${criticalCount} critical violation(s) detected. Immediate action required. Also ${failCount - criticalCount} other failures and ${warnCount} warnings.`;
	} else if (failCount > 0) {
		summary = `${failCount} policy violation(s) detected. ${warnCount} warnings noted. Review required before approval.`;
	} else if (warnCount > 0) {
		summary = `No policy violations. ${warnCount} warning(s) noted for review.`;
	} else {
		summary = "All clauses pass policy compliance checks.";
	}

	return {
		overall_risk,
		flags_count: failCount,
		warnings_count: warnCount,
		summary,
		critical_violations: criticalViolations,
		high_violations: highViolations,
	};
}

// Utility functions for policy management
export async function addPolicyRule(rule: PolicyRule): Promise<void> {
	await policyEngine.addPolicy(rule);
}

export async function updatePolicyRule(ruleId: string, updates: Partial<PolicyRule>): Promise<boolean> {
	return await policyEngine.updatePolicy(ruleId, updates);
}

export async function deletePolicyRule(ruleId: string): Promise<boolean> {
	return await policyEngine.deletePolicy(ruleId);
}
