import { ActivityLogModel } from '../modules/audit/activityLog.model';
import { AccessTokenPayload } from './jwt';

interface LogActivityInput {
  entityType: string;
  entityId: string;
  user: AccessTokenPayload;
  action: string;
  module: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  device?: string;
  sourceApp?: string;
  reason?: string;
}

// Single call site every module's sensitive actions go through — docs/17-security-and-audit.md §7,
// docs/manish/13-security-and-logging-plan.md §2.
export async function logActivity(input: LogActivityInput): Promise<void> {
  await ActivityLogModel.create({
    entityType: input.entityType,
    entityId: input.entityId,
    userId: input.user.sub,
    userRole: input.user.role,
    action: input.action,
    module: input.module,
    oldValue: input.oldValue,
    newValue: input.newValue,
    ipAddress: input.ipAddress,
    device: input.device,
    sourceApp: input.sourceApp,
    reason: input.reason,
  });
}
