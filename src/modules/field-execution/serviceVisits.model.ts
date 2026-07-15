import { Schema, model, Document, Types } from 'mongoose';

export const COMPLETION_PROOF_TYPES = ['OTP', 'SIGNATURE', 'APP_CONFIRMATION'] as const;
export type CompletionProofType = (typeof COMPLETION_PROOF_TYPES)[number];

interface IPart {
  partId?: Types.ObjectId;
  name: string;
  qty: number;
  unitPrice: number;
}

interface IInspection {
  defectFound?: string;
  symptoms: string[];
  solutionType?: string;
}

interface ICompletionProof {
  type: CompletionProofType;
  value?: string; // OTP code (hashed) — not stored in plaintext, see serviceVisits.service.ts
  url?: string; // signature/photo file URL
}

// docs/09-database-architecture.md §2 "service_visits" — a Service Request may
// span multiple visits (ON_HOLD/PARTS_PENDING re-entering WORK_IN_PROGRESS on a
// later day); each is its own document, not an array field on ServiceRequest.
export interface IServiceVisit extends Document {
  serviceRequestId: Types.ObjectId;
  visitNumber: number;
  technicianId: Types.ObjectId;
  startedAt?: Date;
  arrivedAt?: Date;
  inspection: IInspection;
  parts: IPart[];
  labourCharge?: number;
  beforeImages: string[];
  afterImages: string[];
  workNotes?: string;
  completedAt?: Date;
  completionProof?: ICompletionProof;
  nextVisitDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const serviceVisitSchema = new Schema<IServiceVisit>(
  {
    serviceRequestId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest', required: true },
    visitNumber: { type: Number, required: true },
    technicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    startedAt: { type: Date },
    arrivedAt: { type: Date },
    inspection: {
      defectFound: { type: String },
      symptoms: { type: [String], default: [] },
      solutionType: { type: String },
    },
    parts: [
      {
        partId: { type: Schema.Types.ObjectId, ref: 'Master' },
        name: { type: String, required: true },
        qty: { type: Number, required: true },
        unitPrice: { type: Number, required: true },
      },
    ],
    labourCharge: { type: Number },
    beforeImages: { type: [String], default: [] },
    afterImages: { type: [String], default: [] },
    workNotes: { type: String },
    completedAt: { type: Date },
    completionProof: {
      type: { type: String, enum: COMPLETION_PROOF_TYPES },
      value: { type: String },
      url: { type: String },
    },
    nextVisitDate: { type: Date },
  },
  { timestamps: true }
);

serviceVisitSchema.index({ serviceRequestId: 1, visitNumber: 1 }, { unique: true });
serviceVisitSchema.index({ technicianId: 1 });

export const ServiceVisitModel = model<IServiceVisit>('ServiceVisit', serviceVisitSchema);
