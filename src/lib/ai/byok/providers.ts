// Bring-your-own-key AI providers. Requests go DIRECTLY from the browser to
// the provider with the user's key; there is no Vidzart server in between.
//
// That only works if the provider allows cross-origin browser requests
// (CORS). Checked on 2026-10-12 with a preflight (OPTIONS) from a localhost
// origin, for both the chat endpoint and the model list:
//   OpenAI, Groq, OpenRouter, Mistral, Google Gemini: allowed.
//   Anthropic: allowed, but requires the opt-in header
//     "anthropic-dangerous-direct-browser-access: true" (it warns that a key
//     in a web page is visible to that page, which is exactly the BYOK deal:
//     your key, on your device).
// Re-check before adding a provider; see LEARNINGS.md.

export type ProviderId = "openai" | "anthropic" | "gemini" | "groq" | "openrouter" | "mistral";

export interface Provider {
  id: ProviderId;
  name: string;
  /** Where users create a key. */
  keyUrl: string;
  /** Pre-filled model; users can pick another from the provider's list. */
  defaultModel?: string;
}

export const PROVIDERS: Provider[] = [
  { id: "anthropic", name: "Anthropic (Claude)", keyUrl: "https://console.anthropic.com/settings/keys", defaultModel: "claude-haiku-5-5" },
  { id: "openai", name: "OpenAI", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "gemini", name: "Google Gemini", keyUrl: "https://aistudio.google.com/apikey" },
  { id: "groq", name: "Groq", keyUrl: "https://console.groq.com/keys" },
  { id: "openrouter", name: "OpenRouter", keyUrl: "https://openrouter.ai/settings/keys" },
  { id: "mistral", name: "Mistral", keyUrl: "https://console.mistral.ai/api-keys" },
];

/** Base URLs of the OpenAI-compatible APIs (same request/response shape). */
const OPENAI_COMPATIBLE: Partial<Record<ProviderId, string>> = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  mistral: "https://api.mistral.ai/v1",
};

const ANTHROPIC_HEADERS = (key: string) => ({
  "x-api-key": key,
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
});

export class ProviderError extends Error {}

async function call<T>(url: string, init: RequestInit, providerName: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ProviderError(`Couldn't reach ${providerName}. Check your connection.`);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let detail = body.slice(0, 300);
    try {
      const json = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
      detail = (typeof json.error === "string" ? json.error : json.error?.message) ?? json.message ?? detail;
    } catch {
      // not JSON: keep the raw text
    }
    if (response.status === 401 || response.status === 403) {
      throw new ProviderError(`${providerName} rejected the API key (${response.status}). ${detail}`.trim());
    }
    if (response.status === 429) throw new ProviderError(`${providerName} rate limit or quota reached. ${detail}`.trim());
    throw new ProviderError(`${providerName} error ${response.status}: ${detail}`);
  }
  return (await response.json()) as T;
}

export async function listModels(provider: ProviderId, key: string, signal?: AbortSignal): Promise<string[]> {
  const name = PROVIDERS.find((p) => p.id === provider)!.name;
  const base = OPENAI_COMPATIBLE[provider];
  if (base) {
    const json = await call<{ data: { id: string }[] }>(`${base}/models`, { headers: { authorization: `Bearer ${key}` }, signal }, name);
    return json.data.map((m) => m.id).sort();
  }
  if (provider === "anthropic") {
    const json = await call<{ data: { id: string }[] }>("https://api.anthropic.com/v1/models?limit=100", { headers: ANTHROPIC_HEADERS(key), signal }, name);
    return json.data.map((m) => m.id);
  }
  const json = await call<{ models: { name: string; supportedGenerationMethods?: string[] }[] }>(
    "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",
    { headers: { "x-goog-api-key": key }, signal },
    name,
  );
  return json.models
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""));
}

export interface CompletionRequest {
  provider: ProviderId;
  key: string;
  model: string;
  system: string;
  prompt: string;
  signal?: AbortSignal;
}

/** One system + user message in, the model's text out. */
export async function complete({ provider, key, model, system, prompt, signal }: CompletionRequest): Promise<string> {
  const name = PROVIDERS.find((p) => p.id === provider)!.name;
  const json = { "content-type": "application/json" };
  const base = OPENAI_COMPATIBLE[provider];
  if (base) {
    const res = await call<{ choices: { message: { content: string | null } }[] }>(
      `${base}/chat/completions`,
      {
        method: "POST",
        headers: { ...json, authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
        signal,
      },
      name,
    );
    return res.choices[0]?.message.content ?? "";
  }
  if (provider === "anthropic") {
    const res = await call<{ content: { type: string; text?: string }[] }>(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: { ...json, ...ANTHROPIC_HEADERS(key) },
        body: JSON.stringify({ model, max_tokens: 4096, system, messages: [{ role: "user", content: prompt }] }),
        signal,
      },
      name,
    );
    return res.content.map((c) => c.text ?? "").join("");
  }
  const res = await call<{ candidates?: { content?: { parts?: { text?: string }[] } }[] }>(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { ...json, "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
      signal,
    },
    name,
  );
  return res.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}
