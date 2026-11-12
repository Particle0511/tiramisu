const MAX_LEN = 2000;

export function buildResponseMessage(draft: unknown): string | null {
  const statements = (draft as { statements?: unknown })?.statements;
  if (!Array.isArray(statements)) return null;

  const parts: string[] = [];
  let len = 0;
  for (const s of statements) {
    const text = typeof (s as any)?.text === "string" ? (s as any).text.trim() : "";
    if (!text) continue;
    if (len + text.length + 1 > MAX_LEN) break; // whole statements only
    parts.push(text);
    len += text.length + 1;
  }
  return parts.length ? parts.join(" ") : null;
}