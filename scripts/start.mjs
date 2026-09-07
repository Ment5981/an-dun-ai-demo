import { spawn } from 'node:child_process';

const nodeProxyFlag = Number(process.versions.node.split('.')[0]) >= 24 ? ['--use-env-proxy'] : [];
const child = spawn(process.execPath, [...nodeProxyFlag, 'server/index.mjs'], { stdio: 'inherit', env: process.env });
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
