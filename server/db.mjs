import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

export const serverDir = dirname(fileURLToPath(import.meta.url));
export const projectDir = resolve(serverDir, '..');
export const dataDir = resolve(process.env.DATA_DIR || join(projectDir, 'data'));
export const uploadsDir = join(dataDir, 'evidence');
mkdirSync(uploadsDir, { recursive: true });
export const db = new DatabaseSync(join(dataDir, 'sf-disputes.sqlite'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
db.exec(readFileSync(join(serverDir, 'schema.sql'), 'utf8'));
export const uid = (prefix = '') => `${prefix}${randomUUID()}`;
export const now = () => new Date().toISOString();
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const run = (sql, ...args) => db.prepare(sql).run(...args);
export const one = (sql, ...args) => db.prepare(sql).get(...args);
export const all = (sql, ...args) => db.prepare(sql).all(...args);
export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function checkPassword(password, encoded) {
  const [salt, hash] = encoded.split(':');
  const test = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === test.length && timingSafeEqual(test, expected);
}
export function publicUser(user) {
  return { id: user.id, username: user.username, name: user.name, role: user.role, org: user.org };
}
export function audit(user, action, detail, caseId = null) {
  run('INSERT INTO AuditLog (id,caseId,userId,action,detail,org,createdAt) VALUES (?,?,?,?,?,?,?)',
    uid('log_'), caseId, user?.id || null, action, detail, user?.org || null, now());
}
export function knowledgeRows() {
  return all('SELECT * FROM Knowledge ORDER BY createdAt DESC').map(row => ({
    ...row, keywords: JSON.parse(row.keywords), isDemo: Boolean(row.isDemo),
  }));
}
