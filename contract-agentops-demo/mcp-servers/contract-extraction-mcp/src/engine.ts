interface ExtractedClause {
  type: string;
  text: string;
  section: string;
}

interface ExtractionResult {
  clauses: ExtractedClause[];
  confidence: number;
}

interface PartiesResult {
  parties: string[];
  roles: Array<{ name: string; role: string }>;
}

interface DatesValuesResult {
  dates: string[];
  values: string[];
}

const CLAUSE_PATTERNS: Array<{
  type: string;
  patterns: RegExp[];
  sectionPattern: RegExp;
}> = [
  {
    type: "confidentiality",
    patterns: [/shall not disclose/i, /confidential\s+information/i, /non-disclosure/i],
    sectionPattern: /(\d+(?:\.\d+)?)\s*\.?\s*(?:CONFIDENTIAL|DEFINITION OF CONFIDENTIAL|NON-DISCLOSURE)/i,
  },
  {
    type: "termination",
    patterns: [/terminat(?:e|ion)/i, /written\s+notice/i],
    sectionPattern: /(\d+(?:\.\d+)?)\s*\.?\s*(?:TERMINAT)/i,
  },
  {
    type: "liability",
    patterns: [/liability.*(?:shall not|not)\s+exceed/i, /limitation\s+of\s+liability/i],
    sectionPattern: /(\d+(?:\.\d+)?)\s*\.?\s*(?:LIMIT.*LIABILITY|LIABILITY)/i,
  },
  {
    type: "indemnification",
    patterns: [/indemnif/i, /hold\s+harmless/i],
    sectionPattern: /(\d+(?:\.\d+)?)\s*\.?\s*(?:INDEMNIF)/i,
  },
  {
    type: "payment",
    patterns: [/payment\s+terms/i, /net-\d+/i, /invoice/i, /fee/i],
    sectionPattern: /(\d+(?:\.\d+)?)\s*\.?\s*(?:PAYMENT|FEES)/i,
  },
  {
    type: "ip_ownership",
    patterns: [/intellectual\s+property/i, /work\s+product.*owned/i, /ip\s+ownership/i],
    sectionPattern: /(\d+(?:\.\d+)?)\s*\.?\s*(?:INTELLECTUAL|IP|OWNERSHIP)/i,
  },
  {
    type: "data_protection",
    patterns: [/personal\s+data/i, /data\s+protection/i, /data\s+breach/i, /HIPAA/i],
    sectionPattern: /(\d+(?:\.\d+)?)\s*\.?\s*(?:DATA\s+PROTECT|DATA\s+PROCESS)/i,
  },
  {
    type: "governing_law",
    patterns: [/governed\s+by/i, /governing\s+law/i, /jurisdiction/i],
    sectionPattern: /(\d+(?:\.\d+)?)\s*\.?\s*(?:GOVERNING|JURISDICTION)/i,
  },
  {
    type: "force_majeure",
    patterns: [/force\s+majeure/i, /beyond.*reasonable\s+control/i],
    sectionPattern: /(\d+(?:\.\d+)?)\s*\.?\s*(?:FORCE\s+MAJEURE)/i,
  },
  {
    type: "auto_renewal",
    patterns: [/auto.*renew/i, /automatically\s+renew/i],
    sectionPattern: /(\d+(?:\.\d+)?)\s*\.?\s*(?:RENEWAL|AUTO)/i,
  },
  {
    type: "sla",
    patterns: [/uptime/i, /service\s+level/i, /service\s+credits/i],
    sectionPattern: /(\d+(?:\.\d+)?)\s*\.?\s*(?:SERVICE\s+LEVEL|UPTIME|SLA)/i,
  },
  {
    type: "scope",
    patterns: [/scope\s+of\s+(?:work|services)/i, /shall\s+provide/i],
    sectionPattern: /(\d+(?:\.\d+)?)\s*\.?\s*(?:SCOPE)/i,
  },
];

export async function extractClauses(
  text: string,
  _contractType?: string,
): Promise<ExtractionResult> {
  const clauses: ExtractedClause[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);

  for (const clauseDef of CLAUSE_PATTERNS) {
    for (const sentence of sentences) {
      for (const pattern of clauseDef.patterns) {
        if (pattern.test(sentence)) {
          // Find section number
          const sectionMatch = text.match(clauseDef.sectionPattern);
          const section = sectionMatch ? sectionMatch[1] : "N/A";

          // Avoid duplicate clauses
          if (!clauses.some((c) => c.type === clauseDef.type && c.text === sentence.trim())) {
            clauses.push({
              type: clauseDef.type,
              text: sentence.trim().slice(0, 200),
              section,
            });
          }
          break;
        }
      }
    }
  }

  return {
    clauses,
    confidence: clauses.length > 0 ? Math.min(0.98, 0.7 + clauses.length * 0.03) : 0.5,
  };
}

export async function identifyParties(text: string): Promise<PartiesResult> {
  const parties: string[] = [];
  const roles: Array<{ name: string; role: string }> = [];

  // Pattern: "between X ... and Y"
  const betweenMatch = text.match(
    /between\s+(.+?)\s*(?:,\s*a\s+.+?\s*)?(?:\("(.+?)"\)\s*)?(?:,?\s*and\s+)(.+?)\s*(?:,\s*a\s+.+?\s*)?(?:\("(.+?)"\))/i,
  );

  if (betweenMatch) {
    const party1 = betweenMatch[1].trim();
    const role1 = betweenMatch[2] ?? "Party A";
    const party2 = betweenMatch[3].trim();
    const role2 = betweenMatch[4] ?? "Party B";

    parties.push(party1, party2);
    roles.push({ name: party1, role: role1 }, { name: party2, role: role2 });
  }

  // Also extract signatories
  const nameMatches = text.matchAll(/Name:\s*(.+)/gi);
  for (const match of nameMatches) {
    const name = match[1].trim();
    if (!parties.includes(name)) {
      roles.push({ name, role: "Signatory" });
    }
  }

  return { parties, roles };
}

export async function extractDatesValues(text: string): Promise<DatesValuesResult> {
  // Extract dates
  const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi;
  const dates = [...new Set([...text.matchAll(datePattern)].map((m) => m[0]))];

  // Extract monetary values
  const valuePattern = /\$[\d,]+(?:\.\d{2})?(?:\s*\([^)]+\))?/g;
  const values = [...new Set([...text.matchAll(valuePattern)].map((m) => m[0]))];

  return { dates, values };
}
