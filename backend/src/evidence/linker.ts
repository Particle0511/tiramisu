export type EvidenceRecord = { id: string; type: string; content: string };
export type DraftStatement = { text: string; sourceRecordIds: string[] };
export type DroppedStatement = { text: string; reason: string };
export type LinkResult = {
  supported: DraftStatement[];
  dropped: DroppedStatement[];
};

const MAX_STATEMENT_LENGTH = 1000;


const ID_LIKE = /\b(?=[a-z0-9-]*\d)[a-z0-9-]{6,}\b/gi;

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sept: 9, sep: 9, october: 10, oct: 10,
  november: 11, nov: 11, december: 12, dec: 12,
};

const MONTH_NAMES = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join("|");


const DATE_DMY = new RegExp(
  `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_NAMES})\\.?,?\\s+(\\d{4})\\b`,
  "gi"
);

const DATE_MDY = new RegExp(
  `\\b(${MONTH_NAMES})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`,
  "gi"
);

function toIso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null; // for example 31 February
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}


export function extractDates(text: string): { raw: string; iso: string | null }[] {
  const found: { raw: string; iso: string | null }[] = [];
  for (const m of text.matchAll(DATE_DMY)) {
    found.push({ raw: m[0], iso: toIso(Number(m[3]), MONTHS[m[2].toLowerCase()], Number(m[1])) });
  }
  for (const m of text.matchAll(DATE_MDY)) {
    found.push({ raw: m[0], iso: toIso(Number(m[3]), MONTHS[m[1].toLowerCase()], Number(m[2])) });
  }
  return found;
}

export function linkStatements(
  statements: unknown,
  records: EvidenceRecord[]
): LinkResult {
  const supported: DraftStatement[] = [];
  const dropped: DroppedStatement[] = [];

  if (!Array.isArray(statements)) {
    dropped.push({ text: "(entire draft)", reason: "Draft was not a list of statements" });
    return { supported, dropped };
  }

  const byId = new Map(records.map((r) => [r.id, r]));

  for (const item of statements) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as any).text !== "string" ||
      !Array.isArray((item as any).sourceRecordIds) ||
      !(item as any).sourceRecordIds.every((x: unknown) => typeof x === "string")
    ) {
      dropped.push({ text: "(malformed item)", reason: "Statement had the wrong shape" });
      continue;
    }

    const text = ((item as any).text as string).trim();
    const ids = [...new Set((item as any).sourceRecordIds as string[])];

    if (!text) {
      dropped.push({ text: "(empty)", reason: "Statement was empty" });
      continue;
    }
    if (text.length > MAX_STATEMENT_LENGTH) {
      dropped.push({ text: text.slice(0, 80) + "...", reason: "Statement was too long" });
      continue;
    }
    if (ids.length === 0) {
      dropped.push({ text, reason: "No source record cited" });
      continue;
    }
    if (ids.some((id) => !byId.has(id))) {
      dropped.push({ text, reason: "Cites a record that does not exist" });
      continue;
    }

    const sourceText = ids.map((id) => byId.get(id)!.content.toLowerCase()).join("\n");

    const tokens = text.match(ID_LIKE) ?? [];
    const unsupported = tokens.find((t) => !sourceText.includes(t.toLowerCase()));
    if (unsupported) {
      dropped.push({
        text,
        reason: `Contains "${unsupported}" which is not in the cited records`,
      });
      continue;
    }


    const badDate = extractDates(text).find((d) => d.iso === null || !sourceText.includes(d.iso));
    if (badDate) {
      dropped.push({
        text,
        reason:
          badDate.iso === null
            ? `Contains "${badDate.raw}" which is not a valid date`
            : `Contains the date "${badDate.raw}" which is not in the cited records`,
      });
      continue;
    }

    supported.push({ text, sourceRecordIds: ids });
  }

  return { supported, dropped };
}