import { randomUUID } from "node:crypto";

interface ClassificationResult {
	type: string;
	confidence: number;
}

interface MetadataResult {
	parties: string[];
	contract_category: string;
	source_channel: string;
	industry: string | null;
	counterparty_type: string | null;
	risk_level: string | null;
	compliance_needs: string[];
	effective_date: string | null;
	expiry_date: string | null;
	value: number | null;
	currency: string | null;
	jurisdiction: string | null;
	source_system: string | null;
	duration: string | null;
}

interface UploadResult {
	contract_id: string;
	filename: string;
	type: string;
	confidence: number;
	parties: string[];
	metadata: MetadataResult;
	status: string;
}

const CORPORATE_CONTRACT_TYPES = new Set([
	"Promissory Note",
	"Loan Agreement",
	"Employment",
	"Joint Venture",
	"Franchise",
	"Consortium",
	"Partnership",
]);

const INDUSTRY_PATTERNS: Array<{ industry: string; pattern: RegExp }> = [
	{ industry: "Technology", pattern: /software|saas|cloud|platform|ai|technology/i },
	{ industry: "Financial Services", pattern: /bank|lender|loan|credit|finance|financial/i },
	{ industry: "Healthcare", pattern: /health|patient|hospital|medical|pharma/i },
	{ industry: "Manufacturing", pattern: /manufactur|factory|raw materials|supply chain/i },
	{ industry: "Public Sector", pattern: /government|public sector|federal acquisition|state agency/i },
	{ industry: "Insurance", pattern: /insurer|insured|policyholder|coverage/i },
];

function normalizeDate(value: string | null): string | null {
	if (!value) {
		return null;
	}

	const parsed = new Date(value.replace(/,/g, ""));
	if (Number.isNaN(parsed.getTime())) {
		return value;
	}

	return parsed.toISOString().slice(0, 10);
}

function inferContractCategory(type: string): string {
	if (type === "UNKNOWN") {
		return "UNKNOWN";
	}

	return CORPORATE_CONTRACT_TYPES.has(type) ? "Corporate" : "Commercial";
}

function detectSourceChannel(text: string, filename: string): string {
	if (/^from:|^subject:|^sent:/im.test(text) || /\.(eml|msg)$/i.test(filename)) {
		return "email";
	}
	if (/api payload|webhook|application\/json|request body|http\/1\.1/i.test(text) || /\.(json)$/i.test(filename)) {
		return "api";
	}
	if (/database record|crm export|erp extract|db row|salesforce/i.test(text) || /\.(csv|tsv)$/i.test(filename)) {
		return "db";
	}
	if (filename) {
		return "file";
	}
	return "unknown";
}

function detectIndustry(text: string): string | null {
	for (const candidate of INDUSTRY_PATTERNS) {
		if (candidate.pattern.test(text)) {
			return candidate.industry;
		}
	}
	return null;
}

function detectCounterpartyType(text: string, contractType: string): string | null {
	if (contractType === "Loan Agreement" || contractType === "Promissory Note") return "lender-borrower";
	if (contractType === "Employment") return "employer-employee";
	if (contractType === "Lease") return "landlord-tenant";
	if (contractType === "Insurance") return "insurer-insured";
	if (contractType === "Franchise") return "franchisor-franchisee";
	if (contractType === "Joint Venture" || contractType === "Partnership" || contractType === "Consortium") {
		return "partners";
	}
	if (
		[
			"NDA",
			"MSA",
			"Services Agreement",
			"SOW",
			"SLA",
			"Amendment",
			"Sales Agreement",
			"Distribution Agreement",
			"Supply Agreement",
			"License Agreement",
			"SaaS / Cloud Services Agreement",
			"AI Services",
			"Procurement",
			"Government Contract",
		].includes(contractType)
	) {
		return "vendor-customer";
	}
	if (/customer|client|buyer/i.test(text) && /vendor|provider|seller|supplier/i.test(text)) return "vendor-customer";
	if (/government|agency|department/i.test(text) && /contractor|vendor|supplier/i.test(text)) {
		return "government-contractor";
	}
	return null;
}

