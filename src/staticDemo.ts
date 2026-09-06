import type { Analysis, AuditLog, CaseItem, Evidence, Knowledge, LegalDocument, Task, User } from './api';

const stamp = (hours = 0) => new Date(Date.now() + hours * 3600000).toISOString();
const demoUsers: Record<string, User> = {
  courier: { id: 'static-courier', username: 'courier', name: '陈思远', role: 'courier', org: '深圳南山科技园营业点' },
  supervisor: { id: 'static-supervisor', username: 'supervisor', name: '李敏', role: 'supervisor', org: '深圳南山科技园营业点' },
  legal: { id: 'static-legal', username: 'legal', name: '王律师', role: 'legal', org: '集团法务中心' },
};

const staticAnalysis: Analysis = {
  category: '破损', risk: '高', mode: 'rules', generatedAt: stamp(-1),
  summary: '当前信息显示存在包装受损、货损发现时间和责任环节未闭合三个争议焦点。先保存原始状态和运输交接记录，再由法务核验赔偿口径。',
  focusPoints: ['货物和外包装在签收、开箱时的原始状态尚未完整固定。', '分拨、派送交接时间与监控原片需要和物流轨迹相互印证。', '金额属于演示升级阈值以上，不能由 AI 直接作出赔偿结论。'],
  riskReasons: ['主张金额达到演示升级阈值 ¥10,000，需人工法务复核。'],
  questions: [
    { id: 'q-packaging', question: '签收时外包装是否有破损、加固或异常标记？谁在现场看到？' },
    { id: 'q-discovery', question: '客户具体在什么时间、以什么方式首次发现货损？' },
    { id: 'q-insurance', question: '运单和保价服务的原始记录是否已经核验？' },
  ],
  checklist: [
    { id: 'waybill', title: '运单与寄递约定', category: 'waybill', priority: 'immediate', reason: '保存完整运单、寄递品名、服务约定和保价条款，确定合同与主张基础。', deadlineHours: 2 },
    { id: 'tracking', title: '运输轨迹与交接记录', category: 'tracking', priority: 'immediate', reason: '导出全部扫描节点和交接时间，核实争议可能发生的环节。', deadlineHours: 4 },
    { id: 'chat', title: '完整沟通与首次异议记录', category: 'chat', priority: 'immediate', reason: '保留原始对话、双方身份和时间，避免仅截取局部内容。', deadlineHours: 4 },
    { id: 'packaging', title: '外包装、内件与开箱影像', category: 'packaging', priority: 'immediate', reason: '拍摄六面包装、封口、内件受损部位，保留原包装与原文件。', deadlineHours: 2 },
    { id: 'monitor', title: '现场与交接监控原片', category: 'monitor', priority: 'immediate', reason: '按登记的监控覆盖时间联系保管人，导出争议时段原片并记录提取过程。', deadlineHours: 6 },
    { id: 'value', title: '货值与实际损失凭证', category: 'value', priority: 'supplement', reason: '收集订单、发票、维修报价等材料，区分主张金额和核实损失。' },
    { id: 'delivery', title: '签收与交付记录', category: 'delivery', priority: 'supplement', reason: '核对签收人、签收时间和交付异常备注。' },
  ],
  sop: [
    { title: '先固定现场与原始文件', description: '将包装、货物、运单和开箱影像分别保留原件，记录拍摄人、时间和取得方式。' },
    { title: '申请监控留存', description: '确认设备位置、覆盖时间和保管人，提交调取或留存申请并把过程写入时间线。' },
    { title: '完成事实核验后再协商', description: '区分客户陈述、已核实事实和待核实事项，赔偿口径由授权主管或法务确认。' },
  ],
  citations: [
    { id: 'law-civil-832', title: '《中华人民共和国民法典》第八百三十二条', version: '2020-05-28通过，2021-01-01施行', sourceUrl: 'https://gdca.miit.gov.cn/zwgk/zcwj/flfg/art/2020/art_573d6ef5018b46b6a4e1f31ca085a710.html', excerpt: '承运人对运输过程中货物的毁损、灭失承担赔偿责任；免责事由需要依事实和材料核验。' },
    { id: 'law-express-28', title: '《快递暂行条例》第二十八条', version: '2025-06-01施行版本', sourceUrl: 'https://www.mee.gov.cn/zcwj/gwywj/202504/t20250422_1117316.shtml', excerpt: '保价与未保价快件的赔偿规则需要结合寄递服务约定及实际材料核验。' },
  ],
  escalationReasons: ['主张金额达到演示升级阈值 ¥10,000'],
  disclaimer: 'AI 仅辅助梳理风险和证据缺口，不作责任认定、赔偿承诺或法律意见。',
};

