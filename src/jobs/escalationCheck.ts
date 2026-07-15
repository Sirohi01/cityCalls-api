import { ServiceRequestModel } from '../modules/service-requests/serviceRequests.model';
import { sendPlaceholderNotification } from '../lib/notificationStub';

// SLA-breach escalation check — docs/manish/06-workflow-engine-plan.md §4.
// Runs as a lightweight in-process periodic function rather than a full
// BullMQ/Redis queue, per the "simpler Mongo-backed queue if Redis is not
// desired" allowance in docs/08-system-architecture.md §6 — this environment
// has no Redis/Docker available, so the full job-queue infrastructure from
// docs/manish/12-background-jobs-and-notifications.md is deferred; this
// function is the seam a real queue would call on the same schedule.
const TERMINAL_STATUSES = ['CLOSED', 'CANCELLED', 'REOPENED'];

export async function runEscalationCheck(): Promise<{ breached: number }> {
  const now = new Date();

  const overdue = await ServiceRequestModel.find({
    'sla.dueAt': { $lt: now },
    'sla.breachedAt': { $exists: false },
    status: { $nin: TERMINAL_STATUSES },
  });

  for (const sr of overdue) {
    sr.isEscalated = true;
    sr.escalationReason = 'SLA_BREACHED';
    sr.sla.breachedAt = now;
    await sr.save();

    sendPlaceholderNotification({
      to: sr.branchId?.toString() ?? 'unassigned',
      purpose: 'SLA_BREACHED',
      payload: { serviceRequestId: sr._id.toString(), number: sr.number, dueAt: sr.sla.dueAt },
    });
  }

  if (overdue.length > 0) {
    console.log(`[escalationCheck] flagged ${overdue.length} SLA breach(es)`);
  }

  return { breached: overdue.length };
}

export function startEscalationCheckInterval(intervalMs = 15 * 60 * 1000): NodeJS.Timeout {
  const timer = setInterval(() => {
    runEscalationCheck().catch((err) => {
      console.error('[escalationCheck] failed', err);
    });
  }, intervalMs);
  timer.unref(); // don't keep the process alive just for this timer
  return timer;
}
