export type Provider = "anthropic" | "openai";

export const PROVIDERS: Record<Provider, { label: string; model: string }> = {
  anthropic: { label: "Anthropic", model: "claude-haiku-4-5-20251001" },
  openai: { label: "OpenAI", model: "gpt-4o-mini" },
};

// Runs in the browser only. The key never goes through this app's server.
export async function complete(
  provider: Provider,
  apiKey: string,
  system: string,
  prompt: string,
  maxTokens = 1200,
): Promise<string> {
  const model = PROVIDERS[provider].model;
  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
    const j = (await res.json()) as { content: { text?: string }[] };
    return j.content.map((c) => c.text ?? "").join("");
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const j = (await res.json()) as { choices: { message: { content: string } }[] };
  return j.choices[0]?.message.content ?? "";
}
