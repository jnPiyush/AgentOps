import { resolve } from "node:path";
import { JsonStore } from "./jsonStore.js";
import type { Contract, AuditEntry, FeedbackEntry } from "../types.js";
import { appConfig } from "../config.js";

export const contractStore = new JsonStore<Contract>(
  resolve(appConfig.dataDir, "contracts.json"),
);

export const auditStore = new JsonStore<AuditEntry>(
  resolve(appConfig.dataDir, "audit.json"),
);

export const feedbackStore = new JsonStore<FeedbackEntry>(
  resolve(appConfig.dataDir, "feedback.json"),
);

export async function initStores(): Promise<void> {
  await Promise.all([
    contractStore.load(),
    auditStore.load(),
    feedbackStore.load(),
  ]);
}
