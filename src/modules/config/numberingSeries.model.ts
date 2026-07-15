import { Schema, model, Document, Types } from 'mongoose';

// docs/09-database-architecture.md §4.
export const DOCUMENT_TYPES = [
  'SERVICE_REQUEST',
  'LEAD',
  'CALL',
  'ESTIMATE',
  'PROFORMA_INVOICE',
  'INVOICE',
  'PAYMENT_RECEIPT',
  'CREDIT_NOTE',
  'DEBIT_NOTE',
  'CUSTOMER',
  'VENDOR',
  'VENDOR_INVOICE',
  'VENDOR_PAYOUT',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface INumberingSeries extends Document {
  documentType: DocumentType;
  branchId?: Types.ObjectId;
  financialYear?: string;
  prefix: string;
  padLength: number;
  lastSequence: number;
}

const numberingSeriesSchema = new Schema<INumberingSeries>({
  documentType: { type: String, enum: DOCUMENT_TYPES, required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  financialYear: { type: String },
  prefix: { type: String, required: true },
  padLength: { type: Number, default: 6 },
  lastSequence: { type: Number, default: 0 },
});

numberingSeriesSchema.index(
  { documentType: 1, branchId: 1, financialYear: 1 },
  { unique: true }
);

export const NumberingSeriesModel = model<INumberingSeries>('NumberingSeries', numberingSeriesSchema);
