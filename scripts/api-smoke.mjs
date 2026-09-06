import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

// Exercises the actual HTTP server, private file storage and SQLite database.
// DATA_DIR is always an isolated directory created by this script.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = resolve(tmpdir());
const dataDir = await mkdtemp(join(temporaryRoot, 'sf-api-smoke-'));
const port = await new Promise((resolvePort, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const selected = probe.address().port;
    probe.close(error => error ? reject(error) : resolvePort(selected));
  });
});
const base = `http://127.0.0.1:${port}`;
let child;
let database;
let output = '';
let checks = 0;

function check(description) {
  checks += 1;
  process.stdout.write(`PASS ${String(checks).padStart(2, '0')}  ${description}\n`);
}

async function startServer() {
  child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: root,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir,
      DEMO_PASSWORD: 'Sf2026!demo', SEED_DEMO: 'true',
      // Validation is deterministic and never calls a paid remote model.
      AI_API_KEY: '', OPENAI_API_KEY: '', AI_PROVIDER: 'local',
    },
  });
  child.stdout.on('data', chunk => { output = (output + chunk).slice(-16000); });
  child.stderr.on('data', chunk => { output = (output + chunk).slice(-16000); });
  let startupError;
  child.once('error', error => { startupError = error; });
  const until = Date.now() + 20000;
  while (Date.now() < until) {
    if (startupError) throw startupError;
    if (child.exitCode !== null) throw new Error(`Server exited during startup: ${output}`);
    try {
      const response = await fetch(`${base}/api/auth/me`, { signal: AbortSignal.timeout(750) });
      if (response.status === 401) return;
    } catch { /* The isolated server may still be initializing its seed database. */ }
    await new Promise(done => setTimeout(done, 100));
  }
  throw new Error(`Server did not become ready within 20 seconds: ${output}`);
}

