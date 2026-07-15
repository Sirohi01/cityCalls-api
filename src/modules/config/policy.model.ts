import { Schema, model, Document, Types } from 'mongoose';

// docs/09-database-architecture.md §5.
export const POLICY_TYPES = ['REOPEN', 'WARRANTY', 'CANCELLATION', 'RESCHEDULE'] as const;
export type PolicyType = (typeof POLICY_TYPES)[number];

export const POLICY_SCOPES = ['GLOBAL', 'BRANCH', 'SERVICE', 'PRODUCT', 'BRAND', 'CONTRACT', 'CUSTOMER'] as const;
export type PolicyScope = (typeof POLICY_SCOPES)[number];

export interface IPolicy extends Document {
  policyType: PolicyType;
  scope: PolicyScope;
  scopeRefId?: Types.ObjectId;
  rules: Record<string, unknown>;
}

const policySchema = new Schema<IPolicy>({
  policyType: { type: String, enum: POLICY_TYPES, required: true },
  scope: { type: String, enum: POLICY_SCOPES, required: true },
  scopeRefId: { type: Schema.Types.ObjectId },
  rules: { type: Schema.Types.Mixed, required: true },
});

policySchema.index({ policyType: 1, scope: 1, scopeRefId: 1 }, { unique: true });

export const PolicyModel = model<IPolicy>('Policy', policySchema);
