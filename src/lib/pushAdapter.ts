import { initializeApp, cert, App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { env } from '../config/env';

// Same adapter-selection pattern as emailAdapter.ts/whatsappAdapter.ts
// (docs/14-integration-architecture.md §1) — this module only concerns
// itself with "how to actually send"; notifications.ts decides whether to
// call it at all (SKIPPED_INTEGRATION_DISABLED when isPushEnabled() is false).
// firebase-admin v12+ dropped the old `admin.credential`/`admin.app.App`
// namespace API in favor of these per-module imports.
let app: App | undefined;

function getApp(): App {
  if (!app) {
    const credential = env.firebase.serviceAccountJson
      ? cert(JSON.parse(env.firebase.serviceAccountJson))
      : cert(env.firebase.serviceAccountPath as string);
    app = initializeApp({ credential });
  }
  return app;
}

export function isPushEnabled(): boolean {
  return env.firebase.enabled && !!(env.firebase.serviceAccountJson || env.firebase.serviceAccountPath);
}

export interface SendPushInput {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface SendPushResult {
  successCount: number;
  failureCount: number;
  // Tokens FCM reported as invalid/unregistered — the caller (notifications.ts)
  // removes these from the recipient's stored token list so they aren't
  // retried forever on every future notification.
  invalidTokens: string[];
}

export async function sendPush(input: SendPushInput): Promise<SendPushResult> {
  if (input.tokens.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  const response = await getMessaging(getApp()).sendEachForMulticast({
    tokens: input.tokens,
    notification: { title: input.title, body: input.body },
    data: input.data,
  });

  const invalidTokens: string[] = [];
  response.responses.forEach((r: { success: boolean; error?: { code?: string } }, i: number) => {
    if (!r.success && (r.error?.code === 'messaging/invalid-registration-token' || r.error?.code === 'messaging/registration-token-not-registered')) {
      invalidTokens.push(input.tokens[i]);
    }
  });

  return { successCount: response.successCount, failureCount: response.failureCount, invalidTokens };
}
