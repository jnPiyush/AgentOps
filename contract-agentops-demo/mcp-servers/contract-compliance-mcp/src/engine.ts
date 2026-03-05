import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../../data");

interface PolicyRule {
  id: string;
  name: string;
  description: string;
  category: string;
  clause_type: string;
  check: string;
  severity: string;
}

interface ClauseInput {
  type: string;
  text: string;
  section: string;
}

interface ClauseResult {
  clause_type: string;
  status: "pass" | "warn" | "fail";
  policy_ref: string;
  reason: string;
}

interface ComplianceResult {
  clause_results: ClauseResult[];
  overall_risk: "low" | "medium" | "high" | "critical";
  flags_count: number;
  policy_references: string[];
}

interface RiskAssessment {
  overall_risk: "low" | "medium" | "high" | "critical";
  flags_count: number;
  summary: string;
}

let cachedPolicies: PolicyRule[] | null = null;

export async function getPolicyRules(): Promise<PolicyRule[]> {
  if (cachedPolicies) return cachedPolicies;
  const raw = await readFile(resolve(DATA_DIR, "policies.json"), "utf-8");
  cachedPolicies = JSON.parse(raw) as PolicyRule[];
  return cachedPolicies;
}

export async function checkPolicy(
  clauses: ClauseInput[],
  _contractType?: string,
): Promise<ComplianceResult> {
  const policies = await getPolicyRules();
  const results: ClauseResult[] = [];
  const policyRefs: Set<string> = new Set();

  for (const clause of clauses) {
    // Find matching policy
    const matchingPolicy = policies.find((p) => p.clause_type === clause.type);

    if (matchingPolicy) {
      policyRefs.add(matchingPolicy.id);
      const status = evaluateClause(clause, matchingPolicy);
      results.push({
        clause_type: clause.type,
        status,
        policy_ref: matchingPolicy.id,
        reason: generateReason(clause, matchingPolicy, status),
      });
    } else {
      // Clause type not covered by policy
      results.push({
        clause_type: clause.type,
        status: "pass",
        policy_ref: "",
        reason: `No specific policy rule for ${clause.type} clauses`,
      });
    }
  }

  const failCount = results.filter((r) => r.status === "fail").length;
  const warnCount = results.filter((r) => r.status === "warn").length;

  let overall_risk: "low" | "medium" | "high" | "critical";
  if (failCount >= 2) overall_risk = "high";
  else if (failCount === 1) overall_risk = "medium";
  else if (warnCount >= 2) overall_risk = "medium";
  else if (warnCount === 1) overall_risk = "low";
  else overall_risk = "low";

  return {
    clause_results: results,
    overall_risk,
    flags_count: failCount,
    policy_references: [...policyRefs],
  };
}

export async function flagRisk(
  clauseResults: Array<{
    clause_type: string;
    status: string;
    policy_ref: string;
    reason: string;
  }>,
): Promise<RiskAssessment> {
  const failCount = clauseResults.filter((r) => r.status === "fail").length;
  const warnCount = clauseResults.filter((r) => r.status === "warn").length;

  let overall_risk: "low" | "medium" | "high" | "critical";
  if (failCount >= 3) overall_risk = "critical";
  else if (failCount >= 2) overall_risk = "high";
  else if (failCount === 1 || warnCount >= 3) overall_risk = "medium";
  else overall_risk = "low";

  const failedClauses = clauseResults
    .filter((r) => r.status === "fail")
    .map((r) => r.clause_type);

  return {
    overall_risk,
    flags_count: failCount,
    summary:
      failCount > 0
        ? `${failCount} policy violation(s) detected in: ${failedClauses.join(", ")}`
        : `No policy violations. ${warnCount} warning(s) noted.`,
  };
}

function evaluateClause(clause: ClauseInput, policy: PolicyRule): "pass" | "warn" | "fail" {
  const text = clause.text.toLowerCase();

  // Simple heuristic checks based on policy type
  switch (policy.clause_type) {
    case "liability": {
      // Check if liability exceeds 2x
      const multiplierMatch = text.match(/(\d+)\s*(?:times|x)\s/i);
      if (multiplierMatch && parseInt(multiplierMatch[1], 10) > 2) return "fail";
      return "pass";
    }
    case "termination": {
      const daysMatch = text.match(/(\d+)\s*(?:days|day)/i);
      if (daysMatch && parseInt(daysMatch[1], 10) < 30) return "fail";
      return "pass";
    }
    case "confidentiality": {
      const yearsMatch = text.match(/(\d+)\s*(?:years|year)/i);
      if (yearsMatch && parseInt(yearsMatch[1], 10) < 2) return "fail";
      if (yearsMatch && parseInt(yearsMatch[1], 10) < 5) return "warn";
      return "pass";
    }
    case "indemnification": {
      if (!text.includes("cap") && !text.includes("limit") && !text.includes("not exceed")) {
        return "fail";
      }
      return "pass";
    }
    case "payment": {
      const netMatch = text.match(/net-?(\d+)/i);
      if (netMatch && parseInt(netMatch[1], 10) > 60) return "fail";
      return "pass";
    }
    default:
      return "pass";
  }
}

function generateReason(
  clause: ClauseInput,
  policy: PolicyRule,
  status: "pass" | "warn" | "fail",
): string {
  if (status === "pass") {
    return `${clause.type} clause meets ${policy.name} requirements`;
  }
  if (status === "warn") {
    return `${clause.type} clause meets minimum but below recommended threshold per ${policy.name}`;
  }
  return `${clause.type} clause violates ${policy.name}: ${policy.check}`;
}
