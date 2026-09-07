import { all, one, run, uid, now, audit, knowledgeRows } from './db.mjs';
import { analyzeCase } from './ai.mjs';

export function caseScope(user, alias = 'c') {
  if (user.role === 'legal') return { sql: '1 = 1', args: [] };
  if (user.role === 'supervisor') return { sql: `${alias}.org = ?`, args: [user.org] };
  return { sql: `${alias}.ownerId = ?`, args: [user.id] };
}
export function caseRow(id) {
  const row = one('SELECT c.*,w.number AS waybill,u.name AS ownerName FROM "Case" c JOIN Waybill w ON w.caseId=c.id JOIN User u ON u.id=c.ownerId WHERE c.id=?', id);
  if (!row) return null;
  const handler = row.currentHandlerId ? one('SELECT id,name,role,org FROM User WHERE id=?', row.currentHandlerId) : null;
  return {
    ...row,
    insured: Boolean(row.insured), major: Boolean(row.major), criminalRisk: Boolean(row.criminalRisk),
    escalated: Boolean(row.escalated), isDemo: Boolean(row.isDemo),
    clarificationAnswers: JSON.parse(row.clarificationAnswers),
    currentHandlerName: handler?.name || null,
    currentHandlerRole: row.currentHandlerRole || handler?.role || 'courier',
  };
}
export function evidenceRows(id) {
  return all('SELECT e.*,u.name AS uploadedByName FROM Evidence e JOIN User u ON u.id=e.uploadedBy WHERE caseId=? ORDER BY e.createdAt DESC', id);
}
export function taskRows(id) {
  return all('SELECT t.*,c.title AS caseTitle,u.name AS assignedToName FROM Task t JOIN "Case" c ON c.id=t.caseId JOIN User u ON u.id=t.assignedTo WHERE t.caseId=? ORDER BY CASE t.status WHEN \'待处理\' THEN 0 ELSE 1 END,t.dueAt IS NULL,t.dueAt', id);
}
export function latestAnalysis(id) {
  const row = one('SELECT result FROM AIAnalysis WHERE caseId=? ORDER BY createdAt DESC,rowid DESC LIMIT 1', id);
  return row ? JSON.parse(row.result) : null;
}
export function caseDetail(id, user = null) {
  const item = caseRow(id);
  if (!item) return null;
  const evidence = evidenceRows(id).map(({ storageName, ...e }) => e);
  const tasks = taskRows(id);
  const analysis = latestAnalysis(id);
  if (analysis) {
    analysis.checklist = (analysis.checklist || []).map(check => ({
      ...check,
      status: evidence.some(e => e.category === check.category) ? '已具备' : check.priority === 'immediate' ? '立即固定' : '待补充',
      priority: evidence.some(e => e.category === check.category) ? 'available' : check.priority === 'available' ? 'supplement' : check.priority,
    }));
  }
  const requiredCount = analysis?.checklist?.length || 0;
  const completedCount = analysis?.checklist?.filter(x => x.status === '已具备').length || 0;
  const pending = tasks.filter(t => t.status === '待处理');
  const dueAt = pending.filter(t => t.dueAt).map(t => t.dueAt).sort()[0] || null;
  const documents = all('SELECT d.*,u.name AS createdByName FROM LegalDocument d JOIN User u ON u.id=d.createdBy WHERE caseId=? ORDER BY d.createdAt DESC', id)
    .filter(document => !user || user.role === 'legal' || document.type !== '答辩材料');
  const timeline = all('SELECT a.*,u.name AS actor,u.role AS actorRole FROM AuditLog a LEFT JOIN User u ON u.id=a.userId WHERE a.caseId=? ORDER BY a.createdAt DESC,a.rowid DESC', id);
  return {
    ...item, evidence, tasks, analysis, documents, timeline,
    evidenceCount: evidence.length, requiredCount, completedCount,
    completeness: requiredCount ? Math.round(completedCount / requiredCount * 100) : 0,
    nextAction: item.status === '已归档' ? '案件已归档' : pending[0]?.title || analysis?.nextAction || '补充案情并进行辅助研判',
    dueAt,
  };
}
export function listCases(user) {
  const scope = caseScope(user);
  return all(`SELECT c.id FROM "Case" c WHERE ${scope.sql} ORDER BY c.updatedAt DESC,c.createdAt DESC`, ...scope.args).map(({ id }) => {
    const { evidence, tasks, analysis, documents, timeline, clarificationAnswers, ...summary } = caseDetail(id);
    return summary;
  });
}
export async function getAnalysis(item, evidence = evidenceRows(item.id)) {
  // User-submitted experience cases enter the retrieval index only after legal
  // review. This keeps an unverified anecdote from becoming a legal citation.
  return analyzeCase(item, evidence, knowledgeRows({ approvedOnly: true }));
}
export function addTask(item, { title, kind, evidenceKey = null, dueAt = null, priority = 'P1', assignedTo = item.ownerId }) {
  const id = uid('task_');
  run('INSERT INTO Task (id,caseId,title,kind,evidenceKey,dueAt,priority,assignedTo,createdAt) VALUES (?,?,?,?,?,?,?,?,?)',
    id, item.id, title, kind, evidenceKey, dueAt, priority, assignedTo, now());
  return id;
}
export function saveAnalysis(item, analysis, user) {
  const timestamp = now();
  run('INSERT INTO AIAnalysis (id,caseId,result,mode,createdBy,createdAt) VALUES (?,?,?,?,?,?)',
    uid('ai_'), item.id, JSON.stringify(analysis), analysis.mode || 'rules', user.id, timestamp);
  run('UPDATE "Case" SET category=?,risk=?,updatedAt=? WHERE id=?', analysis.category, analysis.risk, timestamp, item.id);
  const available = new Set(evidenceRows(item.id).map(e => e.category));
  for (const check of analysis.checklist || []) {
    const key = check.category || check.id;
    const existing = one('SELECT id,status FROM Task WHERE caseId=? AND kind=? AND evidenceKey=?', item.id, 'evidence', key);
    if (available.has(key)) {
      if (existing?.status === '待处理') {
        run('UPDATE Task SET status=?,completedAt=?,completionNote=? WHERE id=?', '已完成', timestamp, '已上传对应证据，系统自动完成', existing.id);
      }
      continue;
    }
    if (!existing && item.status !== '已归档') {
      const hours = Number(check.deadlineHours) || (check.priority === 'immediate' ? 6 : 48);
      const dueAt = key === 'monitor' && item.monitorDeadline ? item.monitorDeadline : new Date(Date.now() + hours * 3600000).toISOString();
      addTask(item, { title: `固定${check.title}${key === 'monitor' && !item.monitorDeadline ? '（保全提醒，覆盖时间待核实）' : ''}`, kind: 'evidence', evidenceKey: key, dueAt, priority: check.priority === 'immediate' ? 'P0' : 'P1' });
    }
  }
  const deadlines = [
    ['insurance', item.insuranceDeadline, '保险报案期限提醒（以保单约定为准）'],
    ['proof', item.proofDeadline, '举证期限提醒（以正式通知为准）'],
  ];
  if (item.monitorDeadline && !(analysis.checklist || []).some(c => c.category === 'monitor')) {
    deadlines.push(['monitor', item.monitorDeadline, '监控即将覆盖，请联系保管人保全原始文件']);
  }
  for (const [key, dueAt, title] of deadlines) {
    if (dueAt && !one('SELECT id FROM Task WHERE caseId=? AND kind=? AND evidenceKey=?', item.id, 'deadline', key)) {
      addTask(item, { title, kind: 'deadline', evidenceKey: key, dueAt, priority: 'P0' });
    }
  }
  if ((analysis.escalationReasons || []).length && !item.escalated && item.status !== '已归档') {
    const legal = one('SELECT id FROM User WHERE role=? ORDER BY id LIMIT 1', 'legal');
    run('UPDATE "Case" SET escalated=1,status=?,currentHandlerRole=?,currentHandlerId=?,handoffStatus=?,handoffNote=?,handoffAt=? WHERE id=?',
      '法务处理中', 'legal', legal?.id || null, 'awaiting_legal', analysis.escalationReasons.join('；'), now(), item.id);
    if (legal) addTask(item, { title: '人工法务审核：' + analysis.escalationReasons.join('；'), kind: 'legal_review', priority: 'P0', dueAt: new Date(Date.now() + 4 * 3600000).toISOString(), assignedTo: legal.id });
    audit(user, '自动升级法务', analysis.escalationReasons.join('；') + (legal ? '。仅作分流，最终决定由人工法务作出。' : '。当前暂无法务账号，需管理员补充。'), item.id);
  }
  audit(user, 'AI辅助研判', `${analysis.category} · ${analysis.risk}风险 · ${analysis.mode === 'llm' ? '检索增强模型' : '规则引擎与知识检索'}；法律依据 ${analysis.citations?.length || 0} 项。`, item.id);
}
