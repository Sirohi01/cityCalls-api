import { Schema, model, Document, Types } from 'mongoose';

// Credit/Debit notes correct an already-issued (possibly already-paid) Invoice
// without editing it in place — docs/16-pdf-and-financial-documents.md §4.
// Kept lightweight (amount + reason against the original invoice) rather than
// their own full line-item set, matching how they're actually used here: a
// value adjustment, not a re-billing.
interface INoteBase extends Document {
  number: string;
  invoiceId: Types.ObjectId;
  customerId: Types.ObjectId;
  branchId: Types.ObjectId;
  financialYear: string;
  amount: number;
  reason: string;
  pdfUrl?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const noteSchemaDef = {
  number: { type: String, required: true, unique: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  financialYear: { type: String, required: true },
  amount: { type: Number, required: true },
  reason: { type: String, required: true },
  pdfUrl: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
};

export type ICreditNote = INoteBase;
const creditNoteSchema = new Schema<ICreditNote>(noteSchemaDef, { timestamps: { createdAt: true, updatedAt: false } });
creditNoteSchema.index({ invoiceId: 1 });
export const CreditNoteModel = model<ICreditNote>('CreditNote', creditNoteSchema);

export type IDebitNote = INoteBase;
const debitNoteSchema = new Schema<IDebitNote>(noteSchemaDef, { timestamps: { createdAt: true, updatedAt: false } });
debitNoteSchema.index({ invoiceId: 1 });
export const DebitNoteModel = model<IDebitNote>('DebitNote', debitNoteSchema);
