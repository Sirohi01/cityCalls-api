import { Schema, Types } from 'mongoose';

// Shared shape across Estimate/ProformaInvoice/Invoice/CreditNote/DebitNote —
// docs/09-database-architecture.md §2. Kept as separate Mongoose models per
// docs (not one generic "FinancialDocument" collection), but the line-item and
// tax-breakup sub-schemas are defined once here to avoid six copies drifting
// apart from each other.
export interface ILineItem {
  description: string;
  partId?: Types.ObjectId;
  qty: number;
  unitPrice: number;
  taxRateId?: Types.ObjectId;
  lineTotal: number;
}

export interface ITaxBreakup {
  cgst: number;
  sgst: number;
  igst: number;
}

export const lineItemSchemaDef = {
  description: { type: String, required: true },
  partId: { type: Schema.Types.ObjectId, ref: 'Master' },
  qty: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  taxRateId: { type: Schema.Types.ObjectId, ref: 'Master' },
  lineTotal: { type: Number, required: true },
};

export const taxBreakupSchemaDef = {
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
};

// Common fields every financial document shares, spread into each model's own
// schema rather than inherited, since Mongoose discriminators would force them
// back into one physical collection (explicitly not what docs/09 §2 wants).
export const financialDocumentCommonFields = {
  number: { type: String, required: true, unique: true },
  serviceRequestId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest' },
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  financialYear: { type: String, required: true },
  items: [lineItemSchemaDef],
  subtotal: { type: Number, required: true },
  taxBreakup: taxBreakupSchemaDef,
  discount: { type: Number, default: 0 },
  roundOff: { type: Number, default: 0 },
  total: { type: Number, required: true },
  pdfUrl: { type: String },
  sentVia: { type: [String], default: [] },
  revisionOf: { type: Schema.Types.ObjectId },
  cancelledAt: { type: Date },
  cancelReason: { type: String },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
};