async function stopServer() {
  if (!child || child.exitCode !== null) return;
  const stopped = new Promise(done => child.once('exit', done));
  child.kill();
  await Promise.race([stopped, new Promise(done => setTimeout(done, 5000))]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function request(path, { cookie, method = 'GET', body, expected = 200, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (cookie) requestHeaders.Cookie = cookie;
  const options = { method, headers: requestHeaders, signal: AbortSignal.timeout(10000) };
  if (body instanceof FormData) options.body = body;
  else if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${base}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json') ? await response.json() : await response.text();
  const statuses = Array.isArray(expected) ? expected : [expected];
  assert.ok(statuses.includes(response.status), `${method} ${path}: expected ${statuses.join('/')}, got ${response.status}: ${JSON.stringify(result).slice(0, 600)}`);
  return { response, result };
}

async function login(role) {
  const { response, result } = await request('/api/auth/login', {
    method: 'POST', body: { username: role, password: 'Sf2026!demo', role },
  });
  assert.equal(result.user.role, role);
  assert.equal(result.user.passwordHash, undefined);
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  return { cookie: setCookie.split(';')[0], user: result.user };
}

async function upload(caseId, cookie, category, content = `Smoke evidence ${category}: 运单与现场记录原文。`) {
  const form = new FormData();
  form.set('file', new Blob([content], { type: 'text/plain' }), `${category}.txt`);
  form.set('title', `测试证据 ${category}`);
  form.set('category', category);
  const { result } = await request(`/api/cases/${caseId}/evidence`, {
    cookie, method: 'POST', body: form, expected: [200, 201],
  });
  const evidence = result.case.evidence.find(item => item.category === category && item.sha256 === createHash('sha256').update(content).digest('hex'));
  assert.ok(evidence, 'Upload must return real persisted evidence with a matching SHA-256');
  return { item: result.case, evidence, content };
}

async function finishTasks(caseId, cookie) {
  let { result } = await request(`/api/cases/${caseId}`, { cookie });
  const supportedCategories = new Set(['waybill', 'packaging', 'monitor', 'chat', 'value', 'delivery', 'tracking', 'identity']);
  for (const task of result.case.tasks.filter(task => task.status !== '已完成')) {
    if (task.evidenceKey && supportedCategories.has(task.evidenceKey) && !result.case.evidence.some(e => e.category === task.evidenceKey)) {
      await upload(caseId, cookie, task.evidenceKey);
    }
    await request(`/api/tasks/${task.id}`, {
      cookie, method: 'PATCH', body: { status: '已完成', note: '自动化验收：已核对并完成本项；真实业务须由经办人确认。' },
    });
  }
  ({ result } = await request(`/api/cases/${caseId}`, { cookie }));
  assert.ok(result.case.tasks.every(task => task.status === '已完成'));
  return result.case;
}

try {
  await startServer();
  await request('/api/cases', { expected: 401 });
  await request('/api/tasks', { expected: 401 });
  await request('/api/knowledge', { expected: 401 });
  await request('/api/audit', { expected: 401 });
  check('业务数据和文件入口要求登录');

  await request('/api/auth/login', {
    method: 'POST', body: { username: 'courier', password: 'wrong-password', role: 'courier' }, expected: 401,
  });
  await request('/api/auth/login', {
    method: 'POST', body: { username: 'courier', password: 'Sf2026!demo', role: 'legal' }, expected: [401, 403],
  });
  const courier = await login('courier');
  const supervisor = await login('supervisor');
  const legal = await login('legal');
  check('三类真实账号登录；错误密码和伪造身份被拒绝');

  database = new DatabaseSync(join(dataDir, 'sf-disputes.sqlite'), { readOnly: true });
  for (const actor of [courier, supervisor, legal]) {
    const stored = database.prepare('SELECT passwordHash FROM User WHERE id = ?').get(actor.user.id);
    assert.notEqual(stored.passwordHash, 'Sf2026!demo');
    assert.match(stored.passwordHash, /^[a-f\d]+:[a-f\d]+$/);
    const { result } = await request('/api/auth/me', { cookie: actor.cookie });
    assert.equal(result.user.id, actor.user.id);
  }
  const savedSessions = database.prepare('SELECT tokenHash FROM Session').all();
  assert.ok(savedSessions.length >= 3);
  assert.ok(savedSessions.every(s => ![courier.cookie, supervisor.cookie, legal.cookie].some(c => c.includes(s.tokenHash))));
  check('密码和会话令牌以哈希持久化；会话身份由服务器返回');

  const ownList = (await request('/api/cases', { cookie: courier.cookie })).result.cases;
  const regionList = (await request('/api/cases', { cookie: supervisor.cookie })).result.cases;
  const allList = (await request('/api/cases', { cookie: legal.cookie })).result.cases;
  assert.ok(ownList.every(item => item.ownerId === courier.user.id));
  assert.ok(regionList.every(item => item.org === supervisor.user.org));
  assert.ok(allList.length > regionList.length && regionList.length > ownList.length);
  const otherRegion = allList.find(item => item.org !== supervisor.user.org);
  const otherOwner = regionList.find(item => item.ownerId !== courier.user.id);
  assert.ok(otherRegion && otherOwner, 'Seed must contain both same-org and external-org scope fixtures');
  await request(`/api/cases/${otherOwner.id}`, { cookie: courier.cookie, expected: 404 });
  await request(`/api/cases/${otherRegion.id}`, { cookie: supervisor.cookie, expected: 404 });
  await request(`/api/cases/${otherOwner.id}/analysis`, { cookie: courier.cookie, method: 'POST', body: {}, expected: 404 });
  check('快递员仅本人、主管仅辖区、法务全部；越权读取和写入被拒绝');

  const created = await request('/api/cases', {
    cookie: courier.cookie, method: 'POST', expected: [200, 201],
    body: {
      title: 'API 验收 · 包裹外箱破损', waybill: 'SF2026090700001',
      description: '派送时发现外箱破损，客户要求核验包装和运输交接记录，尚未确定内件是否损坏。',
      amount: 120, goods: '图书', insured: false, incidentAt: new Date().toISOString(),
      monitorDeadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      proofDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      ownerId: legal.user.id, role: 'legal', org: '伪造辖区',
    },
  });
  let item = created.result.case;
  const caseId = item.id;
  assert.equal(item.ownerId, courier.user.id);
  assert.equal(item.org, courier.user.org);
  assert.equal(item.waybill, 'SF2026090700001');
  assert.ok(item.analysis && item.tasks.length > 0);
  assert.ok(item.analysis.checklist.some(check => check.priority === 'immediate'));
  assert.ok(item.analysis.checklist.some(check => check.priority === 'supplement'));
  assert.equal(item.analysis.mode, 'rules');
  assert.ok(item.tasks.some(task => task.evidenceKey === 'monitor' && task.dueAt === item.monitorDeadline));
  assert.ok(item.tasks.some(task => task.kind === 'deadline' && task.evidenceKey === 'proof' && task.dueAt === item.proofDeadline));
  assert.equal(database.prepare('SELECT title FROM "Case" WHERE id = ?').get(caseId).title, item.title);
  assert.equal(database.prepare('SELECT number FROM Waybill WHERE caseId = ?').get(caseId).number, item.waybill);
  check('报案真实写入 Case / Waybill 并生成分析和任务；不能伪造所有人或组织');

  await request(`/api/cases/${caseId}/transition`, {
    cookie: courier.cookie, method: 'POST', body: { action: 'compensate', role: 'legal', note: '伪造审批' }, expected: 403,
  });
  await request(`/api/cases/${caseId}/transition`, {
    cookie: courier.cookie, method: 'POST', body: { action: 'archive', note: '提前归档' }, expected: 403,
  });
  await request(`/api/cases/${caseId}/transition`, {
    cookie: supervisor.cookie, method: 'POST', body: { action: 'archive', note: '任务未完成' }, expected: [400, 409],
  });
  await request(`/api/cases/${caseId}/analysis`, {
    cookie: courier.cookie, method: 'POST', body: {}, headers: { Origin: 'https://untrusted.example' }, expected: 403,
  });
  check('赔偿和归档有服务端权限；未完成待办不能归档；拒绝跨源写入');

  const questionId = item.analysis.questions?.[0]?.id;
  assert.ok(questionId, 'New analysis should ask at least one clarification question');
  item = (await request(`/api/cases/${caseId}/analysis`, {
    cookie: courier.cookie, method: 'POST', body: { answers: { [questionId]: '客户当场发现外箱破损，已联系保管人留存监控。' } },
  })).result.case;
  assert.ok(item.clarificationAnswers[questionId].includes('当场发现'));
  assert.ok(['高', '中', '低'].includes(item.risk));
  assert.ok(item.analysis.citations.length > 0);
  const knowledgeIds = new Set(database.prepare('SELECT id FROM Knowledge').all().map(row => row.id));
  for (const citation of item.analysis.citations) assert.ok(knowledgeIds.has(citation.id), `Citation must reference saved knowledge: ${JSON.stringify(citation)}`);
  assert.ok(database.prepare('SELECT COUNT(*) AS n FROM AIAnalysis WHERE caseId = ?').get(caseId).n >= 2);
  check('澄清答案和分析版本持久化；责任等级有效，引用指向真实知识条目');

  const evidenceTask = item.tasks.find(task => task.evidenceKey && task.status !== '已完成');
  assert.ok(evidenceTask);
  await request(`/api/tasks/${evidenceTask.id}`, {
    cookie: courier.cookie, method: 'PATCH', body: { status: '已完成', note: '没有实际证据的伪完成' }, expected: [400, 409],
  });
  const uploaded = await upload(caseId, courier.cookie, evidenceTask.evidenceKey);
  const { evidence, content } = uploaded;
  assert.ok(uploaded.item.analysis.checklist.some(check => check.category === evidence.category && check.status === '已具备'));
  const downloaded = await request(`/api/evidence/${evidence.id}/download`, { cookie: supervisor.cookie });
  assert.equal(downloaded.result, content);
  assert.ok(downloaded.response.headers.get('content-disposition')?.includes('attachment'));
  const verified = (await request(`/api/evidence/${evidence.id}/verify`, { cookie: courier.cookie })).result;
  assert.equal(verified.valid, true);
  assert.equal(verified.sha256, createHash('sha256').update(content).digest('hex'));
  assert.equal(verified.actualSha256, verified.sha256);
  await request(`/api/evidence/${evidence.id}/download`, { expected: 401 });
  await request('/api/evidence/..%2F..%2Fpackage.json/download', { cookie: courier.cookie, expected: 404 });
  await request(`/api/tasks/${evidenceTask.id}`, {
    cookie: courier.cookie, method: 'PATCH', body: { status: '已完成', note: '证据已上传并核验' },
  });
  const savedEvidence = database.prepare('SELECT * FROM Evidence WHERE id = ?').get(evidence.id);
  const storedFile = join(dataDir, 'evidence', savedEvidence.storageName);
  const originalBytes = await readFile(storedFile);
  assert.equal(createHash('sha256').update(originalBytes).digest('hex'), evidence.sha256);
  await request(`/data/evidence/${savedEvidence.storageName}`, { expected: 404 });
  check('证据必须真实上传；下载字节和磁盘文件 SHA-256 一致；补证任务与附件绑定');

  try {
    await writeFile(storedFile, Buffer.from('Simulated unauthorized file modification in isolated test data.'));
    const mismatch = (await request(`/api/evidence/${evidence.id}/verify`, { cookie: courier.cookie })).result;
    assert.equal(mismatch.valid, false);
    assert.notEqual(mismatch.actualSha256, mismatch.sha256);
  } finally { await writeFile(storedFile, originalBytes); }
  for (const filename of ['forged.jpg', 'executable.html']) {
    const invalid = new FormData();
    invalid.set('file', new Blob(['This is text, not an image.']), filename);
    invalid.set('title', '无效文件测试');
    invalid.set('category', 'packaging');
    await request(`/api/cases/${caseId}/evidence`, { cookie: courier.cookie, method: 'POST', body: invalid, expected: 400 });
  }
  check('摘要校验能发现磁盘篡改；伪装图片和不支持文件被拒绝；私有文件无静态入口');

  const docCase = (await request(`/api/cases/${caseId}/documents`, {
    cookie: courier.cookie, method: 'POST', body: { type: '证据目录' }, expected: [200, 201],
  })).result.case;
  const doc = docCase.documents.find(document => document.type === '证据目录');
  assert.ok(doc);
  const documentDownload = await request(`/api/documents/${doc.id}/download`, { cookie: courier.cookie });
  assert.match(documentDownload.result, /草稿/);
  assert.ok(documentDownload.result.includes(evidence.sha256));
  await request(`/api/documents/${doc.id}/download`, { expected: 401 });
  assert.ok(database.prepare('SELECT id FROM LegalDocument WHERE id = ?').get(doc.id));
  check('按已上传证据生成并保存文书草稿，授权下载含真实文件摘要');

  for (const type of ['情况说明', '监控调取函']) {
    const documentCase = (await request(`/api/cases/${caseId}/documents`, {
      cookie: courier.cookie, method: 'POST', body: { type }, expected: [200, 201],
    })).result.case;
    const generated = documentCase.documents.find(document => document.type === type);
    const file = await request(`/api/documents/${generated.id}/download`, { cookie: courier.cookie });
    assert.match(file.result, /草稿/);
    assert.ok(file.result.includes(item.waybill));
  }
  await request(`/api/cases/${caseId}/documents`, {
    cookie: courier.cookie, method: 'POST', body: { type: '答辩材料' }, expected: 403,
  });
  const legalDraftCase = (await request(`/api/cases/${caseId}/documents`, {
    cookie: legal.cookie, method: 'POST', body: { type: '答辩材料' }, expected: [200, 201],
  })).result.case;
  const legalDraft = legalDraftCase.documents.find(document => document.type === '答辩材料');
  const legalDraftFile = await request(`/api/documents/${legalDraft.id}/download`, { cookie: legal.cookie });
  assert.match(legalDraftFile.result, /案号：【待补充，不得推测】/);
  for (const actor of [courier, supervisor]) {
    await request(`/api/documents/${legalDraft.id}/download`, { cookie: actor.cookie, expected: 403 });
    const businessView = (await request(`/api/cases/${caseId}`, { cookie: actor.cookie })).result.case;
    assert.ok(!businessView.documents.some(document => document.id === legalDraft.id && document.content), 'Legal-only draft content must not leak through case detail');
  }
  check('四类文书均可生成；答辩材料仅法务可访问，不经案件详情泄露');

  const external = (await request(`/api/cases/${otherRegion.id}/documents`, {
    cookie: legal.cookie, method: 'POST', body: { type: '情况说明' }, expected: [200, 201],
  })).result.case;
  const externalDoc = external.documents.find(document => document.type === '情况说明');
  const externalEvidence = await upload(otherRegion.id, legal.cookie, 'chat');
  for (const actor of [courier, supervisor]) {
    await request(`/api/documents/${externalDoc.id}/download`, { cookie: actor.cookie, expected: 404 });
    await request(`/api/evidence/${externalEvidence.evidence.id}/download`, { cookie: actor.cookie, expected: 404 });
    await request(`/api/evidence/${externalEvidence.evidence.id}/verify`, { cookie: actor.cookie, expected: 404 });
  }
  check('文件、文书及摘要校验接口独立执行案件范围权限');

  const knowledgeBody = {
    title: 'API 验收内部补证 SOP', type: '内部SOP',
    content: '仅供自动化验收：运输争议发生后应核对原始运单，立即固定现场照片并由经办人记录交接情况。',
    sourceUrl: '', version: '验收演示 v1',
  };
  await request('/api/knowledge', { cookie: courier.cookie, method: 'POST', body: knowledgeBody, expected: 403 });
  await request('/api/knowledge', { cookie: supervisor.cookie, method: 'POST', body: knowledgeBody, expected: 403 });
  const knowledge = (await request('/api/knowledge', { cookie: legal.cookie, method: 'POST', body: knowledgeBody, expected: [200, 201] })).result.item;
  const matches = (await request(`/api/knowledge?q=${encodeURIComponent('API 验收内部补证')}`, { cookie: courier.cookie })).result.items;
  assert.ok(matches.some(match => match.id === knowledge.id));
  check('只有法务可以维护知识库，新增来源可由业务角色检索');

  await finishTasks(caseId, courier.cookie);
  item = (await request(`/api/cases/${caseId}/transition`, {
    cookie: supervisor.cookie, method: 'POST', body: { action: 'negotiate', note: '已与客户核对争议事实，正在协商。' },
  })).result.case;
  assert.equal(item.status, '协商中');
  item = (await request(`/api/cases/${caseId}/transition`, {
    cookie: supervisor.cookie, method: 'POST', body: { action: 'compensate', note: '提交主管审核金额，尚未付款。' },
  })).result.case;
  assert.equal(item.status, '赔偿审批');
  item = (await request(`/api/cases/${caseId}/transition`, {
    cookie: supervisor.cookie, method: 'POST', body: { action: 'archive', note: '测试闭环：已完成核验并经授权人员确认处理结论。' },
  })).result.case;
  assert.equal(item.status, '已归档');
  check('真实完成补证待办 → 协商 → 赔偿审批 → 主管归档闭环');

  const majorCase = (await request('/api/cases', {
    cookie: courier.cookie, method: 'POST', expected: [200, 201],
    body: {
      title: 'API 验收 · 高金额争议', waybill: 'SF2026090700002',
      description: '运输中的精密仪器外壳破损，客户提出高金额索赔，损害原因及交接情况需要进一步核查。',
      amount: 80000, goods: '精密仪器', insured: true, incidentAt: new Date().toISOString(),
    },
  })).result.case;
  assert.equal(majorCase.escalated, true);
  assert.equal(majorCase.status, '法务处理中');
  for (const action of ['compensate', 'negotiate', 'archive']) {
    await request(`/api/cases/${majorCase.id}/transition`, {
      cookie: supervisor.cookie, method: 'POST', body: { action, note: '尝试绕过法务' }, expected: [403, 409],
    });
  }
  const reviewedAnalysis = (await request(`/api/cases/${majorCase.id}/analysis`, {
    cookie: courier.cookie, method: 'POST', body: {},
  })).result.case;
  assert.equal(reviewedAnalysis.escalated, true);
  assert.equal(reviewedAnalysis.status, '法务处理中');
  await finishTasks(majorCase.id, legal.cookie);
  const legalClosed = (await request(`/api/cases/${majorCase.id}/transition`, {
    cookie: legal.cookie, method: 'POST', body: { action: 'archive', note: '法务人工审核验收：已核查全部任务和证据并确认可归档。' },
  })).result.case;
  assert.equal(legalClosed.status, '已归档');
  assert.ok(legalClosed.legalReviewedAt);
  check('高金额自动升级、复分析保留法务锁；仅法务完成审核后归档');

  const authorizedCaseIds = new Set((await request('/api/cases', { cookie: courier.cookie })).result.cases.map(c => c.id));
  const supervisedCaseIds = new Set((await request('/api/cases', { cookie: supervisor.cookie })).result.cases.map(c => c.id));
  await request('/api/audit', { cookie: courier.cookie, expected: 403 });
  const logs = (await request('/api/audit', { cookie: supervisor.cookie })).result.logs;
  assert.ok(logs.length > 0);
  assert.ok(logs.every(log => log.caseId ? supervisedCaseIds.has(log.caseId) : log.org === supervisor.user.org));
  assert.ok(!JSON.stringify(logs).includes('passwordHash'));
  assert.ok(!JSON.stringify(logs).includes('Sf2026!demo'));
  assert.ok(!JSON.stringify(logs).includes(legal.cookie.split('=')[1]));
  const visibleTasks = (await request('/api/tasks', { cookie: courier.cookie })).result.tasks;
  assert.ok(visibleTasks.every(task => authorizedCaseIds.has(task.caseId)));
  check('任务和审计同样按案件过滤，日志不泄露密码或其他人的会话');

  await request('/api/auth/logout', { cookie: courier.cookie, method: 'POST', body: {} });
  await request('/api/auth/me', { cookie: courier.cookie, expected: 401 });
  check('退出使原会话立即失效');

  database.close();
  database = undefined;
  await stopServer();
  await startServer();
  const resumed = await login('legal');
  const persisted = (await request(`/api/cases/${caseId}`, { cookie: resumed.cookie })).result.case;
  assert.equal(persisted.status, '已归档');
  assert.ok(persisted.evidence.some(e => e.id === evidence.id));
  assert.ok(persisted.documents.some(d => d.id === doc.id));
  assert.equal((await request(`/api/evidence/${evidence.id}/download`, { cookie: resumed.cookie })).result, content);
  check('服务重启后案件、证据、文书、归档状态及文件内容均保留');

  process.stdout.write(`\nAPI smoke passed: ${checks} checks; isolated SQLite and files.\n`);
} catch (error) {
  process.stderr.write(`\nAPI smoke failed: ${error.stack || error}\nServer output:\n${output}\n`);
  process.exitCode = 1;
} finally {
  database?.close();
  await stopServer();
  const normalizedData = resolve(dataDir);
  assert.ok(normalizedData.startsWith(temporaryRoot + sep) && normalizedData.split(sep).at(-1).startsWith('sf-api-smoke-'), 'Refuse to clean up an unexpected directory');
  if (process.env.TEST_KEEP_DATA === '1') process.stdout.write(`Test data retained: ${normalizedData}\n`);
  else await rm(normalizedData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
