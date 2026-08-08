import { Schema, model, Document, Types } from 'mongoose';

// docs/09-database-architecture.md §2 "reopen_records" — the queryable reopen
// ledger deferred from Phase 4's basic reopen implementation (which linked the
// new Service Request via originalServiceRequestId but didn't yet maintain
// this separate, independently-queryable history entity or a reopen count).
//
// A CUSTOMER-initiated reopen starts PENDING (no newServiceRequestId yet) and
// needs a CUSTOMER_SUPPORT_EXECUTIVE/HAPPY_CALL_EXECUTIVE (or admin) to
// approve/reject it — see serviceRequests.service.ts's requestReopen /
// approveReopenRequest / rejectReopenRequest. A CALL_EXECUTIVE/ADMIN/
// SUPER_ADMIN-initiated reopen (reopenServiceRequest) still applies
// immediately and is recorded as already APPROVED (self-reviewed) — staff
// acting directly don't need a second staff member's sign-off.
export const REOPEN_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ReopenRequestStatus = (typeof REOPEN_REQUEST_STATUSES)[number];

export interface IReopenRecord extends Document {
  // The chain ROOT (findRootServiceRequestId) — used for cross-chain
  // counting/history, per the original design. NOT necessarily the specific
  // SR this particular reopen action is against (see requestedServiceRequestId).
  originalServiceRequestId: Types.ObjectId;
  // The exact CLOSED/PAID SR this reopen request/action targets — for a
  // first-time reopen this equals originalServiceRequestId, but for a reopen
  // of an already-reopened-and-since-closed chain it's a later link, not the
  // root. Needed at approval time to know which SR to actually flip to
  // REOPENED (the root id alone isn't enough for that).
  requestedServiceRequestId: Types.ObjectId;
  newServiceRequestId?: Types.ObjectId; // set only once APPROVED
  reason: string;
  reopenedBy: Types.ObjectId;
  reopenedAt: Date;
  withinPolicyWindow: boolean;
  warrantyApplied: boolean;
  reopenCount: number; // this reopen's ordinal for the same original chain (1st, 2nd, ...)
  status: ReopenRequestStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
}

const reopenRecordSchema = new Schema<IReopenRecord>({
  originalServiceRequestId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest', required: true },
  requestedServiceRequestId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest', required: true },
  newServiceRequestId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest' },
  reason: { type: String, required: true },
  reopenedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reopenedAt: { type: Date, default: Date.now },
  withinPolicyWindow: { type: Boolean, required: true },
  warrantyApplied: { type: Boolean, default: false },
  reopenCount: { type: Number, required: true },
  status: { type: String, enum: REOPEN_REQUEST_STATUSES, default: 'APPROVED' },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  rejectionReason: { type: String },
});

reopenRecordSchema.index({ originalServiceRequestId: 1, reopenedAt: 1 });
reopenRecordSchema.index({ status: 1, reopenedAt: -1 });

export const ReopenRecordModel = model<IReopenRecord>('ReopenRecord', reopenRecordSchema);
