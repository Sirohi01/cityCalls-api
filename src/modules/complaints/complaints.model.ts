import { Schema, model, Document, Types } from 'mongoose';
export const COMPLAINT_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export interface IComplaint extends Document {
  customerId: Types.ObjectId;
  serviceRequestId?: Types.ObjectId;
  subject: string;
  description: string;
  status: ComplaintStatus;
  response?: string;
  respondedBy?: Types.ObjectId;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const complaintSchema = new Schema<IComplaint>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    serviceRequestId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest' },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    status: { type: String, enum: COMPLAINT_STATUSES, default: 'OPEN' },
    response: { type: String },
    respondedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    respondedAt: { type: Date },
  },
  { timestamps: true }
);

complaintSchema.index({ customerId: 1, createdAt: -1 });
complaintSchema.index({ status: 1 });

export const ComplaintModel = model<IComplaint>('Complaint', complaintSchema);
