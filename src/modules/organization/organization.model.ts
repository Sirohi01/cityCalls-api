import { Schema, model, Document, Types } from 'mongoose';

// Per docs/09-database-architecture.md §2 "branches / sub_branches / teams".
interface WorkingHours {
  day: number; // 0=Sunday .. 6=Saturday
  openTime: string; // "09:00"
  closeTime: string; // "18:00"
  closed: boolean;
}

export interface IBranch extends Document {
  name: string;
  code: string;
  coverage: { pinCodes: string[]; cities: string[]; states: string[] };
  serviceCategoryIds: Types.ObjectId[];
  workingHours: WorkingHours[];
  holidays: Date[];
  managerId?: Types.ObjectId;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const branchSchema = new Schema<IBranch>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    coverage: {
      pinCodes: { type: [String], default: [] },
      cities: { type: [String], default: [] },
      states: { type: [String], default: [] },
    },
    serviceCategoryIds: [{ type: Schema.Types.ObjectId, ref: 'Master' }],
    workingHours: [
      {
        day: { type: Number, min: 0, max: 6, required: true },
        openTime: { type: String },
        closeTime: { type: String },
        closed: { type: Boolean, default: false },
      },
    ],
    holidays: { type: [Date], default: [] },
    managerId: { type: Schema.Types.ObjectId, ref: 'User' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

branchSchema.index({ 'coverage.pinCodes': 1 });

export const BranchModel = model<IBranch>('Branch', branchSchema);

export interface ISubBranch extends Document {
  branchId: Types.ObjectId;
  name: string;
  code: string;
  coverage: { pinCodes: string[] };
  managerId?: Types.ObjectId;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const subBranchSchema = new Schema<ISubBranch>(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    coverage: { pinCodes: { type: [String], default: [] } },
    managerId: { type: Schema.Types.ObjectId, ref: 'User' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

subBranchSchema.index({ branchId: 1 });

export const SubBranchModel = model<ISubBranch>('SubBranch', subBranchSchema);

export interface ITeam extends Document {
  branchId: Types.ObjectId;
  subBranchId?: Types.ObjectId;
  name: string;
  leadId?: Types.ObjectId;
  memberIds: Types.ObjectId[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const teamSchema = new Schema<ITeam>(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    subBranchId: { type: Schema.Types.ObjectId, ref: 'SubBranch' },
    name: { type: String, required: true, trim: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'User' },
    memberIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

teamSchema.index({ branchId: 1 });

export const TeamModel = model<ITeam>('Team', teamSchema);
