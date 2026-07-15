import { Schema, model, Document } from 'mongoose';

// Daily request/token counters, one row per {date, scope}. `scope` is either
// 'GLOBAL' or a Role name — every successful (provider-reaching) request
// increments both its own role's row and the GLOBAL row, so the cap check in
// ai.service.ts can enforce the global cap and any per-role override in one
// read each. `date` is a plain 'YYYY-MM-DD' string (server-local calendar
// day) rather than a Date range query, matching the simplicity of the
// numbering engine's day/FY-scoped counters.
export interface IAiUsage extends Document {
  date: string;
  scope: string;
  requestCount: number;
  tokenCount: number;
}

const aiUsageSchema = new Schema<IAiUsage>({
  date: { type: String, required: true },
  scope: { type: String, required: true },
  requestCount: { type: Number, default: 0 },
  tokenCount: { type: Number, default: 0 },
});

aiUsageSchema.index({ date: 1, scope: 1 }, { unique: true });

export const AiUsageModel = model<IAiUsage>('AiUsage', aiUsageSchema);
