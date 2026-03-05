import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../../data");

interface GroundTruth {
  contract_id: string;
  expected_type: string;
  expected_clauses: string[];
  expected_parties: string[];
  expected_risk: string;
}

interface PerContractResult {
  contract_id: string;
  classification: "pass" | "fail";
  extraction: "pass" | "fail";
  compliance: "pass" | "fail";
  judge_avg: number;
  overall: "pass" | "fail";
}

interface EvalResult {
  id: string;
  version: string;
  run_at: string;
  total_cases: number;
  passed: number;
  accuracy: number;
  per_metric: Record<string, number>;
  per_contract: Record<string, PerContractResult>;
  quality_gate: "PASS" | "FAIL";
  judge_scores: { relevance: number; groundedness: number; coherence: number };
}

const GROUND_TRUTH: GroundTruth[] = [
  { contract_id: "NDA-001", expected_type: "NDA", expected_clauses: ["confidentiality", "termination", "non_solicitation", "governing_law"], expected_parties: ["Acme Corp", "Beta Inc"], expected_risk: "medium" },
  { contract_id: "NDA-002", expected_type: "NDA", expected_clauses: ["confidentiality", "termination", "data_protection"], expected_parties: ["TechCo", "StartupX"], expected_risk: "low" },
  { contract_id: "MSA-001", expected_type: "MSA", expected_clauses: ["liability", "termination", "payment_terms", "indemnification"], expected_parties: ["GlobalCorp", "Vendor Ltd"], expected_risk: "high" },
  { contract_id: "MSA-002", expected_type: "MSA", expected_clauses: ["liability", "confidentiality", "dispute_resolution"], expected_parties: ["MegaCorp", "SmallBiz"], expected_risk: "medium" },
  { contract_id: "SOW-001", expected_type: "SOW", expected_clauses: ["payment_terms", "termination", "intellectual_property"], expected_parties: ["ClientCo", "AgencyInc"], expected_risk: "low" },
  { contract_id: "SOW-002", expected_type: "SOW", expected_clauses: ["payment_terms", "milestones", "acceptance_criteria"], expected_parties: ["BuyerCo", "DevShop"], expected_risk: "low" },
  { contract_id: "AMD-001", expected_type: "Amendment", expected_clauses: ["payment_terms", "termination"], expected_parties: ["PartnerA", "PartnerB"], expected_risk: "low" },
  { contract_id: "AMD-002", expected_type: "Amendment", expected_clauses: ["liability", "confidentiality"], expected_parties: ["AlphaCo", "BetaCo"], expected_risk: "medium" },
  { contract_id: "SLA-001", expected_type: "SLA", expected_clauses: ["uptime_guarantee", "penalties", "support_response"], expected_parties: ["CloudProvider", "Enterprise"], expected_risk: "low" },
  { contract_id: "SLA-002", expected_type: "SLA", expected_clauses: ["uptime_guarantee", "data_protection", "termination"], expected_parties: ["SaaSCo", "FinanceCo"], expected_risk: "medium" },
  { contract_id: "NDA-003", expected_type: "NDA", expected_clauses: ["confidentiality", "non_compete", "governing_law"], expected_parties: ["InvestorGroup", "TargetCo"], expected_risk: "low" },
  { contract_id: "MSA-003", expected_type: "MSA", expected_clauses: ["liability", "indemnification", "payment_terms", "data_protection"], expected_parties: ["HealthCorp", "MedTech"], expected_risk: "high" },
  { contract_id: "SOW-003", expected_type: "SOW", expected_clauses: ["milestones", "acceptance_criteria", "payment_terms"], expected_parties: ["GovAgency", "Contractor"], expected_risk: "medium" },
  { contract_id: "NDA-004", expected_type: "NDA", expected_clauses: ["confidentiality", "termination", "jurisdiction"], expected_parties: ["BankCo", "FintechStartup"], expected_risk: "low" },
  { contract_id: "MSA-004", expected_type: "MSA", expected_clauses: ["liability", "termination", "force_majeure", "insurance"], expected_parties: ["ManufactureCo", "SupplierInc"], expected_risk: "high" },
  { contract_id: "SLA-003", expected_type: "SLA", expected_clauses: ["uptime_guarantee", "penalties", "escalation"], expected_parties: ["DataCenter", "RetailCo"], expected_risk: "low" },
  { contract_id: "AMD-003", expected_type: "Amendment", expected_clauses: ["payment_terms", "scope_change"], expected_parties: ["OldPartner", "NewPartner"], expected_risk: "low" },
  { contract_id: "NDA-005", expected_type: "NDA", expected_clauses: ["confidentiality", "return_of_materials", "termination"], expected_parties: ["PharmaCo", "ResearchLab"], expected_risk: "low" },
  { contract_id: "MSA-005", expected_type: "MSA", expected_clauses: ["liability", "confidentiality", "payment_terms", "warranty"], expected_parties: ["TelcoCo", "InfraCo"], expected_risk: "medium" },
  { contract_id: "SOW-004", expected_type: "SOW", expected_clauses: ["deliverables", "timeline", "payment_terms"], expected_parties: ["MarketingCo", "DesignStudio"], expected_risk: "low" },
];

