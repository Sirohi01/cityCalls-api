import { Schema, model, Document } from 'mongoose';
import { ROLES, Role } from '../users/users.types';

// Generic status-transition rules, seeded from docs/07-status-transition-matrix.md,
// shared by every entity with a status/stage field (Lead now, ServiceRequest/Estimate/
// Invoice from Phase 4-6 onward). Per docs/manish/06-workflow-engine-plan.md §1.
export const ENTITY_TYPES = ['LEAD', 'SERVICE_REQUEST', 'ESTIMATE', 'PROFORMA_INVOICE', 'INVOICE'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export interface IStatusTransition extends Document {
  entityType: EntityType;
  fromStatus: string;
  toStatus: string;
  allowedRoles: Role[];
}

const statusTransitionSchema = new Schema<IStatusTransition>({
  entityType: { type: String, enum: ENTITY_TYPES, required: true },
  fromStatus: { type: String, required: true },
  toStatus: { type: String, required: true },
  allowedRoles: { type: [String], enum: ROLES, default: [] },
});

statusTransitionSchema.index({ entityType: 1, fromStatus: 1, toStatus: 1 }, { unique: true });

export const StatusTransitionModel = model<IStatusTransition>('StatusTransition', statusTransitionSchema);
