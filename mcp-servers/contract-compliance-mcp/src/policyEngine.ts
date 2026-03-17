import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const POLICY_DIR = resolve(__dirname, "../../../data/policies");

export interface PolicyRule {
	id: string;
	category: "financial" | "legal" | "data" | "operational" | "ai_ml" | "security";
	clause_types: string[];
	rule_type: "threshold" | "pattern" | "lookup" | "calculation";
	condition: PolicyCondition;
	severity: "low" | "medium" | "high" | "critical";
	message_template: string;
	effective_date: string;
	expiry_date?: string;
	enabled: boolean;
	metadata?: Record<string, unknown>;
}

export interface PolicyCondition {
	operator: "gt" | "lt" | "eq" | "ne" | "contains" | "not_contains" | "regex" | "in" | "not_in";
	field: string;
	value: string | number | string[];
	unit?: string;
	currency?: string;
}

export interface PolicyViolation {
	rule_id: string;
	clause_type: string;
	status: "pass" | "warning" | "fail";
	severity: "low" | "medium" | "high" | "critical";
	message: string;
	extracted_value?: string | number;
	policy_threshold?: string | number;
}

class DynamicPolicyEngine {
	private policies: PolicyRule[] = [];
	private lastLoaded: Date | null = null;

	constructor() {
		this.loadPolicies();
	}

	async loadPolicies(): Promise<void> {
		try {
			const policyFile = resolve(POLICY_DIR, "contract_policies.json");
			const content = await readFile(policyFile, "utf-8");
			this.policies = JSON.parse(content);
			this.lastLoaded = new Date();
		} catch (error) {
			// Initialize with default policies if file doesn't exist
			await this.initializeDefaultPolicies();
		}
	}

	async evaluateClause(
		clauseType: string,
		clauseText: string,
		extractedData?: Record<string, any>,
		contractType?: string,
	): Promise<PolicyViolation[]> {
		if (!this.lastLoaded || Date.now() - this.lastLoaded.getTime() > 300000) {
			// Refresh every 5 minutes
			await this.loadPolicies();
		}

		const violations: PolicyViolation[] = [];
		const applicablePolicies = this.policies.filter(
			(p) =>
				p.enabled &&
				p.clause_types.includes(clauseType) &&
				this.isEffective(p) &&
				this.appliesToContractType(p, contractType),
		);

		for (const policy of applicablePolicies) {
			const violation = await this.evaluatePolicy(policy, clauseType, clauseText, extractedData);
			if (violation) {
				violations.push(violation);
			}
		}

		return violations;
	}

	private async evaluatePolicy(
		policy: PolicyRule,
		clauseType: string,
		clauseText: string,
		extractedData?: Record<string, any>,
	): Promise<PolicyViolation | null> {
		const condition = policy.condition;
		let actualValue: any = null;
		let violationDetected = false;

		// Extract value from clause text or provided data
		switch (condition.field) {
			case "clause_text":
				actualValue = clauseText;
				break;
			case "liability_amount":
				actualValue = this.extractMonetaryValue(clauseText);
				break;
			case "payment_days":
				actualValue = this.extractPaymentTerms(clauseText);
				break;
			case "retention_years":
				actualValue = this.extractRetentionPeriod(clauseText);
				break;
			case "jurisdiction":
				actualValue = this.extractJurisdiction(clauseText);
				break;
			case "notice_days":
				actualValue = this.extractNoticePeriod(clauseText);
				break;
			case "indemnification_type":
				actualValue = this.analyzeIndemnificationType(clauseText);
				break;
			case "uptime_percentage":
				actualValue = this.extractUptimeRequirement(clauseText);
				break;
			case "interest_rate":
				actualValue = this.extractInterestRate(clauseText);
				break;
			default:
				actualValue = extractedData?.[condition.field];
		}

		// Evaluate condition
		switch (condition.operator) {
			case "gt":
				violationDetected = Number(actualValue) > Number(condition.value);
				break;
			case "lt":
				violationDetected = Number(actualValue) < Number(condition.value);
				break;
			case "eq":
				violationDetected = actualValue === condition.value;
				break;
			case "ne":
				violationDetected = actualValue !== condition.value;
				break;
			case "contains":
				violationDetected = String(actualValue).toLowerCase().includes(String(condition.value).toLowerCase());
				break;
			case "not_contains":
				violationDetected = !String(actualValue).toLowerCase().includes(String(condition.value).toLowerCase());
				break;
			case "in":
				violationDetected = Array.isArray(condition.value) && condition.value.includes(actualValue);
				break;
			case "not_in":
				violationDetected = Array.isArray(condition.value) && !condition.value.includes(actualValue);
				break;
			case "regex":
				violationDetected = new RegExp(String(condition.value)).test(String(actualValue));
				break;
		}

		if (violationDetected) {
			return {
				rule_id: policy.id,
				clause_type: clauseType,
				status: policy.severity === "low" ? "warning" : "fail",
				severity: policy.severity,
				message: this.formatMessage(policy.message_template, actualValue, condition.value),
				extracted_value: actualValue,
				policy_threshold: Array.isArray(condition.value) ? condition.value.join(", ") : condition.value,
			};
		}

		return null;
	}

