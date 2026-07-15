import { Schema, model, Document, Types } from 'mongoose';

// Dynamic service catalog — docs/09-database-architecture.md §2 "services",
// docs/04-modules-and-feature-list.md M6. Brands/ProductTypes ride on the generic
// Masters engine (masterType: 'BRAND' | 'PRODUCT_TYPE'), not their own collections.
interface IPricing {
  basePrice: number;
  visitingCharge: number;
  inspectionCharge: number;
  emergencyCharge: number;
}

interface IRequiredImages {
  before: number;
  after: number;
}

export interface IService extends Document {
  name: string;
  categoryId: Types.ObjectId; // Master (SERVICE_CATEGORY)
  subCategoryId?: Types.ObjectId;
  applicableBrandIds: Types.ObjectId[];
  applicableProductTypeIds: Types.ObjectId[];
  complaintTypeIds: Types.ObjectId[];
  symptomIds: Types.ObjectId[];
  defectIds: Types.ObjectId[];
  solutionTypeIds: Types.ObjectId[];
  requiredSkills: string[];
  expectedDurationMinutes: number;
  pricing: IPricing;
  taxRateId?: Types.ObjectId;
  warrantyPeriodDays: number;
  reopenPeriodDaysOverride?: number;
  requiredDocuments: string[];
  requiredImages: IRequiredImages;
  mandatoryChecklist: string[];
  customFields: { key: string; label: string; type: string }[];
  slaMinutes: number;
  cancellationPolicyId?: Types.ObjectId;
  reschedulePolicyId?: Types.ObjectId;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<IService>(
  {
    name: { type: String, required: true, trim: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Master', required: true },
    subCategoryId: { type: Schema.Types.ObjectId, ref: 'Master' },
    applicableBrandIds: [{ type: Schema.Types.ObjectId, ref: 'Master' }],
    applicableProductTypeIds: [{ type: Schema.Types.ObjectId, ref: 'Master' }],
    complaintTypeIds: [{ type: Schema.Types.ObjectId, ref: 'Master' }],
    symptomIds: [{ type: Schema.Types.ObjectId, ref: 'Master' }],
    defectIds: [{ type: Schema.Types.ObjectId, ref: 'Master' }],
    solutionTypeIds: [{ type: Schema.Types.ObjectId, ref: 'Master' }],
    requiredSkills: { type: [String], default: [] },
    expectedDurationMinutes: { type: Number, default: 60 },
    pricing: {
      basePrice: { type: Number, default: 0 },
      visitingCharge: { type: Number, default: 0 },
      inspectionCharge: { type: Number, default: 0 },
      emergencyCharge: { type: Number, default: 0 },
    },
    taxRateId: { type: Schema.Types.ObjectId, ref: 'Master' },
    warrantyPeriodDays: { type: Number, default: 0 },
    reopenPeriodDaysOverride: { type: Number },
    requiredDocuments: { type: [String], default: [] },
    requiredImages: {
      before: { type: Number, default: 0 },
      after: { type: Number, default: 0 },
    },
    mandatoryChecklist: { type: [String], default: [] },
    customFields: [{ key: String, label: String, type: String }],
    slaMinutes: { type: Number, default: 1440 },
    cancellationPolicyId: { type: Schema.Types.ObjectId, ref: 'Policy' },
    reschedulePolicyId: { type: Schema.Types.ObjectId, ref: 'Policy' },
    active: { type: Boolean, default: false }, // new services start inactive until deliberately published
  },
  { timestamps: true }
);

serviceSchema.index({ active: 1 });
serviceSchema.index({ categoryId: 1 });
serviceSchema.index({ applicableProductTypeIds: 1 });

export const ServiceModel = model<IService>('Service', serviceSchema);
