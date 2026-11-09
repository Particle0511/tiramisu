export type EvidenceRecord = { id: string; type: string; content: string };
export type DraftStatement = { text: string; sourceRecordIds: string[] };
export type DroppedStatement = { text: string; reason: string };
export type LinkResult = {
  supported: DraftStatement[];
  dropped: DroppedStatement[];
};

const MAX_STATEMENT_LENGTH = 1000;

// Matches ID-like tokens: 6+ chars of letters, digits or hyphens, containing
// at least one digit (tracking numbers, order IDs, ISO dates).
// Plain words and short amounts like "85.00" do not match.
const ID_LIKE = /\b(?=[a-z0-9-]*\d)[a-z0-9-]{6,}\b/gi;

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

    supported.push({ text, sourceRecordIds: ids });
  }

  return { supported, dropped };
}