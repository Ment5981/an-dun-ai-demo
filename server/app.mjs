import express from 'express';
import multer from 'multer';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { all, one, run, uid, now, transaction, checkPassword, publicUser, sha256, uploadsDir, knowledgeUploadsDir, projectDir, audit, knowledgeRows } from './db.mjs';
import { caseScope, caseRow, caseDetail, listCases, evidenceRows, getAnalysis, saveAnalysis, addTask } from './cases.mjs';
import { retrieveKnowledge } from './ai.mjs';
import { buildDocument } from './documents.mjs';
import { seedDatabase } from './seed.mjs';

await seedDatabase();
export const app = express();
app.disable('x-powered-by');
app.set('etag', false);
app.use(express.json({ limit: '128kb' }));
app.use((req, res, next) => {
  req.body ||= {};
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  res.set('X-Frame-Options', 'DENY');
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.get('origin');
    const allowed = new Set((process.env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean));
    allowed.add(`${req.protocol}://${req.get('host')}`);
    if (process.env.NODE_ENV !== 'production') {
      allowed.add('http://localhost:5173'); allowed.add('http://127.0.0.1:5173');
    }
    if ((origin && !allowed.has(origin)) || req.get('sec-fetch-site') === 'cross-site') {
      return res.status(403).json({ error: '请求来源不受信任，请从系统页面操作。', code: 'CSRF_ORIGIN' });
    }
  }
  next();
});
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (status, message, code) => { const error = new Error(message); error.status = status; error.code = code; throw error; };
function string(value, field, max = 500, required = false) {
  if (value === undefined || value === null) { if (required) fail(400, `请填写${field}`); return ''; }
  if (typeof value !== 'string') fail(400, `${field}格式错误`);
  const result = value.trim();
  if (result.length > max || (required && !result)) fail(400, `${field}需为 ${required ? '1' : '0'}–${max} 字符`);
  return result;
}
function dateInput(value, field, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) fail(400, `${field}不是有效日期`);
  return new Date(value).toISOString();
}
function bool(value, field) {
  if (value === undefined || value === null) return false;
  if (typeof value !== 'boolean') fail(400, `${field}须为布尔值`);
  return value;
}
function requireUser(req, res, next) {
  let token = '';
  try { token = decodeURIComponent((req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('sf_session='))?.slice(11) || ''); } catch { /* Invalid cookie is unauthenticated. */ }
  if (!token || token.length > 256) return res.status(401).json({ error: '请先登录', code: 'UNAUTHENTICATED' });
  const user = one('SELECT u.*,s.tokenHash FROM Session s JOIN User u ON u.id=s.userId WHERE s.tokenHash=? AND s.expiresAt>?', sha256(token), now());
  if (!user) return res.status(401).json({ error: '登录已过期，请重新登录', code: 'UNAUTHENTICATED' });
  req.user = user; next();
}
function requireCase(req, id) {
  const item = caseRow(id);
  if (!item || (req.user.role === 'courier' && item.ownerId !== req.user.id) || (req.user.role === 'supervisor' && item.org !== req.user.org)) fail(404, '案件不存在或无权访问');
  return item;
}
function writable(item) { if (item.status === '已归档') fail(409, '案件已归档，不能修改。'); }
function requireRoles(req, roles) { if (!roles.includes(req.user.role)) fail(403, '当前身份没有此操作权限。', 'FORBIDDEN'); }
const locks = new Map();
async function withCaseLock(id, fn) {
  const previous = locks.get(id) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  locks.set(id, current);
  await previous;
  try { return await fn(); } finally { release(); if (locks.get(id) === current) locks.delete(id); }
}

app.get('/api/health', (req, res) => res.json({ ok: true, aiMode: process.env.AI_API_KEY ? 'llm-configured' : 'rules', database: 'sqlite', version: '1.0.0' }));
const loginAttempts = new Map();
app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const username = string(req.body.username, '用户名', 80, true);
  const password = string(req.body.password, '密码', 256, true);
  const role = string(req.body.role, '身份', 30, true);
  const key = `${req.ip}:${username}`;
  const bucket = loginAttempts.get(key);
  if (bucket && bucket.until > Date.now() && bucket.count >= 10) fail(429, '登录失败次数过多，请 10 分钟后重试。');
  const user = one('SELECT * FROM User WHERE username=?', username);
  if (!user || !checkPassword(password, user.passwordHash) || user.role !== role) {
    const active = bucket && bucket.until > Date.now() ? bucket : { count: 0, until: Date.now() + 600000 };
    active.count++; loginAttempts.set(key, active);
    if (loginAttempts.size > 10000) for (const [k, v] of loginAttempts) if (v.until < Date.now()) loginAttempts.delete(k);
    audit(user || null, '登录失败', '账号、密码或所选身份不匹配。');
    fail(401, '账号、密码或所选身份不匹配。');
  }
  loginAttempts.delete(key);
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 12 * 3600000).toISOString();
  transaction(() => {
    run('DELETE FROM Session WHERE expiresAt<?', now());
    run('INSERT INTO Session (tokenHash,userId,createdAt,expiresAt) VALUES (?,?,?,?)', sha256(token), user.id, now(), expiresAt);
    audit(user, '登录系统', `以${user.role === 'courier' ? '快递员' : user.role === 'supervisor' ? '主管' : '法务'}身份登录。`);
  });
  res.cookie('sf_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.SESSION_COOKIE_SECURE === 'true', maxAge: 12 * 3600000, path: '/' });
  res.json({ user: publicUser(user) });
}));
app.use('/api', requireUser);
app.get('/api/auth/me', (req, res) => res.json({ user: publicUser(req.user) }));
app.post('/api/auth/logout', (req, res) => {
  transaction(() => { run('DELETE FROM Session WHERE tokenHash=?', req.user.tokenHash); audit(req.user, '退出登录', '会话已注销。'); });
  res.clearCookie('sf_session', { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.SESSION_COOKIE_SECURE === 'true' });
  res.json({ ok: true });
});

