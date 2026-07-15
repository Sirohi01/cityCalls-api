import { Schema, model, Document, Types } from 'mongoose';

// docs/09-database-architecture.md §2 "employees".
export interface IAvailabilitySlot {
  day: number; // 0=Sunday .. 6=Saturday
  available: boolean;
}

export interface IEmployee extends Document {
  userId: Types.ObjectId;
  branchId: Types.ObjectId;
  subBranchId?: Types.ObjectId;
  teamId?: Types.ObjectId;
  skills: string[];
  certifications: string[];
  documents: { name: string; url: string }[];
  availability: IAvailabilitySlot[];
  dailyCapacity: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const employeeSchema = new Schema<IEmployee>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    subBranchId: { type: Schema.Types.ObjectId, ref: 'SubBranch' },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team' },
    skills: { type: [String], default: [] },
    certifications: { type: [String], default: [] },
    documents: [{ name: String, url: String }],
    availability: [
      {
        day: { type: Number, min: 0, max: 6 },
        available: { type: Boolean, default: true },
      },
    ],
    dailyCapacity: { type: Number, default: 5 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

employeeSchema.index({ branchId: 1 });
employeeSchema.index({ skills: 1 });

export const EmployeeModel = model<IEmployee>('Employee', employeeSchema);
