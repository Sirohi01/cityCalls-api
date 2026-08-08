import { processQueuedCampaignRecipients, queueDueScheduledCampaigns } from '../modules/marketing/campaigns.service';

let running = false;

export async function runCampaignSchedulerOnce(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await queueDueScheduledCampaigns();
    await processQueuedCampaignRecipients(25);
  } catch (error) {
    console.error('[campaign-scheduler] cycle failed', error);
  } finally {
    running = false;
  }
}

export function startCampaignSchedulerInterval(): NodeJS.Timeout {
  void runCampaignSchedulerOnce();
  const timer = setInterval(() => void runCampaignSchedulerOnce(), 10_000);
  timer.unref();
  return timer;
}
