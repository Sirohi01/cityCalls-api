import { Schema, model, Document, Types } from 'mongoose';
import { ROLES, Role, DATA_SCOPES, DataScope } from '../users/users.types';

// One document per {role, module, action} — docs/09-database-architecture.md §"role_permissions"
// and docs/manish/03-database-model-implementation-plan.md §3.
export interface IRolePermission extends Document {
  role: Role;
  module: string;
  action: string;
  dataScope: DataScope;
  // Unset on rows created by the deployment seed script rather than through
  // the runtime editor — shown as "System (seed)" on the frontend, not backfilled.
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const rolePermissionSchema = new Schema<IRolePermission>(
  {
    role: { type: String, enum: ROLES, required: true },
    module: { type: String, required: true },
    action: { type: String, required: true },
    dataScope: { type: String, enum: DATA_SCOPES, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

rolePermissionSchema.index({ role: 1, module: 1, action: 1 }, { unique: true });

export const RolePermissionModel = model<IRolePermission>('RolePermission', rolePermissionSchema);
