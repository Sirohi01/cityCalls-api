import { env } from '../config/env';
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
export async function syncWhatsAppTemplates(): Promise<void> {
  if (!isWhatsAppEnabled()) return;
  console.log('[whatsappAdapter] syncWhatsAppTemplates: not yet implemented — requires a live AiSensy account to sync against');
}