app.get('/api/cases', (req, res) => res.json({ cases: listCases(req.user) }));
app.post('/api/cases', asyncRoute(async (req, res) => {
  const amount = req.body.amount === undefined ? 0 : Number(req.body.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000000 || typeof req.body.amount === 'boolean') fail(400, '争议金额须为 0 至 100000000 的有效数字');
  const timestamp = now();
  const item = {
    id: uid('case_'), title: string(req.body.title, '案件标题', 120, true),
    description: string(req.body.description, '案情描述', 20000, true),
    waybill: string(req.body.waybill, '运单号', 80, true),
    goods: string(req.body.goods, '物品名称', 200), amount,
    insured: bool(req.body.insured, '是否保价'), major: bool(req.body.major, '重大案件标记'), criminalRisk: bool(req.body.criminalRisk, '刑事风险标记'),
    ownerId: req.user.id, org: req.user.org, status: '取证中', escalated: false, clarificationAnswers: {},
    currentHandlerRole: req.user.role, currentHandlerId: req.user.id, handoffStatus: 'self_handling', handoffNote: null, handoffAt: null,
    incidentAt: dateInput(req.body.incidentAt, '事发时间', timestamp),
    monitorDeadline: dateInput(req.body.monitorDeadline, '监控覆盖时间'),
    insuranceDeadline: dateInput(req.body.insuranceDeadline, '保险报案期限'),
    proofDeadline: dateInput(req.body.proofDeadline, '举证期限'), createdAt: timestamp, updatedAt: timestamp,
  };
  if (Date.parse(item.incidentAt) > Date.now() + 300000) fail(400, '事发时间不能在未来');
  const analysis = await getAnalysis(item, []);
  transaction(() => {
    run('INSERT INTO "Case" (id,title,description,amount,goods,insured,major,criminalRisk,ownerId,org,incidentAt,monitorDeadline,insuranceDeadline,proofDeadline,currentHandlerRole,currentHandlerId,handoffStatus,handoffNote,handoffAt,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      item.id, item.title, item.description, item.amount, item.goods, +item.insured, +item.major, +item.criminalRisk, item.ownerId, item.org, item.incidentAt, item.monitorDeadline, item.insuranceDeadline, item.proofDeadline, item.currentHandlerRole, item.currentHandlerId, item.handoffStatus, item.handoffNote, item.handoffAt, timestamp, timestamp);
    run('INSERT INTO Waybill (id,caseId,number,goods,insured,createdAt) VALUES (?,?,?,?,?,?)', uid('wb_'), item.id, item.waybill, item.goods, +item.insured, timestamp);
    audit(req.user, '新建案件', `${item.title}；运单 ${item.waybill}；争议金额 ¥${amount.toFixed(2)}。`, item.id);
    saveAnalysis(item, analysis, req.user);
  });
  res.status(201).json({ case: caseDetail(item.id, req.user) });
}));
app.get('/api/cases/:id', (req, res) => { requireCase(req, req.params.id); res.json({ case: caseDetail(req.params.id, req.user) }); });
app.post('/api/cases/:id/analysis', asyncRoute(async (req, res) => withCaseLock(req.params.id, async () => {
  const item = requireCase(req, req.params.id); writable(item);
  const answers = req.body.answers;
  if (answers !== undefined) {
    if (!answers || Array.isArray(answers) || typeof answers !== 'object' || Object.keys(answers).length > 30) fail(400, '澄清答复格式错误');
    const clean = Object.fromEntries(Object.entries(answers).map(([key, value]) => [string(key, '问题编号', 80, true), string(value, '澄清答复', 2000)]));
    item.clarificationAnswers = { ...item.clarificationAnswers, ...clean };
  }
  const analysis = await getAnalysis(item);
  transaction(() => {
    run('UPDATE "Case" SET clarificationAnswers=? WHERE id=?', JSON.stringify(item.clarificationAnswers), item.id);
    if (answers) audit(req.user, '补充案情', `已保存 ${Object.keys(answers).length} 项澄清答复。`, item.id);
    saveAnalysis(item, analysis, req.user);
  });
  res.json({ case: caseDetail(item.id, req.user) });
})));

const evidenceCategories = new Set(['waybill', 'packaging', 'monitor', 'chat', 'value', 'delivery', 'tracking', 'identity', 'insurance', 'other']);
const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf', '.mp4', '.mov', '.webm', '.txt', '.md', '.csv', '.docx']);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024, files: 1, fields: 5, fieldSize: 2000 } });
const knowledgeUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 10, fieldSize: 50000 } });
function validateFile(file) {
  if (!file || !file.size) fail(400, '请选择非空证据文件');
  const extension = extname(file.originalname).toLowerCase();
  if (!allowedExtensions.has(extension)) fail(400, '支持 JPG、PNG、WEBP、GIF、PDF、MP4、MOV、WEBM、TXT、CSV、DOCX，单文件最多 40 MB');
  const b = file.buffer;
  const sig = b.subarray(0, 16);
  const signatures = {
    '.png': () => sig.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
    '.jpg': () => sig[0] === 255 && sig[1] === 216,
    '.jpeg': () => sig[0] === 255 && sig[1] === 216,
    '.webp': () => sig.toString('ascii', 0, 4) === 'RIFF' && sig.toString('ascii', 8, 12) === 'WEBP',
    '.gif': () => ['GIF87a','GIF89a'].includes(sig.toString('ascii', 0, 6)),
    '.pdf': () => sig.toString('ascii', 0, 5) === '%PDF-',
    '.mp4': () => sig.toString('ascii', 4, 8) === 'ftyp',
    '.mov': () => ['ftyp','moov','mdat','wide'].includes(sig.toString('ascii', 4, 8)),
    '.webm': () => sig.subarray(0, 4).equals(Buffer.from([26,69,223,163])),
    '.docx': () => sig[0] === 80 && sig[1] === 75,
    '.txt': () => !b.subarray(0, 8192).includes(0),
    '.md': () => !b.subarray(0, 8192).includes(0),
    '.csv': () => !b.subarray(0, 8192).includes(0),
  };
  if (!signatures[extension]()) fail(400, '文件内容与扩展名不匹配，请上传原始文件');
  const mimeTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  return { extension, mimeType: mimeTypes[extension] };
}
app.post('/api/cases/:id/evidence', (req, res, next) => { try { writable(requireCase(req, req.params.id)); next(); } catch (e) { next(e); } }, upload.single('file'), asyncRoute(async (req, res) => withCaseLock(req.params.id, async () => {
  const item = requireCase(req, req.params.id); writable(item);
  const { extension, mimeType } = validateFile(req.file);
  const category = string(req.body.category, '证据类别', 40, true);
  if (!evidenceCategories.has(category)) fail(400, '未知的证据类别');
  // Busboy decodes multipart filename bytes as Latin-1; recover UTF-8 when unambiguous.
  const candidateName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  const decodedName = !candidateName.includes('\uFFFD') && /^[\u0000-\u00ff]*$/.test(req.file.originalname) ? candidateName : req.file.originalname;
  const title = string(req.body.title, '证据标题', 200) || decodedName;
  const id = uid('ev_');
  const originalName = basename(decodedName.replaceAll('\\', '/')).slice(0, 240);
  const evidence = { id, caseId: item.id, title, category, originalName, storageName: `${id}${extension}`, mimeType, size: req.file.size, sha256: sha256(req.file.buffer), uploadedBy: req.user.id, status: '已具备', createdAt: now() };
  const analysis = await getAnalysis(item, [...evidenceRows(item.id), evidence]);
  const destination = join(uploadsDir, evidence.storageName);
  writeFileSync(destination, req.file.buffer, { flag: 'wx' });
  try {
    transaction(() => {
      run('INSERT INTO Evidence (id,caseId,title,category,originalName,storageName,mimeType,size,sha256,uploadedBy,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        id, item.id, title, category, originalName, evidence.storageName, mimeType, evidence.size, evidence.sha256, req.user.id, evidence.createdAt);
      audit(req.user, '上传证据', `${title}；${originalName}；${evidence.size} 字节；SHA-256 ${evidence.sha256}`, item.id);
      saveAnalysis(item, analysis, req.user);
    });
  } catch (error) { try { unlinkSync(destination); } catch { /* Preserve original transaction failure. */ } throw error; }
  res.status(201).json({ case: caseDetail(item.id, req.user) });
})));
app.get('/api/evidence/:id/download', (req, res) => {
  const item = one('SELECT * FROM Evidence WHERE id=?', req.params.id);
  if (!item) fail(404, '证据不存在或无权访问');
  requireCase(req, item.caseId);
  if (!existsSync(join(uploadsDir, item.storageName))) fail(404, '原始文件缺失，请联系管理员核查');
  audit(req.user, '下载证据', `下载 ${item.title}，SHA-256 ${item.sha256}`, item.caseId);
  res.set('Content-Type', item.mimeType); res.download(join(uploadsDir, item.storageName), item.originalName);
});
app.get('/api/evidence/:id/verify', (req, res) => {
  const item = one('SELECT * FROM Evidence WHERE id=?', req.params.id);
  if (!item) fail(404, '证据不存在或无权访问');
  requireCase(req, item.caseId);
  const filename = join(uploadsDir, item.storageName);
  const actualSha256 = existsSync(filename) ? sha256(readFileSync(filename)) : null;
  const valid = actualSha256 === item.sha256;
  audit(req.user, '校验证据', `${item.title}：${valid ? '校验一致' : '文件缺失或摘要不一致，请人工核查'}`, item.caseId);
  res.json({ id: item.id, sha256: item.sha256, actualSha256, valid, verifiedAt: now() });
});

function findHandler(role, org = null) {
  if (role === 'legal') return one('SELECT * FROM User WHERE role=? ORDER BY id LIMIT 1', role);
  return one('SELECT * FROM User WHERE role=? AND org=? ORDER BY id LIMIT 1', role, org);
}
function completePendingTasks(caseId, kind, note) {
  run('UPDATE Task SET status=?,completedAt=?,completionNote=? WHERE caseId=? AND kind=? AND status=?', '已完成', now(), note || null, caseId, kind, '待处理');
}
function pendingTask(caseId, kind) {
  return one('SELECT id FROM Task WHERE caseId=? AND kind=? AND status=? LIMIT 1', caseId, kind, '待处理');
}

// Cases normally stay with the person who opened them. These explicit handoff
// actions keep the courier → supervisor → legal chain auditable while preserving
// the original business stage (取证中/协商中/赔偿审批/法务处理中).
async function handleHandoff(item, req, action, note) {
  const timestamp = now();
  const requireNote = () => { if (note.length < 4) fail(400, '请填写至少 4 个字的交接说明，便于后续复核。'); };
  if (action === 'handoff_supervisor') {
    requireRoles(req, ['courier']); requireNote();
    if (item.currentHandlerRole && !['courier'].includes(item.currentHandlerRole) && item.handoffStatus !== 'returned_to_courier') fail(409, '本案当前不在快递员处理环节。');
    const supervisor = findHandler('supervisor', item.org);
    if (!supervisor) fail(409, '当前网点暂无可接收的主管账号。');
    transaction(() => {
      completePendingTasks(item.id, 'supervisor_review', note);
      addTask(item, { title: `主管复核：${note}`, kind: 'supervisor_review', priority: item.risk === '高' ? 'P0' : 'P1', dueAt: new Date(Date.now() + 24 * 3600000).toISOString(), assignedTo: supervisor.id });
      run('UPDATE "Case" SET currentHandlerRole=?,currentHandlerId=?,handoffStatus=?,handoffNote=?,handoffAt=?,updatedAt=? WHERE id=?', 'supervisor', supervisor.id, 'awaiting_supervisor', note, timestamp, timestamp, item.id);
      audit(req.user, '转交主管', `快递员申请主管复核：${note}`, item.id);
    });
  } else if (action === 'accept_supervisor') {
    requireRoles(req, ['supervisor']);
    transaction(() => {
      completePendingTasks(item.id, 'supervisor_review', note || '主管已接收案件并开始复核。');
      run('UPDATE "Case" SET currentHandlerRole=?,currentHandlerId=?,handoffStatus=?,handoffNote=?,handoffAt=?,updatedAt=? WHERE id=?', 'supervisor', req.user.id, 'supervisor_handling', note || '主管已接收案件并开始复核。', timestamp, timestamp, item.id);
      audit(req.user, '主管接收案件', note || '主管已接收案件并开始复核。', item.id);
    });
  } else if (action === 'return_courier') {
    requireRoles(req, ['supervisor']); requireNote();
    const courier = one('SELECT * FROM User WHERE id=? AND role=?', item.ownerId, 'courier');
    if (!courier) fail(409, '原经办快递员账号不存在，无法退回。');
    transaction(() => {
      completePendingTasks(item.id, 'supervisor_review', note);
      addTask(item, { title: `快递员补充：${note}`, kind: 'courier_action', priority: 'P1', dueAt: new Date(Date.now() + 24 * 3600000).toISOString(), assignedTo: courier.id });
      run('UPDATE "Case" SET status=?,currentHandlerRole=?,currentHandlerId=?,handoffStatus=?,handoffNote=?,handoffAt=?,updatedAt=? WHERE id=?', '待补证', 'courier', courier.id, 'returned_to_courier', note, timestamp, timestamp, item.id);
      audit(req.user, '退回快递员补证', `主管退回原经办补充：${note}`, item.id);
    });
  } else if (action === 'request_legal') {
    requireRoles(req, ['supervisor']); requireNote();
    const legal = findHandler('legal');
    if (!legal) fail(409, '当前系统暂无可接收的法务账号。');
    transaction(() => {
      completePendingTasks(item.id, 'supervisor_review', note);
      run('UPDATE "Case" SET escalated=1,status=?,legalReviewedAt=NULL,currentHandlerRole=?,currentHandlerId=?,handoffStatus=?,handoffNote=?,handoffAt=?,updatedAt=? WHERE id=?', '法务处理中', 'legal', legal.id, 'awaiting_legal', note, timestamp, timestamp, item.id);
      if (!pendingTask(item.id, 'legal_review')) addTask(item, { title: `法务接收：${note}`, kind: 'legal_review', priority: 'P0', dueAt: new Date(Date.now() + 4 * 3600000).toISOString(), assignedTo: legal.id });
      audit(req.user, '申请法务接收', `主管申请法务介入：${note}`, item.id);
    });
  } else if (action === 'accept_legal') {
    requireRoles(req, ['legal']);
    transaction(() => {
      const task = one('SELECT id FROM Task WHERE caseId=? AND kind=? AND status=? LIMIT 1', item.id, 'legal_review', '待处理');
      if (task) run('UPDATE Task SET assignedTo=? WHERE id=?', req.user.id, task.id);
      else addTask(item, { title: '人工法务审核', kind: 'legal_review', priority: 'P0', dueAt: new Date(Date.now() + 4 * 3600000).toISOString(), assignedTo: req.user.id });
      run('UPDATE "Case" SET status=?,currentHandlerRole=?,currentHandlerId=?,handoffStatus=?,handoffNote=?,handoffAt=?,updatedAt=? WHERE id=?', '法务处理中', 'legal', req.user.id, 'legal_handling', note || '法务已接收案件并开始审核。', timestamp, timestamp, item.id);
      audit(req.user, '法务接收案件', note || '法务已接收案件并开始审核。', item.id);
    });
  } else if (action === 'return_supervisor') {
    requireRoles(req, ['legal']); requireNote();
    const supervisor = findHandler('supervisor', item.org);
    if (!supervisor) fail(409, '原网点暂无可接收的主管账号，无法退回。');
    transaction(() => {
      completePendingTasks(item.id, 'legal_review', note);
      addTask(item, { title: `主管继续处置：${note}`, kind: 'supervisor_action', priority: 'P1', dueAt: new Date(Date.now() + 48 * 3600000).toISOString(), assignedTo: supervisor.id });
      run('UPDATE "Case" SET status=?,legalReviewedAt=?,currentHandlerRole=?,currentHandlerId=?,handoffStatus=?,handoffNote=?,handoffAt=?,updatedAt=? WHERE id=?', item.status === '法务处理中' ? '待补证' : item.status, timestamp, 'supervisor', supervisor.id, 'returned_to_supervisor', note, timestamp, timestamp, item.id);
      audit(req.user, '退回主管继续处置', `法务给出意见并退回主管：${note}`, item.id);
    });
  } else if (action === 'legal_approve') {
    requireRoles(req, ['legal']); requireNote();
    const supervisor = findHandler('supervisor', item.org);
    transaction(() => {
      completePendingTasks(item.id, 'legal_review', note);
      if (supervisor) addTask(item, { title: '法务审核完成，请推进协商或赔偿审批', kind: 'supervisor_action', priority: 'P1', dueAt: new Date(Date.now() + 48 * 3600000).toISOString(), assignedTo: supervisor.id });
      run('UPDATE "Case" SET status=?,legalReviewedAt=?,currentHandlerRole=?,currentHandlerId=?,handoffStatus=?,handoffNote=?,handoffAt=?,updatedAt=? WHERE id=?', '协商中', timestamp, supervisor ? 'supervisor' : 'legal', supervisor?.id || req.user.id, 'legal_resolved', note, timestamp, timestamp, item.id);
      audit(req.user, '法务审核完成', `法务给出处置意见：${note}`, item.id);
    });
  }
  return caseDetail(item.id, req.user);
}

app.post('/api/cases/:id/transition', asyncRoute(async (req, res) => withCaseLock(req.params.id, async () => {
  const item = requireCase(req, req.params.id); writable(item);
  const action = string(req.body.action, '操作', 30, true);
  const note = string(req.body.note, '处理说明', 3000);
  const handoffActions = new Set(['handoff_supervisor', 'accept_supervisor', 'return_courier', 'request_legal', 'accept_legal', 'return_supervisor', 'legal_approve']);
  if (handoffActions.has(action)) {
    const result = await handleHandoff(item, req, action, note);
    return res.json({ case: result });
  }
  const statuses = { supplement: '待补证', negotiate: '协商中', compensate: '赔偿审批', escalate: '法务处理中', archive: '已归档' };
  if (!statuses[action]) fail(400, '不支持的案件操作');
  if (action === 'escalate') requireRoles(req, ['supervisor', 'legal']);
  if (['compensate', 'archive'].includes(action)) requireRoles(req, ['supervisor', 'legal']);
  if (['compensate', 'escalate', 'archive'].includes(action) && note.length < 4) fail(400, '请填写至少 4 个字的处理说明，便于审计追溯');
  if (item.escalated && !item.legalReviewedAt && action !== 'escalate' && req.user.role !== 'legal') fail(403, '本案已升级法务，须经人工法务审核后才能变更处置阶段。');
  if (item.escalated && !item.legalReviewedAt && action !== 'escalate' && note.length < 4) fail(400, '请法务填写审核结论后变更处置阶段');
  if (action === 'compensate' && !['协商中', '法务处理中', '赔偿审批'].includes(item.status)) fail(409, '请先进入协商阶段，再发起赔偿审批');
  if (action === 'negotiate' && !one('SELECT id FROM Evidence WHERE caseId=? LIMIT 1', item.id)) fail(409, '请至少固定一项证据后再进入协商阶段');
  if (action === 'archive') {
    if (!['协商中', '赔偿审批', '法务处理中'].includes(item.status)) fail(409, '请完成协商或法务处置后归档');
    const pending = one('SELECT COUNT(*) AS count FROM Task WHERE caseId=? AND status=?', item.id, '待处理').count;
    if (pending) fail(409, `仍有 ${pending} 项待办未完成，请完成固证、期限与人工审核任务后再归档。`);
  }
  transaction(() => {
    if (action === 'escalate') {
      const legal = one('SELECT id FROM User WHERE role=? ORDER BY id LIMIT 1', 'legal');
      run('UPDATE "Case" SET escalated=1,status=?,currentHandlerRole=?,currentHandlerId=?,handoffStatus=?,handoffNote=?,handoffAt=?,updatedAt=? WHERE id=?', statuses[action], 'legal', legal?.id || null, 'awaiting_legal', note || '案件已申请人工法务审核。', now(), now(), item.id);
      if (!one('SELECT id FROM Task WHERE caseId=? AND kind=? AND status=?', item.id, 'legal_review', '待处理')) {
        if (!legal) fail(409, '当前系统暂无可接收的法务账号。');
        addTask(item, { title: '人工法务审核：' + note, kind: 'legal_review', priority: 'P0', dueAt: new Date(Date.now() + 4 * 3600000).toISOString(), assignedTo: legal.id });
        run('UPDATE "Case" SET legalReviewedAt=NULL WHERE id=?', item.id);
      }
    } else {
      if (item.escalated && !item.legalReviewedAt && req.user.role === 'legal') {
        run('UPDATE "Case" SET legalReviewedAt=? WHERE id=?', now(), item.id);
        run('UPDATE Task SET status=?,completedAt=?,completionNote=? WHERE caseId=? AND kind=? AND status=?', '已完成', now(), note, item.id, 'legal_review', '待处理');
        audit(req.user, '人工法务审核', note, item.id);
      }
      run('UPDATE "Case" SET status=?,updatedAt=? WHERE id=?', statuses[action], now(), item.id);
    }
    audit(req.user, '阶段变更', `${item.status} → ${statuses[action]}${note ? '；' + note : ''}${action === 'compensate' ? '。本操作仅进入审批，不执行付款。' : ''}`, item.id);
  });
  res.json({ case: caseDetail(item.id, req.user) });
})));

app.get('/api/tasks', (req, res) => {
  const scope = caseScope(req.user);
  const tasks = all(`SELECT t.*,c.title AS caseTitle,u.name AS assignedToName FROM Task t JOIN "Case" c ON c.id=t.caseId JOIN User u ON u.id=t.assignedTo WHERE ${scope.sql} ORDER BY CASE t.status WHEN '待处理' THEN 0 ELSE 1 END,t.dueAt IS NULL,t.dueAt`, ...scope.args);
  res.json({ tasks });
});
app.patch('/api/tasks/:id', asyncRoute(async (req, res) => {
  const task = one('SELECT * FROM Task WHERE id=?', req.params.id);
  if (!task) fail(404, '待办不存在或无权访问');
  return withCaseLock(task.caseId, async () => {
    const item = requireCase(req, task.caseId); writable(item);
    const status = string(req.body.status, '待办状态', 10, true);
    const note = string(req.body.note, '完成说明', 3000);
    if (!['待处理', '已完成'].includes(status)) fail(400, '不支持的待办状态');
    if (task.kind === 'legal_review') requireRoles(req, ['legal']);
    if (['supervisor_review', 'supervisor_action'].includes(task.kind)) {
      requireRoles(req, ['supervisor']);
      if (task.assignedTo !== req.user.id) fail(403, '该主管待办已分配给其他主管。');
    }
    if (task.kind === 'courier_action') {
      requireRoles(req, ['courier']);
      if (task.assignedTo !== req.user.id) fail(403, '该待办已分配给原经办快递员。');
    }
    if (status === '已完成' && (task.kind === 'evidence' || task.evidenceKey === 'monitor') && !one('SELECT id FROM Evidence WHERE caseId=? AND category=? LIMIT 1', item.id, task.evidenceKey)) fail(409, '该待办关联固证清单，请先上传对应证据');
    if (status === '已完成' && task.kind === 'legal_review' && note.length < 4) fail(400, '请填写至少 4 个字的法务审核意见');
    transaction(() => {
      run('UPDATE Task SET status=?,completedAt=?,completionNote=? WHERE id=?', status, status === '已完成' ? now() : null, note || null, task.id);
      run('UPDATE "Case" SET updatedAt=? WHERE id=?', now(), item.id);
      if (task.kind === 'legal_review') run('UPDATE "Case" SET legalReviewedAt=? WHERE id=?', status === '已完成' ? now() : null, item.id);
      audit(req.user, task.kind === 'legal_review' ? '人工法务审核' : '更新待办', `${task.title} → ${status}${note ? '；' + note : ''}`, item.id);
    });
    res.json({ task: one('SELECT t.*,c.title AS caseTitle FROM Task t JOIN "Case" c ON c.id=t.caseId WHERE t.id=?', task.id) });
  });
}));

app.post('/api/cases/:id/documents', asyncRoute(async (req, res) => withCaseLock(req.params.id, async () => {
  const item = requireCase(req, req.params.id); writable(item);
  const type = string(req.body.type, '文书类型', 40, true);
  if (!['情况说明', '证据目录', '监控调取函', '答辩材料'].includes(type)) fail(400, '不支持的文书类型');
  if (type === '答辩材料') requireRoles(req, ['legal']);
  const id = uid('doc_');
  const content = buildDocument(type, caseDetail(item.id), req.user);
  transaction(() => {
    run('INSERT INTO LegalDocument (id,caseId,type,title,content,createdBy,createdAt) VALUES (?,?,?,?,?,?,?)', id, item.id, type, `${item.title}—${type}（草稿）`, content, req.user.id, now());
    audit(req.user, '生成文书草稿', `${type}，仅含已录入事实与已上传证据，待人工审核。`, item.id);
    run('UPDATE "Case" SET updatedAt=? WHERE id=?', now(), item.id);
  });
  res.status(201).json({ case: caseDetail(item.id, req.user) });
})));
app.get('/api/documents/:id/download', (req, res) => {
  const item = one('SELECT * FROM LegalDocument WHERE id=?', req.params.id);
  if (!item) fail(404, '文书不存在或无权访问');
  requireCase(req, item.caseId);
  if (item.type === '答辩材料') requireRoles(req, ['legal']);
  audit(req.user, '下载文书', `${item.title}（待人工审核）`, item.caseId);
  res.attachment(`${item.title}.txt`); res.type('text/plain; charset=utf-8'); res.send('\uFEFF' + item.content);
});
app.get('/api/knowledge', (req, res) => {
  const q = string(req.query.q, '检索词', 500);
  const type = string(req.query.type, '知识类型', 80);
  let items = knowledgeRows();
  if (type && type !== '全部') items = items.filter(x => x.type === type);
  if (q) items = retrieveKnowledge(q, items, 30);
  res.json({ items });
});
app.post('/api/knowledge', (req, res) => {
  const type = string(req.body.type, '知识类型', 80, true);
  // 业务角色可提交自己的经验案例；法规、行业规则、SOP 和模板仍由法务维护。
  if (type !== '历史案例') requireRoles(req, ['legal']);
  const item = { id: uid('know_'), title: string(req.body.title, '知识标题', 240, true), type, content: string(req.body.content, '知识正文', 50000, true), sourceUrl: string(req.body.sourceUrl, '来源链接', 2000), version: string(req.body.version, '版本信息', 160) || (type === '历史案例' ? '用户投稿' : ''), createdAt: now() };
  if (!['法律法规', '行业规则', '内部SOP', '历史案例', '文书模板'].includes(item.type)) fail(400, '请选择有效知识类型');
  if (!item.version) fail(400, '请填写版本信息');
  if (['法律法规', '行业规则'].includes(item.type) && !item.sourceUrl) fail(400, '法律法规与行业规则必须提供可追溯的原始来源链接');
  if (item.sourceUrl) {
    let url; try { url = new URL(item.sourceUrl); } catch { fail(400, '来源链接格式错误'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail(400, '来源须为不含账号凭据的 HTTP/HTTPS 链接');
  }
  const reviewStatus = type === '历史案例' && req.user.role !== 'legal' ? '待法务审核' : '已审核';
  transaction(() => {
    run('INSERT INTO Knowledge (id,title,type,content,sourceUrl,version,createdBy,reviewStatus,createdAt) VALUES (?,?,?,?,?,?,?,?,?)', item.id, item.title, item.type, item.content, item.sourceUrl, item.version, req.user.id, reviewStatus, item.createdAt);
    audit(req.user, type === '历史案例' && req.user.role !== 'legal' ? '提交经验案例' : '新增知识', `${item.title}；类型 ${item.type}；版本 ${item.version}；状态 ${reviewStatus}。${item.sourceUrl ? '已登记来源链接。' : '未提供外部来源，需结合案卷核验。'}`);
  });
  res.status(201).json({ item: { ...item, keywords: [], isDemo: false, verifiedAt: reviewStatus === '已审核' ? item.createdAt : null, reviewStatus, createdBy: req.user.id, createdByName: req.user.name, createdByRole: req.user.role } });
});
app.post('/api/knowledge/upload', knowledgeUpload.single('file'), asyncRoute(async (req, res) => {
  const type = string(req.body.type, '知识类型', 80, true);
  if (type !== '历史案例') requireRoles(req, ['legal']);
  if (!req.file || !req.file.size) fail(400, '请选择经验案例原文件');
  const { extension, mimeType } = validateFile(req.file);
  const title = string(req.body.title, '知识标题', 240, true);
  let content = string(req.body.content, '知识正文', 50000);
  const sourceUrl = string(req.body.sourceUrl, '来源链接', 2000);
  const version = string(req.body.version, '版本信息', 160) || (type === '历史案例' ? '用户投稿' : '待核验版本');
  if (!['法律法规', '行业规则', '内部SOP', '历史案例', '文书模板'].includes(type)) fail(400, '请选择有效知识类型');
  if (['法律法规', '行业规则'].includes(type) && !sourceUrl) fail(400, '法律法规与行业规则必须提供可追溯的原始来源链接');
  if (sourceUrl) { let url; try { url = new URL(sourceUrl); } catch { fail(400, '来源链接格式错误'); } if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail(400, '来源须为不含账号凭据的 HTTP/HTTPS 链接'); }
  if (!content && ['text/plain', 'text/csv', 'text/markdown'].includes(mimeType)) content = req.file.buffer.toString('utf8').slice(0, 50000);
  if (!content) content = `已上传原始附件：${req.file.originalname}。正文需在法务审核时结合原件核验。`;
  const id = uid('know_'); const createdAt = now(); const reviewStatus = type === '历史案例' && req.user.role !== 'legal' ? '待法务审核' : '已审核';
  const storageName = `${id}${extension}`; const destination = join(knowledgeUploadsDir, storageName);
  writeFileSync(destination, req.file.buffer, { flag: 'wx' });
  try {
    transaction(() => {
      run('INSERT INTO Knowledge (id,title,type,content,sourceUrl,version,createdBy,reviewStatus,attachmentName,storageName,mimeType,size,sha256,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', id, title, type, content, sourceUrl, version, req.user.id, reviewStatus, req.file.originalname.slice(0, 240), storageName, mimeType, req.file.size, sha256(req.file.buffer), createdAt);
      audit(req.user, type === '历史案例' && req.user.role !== 'legal' ? '提交经验案例附件' : '新增知识附件', `${title}；原文件 ${req.file.originalname}；SHA-256 ${sha256(req.file.buffer)}；状态 ${reviewStatus}。`);
    });
  } catch (error) { try { unlinkSync(destination); } catch { /* preserve original failure */ } throw error; }
  const item = knowledgeRows().find(row => row.id === id);
  res.status(201).json({ item });
}));
app.get('/api/knowledge/:id/download', (req, res) => {
  const item = one('SELECT * FROM Knowledge WHERE id=?', req.params.id);
  if (!item || !item.storageName || !/^[A-Za-z0-9_-]+\.[a-z0-9]+$/.test(item.storageName)) fail(404, '知识附件不存在或无权访问');
  const filename = join(knowledgeUploadsDir, item.storageName);
  if (!existsSync(filename)) fail(404, '知识附件原文件缺失，请联系管理员核查');
  audit(req.user, '下载知识附件', `${item.title}；SHA-256 ${item.sha256 || '未记录'}`);
  res.set('Content-Type', item.mimeType || 'application/octet-stream'); res.download(filename, item.attachmentName || `${item.title}.bin`);
});
app.patch('/api/knowledge/:id/review', (req, res) => {
  requireRoles(req, ['legal']);
  const item = one('SELECT * FROM Knowledge WHERE id=?', req.params.id);
  if (!item) fail(404, '知识条目不存在');
  const status = string(req.body.status, '审核状态', 20, true);
  const note = string(req.body.note, '审核意见', 3000, true);
  if (!['已审核', '已退回'].includes(status)) fail(400, '审核状态只能是已审核或已退回');
  transaction(() => {
    run('UPDATE Knowledge SET reviewStatus=?,verifiedAt=? WHERE id=?', status, status === '已审核' ? now() : null, item.id);
    audit(req.user, status === '已审核' ? '审核通过经验案例' : '退回经验案例', `${item.title}；审核意见：${note}`, null);
  });
  const updated = knowledgeRows().find(row => row.id === item.id);
  res.json({ item: updated });
});
app.get('/api/audit', (req, res) => {
  requireRoles(req, ['supervisor', 'legal']);
  const logs = req.user.role === 'legal'
    ? all('SELECT a.*,u.name AS actor,u.role AS actorRole,c.title AS caseTitle FROM AuditLog a LEFT JOIN User u ON u.id=a.userId LEFT JOIN "Case" c ON c.id=a.caseId ORDER BY a.createdAt DESC,a.rowid DESC LIMIT 500')
    : all('SELECT a.*,u.name AS actor,u.role AS actorRole,c.title AS caseTitle FROM AuditLog a LEFT JOIN User u ON u.id=a.userId LEFT JOIN "Case" c ON c.id=a.caseId WHERE c.org=? OR (a.caseId IS NULL AND a.org=?) ORDER BY a.createdAt DESC,a.rowid DESC LIMIT 500', req.user.org, req.user.org);
  res.json({ logs });
});
app.get('/api/dashboard', (req, res) => {
  const cases = listCases(req.user);
  res.json({ total: cases.length, active: cases.filter(c => c.status !== '已归档').length, highRisk: cases.filter(c => c.risk === '高' && c.status !== '已归档').length, urgent: cases.filter(c => c.dueAt && Date.parse(c.dueAt) <= Date.now() + 6 * 3600000 && c.status !== '已归档').length });
});
app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));
const distDir = join(projectDir, 'dist');
app.use(express.static(distDir, { index: false }));
app.use((req, res, next) => {
  if (req.method === 'GET' && !extname(req.path) && existsSync(join(distDir, 'index.html'))) return res.sendFile(join(distDir, 'index.html'));
  next();
});
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? '证据文件不得超过 40 MB' : '上传格式或字段数量超出限制', code: error.code });
  const status = error.status || (error.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error('[API error]', error);
  res.status(status).json({ error: status >= 500 ? '服务器处理失败，请稍后重试。' : error.message, ...(error.code ? { code: error.code } : {}) });
});
