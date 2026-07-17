import { Request, Response, NextFunction } from 'express';
import { ActivityLogModel } from './activityLog.model';

export async function listAuditLogsHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const logs = await ActivityLogModel.find()
      .populate('actor', 'firstName lastName')
      .sort({ timestamp: -1 })
      .limit(100);

    const formattedLogs = logs.map((log: any) => ({
      id: log._id.toString(),
      action: log.action,
      user: log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : 'System',
      module: log.module,
      target: log.targetId?.toString() || 'N/A',
      details: log.details || '',
      createdAt: log.timestamp.toISOString(),
    }));

    res.status(200).json({
      success: true,
      message: 'Audit logs retrieved',
      data: formattedLogs,
      meta: null,
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}
