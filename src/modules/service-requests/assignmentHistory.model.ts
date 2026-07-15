import { Schema, model, Document, Types } from 'mongoose';
import { ROLES, Role } from '../users/users.types';
import { ASSIGNEE_TYPES, AssigneeType } from './serviceRequests.model';

export const ASSIGNMENT_ACTIONS = ['ASSIGNED', 'REASSIGNED', 'ACCEPTED', 'REJECTED', 'ESCALATED'] as const;
export type AssignmentAction = (typeof ASSIGNMENT_ACTIONS)[number];

export const ASSIGNMENT_METHODS = ['MANUAL', 'RULE_ENGINE', 'BYPASS'] as const;
export type AssignmentMethod = (typeof ASSIGNMENT_METHODS)[number];

// docs/09-database-architecture.md §2 "assignment_history" — append-only,
// never overwritten, per docs/01-business-requirements-document.md §3.4.
export interface IAssignmentHistory extends Document {
  serviceRequestId: Types.ObjectId;
  fromAssigneeType?: AssigneeType;
  fromAssigneeId?: Types.ObjectId;
  toAssigneeType?: AssigneeType;
  toAssigneeId?: Types.ObjectId;
  action: AssignmentAction;
  reason?: string;
  actorId: Types.ObjectId;
  actorRole: Role;
  method: AssignmentMethod;
  timestamp: Date;
}

const assignmentHistorySchema = new Schema<IAssignmentHistory>({
  serviceRequestId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest', required: true },
  fromAssigneeType: { type: String, enum: ASSIGNEE_TYPES },
  fromAssigneeId: { type: Schema.Types.ObjectId },
  toAssigneeType: { type: String, enum: ASSIGNEE_TYPES },
  toAssigneeId: { type: Schema.Types.ObjectId },
  action: { type: String, enum: ASSIGNMENT_ACTIONS, required: true },
  reason: { type: String },
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  actorRole: { type: String, enum: ROLES, required: true },
  method: { type: String, enum: ASSIGNMENT_METHODS, required: true },
  timestamp: { type: Date, default: Date.now },
});

assignmentHistorySchema.index({ serviceRequestId: 1, timestamp: -1 });

export const AssignmentHistoryModel = model<IAssignmentHistory>('AssignmentHistory', assignmentHistorySchema);
