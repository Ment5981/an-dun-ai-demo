import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

export const serverDir = dirname(fileURLToPath(import.meta.url));
export const projectDir = resolve(serverDir, '..');
export const dataDir = resolve(process.env.DATA_DIR || join(projectDir, 'data'));
export const uploadsDir = join(dataDir, 'evidence');
export const knowledgeUploadsDir = join(dataDir, 'knowledge');
mkdirSync(uploadsDir, { recursive: true });
mkdirSync(knowledgeUploadsDir, { recursive: true });
export const db = new DatabaseSync(join(dataDir, 'sf-disputes.sqlite'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
db.exec(readFileSync(join(serverDir, 'schema.sql'), 'utf8'));

// The MVP is intentionally file backed, so a running local demo may already have
// an older SQLite file. Keep schema.sql as the source of truth for fresh databases
// and add the small set of workflow/RAG columns in place for existing demos.
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info("${table}")`).all();
  if (!columns.some(item => item.name === column)) db.exec(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
}
ensureColumn('Case', 'currentHandlerRole', "TEXT NOT NULL DEFAULT 'courier'");
ensureColumn('Case', 'currentHandlerId', 'TEXT REFERENCES User(id)');
ensureColumn('Case', 'handoffStatus', "TEXT NOT NULL DEFAULT 'self_handling'");
ensureColumn('Case', 'handoffNote', 'TEXT');
ensureColumn('Case', 'handoffAt', 'TEXT');
ensureColumn('Knowledge', 'reviewStatus', "TEXT NOT NULL DEFAULT '已审核'");
ensureColumn('Knowledge', 'attachmentName', "TEXT NOT NULL DEFAULT ''");
ensureColumn('Knowledge', 'storageName', 'TEXT');
ensureColumn('Knowledge', 'mimeType', "TEXT NOT NULL DEFAULT ''");
ensureColumn('Knowledge', 'size', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('Knowledge', 'sha256', "TEXT NOT NULL DEFAULT ''");
db.exec('UPDATE "Case" SET currentHandlerId=ownerId WHERE currentHandlerId IS NULL');
db.exec("UPDATE \"Case\" SET currentHandlerRole=(SELECT role FROM User WHERE User.id=\"Case\".ownerId) WHERE currentHandlerRole='courier'");
db.exec("UPDATE Knowledge SET reviewStatus='已审核' WHERE reviewStatus IS NULL OR reviewStatus=''");
db.exec('CREATE INDEX IF NOT EXISTS idx_knowledge_review ON Knowledge(reviewStatus,createdAt)');
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
export function knowledgeRows({ approvedOnly = false } = {}) {
  const sql = approvedOnly
    ? "SELECT k.*,u.name AS createdByName,u.role AS createdByRole FROM Knowledge k LEFT JOIN User u ON u.id=k.createdBy WHERE k.reviewStatus='已审核' ORDER BY k.createdAt DESC"
    : 'SELECT k.*,u.name AS createdByName,u.role AS createdByRole FROM Knowledge k LEFT JOIN User u ON u.id=k.createdBy ORDER BY k.createdAt DESC';
  return all(sql).map(row => ({
    ...row, keywords: JSON.parse(row.keywords), isDemo: Boolean(row.isDemo),
  }));
}