function extractValueAndCurrency(text: string): { value: number | null; currency: string | null } {
	const moneyMatch = text.match(/(?:USD|EUR|GBP|AUD|CAD|INR|\$|€|£)\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
	if (!moneyMatch) {
		return { value: null, currency: null };
	}

	const rawAmount = moneyMatch[1].replace(/,/g, "");
	const value = Number(rawAmount);
	const rawCurrency = moneyMatch[0].toUpperCase();
	const currency =
		rawCurrency.includes("EUR") || rawCurrency.includes("€")
			? "EUR"
			: rawCurrency.includes("GBP") || rawCurrency.includes("£")
				? "GBP"
				: rawCurrency.includes("AUD")
					? "AUD"
					: rawCurrency.includes("CAD")
						? "CAD"
						: rawCurrency.includes("INR")
							? "INR"
							: "USD";

	return { value: Number.isFinite(value) ? value : null, currency };
}

function detectComplianceNeeds(text: string, contractType: string, industry: string | null): string[] {
	const needs = new Set<string>();

	if (/privacy|personal data|gdpr|ccpa|hipaa|confidential information/i.test(text)) needs.add("data_privacy");
	if (/export control|sanctions|restricted party/i.test(text)) needs.add("export_controls");
	if (/artificial intelligence|ai model|training data|model output/i.test(text) || contractType === "AI Services") {
		needs.add("ai_governance");
	}
	if (/ip|intellectual property|license|source code/i.test(text)) needs.add("ip_protection");
	if (/employment|employee|labor|benefits/i.test(text) || contractType === "Employment") needs.add("employment_labor");
	if (/government|public sector|federal acquisition/i.test(text) || contractType === "Government Contract") {
		needs.add("public_sector");
	}
	if (/insurance|coverage|underwriting/i.test(text) || contractType === "Insurance") {
		needs.add("insurance_regulatory");
	}
	if (industry === "Financial Services" || /loan|credit|bank|lender|borrower/i.test(text)) {
		needs.add("financial_regulatory");
	}
	if (/purchase order|procurement|supplier|vendor onboarding/i.test(text) || contractType === "Procurement") {
		needs.add("procurement_controls");
	}

	return [...needs];
}

function detectRiskLevel(
	text: string,
	contractType: string,
	value: number | null,
	complianceNeeds: string[],
): string | null {
	if (
		/unlimited liability|material breach|indemnif|exclusive jurisdiction|government|public sector/i.test(text) ||
		contractType === "Loan Agreement" ||
		contractType === "Insurance" ||
		contractType === "Joint Venture" ||
		(value !== null && value >= 1000000) ||
		complianceNeeds.includes("financial_regulatory") ||
		complianceNeeds.includes("public_sector")
	) {
		return "HIGH";
	}

	if (
		contractType === "MSA" ||
		contractType === "SaaS / Cloud Services Agreement" ||
		contractType === "Procurement" ||
		contractType === "Government Contract" ||
		(value !== null && value >= 250000)
	) {
		return "MEDIUM";
	}

	return "LOW";
}

const CONTRACT_PATTERNS: Record<string, RegExp[]> = {
	NDA: [/non-disclosure/i, /\bnda\b/i, /confidential\s+information/i],
	MSA: [/master\s+service/i, /\bmsa\b/i],
	"Services Agreement": [
		/professional\s+services\s+agreement/i,
		/services?\s+agreement/i,
		/consulting\s+services\s+agreement/i,
	],
	SOW: [/statement\s+of\s+work/i, /\bsow\b/i, /scope\s+of\s+work/i],
	Amendment: [/amendment/i, /amended\s+to/i, /modify.*agreement/i],
	SLA: [/service\s+level/i, /\bsla\b/i, /uptime/i],
	"Sales Agreement": [/sales\s+agreement/i, /purchase\s+and\s+sale\s+agreement/i, /seller\s+agrees\s+to\s+sell/i],
	"Distribution Agreement": [
		/distribution\s+agreement/i,
		/appointed\s+as\s+(?:an\s+)?(?:authorized\s+)?distributor/i,
		/right\s+to\s+distribute/i,
	],
	"Supply Agreement": [/supply\s+agreement/i, /supplier\s+shall\s+supply/i, /procure(?:ment)?\s+of\s+goods/i],
	"License Agreement": [
		/license\s+agreement/i,
		/licensing\s+agreement/i,
		/grants?\s+(?:a\s+)?(?:non-exclusive|exclusive)?\s*license/i,
	],
	"SaaS / Cloud Services Agreement": [
		/saas\s+(?:subscription\s+)?agreement/i,
		/cloud\s+services\s+agreement/i,
		/software\s+as\s+a\s+service/i,
	],
	"Promissory Note": [/promissory\s+note/i, /promises?\s+to\s+pay/i, /principal\s+sum\s+of/i],
	"Loan Agreement": [/loan\s+agreement/i, /lender\s+agrees\s+to\s+lend/i, /borrower\s+shall\s+repay/i],
	Employment: [/employment\s+agreement/i, /employee/i, /employer/i],
	"Joint Venture": [/joint\s+venture/i, /co-venturers?/i, /profit\s+sharing/i],
	Franchise: [/franchise\s+agreement/i, /franchisor/i, /franchisee/i],
	"AI Services": [/ai\s+services\s+agreement/i, /artificial\s+intelligence\s+services/i, /model\s+services/i],
	Procurement: [/procurement\s+agreement/i, /request\s+for\s+proposal/i, /vendor\s+procurement/i],
	Consortium: [/consortium\s+agreement/i, /consortium\s+members/i, /lead\s+member/i],
	Partnership: [/partnership\s+agreement/i, /general\s+partnership/i, /partners?\s+agree/i],
	Lease: [/lease\s+agreement/i, /landlord/i, /tenant/i],
	Insurance: [/insurance\s+policy/i, /insured/i, /insurer/i],
	"Government Contract": [/government\s+contract/i, /public\s+sector/i, /federal\s+acquisition/i],
};

export async function classifyDocument(text: string): Promise<ClassificationResult> {
	const scores: Record<string, number> = {};

	for (const [type, patterns] of Object.entries(CONTRACT_PATTERNS)) {
		let matchCount = 0;
		for (const pattern of patterns) {
			if (pattern.test(text)) matchCount++;
		}
		if (matchCount > 0) {
			scores[type] = matchCount / patterns.length;
		}
	}

	const entries = Object.entries(scores);
	if (entries.length === 0) {
		return { type: "UNKNOWN", confidence: 0.5 };
	}

	entries.sort((a, b) => b[1] - a[1]);
	const [bestType, bestScore] = entries[0];

	return {
		type: bestType,
		confidence: Math.min(0.99, 0.7 + bestScore * 0.25),
	};
}

export async function extractMetadata(text: string): Promise<MetadataResult> {
	// Extract parties - look for patterns like "by and between X and Y"
	const partyMatch = text.match(
		/between\s+(.+?)\s*(?:,\s*a\s+\w+\s+\w+\s*)?(?:\(".*?"\)\s*)?(?:,?\s*and\s+)(.+?)\s*(?:,\s*a\s+\w+\s+\w+\s*)?(?:\(".*?"\))/i,
	);
	const parties = partyMatch ? [partyMatch[1].trim(), partyMatch[2].trim()] : [];

	// Extract date
	const dateMatch = text.match(/(?:as\s+of|dated?|effective)\s+(\w+\s+\d{1,2},?\s+\d{4})/i);
	const effective_date = normalizeDate(dateMatch ? dateMatch[1] : null);

	const expiryMatch = text.match(/(?:expires?|termination\s+date|until)\s+(\w+\s+\d{1,2},?\s+\d{4})/i);
	const expiry_date = normalizeDate(expiryMatch ? expiryMatch[1] : null);

	// Extract jurisdiction
	const jurisdictionMatch = text.match(
		/governed\s+by.*?laws\s+of\s+(?:the\s+)?(?:State\s+of\s+)?(\w[\w\s]*?)(?:\.|,)/i,
	);
	const jurisdiction = jurisdictionMatch ? jurisdictionMatch[1].trim() : null;

	// Extract duration
	const durationMatch = text.match(/(?:term|period|duration)\s+of\s+(\w+\s+\(\d+\)\s+\w+)/i);
	const duration = durationMatch ? durationMatch[1] : null;
	const { type } = await classifyDocument(text);
	const contract_category = inferContractCategory(type);
	const industry = detectIndustry(text);
	const { value, currency } = extractValueAndCurrency(text);
	const compliance_needs = detectComplianceNeeds(text, type, industry);
	const counterparty_type = detectCounterpartyType(text, type);
	const risk_level = detectRiskLevel(text, type, value, compliance_needs);
	const sourceSystemMatch = text.match(/(?:salesforce|sap|workday|dynamics|servicenow|oracle)/i);
	const source_system = sourceSystemMatch ? sourceSystemMatch[0].toLowerCase() : null;

	return {
		parties,
		contract_category,
		source_channel: "unknown",
		industry,
		counterparty_type,
		risk_level,
		compliance_needs,
		effective_date,
		expiry_date,
		value,
		currency,
		jurisdiction,
		source_system,
		duration,
	};
}

export async function uploadContract(text: string, filename: string): Promise<UploadResult> {
	const classification = await classifyDocument(text);
	const metadata = await extractMetadata(text);
	metadata.source_channel = detectSourceChannel(text, filename);
	metadata.contract_category = inferContractCategory(classification.type);

	return {
		contract_id: `contract-${randomUUID().slice(0, 8)}`,
		filename,
		type: classification.type,
		confidence: classification.confidence,
		parties: metadata.parties,
		metadata,
		status: "processing",
	};
}
