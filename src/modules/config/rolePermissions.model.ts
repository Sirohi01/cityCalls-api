import { Schema, model, Document } from 'mongoose';
import { ROLES, Role, DATA_SCOPES, DataScope } from '../users/users.types';

// One document per {role, module, action} — docs/09-database-architecture.md §"role_permissions"
// and docs/manish/03-database-model-implementation-plan.md §3.
export interface IRolePermission extends Document {
  role: Role;
  module: string;
  action: string;
  dataScope: DataScope;
}

const rolePermissionSchema = new Schema<IRolePermission>({
  role: { type: String, enum: ROLES, required: true },
  module: { type: String, required: true },
  action: { type: String, required: true },
  dataScope: { type: String, enum: DATA_SCOPES, required: true },
});

rolePermissionSchema.index({ role: 1, module: 1, action: 1 }, { unique: true });

export const RolePermissionModel = model<IRolePermission>('RolePermission', rolePermissionSchema);