function simulateEvaluation(version: string): EvalResult {
  const perContract: Record<string, PerContractResult> = {};
  let passed = 0;

  // Deterministic but version-aware scoring
  const versionSeed = version.charCodeAt(version.length - 1);
  const baseAccuracy = 0.82 + (versionSeed % 10) * 0.015;

  for (let i = 0; i < GROUND_TRUTH.length; i++) {
    const gt = GROUND_TRUTH[i];
    // Simulate per-contract pass/fail with deterministic pattern
    const classPass = (i + versionSeed) % 7 !== 0;
    const extractPass = (i + versionSeed) % 9 !== 0;
    const compliancePass = (i + versionSeed) % 6 !== 0;
    const judgeAvg = 3.8 + ((i * 7 + versionSeed) % 13) / 10;
    const overall = classPass && extractPass && compliancePass && judgeAvg >= 3.5;

    if (overall) passed++;

    perContract[gt.contract_id] = {
      contract_id: gt.contract_id,
      classification: classPass ? "pass" : "fail",
      extraction: extractPass ? "pass" : "fail",
      compliance: compliancePass ? "pass" : "fail",
      judge_avg: Math.round(judgeAvg * 10) / 10,
      overall: overall ? "pass" : "fail",
    };
  }

  const accuracy = passed / GROUND_TRUTH.length;
  const extractionAccuracy = Math.min(0.98, baseAccuracy + 0.04);
  const complianceAccuracy = Math.min(0.95, baseAccuracy);
  const classificationAccuracy = Math.min(0.99, baseAccuracy + 0.08);

  const relevance = 4.0 + (versionSeed % 10) * 0.07;
  const groundedness = 3.8 + (versionSeed % 8) * 0.08;
  const coherence = 4.2 + (versionSeed % 6) * 0.08;

  return {
    id: `eval-${randomUUID().slice(0, 8)}`,
    version,
    run_at: new Date().toISOString(),
    total_cases: GROUND_TRUTH.length,
    passed,
    accuracy: Math.round(accuracy * 1000) / 10,
    per_metric: {
      extraction_accuracy: Math.round(extractionAccuracy * 1000) / 10,
      compliance_accuracy: Math.round(complianceAccuracy * 1000) / 10,
      classification_accuracy: Math.round(classificationAccuracy * 1000) / 10,
      false_flag_rate: Math.round((1 - complianceAccuracy) * 0.6 * 1000) / 10,
      latency_p95_s: Math.round((2.0 + (versionSeed % 5) * 0.3) * 10) / 10,
    },
    per_contract: perContract,
    quality_gate: accuracy >= 0.80 && relevance >= 4.0 && groundedness >= 3.8 ? "PASS" : "FAIL",
    judge_scores: {
      relevance: Math.round(Math.min(5, relevance) * 10) / 10,
      groundedness: Math.round(Math.min(5, groundedness) * 10) / 10,
      coherence: Math.round(Math.min(5, coherence) * 10) / 10,
    },
  };
}

export async function runEvalSuite(version: string): Promise<EvalResult> {
  const result = simulateEvaluation(version);

  // Persist result
  const evalPath = resolve(DATA_DIR, "evaluations.json");
  let existing: EvalResult[] = [];
  try {
    const raw = await readFile(evalPath, "utf-8");
    existing = JSON.parse(raw);
  } catch {
    // fresh
  }
  existing.push(result);
  await writeFile(evalPath, JSON.stringify(existing, null, 2));

  return result;
}

export async function getEvalResults(): Promise<EvalResult[]> {
  const evalPath = resolve(DATA_DIR, "evaluations.json");
  try {
    const raw = await readFile(evalPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function getGroundTruth(): GroundTruth[] {
  return GROUND_TRUTH;
}

export function getBaseline(): EvalResult {
  return simulateEvaluation("v1.2");
}
