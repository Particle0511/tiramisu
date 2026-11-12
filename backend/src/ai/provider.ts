import { env } from "../config/env";

export type ChatMessage = { role: "system" | "user"; content: string };

export async function chatJson(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${env.AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.AI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      messages,
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {

    throw new Error(`AI provider returned status ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("AI provider returned no content");
  }
  return content;
}