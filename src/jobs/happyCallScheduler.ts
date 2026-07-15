import { ServiceRequestModel } from '../modules/service-requests/serviceRequests.model';
import { scheduleHappyCall } from '../modules/follow-up/happyCalls.service';
import { HappyCallModel } from '../modules/follow-up/happyCalls.model';
import { ActivityLogModel } from '../modules/audit/activityLog.model';
import { emitServiceRequestStatusChanged } from '../realtime';
import { trigger } from '../lib/notifications';

// docs/manish/12-background-jobs-and-notifications.md: "happyCallScheduler |
// daily | Creates HappyCall tasks for eligible completed/paid requests."
//
// PAID -> FOLLOW_UP_PENDING -> HAPPY_CALL_PENDING are both seeded as
// role-gated transitions in status_transitions (for when a human explicitly
// drives them), but this scheduled job is the system-initiated path docs
// describe as "system (auto)" for these two specific steps — the one
// legitimate place a status write bypasses the RBAC-transition-check,
// same as how ServiceRequest/Call/Lead creation also bypasses it for their
// initial state. A synthetic 'SYSTEM' actor isn't added to the Role enum for
// this narrow, singular use — that would ripple into RolePermissionModel and
// every role-list across the codebase for one background job.
async function writeSystemStatusChange(srId: string, fromStatus: string, toStatus: string, reason: string): Promise<void> {
  await ServiceRequestModel.findByIdAndUpdate(srId, { status: toStatus });
  await ActivityLogModel.create({
    entityType: 'SERVICE_REQUEST',
    entityId: srId,
    // userId intentionally omitted — no human actor for a system-initiated
    // change (see IActivityLog.userId doc comment in activityLog.model.ts).
    userRole: 'SYSTEM',
    action: 'STATUS_CHANGED',
    module: 'service-requests',
    oldValue: { status: fromStatus },
    newValue: { status: toStatus },
    reason,
    sourceApp: 'happyCallScheduler',
  });
  emitServiceRequestStatusChanged(srId, { serviceRequestId: srId, fromStatus, toStatus });
}

export async function runHappyCallScheduler(): Promise<{ advancedToFollowUp: number; happyCallsCreated: number }> {
  // Advance PAID requests into the follow-up pipeline.
  const paidRequests = await ServiceRequestModel.find({ status: 'PAID' });
  for (const sr of paidRequests) {
    await writeSystemStatusChange(sr._id.toString(), 'PAID', 'FOLLOW_UP_PENDING', 'Automatic follow-up scheduling');
  }

  // Move follow-up-pending requests into happy-call-pending and create the task.
  const followUpRequests = await ServiceRequestModel.find({ status: 'FOLLOW_UP_PENDING' });
  let happyCallsCreated = 0;
  for (const sr of followUpRequests) {
    const existing = await HappyCallModel.findOne({ serviceRequestId: sr._id });
    if (existing) continue;

    // Default assignment: the technician who performed the work, per the
    // pragmatic default noted in docs/manish/16 Phase 7 planning — branch
    // managers can reassign via PATCH /happy-calls/:id/reassign.
    const assignedTo = sr.assigneeId?.toString();
    if (!assignedTo) continue; // nothing to assign to yet, skip until it has an assignee

    await scheduleHappyCall(sr._id.toString(), assignedTo);
    await writeSystemStatusChange(sr._id.toString(), 'FOLLOW_UP_PENDING', 'HAPPY_CALL_PENDING', 'Happy call task created');
    happyCallsCreated += 1;

    await trigger('HAPPY_CALL_DUE', {
      recipient: { userId: assignedTo },
      variables: { serviceRequestId: sr._id.toString() },
    });
  }

  if (paidRequests.length > 0 || happyCallsCreated > 0) {
    console.log(`[happyCallScheduler] advanced ${paidRequests.length} to follow-up, created ${happyCallsCreated} happy call(s)`);
  }

  return { advancedToFollowUp: paidRequests.length, happyCallsCreated };
}

export function startHappyCallSchedulerInterval(intervalMs = 60 * 60 * 1000): NodeJS.Timeout {
  const timer = setInterval(() => {
    runHappyCallScheduler().catch((err) => {
      console.error('[happyCallScheduler] failed', err);
    });
  }, intervalMs);
  timer.unref();
  return timer;
}
