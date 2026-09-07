import { loadLocalEnv } from './env.mjs';

loadLocalEnv();
const { app } = await import('./app.mjs');
const { db, dataDir } = await import('./db.mjs');

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
const server = app.listen(port, host, () => {
  console.log(`顺丰纠纷取证 MVP 已启动：http://${host}:${port}`);
  console.log(`数据库与原始证据目录：${dataDir}`);
});
function shutdown() {
  server.close(() => { db.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
