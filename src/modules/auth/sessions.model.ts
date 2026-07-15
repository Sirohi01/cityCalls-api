import { Schema, model, Document, Types } from 'mongoose';

// Tracks active refresh tokens per device/session — docs/17-security-and-audit.md §1, §9.
export interface ISession extends Document {
  userId: Types.ObjectId;
  refreshTokenHash: string;
  device?: string;
  ipAddress?: string;
  revokedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    refreshTokenHash: { type: String, required: true },
    device: { type: String },
    ipAddress: { type: String },
    revokedAt: { type: Date },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

sessionSchema.index({ userId: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel = model<ISession>('Session', sessionSchema);
