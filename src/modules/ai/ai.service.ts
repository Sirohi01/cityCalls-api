import { AiSettingsModel, IAiSettings, AiFeature } from './aiSettings.model';
import { AiRequestLogModel, AiRequestStatus } from './aiRequestLog.model';
import { AiUsageModel } from './aiUsage.model';
import { CallModel } from '../calls/calls.model';
import { MasterModel } from '../config/master.model';
import { isAiConfigured, summarize as providerSummarize, classify as providerClassify } from '../../lib/aiProvider';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { AccessTokenPayload } from '../../lib/jwt';
import { Role } from '../users/users.types';

const INPUT_PREVIEW_MAX_LENGTH = 500;

// Get-or-create — a single global AiSettings document, per
// docs/04-modules-and-feature-list.md M17. Never addressed by id from
// outside this module.
export async function getSettings(): Promise<IAiSettings> {
  const existing = await AiSettingsModel.findOne();
  if (existing) return existing;
  return AiSettingsModel.create({});
}

export interface UpdateSettingsInput {
  provider?: 'GEMINI' | 'OPENAI';
  model?: string;
  enabled?: boolean;
  featureFlags?: Partial<Record<AiFeature, boolean>>;
  usageLimits?: {
    maxRequestsPerDay?: number;
    maxTokensPerDay?: number;
    perRoleMaxRequestsPerDay?: Partial<Record<Role, number>>;
  };
}

