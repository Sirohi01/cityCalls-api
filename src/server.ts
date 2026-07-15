import http from 'http';
import { createApp } from './app';
import { connectDb } from './lib/db';
import { loadPermissionCache } from './lib/permissionCache';
import { initRealtime } from './realtime';
import { env } from './config/env';

async function main(): Promise<void> {
  await connectDb();
  await loadPermissionCache();

  const app = createApp();
  const httpServer = http.createServer(app);
  initRealtime(httpServer);

  httpServer.listen(env.port, () => {
     
    console.log(`[server] citycalls-api listening on port ${env.port} (${env.nodeEnv})`);
  });
}

main().catch((err) => {
   
  console.error('[server] failed to start', err);
  process.exit(1);
});
