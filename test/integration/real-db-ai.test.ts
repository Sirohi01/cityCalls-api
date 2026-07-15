import { connectTestDb, disconnectTestDb } from '../setup/testDb';
import { UserModel } from '../../src/modules/users/users.model';
import { CallModel } from '../../src/modules/calls/calls.model';
import { MasterModel } from '../../src/modules/config/master.model';
import { AiRequestLogModel } from '../../src/modules/ai/aiRequestLog.model';
import { AiUsageModel } from '../../src/modules/ai/aiUsage.model';
import { getSettings, updateSettings, summarizeCall, classifyComplaint, checkAndConsumeUsage } from '../../src/modules/ai/ai.service';
import { ValidationError } from '../../src/lib/errors';
import { AccessTokenPayload } from '../../src/lib/jwt';

// Real (in-memory) DB coverage for Phase 9's core acceptance criteria — per
// docs/22-phase-wise-development-plan.md Phase 9: "every AI feature has a
// fully functional non-AI fallback path; usage cap enforcement verified."
// No GEMINI_API_KEY/OPENAI_API_KEY are set in the test environment, so
// isAiConfigured() is always false here — exercising exactly the
// disabled/not-configured/limit-reached fallback paths against real
// Mongoose writes, the same shape of coverage Phase 8's notification tests
// established.
describe('AI settings + trigger flow (real in-memory MongoDB)', () => {
  jest.setTimeout(60_000);
  let actor: AccessTokenPayload;
  let callId: string;

  beforeAll(async () => {
    await connectTestDb();

    const user = await UserModel.create({
      name: 'Admin',
      email: 'admin4@test.local',
      mobile: '9666666666',
      passwordHash: 'x',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    });
    actor = { sub: user._id.toString(), role: 'SUPER_ADMIN' };

    const call = await CallModel.create({
      number: 'CALL-TEST-0001',
      callType: 'INITIAL',
      direction: 'INCOMING',
      callerNumber: '9000000001',
      callDate: new Date(),
      callTime: '10:00',
      notes: 'Customer reports the AC is not cooling and makes a rattling noise.',
      createdBy: user._id,
    });
    callId = call._id.toString();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('creates a default settings document on first access, disabled by default', async () => {
    const settings = await getSettings();
    expect(settings.enabled).toBe(false);
    expect(settings.provider).toBe('GEMINI');
  });

  it('returns aiAvailable:false with reason DISABLED and logs nothing when AI is globally off', async () => {
    const result = await summarizeCall({ callId }, actor);
    expect(result).toEqual({ aiAvailable: false, reason: 'DISABLED' });

    const count = await AiRequestLogModel.countDocuments({ inputRef: callId });
    expect(count).toBe(0);
  });

  it('returns aiAvailable:false with reason PROVIDER_NOT_CONFIGURED once enabled, and logs the attempt', async () => {
    await updateSettings({ enabled: true, featureFlags: { CALL_SUMMARIZATION: true, COMPLAINT_CLASSIFICATION: true } });

    const result = await summarizeCall({ callId }, actor);
    expect(result).toEqual({ aiAvailable: false, reason: 'PROVIDER_NOT_CONFIGURED' });

    const logRow = await AiRequestLogModel.findOne({ inputRef: callId });
    expect(logRow?.status).toBe('SKIPPED_NOT_CONFIGURED');
    expect(logRow?.feature).toBe('CALL_SUMMARIZATION');
    expect(logRow?.inputPreview).toContain('rattling noise');
  });

  it('returns aiAvailable:false with reason AI_LIMIT_REACHED once the daily cap is exhausted, and logs it', async () => {
    await updateSettings({ usageLimits: { maxRequestsPerDay: 0 } });

    const result = await classifyComplaint({ text: 'AC not cooling', categories: ['AC Repair', 'Plumbing'] }, actor);
    expect(result).toEqual({ aiAvailable: false, reason: 'AI_LIMIT_REACHED' });

    const logRow = await AiRequestLogModel.findOne({ feature: 'COMPLAINT_CLASSIFICATION' });
    expect(logRow?.status).toBe('SKIPPED_LIMIT_REACHED');

    // Restore a usable cap for subsequent tests in this file.
    await updateSettings({ usageLimits: { maxRequestsPerDay: 200 } });
  });

  it('falls back to active SERVICE_CATEGORY masters when no categories are supplied', async () => {
    await MasterModel.create({ masterType: 'SERVICE_CATEGORY', key: 'AC', label: 'AC Repair' });
    await MasterModel.create({ masterType: 'SERVICE_CATEGORY', key: 'PLUMB', label: 'Plumbing', active: false });

    // No provider is configured in this environment, so this still resolves
    // to PROVIDER_NOT_CONFIGURED rather than an actual classification — the
    // point of this test is that the missing `categories` input does not
    // itself throw a validation error once at least one active master exists.
    const result = await classifyComplaint({ text: 'AC not cooling' }, actor);
    expect(result.reason).not.toBe('DISABLED');
    expect(result.aiAvailable).toBe(false);
  });

  it('throws a validation error when no categories are supplied and none exist as masters', async () => {
    await MasterModel.deleteMany({ masterType: 'SERVICE_CATEGORY' });
    await expect(classifyComplaint({ text: 'AC not cooling' }, actor)).rejects.toBeInstanceOf(ValidationError);
  });

  describe('checkAndConsumeUsage (direct cap-math coverage)', () => {
    it('allows a request under both the global and per-role caps', async () => {
      const settings = await getSettings();
      settings.usageLimits.maxRequestsPerDay = 5;
      settings.usageLimits.maxTokensPerDay = 5000;
      settings.usageLimits.perRoleMaxRequestsPerDay = {};
      await settings.save();

      const result = await checkAndConsumeUsage('CALL_EXECUTIVE', settings);
      expect(result.allowed).toBe(true);
    });

    it('blocks once the global daily request cap is met', async () => {
      const settings = await getSettings();
      settings.usageLimits.maxRequestsPerDay = 1;
      await settings.save();

      const today = new Date().toISOString().slice(0, 10);
      await AiUsageModel.findOneAndUpdate({ date: today, scope: 'GLOBAL' }, { $set: { requestCount: 1, tokenCount: 0 } }, { upsert: true });

      const result = await checkAndConsumeUsage('CALL_EXECUTIVE', settings);
      expect(result).toEqual({ allowed: false, reason: 'AI_LIMIT_REACHED' });
    });

    it('blocks once a per-role override cap is met even if the global cap has headroom', async () => {
      const settings = await getSettings();
      settings.usageLimits.maxRequestsPerDay = 100;
      settings.usageLimits.perRoleMaxRequestsPerDay = { SALES_EXECUTIVE: 1 };
      await settings.save();

      const today = new Date().toISOString().slice(0, 10);
      await AiUsageModel.findOneAndUpdate({ date: today, scope: 'GLOBAL' }, { $set: { requestCount: 0, tokenCount: 0 } }, { upsert: true });
      await AiUsageModel.findOneAndUpdate({ date: today, scope: 'SALES_EXECUTIVE' }, { $set: { requestCount: 1, tokenCount: 0 } }, { upsert: true });

      const result = await checkAndConsumeUsage('SALES_EXECUTIVE', settings);
      expect(result).toEqual({ allowed: false, reason: 'AI_LIMIT_REACHED' });

      // A role with no override is unaffected by another role's cap.
      const otherRoleResult = await checkAndConsumeUsage('CALL_EXECUTIVE', settings);
      expect(otherRoleResult.allowed).toBe(true);
    });
  });
});
