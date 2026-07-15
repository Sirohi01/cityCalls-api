import { Schema, model, Document, Types } from 'mongoose';

// docs/09-database-architecture.md §2 "reopen_records" — the queryable reopen
// ledger deferred from Phase 4's basic reopen implementation (which linked the
// new Service Request via originalServiceRequestId but didn't yet maintain
// this separate, independently-queryable history entity or a reopen count).
export interface IReopenRecord extends Document {
  originalServiceRequestId: Types.ObjectId;
  newServiceRequestId: Types.ObjectId;
  reason: string;
  reopenedBy: Types.ObjectId;
  reopenedAt: Date;
  withinPolicyWindow: boolean;
  warrantyApplied: boolean;
  reopenCount: number; // this reopen's ordinal for the same original chain (1st, 2nd, ...)
}

const reopenRecordSchema = new Schema<IReopenRecord>({
  originalServiceRequestId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest', required: true },
  newServiceRequestId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest', required: true },
  reason: { type: String, required: true },
  reopenedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reopenedAt: { type: Date, default: Date.now },
  withinPolicyWindow: { type: Boolean, required: true },
  warrantyApplied: { type: Boolean, default: false },
  reopenCount: { type: Number, required: true },
});

reopenRecordSchema.index({ originalServiceRequestId: 1, reopenedAt: 1 });

export const ReopenRecordModel = model<IReopenRecord>('ReopenRecord', reopenRecordSchema);
