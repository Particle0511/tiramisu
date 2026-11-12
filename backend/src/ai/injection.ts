export type InjectionResult = { flagged: boolean; reasons: string[] };

const PATTERNS: { reason: string; re: RegExp }[] = [
  {
    reason: "tries to override the assistant's instructions",
    re: /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(rules?|instructions?|prompts?|guidelines?|polic(?:y|ies))\b/i,
  },
  {
    reason: "claims a special mode or role",
    re: /\b(you are now|act as|pretend to be|developer mode|admin mode|system prompt|jailbreak)\b/i,
  },
  {
    reason: "demands a money action",
    re: /\b(approve|issue|process)\b[^.\n]{0,30}\b(refund|payment|payout|transfer)\b/i,
  },
  {
    reason: "asks to hide something",
    re: /\b(do not|don't|never)\s+(mention|tell|log|report|reveal)\b/i,
  },
  {
    reason: "asks for secrets or credentials",
    re: /\b(api key|secret key|password|access token|credentials)\b/i,
  },
  {
    reason: "contains instruction-style markers",
    re: /(<\/?(system|assistant|instructions?)>|\[\/?(inst|system)\]|^\s*(system|assistant)\s*:)/im,
  },
];


function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "");
}

export function detectInjection(text: string): InjectionResult {
  const clean = normalize(typeof text === "string" ? text : "");
  const reasons = PATTERNS.filter((p) => p.re.test(clean)).map((p) => p.reason);
  return { flagged: reasons.length > 0, reasons };
}