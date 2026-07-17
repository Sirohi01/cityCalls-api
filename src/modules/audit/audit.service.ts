import { ActivityLogModel } from './activityLog.model';
import { buildPaginationMeta } from '../../lib/apiResponse';

interface ListParams {
  page: number;
  limit: number;
  module?: string;
  entityType?: string;
}

// Read-only view over the append-only activity log every module already
// writes to via lib/auditLog.ts's logActivity() — this is the first
// dedicated list endpoint for it (previously only queried ad hoc per
// entity). No write path here; entries are never edited/deleted, per
// docs/17-security-and-audit.md §7.
export async function listAuditLogs(params: ListParams) {
  const filter: Record<string, unknown> = {};
  if (params.module) filter.module = params.module;
  if (params.entityType) filter.entityType = params.entityType;

  const skip = (params.page - 1) * params.limit;
  const [logs, total] = await Promise.all([
    ActivityLogModel.find(filter)
      .populate('userId', 'name')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(params.limit),
    ActivityLogModel.countDocuments(filter),
  ]);

  const items = logs.map((log) => {
    const user = log.userId as unknown as { name?: string } | undefined;
    return {
      id: log._id.toString(),
      action: log.action,
      user: user?.name ?? 'System',
      module: log.module,
      entityType: log.entityType,
      entityId: log.entityId.toString(),
      reason: log.reason,
      createdAt: log.timestamp.toISOString(),
    };
  });

  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}
