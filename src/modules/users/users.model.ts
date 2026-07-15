import { Schema, model, Document, Types } from 'mongoose';
import { ROLES, Role, USER_STATUSES, UserStatus } from './users.types';

export interface IUser extends Document {
  name: string;
  email?: string;
  mobile: string;
  passwordHash: string;
  role: Role;
  status: UserStatus;
  branchId?: Types.ObjectId;
  subBranchId?: Types.ObjectId;
  teamId?: Types.ObjectId;
  vendorId?: Types.ObjectId;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    mobile: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    status: { type: String, enum: USER_STATUSES, default: 'ACTIVE' },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    subBranchId: { type: Schema.Types.ObjectId, ref: 'SubBranch' },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team' },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ branchId: 1 });

export const UserModel = model<IUser>('User', userSchema);
