import { Schema, model, Document, Types } from 'mongoose';

// Generic audit/timeline entity — docs/09-database-architecture.md §"activity_logs",
// append-only (no update/delete endpoint exists, per docs/17-security-and-audit.md §7).
export interface IActivityLog extends Document {
  entityType: string;
  entityId: Types.ObjectId;
  userId: Types.ObjectId;
  userRole: string;
  action: string;
  module: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  device?: string;
  sourceApp?: string;
  reason?: string;
  timestamp: Date;
}

const activityLogSchema = new Schema<IActivityLog>({
  entityType: { type: String, required: true },
  entityId: { type: Schema.Types.ObjectId, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  userRole: { type: String, required: true },
  action: { type: String, required: true },
  module: { type: String, required: true },
  oldValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  ipAddress: { type: String },
  device: { type: String },
  sourceApp: { type: String },
  reason: { type: String },
  timestamp: { type: Date, default: Date.now },
});

activityLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });

export const ActivityLogModel = model<IActivityLog>('ActivityLog', activityLogSchema);
