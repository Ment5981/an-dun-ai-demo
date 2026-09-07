import { staticApi } from './staticDemo';

export type Role = 'courier' | 'supervisor' | 'legal';
export type User = { id: string; username?: string; name: string; role: Role; org: string };
export type Evidence = { id: string; title: string; category: string; originalName: string; mimeType: string; size: number; sha256: string; createdAt: string; uploadedBy: string; status: string };
export type Task = { id: string; caseId: string; caseTitle: string; title: string; kind: string; status: string; dueAt: string; priority: string; assignedTo: string; createdAt: string };
export type Knowledge = { id: string; title: string; type: string; content: string; sourceUrl: string; version: string; isDemo?: boolean; verifiedAt?: string; score?: number; reviewStatus?: string; createdByName?: string; createdBy?: string; attachmentName?: string; visibility?: string; org?: string; reviewNote?: string };
export type Citation = { id: string; title: string; sourceUrl: string; version: string; excerpt: string };
export type AgentDraft = { title: string; goods: string; amount: number | null; category: string; description: string };
export type AgentMessage = { role: 'user' | 'assistant'; content: string };
export type AiTraceStage = { id: string; title: string; status: string; output: string; explanation: string; sourceIds?: string[]; reasons?: string[]; missingCategories?: string[]; urgentCategories?: string[]; escalationReasons?: string[] };
export type AiTrace = {
  pipeline?: string; version?: string; generatedAt?: string; status?: string; mode?: 'rules' | 'llm'; model?: string | null;
  runtime?: { providerConfigured?: boolean; provider?: string; model?: string | null; fallback?: boolean; status?: string; latencyMs?: number };
  stages?: AiTraceStage[]; sources?: Array<{ rank: number; id: string; title: string; type?: string; version?: string | null; sourceUrl?: string | null; score?: number | null; matchTerms?: string[] }>;
  evidence?: { requiredCategories?: string[]; availableCategories?: string[]; missingCategories?: string[]; uploadedCount?: number };
  humanReviewRequired?: boolean; humanReviewReasons?: string[]; guardrails?: string[];
};
export type Analysis = {
  category: string; risk: string; summary: string; focusPoints: string[]; riskReasons?: string[];
  questions: { id: string; question: string }[];
  checklist: { id: string; title: string; category: string; priority: 'immediate' | 'supplement' | 'available'; reason: string; deadlineHours?: number }[];
  sop: { title: string; description: string }[]; citations: Citation[]; escalationReasons: string[];
  nextAction?: string; evidenceReview?: string; engine?: string; model?: string | null; aiTrace?: AiTrace;
  modeDetail?: string; retrievalCount?: number; evidenceGapCount?: number; triggerReasons?: string[];
  mode: 'rules' | 'llm'; generatedAt: string; disclaimer: string; fallbackReason?: string;
};
export type LegalDocument = { id: string; type: string; title: string; content: string; createdAt: string; status: string };
export type AuditLog = { id: string; action: string; detail?: string; details?: string; actorName?: string; userName?: string; createdAt: string; caseId?: string };
export type CaseItem = {
  id: string; title: string; waybill: string; category: string; risk: string; status: string; amount: number;
  ownerName: string; ownerId: string; org: string; createdAt: string; updatedAt: string;
  evidenceCount: number; requiredCount: number; completeness: number; nextAction: string; dueAt: string; escalated: boolean;
  description: string; goods: string; insured: boolean; incidentAt: string; monitorDeadline?: string;
  insuranceDeadline?: string; proofDeadline?: string; major: boolean; criminalRisk: boolean;
  currentHandlerRole?: Role; currentHandlerId?: string; currentHandlerName?: string | null; handoffStatus?: string; handoffNote?: string | null; handoffAt?: string | null; allowedActions?: string[]; completedCount?: number; legalReviewedAt?: string;
  clarificationAnswers?: Record<string, string>; evidence: Evidence[]; tasks: Task[]; documents: LegalDocument[];
  timeline: AuditLog[]; analysis: Analysis;
};
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (import.meta.env.MODE === 'github-pages') return staticApi<T>(path, options);
  const res = await fetch(`/api${path}`, { ...options, credentials: 'same-origin', headers: { ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `请求失败（${res.status}）`);
  return data as T;
}
export const post = <T,>(path: string, data: unknown = {}) => api<T>(path, { method: 'POST', body: JSON.stringify(data) });
export const roleNames: Record<Role, string> = { courier: '快递员', supervisor: '网点主管', legal: '法务' };
export function dateText(value?: string, full = false) {
  if (!value) return '未设置';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', ...(full ? { year: 'numeric' } : {}) });
}
export function timeLeft(value?: string) {
  if (!value) return '待确认期限';
  const delta = new Date(value).getTime() - Date.now();
  if (delta <= 0) return `已逾期 ${Math.max(1, Math.floor(-delta / 3600000))} 小时`;
  if (delta < 3600000) return `剩余 ${Math.ceil(delta / 60000)} 分钟`;
  if (delta < 86400000) return `剩余 ${Math.floor(delta / 3600000)} 小时 ${Math.floor(delta % 3600000 / 60000)} 分钟`;
  return `剩余 ${Math.ceil(delta / 86400000)} 天`;
}
