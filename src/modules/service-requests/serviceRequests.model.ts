import { Schema, model, Document, Types } from 'mongoose';

export const ASSIGNEE_TYPES = ['BRANCH', 'SUB_BRANCH', 'TEAM', 'EMPLOYEE', 'VENDOR', 'OUTSOURCED_PARTNER'] as const;
export type AssigneeType = (typeof ASSIGNEE_TYPES)[number];

// Full status list per docs/07-status-transition-matrix.md §1.
export const SERVICE_REQUEST_STATUSES = [
  'NEW',
  'NEEDS_MANUAL_BRANCH_ASSIGNMENT',
  'ASSIGNED_TO_BRANCH',
  'ASSIGNED_TO_SUB_BRANCH',
  'ASSIGNED_TO_TEAM',
  'ASSIGNED_TO_EMPLOYEE',
  'ASSIGNED_TO_VENDOR',
  'OUTSOURCED',
  'REASSIGNMENT_REQUIRED',
  'ACCEPTED',
  'APPOINTMENT_SCHEDULED',
  'RESCHEDULED',
  'CUSTOMER_UNAVAILABLE',
  'TECHNICIAN_EN_ROUTE',
  'TECHNICIAN_ARRIVED',
  'INSPECTION_STARTED',
  'INSPECTION_COMPLETED',
  'ESTIMATE_PENDING',
  'ESTIMATE_SHARED',
  'AWAITING_CUSTOMER_APPROVAL',
  'ESTIMATE_APPROVED',
  'ESTIMATE_REJECTED',
  'PARTS_PENDING',
  'WORK_STARTED',
  'WORK_IN_PROGRESS',
  'ON_HOLD',
  'SERVICE_COMPLETED',
  'CUSTOMER_CONFIRMATION_PENDING',
  'PAYMENT_PENDING',
  'PARTIALLY_PAID',
  'PAID',
  'FOLLOW_UP_PENDING',
  'HAPPY_CALL_PENDING',
  'CLOSED',
  'REOPENED',
  'CANCELLED',
] as const;
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];

interface IAddressSnapshot {
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pinCode: string;
  country: string;
}

// docs/09-database-architecture.md §2 "service_requests".
export interface IServiceRequest extends Document {
  number: string;
  customerId: Types.ObjectId;
  customerProductId?: Types.ObjectId;
  addressSnapshot: IAddressSnapshot;
  serviceId: Types.ObjectId;
  branchId?: Types.ObjectId;
  subBranchId?: Types.ObjectId;
  assigneeType?: AssigneeType;
  assigneeId?: Types.ObjectId;
  status: ServiceRequestStatus;
  isEscalated: boolean;
  escalationReason?: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  source: string;
  relatedCallId?: Types.ObjectId;
  relatedLeadId?: Types.ObjectId;
  symptoms: string[];
  notes?: string;
  images: string[];
  scheduledDate?: Date;
  scheduledSlot?: string;
  isReopen: boolean;
  originalServiceRequestId?: Types.ObjectId;
  sla: { dueAt?: Date; breachedAt?: Date };
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  closedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
}

const serviceRequestSchema = new Schema<IServiceRequest>(
  {
    number: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerProductId: { type: Schema.Types.ObjectId, ref: 'CustomerProduct' },
    addressSnapshot: {
      line1: { type: String, required: true },
      line2: String,
      landmark: String,
      city: { type: String, required: true },
      state: { type: String, required: true },
      pinCode: { type: String, required: true },
      country: { type: String, default: 'India' },
    },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    subBranchId: { type: Schema.Types.ObjectId, ref: 'SubBranch' },
    assigneeType: { type: String, enum: ASSIGNEE_TYPES },
    assigneeId: { type: Schema.Types.ObjectId },
    status: { type: String, enum: SERVICE_REQUEST_STATUSES, default: 'NEW' },
    isEscalated: { type: Boolean, default: false },
    escalationReason: { type: String },
    priority: { type: String, enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'], default: 'NORMAL' },
    source: { type: String, required: true },
    relatedCallId: { type: Schema.Types.ObjectId, ref: 'Call' },
    relatedLeadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
    symptoms: { type: [String], default: [] },
    notes: { type: String },
    images: { type: [String], default: [] },
    scheduledDate: { type: Date },
    scheduledSlot: { type: String },
    isReopen: { type: Boolean, default: false },
    originalServiceRequestId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest' },
    sla: {
      dueAt: { type: Date },
      breachedAt: { type: Date },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    completedAt: { type: Date },
    closedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelReason: { type: String },
  },
  { timestamps: true }
);

serviceRequestSchema.index({ branchId: 1, status: 1 });
serviceRequestSchema.index({ assigneeType: 1, assigneeId: 1, status: 1 });
serviceRequestSchema.index({ customerId: 1 });
serviceRequestSchema.index({ isEscalated: 1, status: 1 });
serviceRequestSchema.index({ 'sla.dueAt': 1, 'sla.breachedAt': 1 });

export const ServiceRequestModel = model<IServiceRequest>('ServiceRequest', serviceRequestSchema);
