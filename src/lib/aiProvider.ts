import { env } from '../config/env';

// docs/14-integration-architecture.md §5 ("Gemini / OpenAI"): a single
// AIProvider interface (summarize/classify) backed by whichever provider is
// selected in AI settings, matching the adapter-selection pattern already
// used for email/WhatsApp. No real Gemini/OpenAI account exists in this
// environment; this is the real integration shape, verified against each
// provider's documented REST API, but has not been exercised against a live
// key. isAiConfigured() gates every call site the same way isEmailEnabled()/
// isWhatsAppEnabled() do.
export type AiProvider = 'GEMINI' | 'OPENAI';

export function isAiConfigured(provider: AiProvider): boolean {
  if (!env.ai.enabled) return false;
  return provider === 'GEMINI' ? !!env.ai.geminiApiKey : !!env.ai.openaiApiKey;
}

export interface AiCompletionResult {
  text: string;
  tokenUsage: number;
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const OPENAI_API_BASE = 'https://api.openai.com/v1/chat/completions';

async function callGemini(model: string, prompt: string): Promise<AiCompletionResult> {
  const res = await fetch(`${GEMINI_API_BASE}/${model}:generateContent?key=${env.ai.geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini request failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { totalTokenCount?: number };
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const tokenUsage = data.usageMetadata?.totalTokenCount ?? 0;
  return { text: text.trim(), tokenUsage };
}

async function callOpenAi(model: string, prompt: string): Promise<AiCompletionResult> {
  const res = await fetch(OPENAI_API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.ai.openaiApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI request failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content ?? '';
  const tokenUsage = data.usage?.total_tokens ?? 0;
  return { text: text.trim(), tokenUsage };
}

async function complete(provider: AiProvider, model: string, prompt: string): Promise<AiCompletionResult> {
  return provider === 'GEMINI' ? callGemini(model, prompt) : callOpenAi(model, prompt);
}

export async function summarize(provider: AiProvider, model: string, text: string): Promise<AiCompletionResult> {
  return complete(provider, model, `Summarize the following in 2-3 concise sentences for a field-service call log:\n\n${text}`);
}

export async function classify(
  provider: AiProvider,
  model: string,
  text: string,
  categories: string[]
): Promise<AiCompletionResult> {
  const prompt =
    `Classify the following complaint/service-request description into exactly one of these categories: ${categories.join(', ')}.\n` +
    `Respond with only the category name, nothing else.\n\nText:\n${text}`;
  return complete(provider, model, prompt);
}
