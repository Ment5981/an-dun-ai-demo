import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Load a small, dependency-free .env file for local demos.
 * Existing process variables always win, so hosting platforms can inject secrets safely.
 */
export function loadLocalEnv(root = resolve(process.cwd())) {
  const file = join(root, '.env');
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value.replace(/\\n/g, '\n');
  }
}