function evidence(id: string, title: string, category: string, name: string): Evidence {
  return { id, title, category, originalName: name, mimeType: 'text/plain', size: 1420, sha256: `demo-${id}-sha256`, createdAt: stamp(-3), uploadedBy: '陈思远', status: '已具备' };
}
const staticEvidence = [evidence('static-e1', '运单信息', 'waybill', 'SF-DEMO-20260001.txt'), evidence('static-e2', '客户沟通记录', 'chat', 'customer-chat-demo.txt')];
const staticTasks: Task[] = [
  { id: 'static-t1', caseId: 'case-demo-001', caseTitle: '相机运输破损争议', title: '固定外包装、内件与开箱影像', kind: 'evidence', status: '待处理', dueAt: stamp(2), priority: 'P0', assignedTo: '陈思远', createdAt: stamp(-2) },
  { id: 'static-t2', caseId: 'case-demo-001', caseTitle: '相机运输破损争议', title: '申请分拨中心监控留存', kind: 'deadline', status: '待处理', dueAt: stamp(5), priority: 'P0', assignedTo: '李敏', createdAt: stamp(-2) },
  { id: 'static-t3', caseId: 'case-demo-001', caseTitle: '相机运输破损争议', title: '人工法务复核责任与赔偿口径', kind: 'legal_review', status: '待处理', dueAt: stamp(8), priority: 'P0', assignedTo: '王律师', createdAt: stamp(-2) },
];
const staticCase: CaseItem = {
  id: 'case-demo-001', title: '相机运输破损争议', waybill: 'SF-DEMO-20260001', category: '破损', risk: '高', status: '法务处理中', amount: 12800,
  ownerName: '陈思远', ownerId: 'static-courier', org: '深圳南山科技园营业点', createdAt: stamp(-8), updatedAt: stamp(-1), evidenceCount: 2, requiredCount: 7, completeness: 29,
  nextAction: '固定外包装、内件与开箱影像', dueAt: stamp(2), escalated: true, description: '【演示案例】客户反馈收到相机后镜头破裂，外包装一角凹陷。收件人称签收后 30 分钟内开箱发现异常，双方对破损发生环节及保价赔付范围存在争议。', goods: '相机及镜头', insured: true, incidentAt: stamp(-8), monitorDeadline: stamp(5), insuranceDeadline: stamp(20), proofDeadline: stamp(72), major: false, criminalRisk: false,
  clarificationAnswers: {}, evidence: staticEvidence, tasks: staticTasks, documents: [], timeline: [], analysis: staticAnalysis,
};
const secondCase: CaseItem = { ...staticCase, id: 'case-demo-002', title: '广州签收争议', waybill: 'SF-DEMO-20260002', category: '签收争议', risk: '中', status: '取证中', amount: 680, ownerName: '陈思远', evidenceCount: 1, completeness: 20, nextAction: '补充签收底单', dueAt: stamp(18), escalated: false, monitorDeadline: undefined, insuranceDeadline: undefined, proofDeadline: undefined, analysis: { ...staticAnalysis, category: '签收争议', risk: '中', escalationReasons: [], summary: '签收授权和交付记录尚未闭合，建议先核对签收底单、派送轨迹和代收授权。' } };
let currentUser: User | null = null;
let cases = [staticCase, secondCase];
let tasks = [...staticTasks, { ...staticTasks[0], id: 'static-t4', caseId: secondCase.id, caseTitle: secondCase.title, title: '补充签收底单', dueAt: stamp(18), assignedTo: '陈思远' }];
const knowledge: Knowledge[] = [
  { id: 'static-k1', title: '《中华人民共和国民法典》第八百三十二条', type: '法律法规', content: '承运人对运输过程中货物的毁损、灭失承担赔偿责任；免责事由需要依事实和材料核验。', sourceUrl: staticAnalysis.citations[0].sourceUrl, version: '2020-05-28通过，2021-01-01施行', isDemo: false, verifiedAt: '2026-09-07' },
  { id: 'static-k2', title: '运输货损纠纷固证 SOP（演示）', type: '内部SOP', content: '先保存外包装、内件、运单和开箱影像，再申请运输交接及监控留存；所有未知事实标记待核验。', sourceUrl: '', version: '比赛演示 v1.0 · 2026-09-07', isDemo: true, verifiedAt: '2026-09-07' },
  { id: 'static-k3', title: '情况说明与证据目录模板（演示）', type: '文书模板', content: '文书只整理已知事实、来源、待核验事项和已采取行动，不填充虚构法条、案号或裁判结果。', sourceUrl: '', version: '比赛演示 v1.0 · 2026-09-07', isDemo: true, verifiedAt: '2026-09-07' },
];
let logs: AuditLog[] = [{ id: 'static-log-1', action: '自动升级法务', detail: '主张金额达到演示升级阈值，需人工法务复核。', actorName: '系统', createdAt: stamp(-1), caseId: staticCase.id }];

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function bodyOf(options: RequestInit) { return typeof options.body === 'string' ? JSON.parse(options.body) : {}; }
function visibleCase(item: CaseItem) { return clone(item); }
function currentCase(id: string) { const item = cases.find(c => c.id === id); if (!item) throw new Error('案件不存在'); return item; }
function staticCaseDetail(item: CaseItem) { return visibleCase(item); }

