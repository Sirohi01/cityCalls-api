import { Schema, model, Document, Types } from 'mongoose';

// docs/09-database-architecture.md §2 "vendor_invoices / vendor_payouts" —
// the vendor-facing settlement chain, structurally parallel to the customer-
// facing one but simpler (no GST line-item breakdown needed at this stage).
export const VENDOR_INVOICE_STATUSES = ['PENDING', 'APPROVED', 'PAID', 'DISPUTED'] as const;
export type VendorInvoiceStatus = (typeof VENDOR_INVOICE_STATUSES)[number];

export interface IVendorInvoice extends Document {
  number: string;
  vendorId: Types.ObjectId;
  serviceRequestIds: Types.ObjectId[];
  periodStart?: Date;
  periodEnd?: Date;
  amount: number;
  commissionBreakup: { grossAmount: number; commissionRate: number; commissionAmount: number; netPayable: number };
  status: VendorInvoiceStatus;
  createdAt: Date;
  updatedAt: Date;
}

const vendorInvoiceSchema = new Schema<IVendorInvoice>(
  {
    number: { type: String, required: true, unique: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    serviceRequestIds: [{ type: Schema.Types.ObjectId, ref: 'ServiceRequest' }],
    periodStart: { type: Date },
    periodEnd: { type: Date },
    amount: { type: Number, required: true },
    commissionBreakup: {
      grossAmount: { type: Number, required: true },
      commissionRate: { type: Number, required: true },
      commissionAmount: { type: Number, required: true },
      netPayable: { type: Number, required: true },
    },
    status: { type: String, enum: VENDOR_INVOICE_STATUSES, default: 'PENDING' },
  },
  { timestamps: true }
);

vendorInvoiceSchema.index({ vendorId: 1, status: 1 });

export const VendorInvoiceModel = model<IVendorInvoice>('VendorInvoice', vendorInvoiceSchema);

export const VENDOR_PAYOUT_STATUSES = ['PENDING', 'PROCESSING', 'PAID', 'FAILED'] as const;
export type VendorPayoutStatus = (typeof VENDOR_PAYOUT_STATUSES)[number];

export interface IVendorPayout extends Document {
  number: string;
  vendorId: Types.ObjectId;
  vendorInvoiceIds: Types.ObjectId[];
  amount: number;
  status: VendorPayoutStatus;
  paidAt?: Date;
  reference?: string;
  createdAt: Date;
  updatedAt: Date;
}

const vendorPayoutSchema = new Schema<IVendorPayout>(
  {
    number: { type: String, required: true, unique: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    vendorInvoiceIds: [{ type: Schema.Types.ObjectId, ref: 'VendorInvoice' }],
    amount: { type: Number, required: true },
    status: { type: String, enum: VENDOR_PAYOUT_STATUSES, default: 'PENDING' },
    paidAt: { type: Date },
    reference: { type: String },
  },
  { timestamps: true }
);

vendorPayoutSchema.index({ vendorId: 1, status: 1 });

export const VendorPayoutModel = model<IVendorPayout>('VendorPayout', vendorPayoutSchema);
