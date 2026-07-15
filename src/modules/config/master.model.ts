import { Schema, model, Document, Types } from 'mongoose';

// Generic master-list schema shared by every master type — docs/09-database-architecture.md §3.
// Adding a new master type is registering a key in MASTER_TYPES (masterRegistry.ts),
// never a new Mongoose model.
export const MASTER_TYPES = [
  'SERVICE_CATEGORY',
  'BRAND',
  'PRODUCT_TYPE',
  'SYMPTOM',
  'DEFECT',
  'SOLUTION',
  'PART',
  'UNIT',
  'TAX_RATE',
  'PRIORITY',
  'LEAD_SOURCE',
  'CALL_TYPE',
  'APPOINTMENT_SLOT',
  'PAYMENT_METHOD',
] as const;

export type MasterType = (typeof MASTER_TYPES)[number];

export interface IMaster extends Document {
  masterType: MasterType;
  key: string;
  label: string;
  parentId?: Types.ObjectId;
  meta: Record<string, unknown>;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const masterSchema = new Schema<IMaster>(
  {
    masterType: { type: String, enum: MASTER_TYPES, required: true },
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Master' },
    meta: { type: Schema.Types.Mixed, default: {} },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

masterSchema.index({ masterType: 1, key: 1 }, { unique: true });
masterSchema.index({ masterType: 1, active: 1 });

export const MasterModel = model<IMaster>('Master', masterSchema);
