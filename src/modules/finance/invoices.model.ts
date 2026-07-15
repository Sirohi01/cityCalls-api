import { Schema, model, Document } from 'mongoose';
import { financialDocumentCommonFields, ILineItem, ITaxBreakup } from './financial.types';

export const INVOICE_STATUSES = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface IInvoice extends Document {
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
  amountPaid: number;
  status: InvoiceStatus;
  proformaInvoiceId?: Schema.Types.ObjectId;
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

const invoiceSchema = new Schema<IInvoice>(
  {
    ...financialDocumentCommonFields,
    amountPaid: { type: Number, default: 0 },
    status: { type: String, enum: INVOICE_STATUSES, default: 'DRAFT' },
    proformaInvoiceId: { type: Schema.Types.ObjectId, ref: 'ProformaInvoice' },
  },
  { timestamps: true }
);

invoiceSchema.index({ serviceRequestId: 1 });
invoiceSchema.index({ customerId: 1 });
invoiceSchema.index({ status: 1 });

export const InvoiceModel = model<IInvoice>('Invoice', invoiceSchema);
