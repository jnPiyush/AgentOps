import type { ILlmAdapter, LlmRequest, LlmResponse } from "../types.js";
import { appConfig } from "../config.js";
import { FoundryAdapter } from "./foundryAdapter.js";
import { SimulatedAdapter } from "./simulatedAdapter.js";

export function createLlmAdapter(): ILlmAdapter {
  if (appConfig.demoMode === "live") {
    return new FoundryAdapter(
      appConfig.foundryEndpoint,
      appConfig.foundryApiKey,
      appConfig.foundryModel,
    );
  }
  return new SimulatedAdapter(appConfig.dataDir);
}

export { FoundryAdapter } from "./foundryAdapter.js";
export { SimulatedAdapter } from "./simulatedAdapter.js";
