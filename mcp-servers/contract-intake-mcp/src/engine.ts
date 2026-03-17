import { randomUUID } from "node:crypto";

interface ClassificationResult {
	type: string;
	confidence: number;
}

interface MetadataResult {
	parties: string[];
	effective_date: string | null;
	jurisdiction: string | null;
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
	"Sales Agreement": [
		/sales\s+agreement/i,
		/purchase\s+and\s+sale\s+agreement/i,
		/seller\s+agrees\s+to\s+sell/i,
	],
	"Distribution Agreement": [
		/distribution\s+agreement/i,
		/appointed\s+as\s+(?:an\s+)?(?:authorized\s+)?distributor/i,
		/right\s+to\s+distribute/i,
	],
	"Supply Agreement": [
		/supply\s+agreement/i,
		/supplier\s+shall\s+supply/i,
		/procure(?:ment)?\s+of\s+goods/i,
	],
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
	"Promissory Note": [
		/promissory\s+note/i,
		/promises?\s+to\s+pay/i,
		/principal\s+sum\s+of/i,
	],
	"Loan Agreement": [
		/loan\s+agreement/i,
		/lender\s+agrees\s+to\s+lend/i,
		/borrower\s+shall\s+repay/i,
	],
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
	const effective_date = dateMatch ? dateMatch[1] : null;

	// Extract jurisdiction
	const jurisdictionMatch = text.match(
		/governed\s+by.*?laws\s+of\s+(?:the\s+)?(?:State\s+of\s+)?(\w[\w\s]*?)(?:\.|,)/i,
	);
	const jurisdiction = jurisdictionMatch ? jurisdictionMatch[1].trim() : null;

	// Extract duration
	const durationMatch = text.match(/(?:term|period|duration)\s+of\s+(\w+\s+\(\d+\)\s+\w+)/i);
	const duration = durationMatch ? durationMatch[1] : null;

	return { parties, effective_date, jurisdiction, duration };
}

export async function uploadContract(text: string, filename: string): Promise<UploadResult> {
	const classification = await classifyDocument(text);
	const metadata = await extractMetadata(text);

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
