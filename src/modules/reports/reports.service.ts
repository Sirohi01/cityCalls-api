import { Types } from 'mongoose';
import { ServiceRequestModel } from '../service-requests/serviceRequests.model';
import { LeadModel } from '../leads/leads.model';
import { InvoiceModel } from '../finance/invoices.model';
import { CampaignModel } from '../marketing/campaigns.model';
import { DataScope } from '../users/users.types';
import { AccessTokenPayload } from '../../lib/jwt';
import { ValidationError } from '../../lib/errors';

export interface ReportParams {
  branchId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// Applies the same {scope, user} → query-filter shape as applyScopeFilter
// (lib/scopeFilter.ts), but as a Mongo $match stage prefix rather than a
// find() filter, since every report here is built on .aggregate(). A
// BRANCH-scoped caller is pinned to their own branch regardless of what
// branchId they passed in; an explicit branchId is honored only for ALL scope.
function branchMatch(scope: DataScope, user: AccessTokenPayload, params: ReportParams): Record<string, unknown> {
  if (scope === 'BRANCH') {
    return user.branchId ? { branchId: new Types.ObjectId(user.branchId) } : {};
  }
  if (params.branchId) {
    return { branchId: new Types.ObjectId(params.branchId) };
  }
  return {};
}

function dateRangeMatch(field: string, params: ReportParams): Record<string, unknown> {
  if (!params.dateFrom && !params.dateTo) return {};
  const range: Record<string, Date> = {};
  if (params.dateFrom) range.$gte = params.dateFrom;
  if (params.dateTo) range.$lte = params.dateTo;
  return { [field]: range };
}

// docs/04-modules-and-feature-list.md M19 names a broad report catalog with
// no per-report field/formula spec — this is the "core set" (the PRD's P1
// bucket), each backed by a real aggregation pipeline against the live
// operational collections rather than a pre-computed summary collection.
// docs/manish/05-module-wise-backend-plan.md's "Reports" section calls for
// nightly-refreshed pre-aggregated summary collections via a BullMQ job;
// that optimization is deferred here (no Redis/BullMQ in this environment,
// same documented-simplification pattern as escalationCheck.ts/
// happyCallScheduler.ts) — every report below is instead computed live,
// bounded by the same date-range/branch filters the UI would apply, so it
// stays correct and current at dev/pilot scale even without the cache.
export const REPORT_KEYS = [
  'service-request-summary',
  'branch-performance',
  'lead-funnel',
  'revenue-summary',
  'technician-performance',
  'campaign-performance',
] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

async function serviceRequestSummary(scope: DataScope, user: AccessTokenPayload, params: ReportParams) {
  const match = { ...branchMatch(scope, user, params), ...dateRangeMatch('createdAt', params) };
  const [byStatus, totals] = await Promise.all([
    ServiceRequestModel.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    ServiceRequestModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          slaBreached: { $sum: { $cond: [{ $ifNull: ['$sla.breachedAt', false] }, 1, 0] } },
          escalated: { $sum: { $cond: ['$isEscalated', 1, 0] } },
        },
      },
    ]),
  ]);
  return {
    byStatus: byStatus.map((r) => ({ status: r._id, count: r.count })),
    totals: totals[0] ?? { total: 0, slaBreached: 0, escalated: 0 },
  };
}

async function branchPerformance(scope: DataScope, user: AccessTokenPayload, params: ReportParams) {
  const srMatch = { ...branchMatch(scope, user, params), ...dateRangeMatch('createdAt', params) };
  const invoiceMatch = { ...branchMatch(scope, user, params), ...dateRangeMatch('createdAt', params) };

  const [srByBranch, revenueByBranch] = await Promise.all([
    ServiceRequestModel.aggregate([
      { $match: srMatch },
      {
        $group: {
          _id: '$branchId',
          totalServiceRequests: { $sum: 1 },
          closed: { $sum: { $cond: [{ $eq: ['$status', 'CLOSED'] }, 1, 0] } },
        },
      },
    ]),
    InvoiceModel.aggregate([
      { $match: invoiceMatch },
      { $group: { _id: '$branchId', revenue: { $sum: '$total' }, collected: { $sum: '$amountPaid' } } },
    ]),
  ]);

  const revenueByBranchId = new Map(revenueByBranch.map((r) => [String(r._id), r]));
  return srByBranch.map((r) => {
    const revenue = revenueByBranchId.get(String(r._id));
    return {
      branchId: r._id,
      totalServiceRequests: r.totalServiceRequests,
      closed: r.closed,
      completionRate: r.totalServiceRequests > 0 ? Number((r.closed / r.totalServiceRequests).toFixed(4)) : 0,
      revenue: revenue?.revenue ?? 0,
      collected: revenue?.collected ?? 0,
    };
  });
}

