import { env } from '../config/env';
const AISENSY_API_URL = 'https://backend.aisensy.com/campaign/t1/api/v2';

export function isWhatsAppEnabled(): boolean {
  return env.aisensy.enabled && !!env.aisensy.apiKey;
}

export interface SendWhatsAppInput {
  to: string;
  campaignName: string;
  userName?: string;
  variables: string[];
  source?: string;
  media?: { url: string; filename: string };
  buttons?: Array<{
    type: string;
    sub_type: string;
    index: number;
    parameters: Array<{ type: string; text: string }>;
  }>;
  tags?: string[];
  attributes?: Record<string, string>;
  paramsFallbackValue?: Record<string, string>;
}

export interface AiSensySendResult {
  destination: string;
  response: unknown;
}

export function normalizeWhatsAppDestination(mobile: string): string {
  let digits = mobile.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 10 || digits.length > 15) {
    throw new Error('Invalid WhatsApp destination number');
  }
  return digits;
}

export function campaignNameForTrigger(triggerKey: string): string | undefined {
  if (triggerKey === 'OTP_LOGIN') return env.aisensy.loginOtpCampaign;
  if (triggerKey === 'SERVICE_COMPLETION_OTP') return env.aisensy.completionOtpCampaign;
  return undefined;
}

const OTP_TRIGGER_KEYS = ['OTP_LOGIN', 'SERVICE_COMPLETION_OTP'];
export function isOtpTrigger(triggerKey: string): boolean {
  return OTP_TRIGGER_KEYS.includes(triggerKey);
}
export function otpCopyCodeButton(otp: string): SendWhatsAppInput['buttons'] {
  return [{ type: 'button', sub_type: 'url', index: 0, parameters: [{ type: 'text', text: otp }] }];
}

export async function sendWhatsApp(input: SendWhatsAppInput): Promise<AiSensySendResult> {
  if (!isWhatsAppEnabled()) throw new Error('AiSensy integration is disabled');
  if (!input.campaignName.trim()) throw new Error('AiSensy campaign name is required');

  const destination = normalizeWhatsAppDestination(input.to);
  const res = await fetch(AISENSY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      apiKey: env.aisensy.apiKey,
      campaignName: input.campaignName,
      destination,
      userName: input.userName?.trim() || env.aisensy.senderName,
      templateParams: input.variables,
      source: input.source ?? env.aisensy.source,
      ...(input.media ? { media: input.media } : {}),
      ...(input.buttons?.length ? { buttons: input.buttons } : {}),
      ...(input.tags?.length ? { tags: input.tags } : {}),
      ...(input.attributes && Object.keys(input.attributes).length ? { attributes: input.attributes } : {}),
      ...(input.paramsFallbackValue && Object.keys(input.paramsFallbackValue).length
        ? { paramsFallbackValue: input.paramsFallbackValue }
        : {}),
    }),
  });

  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(`AiSensy send failed: ${res.status} ${text}`);
  }
  let response: unknown = text;
  if (text) {
    try {
      response = JSON.parse(text);
    } catch {
      // AiSensy may return a plain-text acknowledgement.
    }
  }
  if (response && typeof response === 'object' && 'success' in response && (response as { success?: unknown }).success === false) {
    throw new Error(`AiSensy send rejected: ${text}`);
  }
  return { destination, response };
}
export async function syncWhatsAppTemplates(): Promise<void> {
  if (!isWhatsAppEnabled()) return;
  console.log('[whatsappAdapter] syncWhatsAppTemplates: not yet implemented — requires a live AiSensy account to sync against');
}
