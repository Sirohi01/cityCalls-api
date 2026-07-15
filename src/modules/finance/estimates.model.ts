import { Schema, model, Document } from 'mongoose';
import { financialDocumentCommonFields, ILineItem, ITaxBreakup } from './financial.types';

export const ESTIMATE_STATUSES = ['DRAFT', 'SHARED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONVERTED'] as const;
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export interface IEstimate extends Document {
  number: string;
  serviceRequestId?: Schema.Types.ObjectId;
  leadId?: Schema.Types.ObjectId;
  customerId: Schema.Types.ObjectId;
  branchId: Schema.Types.ObjectId;
  financialYear: string;
  items: ILineItem[];
  subtotal: number;
  taxBreakup: ITaxBreakup;
  discount: number;
  roundOff: number;
  total: number;
  status: EstimateStatus;
  validUntil?: Date;
  pdfUrl?: string;
  sentVia: string[];
  revisionOf?: Schema.Types.ObjectId;
  cancelledAt?: Date;
  cancelReason?: string;
  approvedBy?: Schema.Types.ObjectId;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const estimateSchema = new Schema<IEstimate>(
  {
    ...financialDocumentCommonFields,
    status: { type: String, enum: ESTIMATE_STATUSES, default: 'DRAFT' },
    validUntil: { type: Date },
  },
  { timestamps: true }
);

estimateSchema.index({ serviceRequestId: 1 });
estimateSchema.index({ customerId: 1 });
estimateSchema.index({ status: 1 });

export const EstimateModel = model<IEstimate>('Estimate', estimateSchema);
