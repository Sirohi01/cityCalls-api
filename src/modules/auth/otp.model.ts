import { Schema, model, Document } from 'mongoose';

// Short-lived OTP for customer-app login — docs/manish/04-authentication-and-rbac-plan.md §1,
// docs/17-security-and-audit.md §4 (rate-limited).
export interface IOtp extends Document {
  mobile: string;
  otpHash: string;
  expiresAt: Date;
  verified: boolean;
  attempts: number;
  createdAt: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    mobile: { type: String, required: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

otpSchema.index({ mobile: 1, createdAt: -1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpModel = model<IOtp>('Otp', otpSchema);
