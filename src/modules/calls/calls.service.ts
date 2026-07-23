import { CallModel, CallType } from './calls.model';
import { NotFoundError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';
import { getNextNumber } from '../../lib/numbering';
import { applyScopeFilter } from '../../lib/scopeFilter';
import { DataScope } from '../users/users.types';
import { AccessTokenPayload } from '../../lib/jwt';

interface ListParams {
  page: number;
  limit: number;
  callType?: CallType;
  direction?: 'INCOMING' | 'OUTGOING';
  customerId?: string;
  createdBy?: string;
  q?: string;
}

export async function listCalls(params: ListParams, scope: DataScope, user: AccessTokenPayload) {
  let filter: Record<string, unknown> = {};
  if (params.callType) filter.callType = params.callType;
  if (params.direction) filter.direction = params.direction;
  if (params.customerId) filter.customerId = params.customerId;
  if (params.createdBy) filter.createdBy = params.createdBy;
  if (params.q) {
    filter.$or = [
      { number: { $regex: params.q, $options: 'i' } },
      { callerNumber: { $regex: params.q, $options: 'i' } },
      { customerName: { $regex: params.q, $options: 'i' } },
    ];
  }
  filter = applyScopeFilter(filter, scope, user);

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    CallModel.find(filter).skip(skip).limit(params.limit).sort({ callDate: -1 }),
    CallModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

export async function getCall(id: string) {
  const call = await CallModel.findById(id);
  if (!call) throw new NotFoundError('Call not found');
  return call;
}

export async function createCall(data: Record<string, unknown>, createdBy: string) {
  const number = await getNextNumber('CALL', data.branchId as string | undefined);
  return CallModel.create({ ...data, number, createdBy });
}

export async function updateCall(id: string, data: Record<string, unknown>) {
  const call = await CallModel.findById(id);
  if (!call) throw new NotFoundError('Call not found');

  if (data.details) {
    // Merge, don't overwrite — a follow-up update to a call's details shouldn't
    // silently drop fields captured in an earlier partial update.
    call.details = { ...call.details, ...(data.details as Record<string, unknown>) };
  }
  if (data.outcome !== undefined) call.outcome = data.outcome as string;
  if (data.notes !== undefined) call.notes = data.notes as string;
  if (data.assignedTo !== undefined) call.assignedTo = data.assignedTo as never;

  await call.save();
  return call;
}

// Chronological call history for a customer or a linked service request —
// backs the "Call detail/timeline" screen per docs/rohit/04-admin-page-list.md.
export async function getCallsForCustomer(customerId: string) {
  return CallModel.find({ customerId }).sort({ callDate: -1 });
}

export async function deleteCall(id: string) {
  const call = await CallModel.findByIdAndDelete(id);
  if (!call) throw new NotFoundError('Call not found');
}
