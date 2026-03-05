import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIT_FILE = resolve(__dirname, "../../../data/audit.json");

interface AuditEntry {
  id: string;
  contract_id: string;
  agent: string;
  action: string;
  reasoning: string;
  timestamp: string;
}

interface AuditReport {
  contract_id: string;
  total_decisions: number;
  agents_involved: string[];
  timeline: AuditEntry[];
  summary: string;
}

async function loadAuditEntries(): Promise<AuditEntry[]> {
  try {
    const raw = await readFile(AUDIT_FILE, "utf-8");
    return JSON.parse(raw) as AuditEntry[];
  } catch {
    return [];
  }
}

async function saveAuditEntries(entries: AuditEntry[]): Promise<void> {
  await mkdir(dirname(AUDIT_FILE), { recursive: true });
  await writeFile(AUDIT_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

export async function logDecision(
  contractId: string,
  agent: string,
  action: string,
  reasoning: string,
): Promise<AuditEntry> {
  const entry: AuditEntry = {
    id: `audit-${randomUUID().slice(0, 8)}`,
    contract_id: contractId,
    agent,
    action,
    reasoning,
    timestamp: new Date().toISOString(),
  };

  const entries = await loadAuditEntries();
  entries.push(entry);
  await saveAuditEntries(entries);

  return entry;
}

export async function getAuditTrail(contractId: string): Promise<AuditEntry[]> {
  const entries = await loadAuditEntries();
  return entries
    .filter((e) => e.contract_id === contractId)
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
}

export async function generateReport(contractId: string): Promise<AuditReport> {
  const trail = await getAuditTrail(contractId);
  const agents = [...new Set(trail.map((e) => e.agent))];

  return {
    contract_id: contractId,
    total_decisions: trail.length,
    agents_involved: agents,
    timeline: trail,
    summary:
      trail.length > 0
        ? `Contract ${contractId} processed through ${agents.length} agent(s) with ${trail.length} decision(s). ` +
          `Final action: ${trail[trail.length - 1].action} by ${trail[trail.length - 1].agent}.`
        : `No audit trail found for contract ${contractId}.`,
  };
}