	private isEffective(policy: PolicyRule): boolean {
		const now = new Date();
		const effectiveDate = new Date(policy.effective_date);
		const expiryDate = policy.expiry_date ? new Date(policy.expiry_date) : null;

		return now >= effectiveDate && (!expiryDate || now <= expiryDate);
	}

	private appliesToContractType(policy: PolicyRule, contractType?: string): boolean {
		const scopedTypes = policy.metadata?.contract_types;
		if (!Array.isArray(scopedTypes) || scopedTypes.length === 0) {
			return true;
		}

		return typeof contractType === "string" && scopedTypes.includes(contractType);
	}

	private extractMonetaryValue(text: string): number {
		const patterns = [
			/\$([0-9,]+(?:\.[0-9]{2})?)/,
			/USD\s*([0-9,]+(?:\.[0-9]{2})?)/,
			/([0-9,]+(?:\.[0-9]{2})?)\s*(?:USD|dollars?)/i,
		];

		for (const pattern of patterns) {
			const match = text.match(pattern);
			if (match) {
				return Number.parseFloat(match[1].replace(/,/g, ""));
			}
		}

		// Check for "unlimited" or "uncapped" liability
		if (/unlimited|uncapped|no\s*limit/i.test(text)) {
			return Number.POSITIVE_INFINITY;
		}

		return 0;
	}

	private extractPaymentTerms(text: string): number {
		const patterns = [
			/net[\s-]?(\d+)/i,
			/payment\s+is\s+due\s+within\s+(\d+)\s*days/i,
			/(\d+)\s*days?\s*from\s*invoice/i,
			/payment\s*(?:due\s*)?(?:in\s*)?(\d+)\s*days/i,
		];

		for (const pattern of patterns) {
			const match = text.match(pattern);
			if (match) {
				return Number.parseInt(match[1]);
			}
		}

		return 0;
	}

	private extractRetentionPeriod(text: string): number {
		const patterns = [
			/(\d+)\s*years?\s*(?:retention|retained|keep|maintain)/i,
			/(?:retain(?:ed)?|keep|maintain)\s*(?:for\s*)?(\d+)\s*years?/i,
		];

		for (const pattern of patterns) {
			const match = text.match(pattern);
			if (match) {
				return Number.parseInt(match[1]);
			}
		}

		return 0;
	}

	private extractJurisdiction(text: string): string {
		const jurisdictions = [
			"Delaware",
			"New York",
			"California",
			"Texas",
			"Florida",
			"Singapore",
			"London",
			"Hong Kong",
			"Ontario",
			"Quebec",
		];

		for (const jurisdiction of jurisdictions) {
			if (text.toLowerCase().includes(jurisdiction.toLowerCase())) {
				return jurisdiction;
			}
		}

		return "Unknown";
	}

	private extractNoticePeriod(text: string): number {
		const patterns = [
			/(\d+)\s*days?\s*(?:notice|written\s*notice)/i,
			/(?:notice|written\s*notice)\s*(?:of\s*)?(\d+)\s*days?/i,
		];

		for (const pattern of patterns) {
			const match = text.match(pattern);
			if (match) {
				return Number.parseInt(match[1]);
			}
		}

		return 0;
	}

	private analyzeIndemnificationType(text: string): string {
		if (/mutual/i.test(text)) return "mutual";
		if (/unlimited|uncapped/i.test(text)) return "unlimited";
		if (/one[\s-]?way|unilateral/i.test(text)) return "one_way";
		return "standard";
	}

	private extractUptimeRequirement(text: string): number {
		const patterns = [
			/(\d{1,3}(?:\.\d+)?)%\s*uptime/i,
			/uptime\s*(?:of\s*)?(\d{1,3}(?:\.\d+)?)%/i,
			/availability\s*(?:of\s*)?(\d{1,3}(?:\.\d+)?)%/i,
		];

		for (const pattern of patterns) {
			const match = text.match(pattern);
			if (match) {
				return Number.parseFloat(match[1]);
			}
		}

		return 0;
	}

