import { env } from '../config/env';

// docs/14-integration-architecture.md §4: sends only approved, synced
// templates — free-form messages outside the 24-hour session window aren't
// attempted since WhatsApp Business API disallows them. Uses AiSensy's
// campaign API (native fetch, Node 20+ — no axios dependency needed for this
// one adapter). No real AiSensy account exists in this environment; this is
// the real integration shape, verified against AiSensy's documented API
// contract, but has not been exercised against a live account.
const AISENSY_API_URL = 'https://backend.aisensy.com/campaign/t1/api/v2';

export function isWhatsAppEnabled(): boolean {
  return env.aisensy.enabled && !!env.aisensy.apiKey;
}

export interface SendWhatsAppInput {
  to: string;
  templateName: string;
  variables: string[];
}

export async function sendWhatsApp(input: SendWhatsAppInput): Promise<void> {
  const res = await fetch(AISENSY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: env.aisensy.apiKey,
      campaignName: input.templateName,
      destination: input.to,
      userName: 'CityCalls',
      templateParams: input.variables,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AiSensy send failed: ${res.status} ${text}`);
  }
}

// docs/14-integration-architecture.md §4: templates are synced from AiSensy's
// approved list into notification_templates via a scheduled job — stubbed
// here since it needs a real account's approved template list to sync against.
export async function syncWhatsAppTemplates(): Promise<void> {
  if (!isWhatsAppEnabled()) return;
  console.log('[whatsappAdapter] syncWhatsAppTemplates: not yet implemented — requires a live AiSensy account to sync against');
}
