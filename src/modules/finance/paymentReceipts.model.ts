import { Schema, model, Document, Types } from 'mongoose';

export const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'GATEWAY', 'CHEQUE', 'CREDIT'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// A Payment Receipt records money received against an Invoice — it does not
// carry its own line items/tax breakup (those were already computed on the
// Invoice being paid), so it uses a tailored shape rather than the generic
// financialDocumentCommonFields used by Estimate/Proforma/Invoice. Per
// docs/16-pdf-and-financial-documents.md §7.
export interface IPaymentReceipt extends Document {
  number: string;
  invoiceId: Types.ObjectId;
  customerId: Types.ObjectId;
  branchId: Types.ObjectId;
  financialYear: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  proofUrl?: string;
  collectedBy: Types.ObjectId;
  pdfUrl?: string;
  createdAt: Date;
}

const paymentReceiptSchema = new Schema<IPaymentReceipt>(
  {
    number: { type: String, required: true, unique: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    financialYear: { type: String, required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    reference: { type: String },
    proofUrl: { type: String },
    collectedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    pdfUrl: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

paymentReceiptSchema.index({ invoiceId: 1 });
paymentReceiptSchema.index({ customerId: 1 });

export const PaymentReceiptModel = model<IPaymentReceipt>('PaymentReceipt', paymentReceiptSchema);