	private extractInterestRate(text: string): number {
		const patterns = [
			/(\d+(?:\.\d+)?)%\s*(?:per\s+annum|annual|interest)/i,
			/interest\s*(?:rate)?\s*(?:of\s*)?(\d+(?:\.\d+)?)%/i,
			/(\d+(?:\.\d+)?)\s*percent\s*(?:per\s+annum|interest)/i,
		];

		for (const pattern of patterns) {
			const match = text.match(pattern);
			if (match) {
				return Number.parseFloat(match[1]);
			}
		}

		return 0;
	}

	private formatMessage(template: string, actualValue: any, policyValue: any): string {
		return template
			.replace("{actual_value}", String(actualValue))
			.replace("{policy_value}", String(policyValue))
			.replace("{currency}", this.formatCurrency(actualValue));
	}

	private formatCurrency(value: any): string {
		if (typeof value === "number" && !Number.isNaN(value)) {
			if (value === Number.POSITIVE_INFINITY) return "unlimited";
			return new Intl.NumberFormat("en-US", {
				style: "currency",
				currency: "USD",
			}).format(value);
		}
		return String(value);
	}

	async addPolicy(policy: PolicyRule): Promise<void> {
		this.policies.push(policy);
		await this.savePolicies();
	}

	async updatePolicy(ruleId: string, updates: Partial<PolicyRule>): Promise<boolean> {
		const index = this.policies.findIndex((p) => p.id === ruleId);
		if (index === -1) return false;

		this.policies[index] = { ...this.policies[index], ...updates };
		await this.savePolicies();
		return true;
	}

	async deletePolicy(ruleId: string): Promise<boolean> {
		const index = this.policies.findIndex((p) => p.id === ruleId);
		if (index === -1) return false;

		this.policies.splice(index, 1);
		await this.savePolicies();
		return true;
	}

	async getPolicies(): Promise<PolicyRule[]> {
		return [...this.policies];
	}

	private async savePolicies(): Promise<void> {
		const policyFile = resolve(POLICY_DIR, "contract_policies.json");
		await writeFile(policyFile, JSON.stringify(this.policies, null, 2));
	}

	private async initializeDefaultPolicies(): Promise<void> {
		this.policies = [
			{
				id: "FIN-001",
				category: "financial",
				clause_types: ["liability"],
				rule_type: "threshold",
				condition: {
					operator: "gt",
					field: "liability_amount",
					value: 5000000,
				},
				severity: "high",
				message_template: "Liability cap {actual_value} exceeds policy maximum of {policy_value}",
				effective_date: "2024-01-01",
				enabled: true,
			},
			{
				id: "FIN-002",
				category: "financial",
				clause_types: ["payment"],
				rule_type: "threshold",
				condition: {
					operator: "gt",
					field: "payment_days",
					value: 45,
				},
				severity: "medium",
				message_template: "Payment terms of {actual_value} days exceed standard limit of {policy_value} days",
				effective_date: "2024-01-01",
				enabled: true,
			},
			{
				id: "FIN-003",
				category: "financial",
				clause_types: ["indemnification"],
				rule_type: "pattern",
				condition: {
					operator: "contains",
					field: "indemnification_type",
					value: "unlimited",
				},
				severity: "critical",
				message_template: "Unlimited indemnification is prohibited by policy",
				effective_date: "2024-01-01",
				enabled: true,
			},
			{
				id: "DATA-001",
				category: "data",
				clause_types: ["data_protection"],
				rule_type: "threshold",
				condition: {
					operator: "gt",
					field: "retention_years",
					value: 7,
				},
				severity: "medium",
				message_template:
					"Data retention period of {actual_value} years exceeds policy maximum of {policy_value} years",
				effective_date: "2024-01-01",
				enabled: true,
			},
			{
				id: "LEG-001",
				category: "legal",
				clause_types: ["governing_law"],
				rule_type: "lookup",
				condition: {
					operator: "not_in",
					field: "jurisdiction",
					value: ["Delaware", "New York", "California"],
				},
				severity: "low",
				message_template: "Jurisdiction '{actual_value}' is not preferred; Delaware, New York, or California preferred",
				effective_date: "2024-01-01",
				enabled: true,
			},
			{
				id: "OPS-001",
				category: "operational",
				clause_types: ["sla"],
				rule_type: "threshold",
				condition: {
					operator: "lt",
					field: "uptime_percentage",
					value: 99.9,
				},
				severity: "medium",
				message_template: "SLA uptime requirement of {actual_value}% below policy minimum of {policy_value}%",
				effective_date: "2024-01-01",
				enabled: true,
			},
		];

		await this.savePolicies();
	}
}

export const policyEngine = new DynamicPolicyEngine();
