import { Schema, model, Document, Types } from 'mongoose';
import { AI_FEATURES, AiFeature } from './aiSettings.model';

// docs/14-integration-architecture.md §5 "ai_requests" — logged for cost/audit
// visibility, and per docs/17-security-and-audit.md, so that any customer
// data sent to an external provider is itself recorded (this log never
// leaves the system). One row per invocation attempt, including ones that
// never reached the provider (disabled/limit-reached/not-configured) —
// those are operationally useful signals, not noise.
export const AI_REQUEST_STATUSES = ['SUCCESS', 'FAILED', 'SKIPPED_DISABLED', 'SKIPPED_LIMIT_REACHED', 'SKIPPED_NOT_CONFIGURED'] as const;
export type AiRequestStatus = (typeof AI_REQUEST_STATUSES)[number];

export interface IAiRequestLog extends Document {
  feature: AiFeature;
  provider: 'GEMINI' | 'OPENAI';
  inputRef?: string; // e.g. callId — omitted when the caller passed raw text with no linked record
  inputPreview: string; // truncated copy of exactly what was sent to the provider
  output?: string;
  tokenUsage: number;
  status: AiRequestStatus;
  failureReason?: string;
  requestedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const aiRequestLogSchema = new Schema<IAiRequestLog>(
  {
    feature: { type: String, enum: AI_FEATURES, required: true },
    provider: { type: String, enum: ['GEMINI', 'OPENAI'], required: true },
    inputRef: { type: String },
    inputPreview: { type: String, required: true },
    output: { type: String },
    tokenUsage: { type: Number, default: 0 },
    status: { type: String, enum: AI_REQUEST_STATUSES, required: true },
    failureReason: { type: String },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

aiRequestLogSchema.index({ requestedBy: 1, createdAt: -1 });
aiRequestLogSchema.index({ feature: 1, status: 1, createdAt: -1 });

export const AiRequestLogModel = model<IAiRequestLog>('AiRequestLog', aiRequestLogSchema);
