import { chatJson } from "./provider";

async function main() {
  const out = await chatJson([
    { role: "system", content: 'Reply with only this JSON: {"ok": true}' },
    { role: "user", content: "ping" },
  ]);
  console.log("AI replied:", out);
}

main().catch((e) => {
  console.error("AI ping failed:", e.message);
  process.exit(1);
});