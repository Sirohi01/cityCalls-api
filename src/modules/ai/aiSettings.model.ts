import { Schema, model, Document } from 'mongoose';
import { Role } from '../users/users.types';

// docs/04-modules-and-feature-list.md M17: single global settings document —
// provider/model selection, per-feature enable flags, and usage/cost caps.
// A singleton, fetched via ai.service.ts's getSettings() (get-or-create),
// never addressed by id from outside this module.
export const AI_FEATURES = ['CALL_SUMMARIZATION', 'COMPLAINT_CLASSIFICATION'] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export interface IAiSettings extends Document {
  provider: 'GEMINI' | 'OPENAI';
  aiModel: string;
  enabled: boolean; // global kill switch — per docs/01-business-requirements-document.md FR-12, AI is always optional
  featureFlags: Record<AiFeature, boolean>;
  usageLimits: {
    maxRequestsPerDay: number;
    maxTokensPerDay: number;
    // Per-role overrides for maxRequestsPerDay — docs/14-integration-architecture.md §5
    // "token/cost caps configurable globally and per-role." Roles without an entry
    // here are bound only by the global cap.
    perRoleMaxRequestsPerDay: Partial<Record<Role, number>>;
  };
  createdAt: Date;
  updatedAt: Date;
}

const aiSettingsSchema = new Schema<IAiSettings>(
  {
    provider: { type: String, enum: ['GEMINI', 'OPENAI'], default: 'GEMINI' },
    aiModel: { type: String, default: 'gemini-1.5-flash' },
    enabled: { type: Boolean, default: false },
    featureFlags: {
      type: Schema.Types.Mixed,
      default: { CALL_SUMMARIZATION: false, COMPLAINT_CLASSIFICATION: false },
    },
    usageLimits: {
      maxRequestsPerDay: { type: Number, default: 200 },
      maxTokensPerDay: { type: Number, default: 200_000 },
      perRoleMaxRequestsPerDay: { type: Schema.Types.Mixed, default: {} },
    },
  },
  { timestamps: true }
);

export const AiSettingsModel = model<IAiSettings>('AiSettings', aiSettingsSchema);
