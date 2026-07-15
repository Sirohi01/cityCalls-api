import { Schema, model, Document, Types } from 'mongoose';

// Idempotency ledger for offline-sync batch actions — docs/10-api-standards.md §11
// and docs/08-system-architecture.md §5: a flaky mobile connection may retry the
// same queued action; this is what lets the server recognize a replay and return
// the original result instead of double-applying it (e.g. double-charging labour,
// double-creating a visit).
export interface ISyncedAction extends Document {
  idempotencyKey: string;
  serviceRequestId: Types.ObjectId;
  actionType: string;
  status: 'APPLIED' | 'REJECTED';
  resultSummary: string;
  processedAt: Date;
}

const syncedActionSchema = new Schema<ISyncedAction>({
  idempotencyKey: { type: String, required: true, unique: true },
  serviceRequestId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest', required: true },
  actionType: { type: String, required: true },
  status: { type: String, enum: ['APPLIED', 'REJECTED'], required: true },
  resultSummary: { type: String, required: true },
  processedAt: { type: Date, default: Date.now },
});

// Rolling 24h dedup window per docs/10-api-standards.md §11 — old entries expire
// automatically rather than growing the collection forever.
syncedActionSchema.index({ processedAt: 1 }, { expireAfterSeconds: 86_400 });

export const SyncedActionModel = model<ISyncedAction>('SyncedAction', syncedActionSchema);