export async function staticApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const route = path.split('?')[0];
  const method = options.method || 'GET';
  if (route === '/health') return { ok: true, aiMode: 'rules', database: 'static-demo', version: '1.0.0' } as T;
  if (route === '/auth/me') { if (!currentUser) throw new Error('请先登录'); return { user: clone(currentUser) } as T; }
  if (route === '/auth/login' && method === 'POST') {
    const body = bodyOf(options); const user = demoUsers[body.role];
    if (!user || body.username !== body.role || body.password !== 'Sf2026!demo') throw new Error('账号、密码或所选身份不匹配。');
    currentUser = user; return { user: clone(user) } as T;
  }
  if (route === '/auth/logout' && method === 'POST') { currentUser = null; return {} as T; }
  if (!currentUser) throw new Error('请先登录');
  if (route === '/cases' && method === 'POST') {
    const body = bodyOf(options);
    const item: CaseItem = { ...clone(staticCase), id: `static-new-${Date.now()}`, title: body.title || '演示纠纷案件', waybill: body.waybill || 'SF-DEMO-NEW', description: body.description || '演示案情待补充。', goods: body.goods || '待确认货物', amount: Number(body.amount) || 0, createdAt: stamp(), updatedAt: stamp(), ownerId: currentUser.id, ownerName: currentUser.name, org: currentUser.org, status: '取证中', escalated: false, evidence: [], evidenceCount: 0, completeness: 0, documents: [], tasks: [], timeline: [], clarificationAnswers: {} };
    cases.unshift(item); return { case: staticCaseDetail(item) } as T;
  }
  if (route === '/cases' && method === 'GET') return { cases: clone(cases.filter(c => currentUser?.role !== 'courier' || c.ownerId === currentUser.id)) } as T;
  if (route === '/tasks' && method === 'GET') return { tasks: clone(tasks.filter(t => cases.some(c => c.id === t.caseId && (currentUser?.role !== 'courier' || c.ownerId === currentUser.id)))) } as T;
  if (route === '/knowledge' && method === 'GET') return { items: clone(knowledge) } as T;
  if (route === '/audit' && method === 'GET') return { logs: clone(logs) } as T;
  const caseMatch = route.match(/^\/cases\/([^/]+)(?:\/(analysis|evidence|transition|documents))?$/);
  if (caseMatch) {
    const item = currentCase(caseMatch[1]); const action = caseMatch[2];
    if (action === 'analysis' && method === 'POST') return { case: staticCaseDetail(item) } as T;
    if (action === 'evidence' && method === 'POST') {
      const form = options.body instanceof FormData ? options.body : null; const uploaded = form?.get('file') as File | null;
      if (!uploaded) throw new Error('请选择证据原件');
      const category = String(form?.get('category') || 'other'); const title = String(form?.get('title') || uploaded.name);
      item.evidence.push(evidence(`static-upload-${Date.now()}`, title, category, uploaded.name)); item.evidenceCount = item.evidence.length; item.completeness = Math.round(item.evidenceCount / item.requiredCount * 100); item.updatedAt = stamp();
      return { case: staticCaseDetail(item) } as T;
    }
    if (action === 'transition' && method === 'POST') { const body = bodyOf(options); const status: Record<string,string> = { negotiate: '协商中', compensate: '赔偿审批', archive: '已归档', escalate: '法务处理中' }; if (status[body.action]) item.status = status[body.action]; item.updatedAt = stamp(); logs.unshift({ id: `static-log-${Date.now()}`, action: body.action, detail: body.note || '演示操作已记录', actorName: currentUser.name, createdAt: stamp(), caseId: item.id }); return { case: staticCaseDetail(item) } as T; }
    if (action === 'documents' && method === 'POST') { const body = bodyOf(options); const doc: LegalDocument = { id: `static-doc-${Date.now()}`, type: body.type, title: `${item.title} · ${body.type}（演示草稿）`, content: `【演示草稿】\n案件：${item.title}\n运单：${item.waybill}\n\n已知事实：${item.description}\n\n待人工核验：责任环节、损失凭证、正式提交对象及期限。\n\nAI 仅辅助整理，提交前须经授权人员审阅。`, createdAt: stamp(), status: '待人工审核' }; item.documents.unshift(doc); return { case: staticCaseDetail(item) } as T; }
    if (!action && method === 'GET') return { case: staticCaseDetail(item) } as T;
  }
  const taskMatch = route.match(/^\/tasks\/([^/]+)$/);
  if (taskMatch && method === 'PATCH') { const task = tasks.find(t => t.id === taskMatch[1]); if (!task) throw new Error('待办不存在'); task.status = bodyOf(options).status || task.status; return { task: clone(task) } as T; }
  if (route.startsWith('/knowledge') && method === 'POST') { return { item: clone(knowledge[0]) } as T; }
  throw new Error('静态演示模式不支持此操作');
}