async function leadFunnel(scope: DataScope, user: AccessTokenPayload, params: ReportParams) {
  const match = { ...branchMatch(scope, user, params), ...dateRangeMatch('createdAt', params) };
  const byStage = await LeadModel.aggregate([{ $match: match }, { $group: { _id: '$stage', count: { $sum: 1 } } }]);
  const total = byStage.reduce((sum, r) => sum + r.count, 0);
  const converted = byStage.find((r) => r._id === 'CONVERTED')?.count ?? 0;
  return {
    byStage: byStage.map((r) => ({ stage: r._id, count: r.count })),
    total,
    conversionRate: total > 0 ? Number((converted / total).toFixed(4)) : 0,
  };
}

async function revenueSummary(scope: DataScope, user: AccessTokenPayload, params: ReportParams) {
  const match = { ...branchMatch(scope, user, params), ...dateRangeMatch('createdAt', params) };
  const [totals, byStatus] = await Promise.all([
    InvoiceModel.aggregate([
      { $match: match },
      { $group: { _id: null, invoiced: { $sum: '$total' }, collected: { $sum: '$amountPaid' } } },
    ]),
    InvoiceModel.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$total' } } }]),
  ]);
  const invoiced = totals[0]?.invoiced ?? 0;
  const collected = totals[0]?.collected ?? 0;
  return {
    invoiced,
    collected,
    outstanding: Number((invoiced - collected).toFixed(2)),
    byStatus: byStatus.map((r) => ({ status: r._id, count: r.count, total: r.total })),
  };
}

async function technicianPerformance(scope: DataScope, user: AccessTokenPayload, params: ReportParams) {
  const match = {
    ...branchMatch(scope, user, params),
    ...dateRangeMatch('createdAt', params),
    assigneeType: 'EMPLOYEE',
    assigneeId: { $exists: true },
  };
  const byAssignee = await ServiceRequestModel.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$assigneeId',
        assigned: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'CLOSED'] }, 1, 0] } },
      },
    },
    { $sort: { assigned: -1 } },
  ]);
  return byAssignee.map((r) => ({
    employeeId: r._id,
    assigned: r.assigned,
    completed: r.completed,
    completionRate: r.assigned > 0 ? Number((r.completed / r.assigned).toFixed(4)) : 0,
  }));
}

async function campaignPerformance(_scope: DataScope, _user: AccessTokenPayload, params: ReportParams) {
  const match = dateRangeMatch('createdAt', params);
  const campaigns = await CampaignModel.find(match).sort({ createdAt: -1 }).lean();
  return campaigns.map((c) => ({
    campaignId: c._id,
    name: c.name,
    channel: c.channel,
    status: c.status,
    stats: c.stats,
  }));
}

const REPORT_HANDLERS: Record<ReportKey, (scope: DataScope, user: AccessTokenPayload, params: ReportParams) => Promise<unknown>> = {
  'service-request-summary': serviceRequestSummary,
  'branch-performance': branchPerformance,
  'lead-funnel': leadFunnel,
  'revenue-summary': revenueSummary,
  'technician-performance': technicianPerformance,
  'campaign-performance': campaignPerformance,
};

export async function runReport(reportKey: string, scope: DataScope, user: AccessTokenPayload, params: ReportParams) {
  if (!(REPORT_KEYS as readonly string[]).includes(reportKey)) {
    throw new ValidationError([{ field: 'reportKey', code: 'INVALID', message: `Unknown report key: ${reportKey}` }]);
  }
  const handler = REPORT_HANDLERS[reportKey as ReportKey];
  return handler(scope, user, params);
}
