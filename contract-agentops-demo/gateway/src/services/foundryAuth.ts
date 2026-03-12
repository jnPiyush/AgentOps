import { DefaultAzureCredential } from "@azure/identity";

export type FoundryAuthMode = "api-key" | "managed-identity";

export interface FoundryAuthConfig {
	authMode: FoundryAuthMode;
	apiKey: string;
	managedIdentityClientId: string;
}

const COGNITIVE_SERVICES_SCOPE = "https://cognitiveservices.azure.com/.default";

let cachedCredential: DefaultAzureCredential | null = null;
let cachedCredentialClientId: string | null = null;

function getCredential(managedIdentityClientId: string): DefaultAzureCredential {
	if (!cachedCredential || cachedCredentialClientId !== managedIdentityClientId) {
		cachedCredential = new DefaultAzureCredential({
			managedIdentityClientId: managedIdentityClientId || undefined,
		});
		cachedCredentialClientId = managedIdentityClientId;
	}

	return cachedCredential;
}

export function isFoundryConfigured(config: FoundryAuthConfig & { endpoint: string }): boolean {
	if (!config.endpoint) {
		return false;
	}

	if (config.authMode === "managed-identity") {
		return true;
	}

	return Boolean(config.apiKey);
}

export function getFoundryConfigurationError(config: FoundryAuthConfig & { endpoint: string }): string {
	if (!config.endpoint) {
		return "FOUNDRY_ENDPOINT is required for live deployment";
	}

	if (config.authMode === "managed-identity") {
		return "";
	}

	if (!config.apiKey) {
		return "FOUNDRY_API_KEY is required when FOUNDRY_AUTH_MODE=api-key";
	}

	return "";
}

export async function withFoundryAuthHeaders(
	config: FoundryAuthConfig,
	headersInit?: HeadersInit,
): Promise<Headers> {
	const headers = new Headers(headersInit);

	if (config.authMode === "managed-identity") {
		const credential = getCredential(config.managedIdentityClientId);
		const token = await credential.getToken(COGNITIVE_SERVICES_SCOPE);
		if (!token?.token) {
			throw new Error("Unable to acquire a Microsoft Entra token for Azure OpenAI");
		}

		headers.set("Authorization", `Bearer ${token.token}`);
		headers.delete("api-key");
		return headers;
	}

	if (!config.apiKey) {
		throw new Error("FOUNDRY_API_KEY is required when FOUNDRY_AUTH_MODE=api-key");
	}

	headers.set("api-key", config.apiKey);
	return headers;
}