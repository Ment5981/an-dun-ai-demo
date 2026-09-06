import { spawn } from 'node:child_process';

const children = [
  spawn(process.execPath, ['server/index.mjs'], { stdio: 'inherit', env: { ...process.env, HOST: '127.0.0.1', PORT: process.env.API_PORT || '3001' } }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], { stdio: 'inherit', env: { ...process.env, VITE_API_PORT: process.env.API_PORT || '3001' } }),
];
let closing = false;
function close(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) if (!child.killed) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 400);
}
for (const child of children) child.on('exit', (code, signal) => { if (!closing && (code ?? 0) !== 0 && signal !== 'SIGTERM') close(code || 1); });
process.on('SIGINT', () => close(0));
process.on('SIGTERM', () => close(0));