export async function updateSettings(input: UpdateSettingsInput): Promise<IAiSettings> {
  const settings = await getSettings();
  if (input.provider !== undefined) settings.provider = input.provider;
  if (input.model !== undefined) settings.aiModel = input.model;
  if (input.enabled !== undefined) settings.enabled = input.enabled;
  if (input.featureFlags) {
    settings.featureFlags = { ...settings.featureFlags, ...input.featureFlags };
  }
  if (input.usageLimits) {
    if (input.usageLimits.maxRequestsPerDay !== undefined) settings.usageLimits.maxRequestsPerDay = input.usageLimits.maxRequestsPerDay;
    if (input.usageLimits.maxTokensPerDay !== undefined) settings.usageLimits.maxTokensPerDay = input.usageLimits.maxTokensPerDay;
    if (input.usageLimits.perRoleMaxRequestsPerDay) {
      settings.usageLimits.perRoleMaxRequestsPerDay = {
        ...settings.usageLimits.perRoleMaxRequestsPerDay,
        ...input.usageLimits.perRoleMaxRequestsPerDay,
      };
    }
  }
  await settings.save();
  return settings;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export type UsageCheckResult = { allowed: true } | { allowed: false; reason: 'AI_LIMIT_REACHED' };

// Exported standalone so cap math is independently testable without a
// configured provider — see test/integration/real-db-ai.test.ts. Consumption
// (the $inc) only happens when a request is actually allowed through, and is
// applied to both the GLOBAL row and the requester's role row so a per-role
// override (if set) can be enforced on the next call without a second query.
export async function checkAndConsumeUsage(role: Role, settings: IAiSettings): Promise<UsageCheckResult> {
  const date = todayKey();
  const [globalUsage, roleUsage] = await Promise.all([
    AiUsageModel.findOne({ date, scope: 'GLOBAL' }).lean(),
    AiUsageModel.findOne({ date, scope: role }).lean(),
  ]);

  const globalCount = globalUsage?.requestCount ?? 0;
  const globalTokens = globalUsage?.tokenCount ?? 0;
  if (globalCount >= settings.usageLimits.maxRequestsPerDay || globalTokens >= settings.usageLimits.maxTokensPerDay) {
    return { allowed: false, reason: 'AI_LIMIT_REACHED' };
  }

  const perRoleLimit = settings.usageLimits.perRoleMaxRequestsPerDay[role];
  if (perRoleLimit !== undefined && (roleUsage?.requestCount ?? 0) >= perRoleLimit) {
    return { allowed: false, reason: 'AI_LIMIT_REACHED' };
  }

  return { allowed: true };
}

async function recordUsage(role: Role, tokenUsage: number): Promise<void> {
  const date = todayKey();
  await Promise.all([
    AiUsageModel.findOneAndUpdate(
      { date, scope: 'GLOBAL' },
      { $inc: { requestCount: 1, tokenCount: tokenUsage } },
      { upsert: true }
    ),
    AiUsageModel.findOneAndUpdate(
      { date, scope: role },
      { $inc: { requestCount: 1, tokenCount: tokenUsage } },
      { upsert: true }
    ),
  ]);
}

export interface AiFeatureResult {
  aiAvailable: boolean;
  reason?: 'DISABLED' | 'AI_LIMIT_REACHED' | 'PROVIDER_NOT_CONFIGURED' | 'FAILED';
  text?: string;
  category?: string;
}

async function logAttempt(
  feature: AiFeature,
  provider: 'GEMINI' | 'OPENAI',
  inputText: string,
  inputRef: string | undefined,
  status: AiRequestStatus,
  actor: AccessTokenPayload,
  extra: { output?: string; tokenUsage?: number; failureReason?: string } = {}
): Promise<void> {
  await AiRequestLogModel.create({
    feature,
    provider,
    inputRef,
    inputPreview: inputText.slice(0, INPUT_PREVIEW_MAX_LENGTH),
    output: extra.output,
    tokenUsage: extra.tokenUsage ?? 0,
    status,
    failureReason: extra.failureReason,
    requestedBy: actor.sub,
  });
}

// docs/01-business-requirements-document.md Business Rule #7 / FR-12: AI is
// always optional and never the only way to complete a workflow step. Every
// branch below returns a normal 200-shaped result (aiAvailable: false + a
// reason) rather than throwing, so callers can degrade to their manual
// fallback (the call executive picks a category themselves, etc.) instead of
// surfacing an error.
export async function summarizeCall(input: { callId?: string; text?: string }, actor: AccessTokenPayload): Promise<AiFeatureResult> {
  const settings = await getSettings();
  let text = input.text;
  if (input.callId) {
    const call = await CallModel.findById(input.callId).lean();
    if (!call) throw new NotFoundError('Call not found');
    text = call.notes ?? '';
  }
  if (!text || !text.trim()) {
    throw new ValidationError([{ field: 'text', code: 'REQUIRED', message: 'Provide callId or text to summarize' }]);
  }

  if (!settings.enabled || !settings.featureFlags.CALL_SUMMARIZATION) {
    return { aiAvailable: false, reason: 'DISABLED' };
  }

  const usage = await checkAndConsumeUsage(actor.role, settings);
  if (!usage.allowed) {
    await logAttempt('CALL_SUMMARIZATION', settings.provider, text, input.callId, 'SKIPPED_LIMIT_REACHED', actor);
    return { aiAvailable: false, reason: 'AI_LIMIT_REACHED' };
  }

  if (!isAiConfigured(settings.provider)) {
    await logAttempt('CALL_SUMMARIZATION', settings.provider, text, input.callId, 'SKIPPED_NOT_CONFIGURED', actor);
    return { aiAvailable: false, reason: 'PROVIDER_NOT_CONFIGURED' };
  }

  try {
    const result = await providerSummarize(settings.provider, settings.aiModel, text);
    await recordUsage(actor.role, result.tokenUsage);
    await logAttempt('CALL_SUMMARIZATION', settings.provider, text, input.callId, 'SUCCESS', actor, {
      output: result.text,
      tokenUsage: result.tokenUsage,
    });
    return { aiAvailable: true, text: result.text };
  } catch (err) {
    await logAttempt('CALL_SUMMARIZATION', settings.provider, text, input.callId, 'FAILED', actor, {
      failureReason: err instanceof Error ? err.message : 'Unknown AI provider error',
    });
    return { aiAvailable: false, reason: 'FAILED' };
  }
}

export async function classifyComplaint(
  input: { text: string; categories?: string[] },
  actor: AccessTokenPayload
): Promise<AiFeatureResult> {
  const settings = await getSettings();
  if (!input.text || !input.text.trim()) {
    throw new ValidationError([{ field: 'text', code: 'REQUIRED', message: 'text is required' }]);
  }

  let categories = input.categories;
  if (!categories || categories.length === 0) {
    const masters = await MasterModel.find({ masterType: 'SERVICE_CATEGORY', active: true }).lean();
    categories = masters.map((m) => m.label);
  }
  if (categories.length === 0) {
    throw new ValidationError([{ field: 'categories', code: 'REQUIRED', message: 'No service categories available to classify against' }]);
  }

  if (!settings.enabled || !settings.featureFlags.COMPLAINT_CLASSIFICATION) {
    return { aiAvailable: false, reason: 'DISABLED' };
  }

  const usage = await checkAndConsumeUsage(actor.role, settings);
  if (!usage.allowed) {
    await logAttempt('COMPLAINT_CLASSIFICATION', settings.provider, input.text, undefined, 'SKIPPED_LIMIT_REACHED', actor);
    return { aiAvailable: false, reason: 'AI_LIMIT_REACHED' };
  }

  if (!isAiConfigured(settings.provider)) {
    await logAttempt('COMPLAINT_CLASSIFICATION', settings.provider, input.text, undefined, 'SKIPPED_NOT_CONFIGURED', actor);
    return { aiAvailable: false, reason: 'PROVIDER_NOT_CONFIGURED' };
  }

  try {
    const result = await providerClassify(settings.provider, settings.aiModel, input.text, categories);
    await recordUsage(actor.role, result.tokenUsage);
    await logAttempt('COMPLAINT_CLASSIFICATION', settings.provider, input.text, undefined, 'SUCCESS', actor, {
      output: result.text,
      tokenUsage: result.tokenUsage,
    });
    return { aiAvailable: true, category: result.text };
  } catch (err) {
    await logAttempt('COMPLAINT_CLASSIFICATION', settings.provider, input.text, undefined, 'FAILED', actor, {
      failureReason: err instanceof Error ? err.message : 'Unknown AI provider error',
    });
    return { aiAvailable: false, reason: 'FAILED' };
  }
}
