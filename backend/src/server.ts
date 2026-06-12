import { createApp } from './app';
import { env } from './config/env';
import prisma from './config/prisma';
async function main() {
  await prisma.$connect();
  const server = createApp().listen(env.PORT, '0.0.0.0', () =>
    console.info(JSON.stringify({ event: 'server_started', port: env.PORT })));
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => { process.exit(1); }, 10_000);
    deadline.unref();
    server.close(() => { void prisma.$disconnect().then(() => { clearTimeout(deadline); process.exit(0); }); });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  server.on('error', error => { console.error(JSON.stringify({ event: 'server_error', type: error.name })); shutdown(); });
}
main().catch(async () => {
  console.error(JSON.stringify({ event: 'startup_failed', message: 'Check database connectivity and configuration' }));
  await prisma.$disconnect();
  process.exitCode = 1;
});
