import http from 'http';
import { createApp } from './app';
import { connectDb } from './lib/db';
import { loadPermissionCache } from './lib/permissionCache';
import { loadStatusEngineCache } from './lib/statusEngine';
import { initRealtime } from './realtime';
import { startEscalationCheckInterval } from './jobs/escalationCheck';
import { startHappyCallSchedulerInterval } from './jobs/happyCallScheduler';
import { env } from './config/env';

async function main(): Promise<void> {
  await connectDb();
  await loadPermissionCache();
  await loadStatusEngineCache();

  const app = createApp();
  const httpServer = http.createServer(app);
  initRealtime(httpServer);
  startEscalationCheckInterval();
  startHappyCallSchedulerInterval();

  httpServer.listen(env.port, () => {
    console.log(`[server] citycalls-api listening on port ${env.port} (${env.nodeEnv})`);
  });
}

main().catch((err) => {
  console.error('[server] failed to start', err);
  process.exit(1);
});
