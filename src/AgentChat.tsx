import { useState } from 'react';
import { Button, Textarea } from '@fluentui/react-components';
import { ArrowRight24Regular, Dismiss24Regular, Send24Regular, ShieldTask24Regular, Sparkle24Regular } from '@fluentui/react-icons';
import { api } from './api';
import type { AgentDraft, AgentMessage, Role } from './api';
import { roleNames } from './api';

type AgentResult = { reply: string; questions?: string[]; draft: AgentDraft | null; mode: 'rules' | 'llm'; model?: string | null; disclaimer: string };
const greetings: Record<Role, string> = {
  courier: '你好，我是顺丰案盾 AI 案件助手。直接告诉我快件发生了什么，我会先帮你整理事实，并提醒现在最该固定的证据。',
  supervisor: '你好，我是顺丰案盾 AI 案件助手。你可以描述一线上报或客户争议，我会帮你快速梳理缺口、风险和下一步协同动作。',
  legal: '你好，我是顺丰案盾 AI 案件助手。可以先描述案件背景，我会整理事实和可追溯依据，最终法律口径仍由你确认。',
};

export function AgentChat({ role, onCreateCase, onClose }: { role: Role; onCreateCase?: (draft: AgentDraft) => void; onClose?: () => void }) {
  const [messages, setMessages] = useState<AgentMessage[]>([{ role: 'assistant', content: greetings[role] }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState<AgentResult | null>(null);
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next); setInput(''); setBusy(true); setError('');
    try {
      const result = await api<AgentResult>('/agent/chat', { method: 'POST', body: JSON.stringify({ messages: next }) });
      setMessages(current => [...current, { role: 'assistant', content: result.reply }]);
      setLastResult(result);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  const quick = ['客户说快件破损了', '客户说没收到，但系统显示已签收', '我不知道现在该留什么证据'];
  return <section className="agent-chat-panel" aria-label="AI 案件助手"><div className="agent-chat-header"><div className="agent-chat-brand"><span><Sparkle24Regular /></span><div><strong>AI 案件助手</strong><small>先聊天，再自动整理成案件</small></div></div>{onClose && <Button appearance="subtle" icon={<Dismiss24Regular />} aria-label="关闭 AI 案件助手" onClick={onClose}/>}</div><div className="agent-chat-intro"><ShieldTask24Regular/><p>不用先填表。说清楚“发生了什么”，AI 会继续追问时间、货物、客户诉求和手上已有的证据。</p></div><div className="agent-chat-messages">{messages.map((message, index) => <div className={`agent-message ${message.role}`} key={`${message.role}-${index}`}><span className="agent-message-role">{message.role === 'assistant' ? 'AI 助手' : '我'}</span><p>{message.content}</p></div>)}{busy && <div className="agent-message assistant"><span className="agent-message-role">AI 助手</span><p className="agent-typing">正在理解案情<span>·</span><span>·</span><span>·</span></p></div>}</div><div className="agent-quick-prompts">{quick.map(prompt => <button key={prompt} type="button" onClick={() => setInput(prompt)}>{prompt}</button>)}</div>{lastResult?.draft && <div className="agent-draft-card"><div><span className="agent-draft-label">已整理案件草稿 · {lastResult.mode === 'llm' ? lastResult.model || '模型增强' : '本地规则'}</span><strong>{lastResult.draft.title}</strong><p>{lastResult.draft.category} · {lastResult.draft.amount ? `主张金额 ¥${lastResult.draft.amount.toLocaleString('zh-CN')}` : '金额待补充'}{lastResult.draft.goods ? ` · ${lastResult.draft.goods}` : ''}</p></div>{onCreateCase && <Button appearance="primary" icon={<ArrowRight24Regular />} iconPosition="after" onClick={() => onCreateCase(lastResult.draft!)}>用对话创建案件</Button>}</div>}{error && <div className="error-box" role="alert">{error}</div>}<form className="agent-chat-compose" onSubmit={send}><Textarea aria-label="告诉 AI 发生了什么" value={input} onChange={(_, data) => setInput(data.value)} placeholder="例如：客户收到相机后发现镜头破损，要求赔偿……" resize="vertical" rows={2} disabled={busy}/><Button appearance="primary" type="submit" icon={<Send24Regular />} disabled={!input.trim() || busy}>发送</Button></form><small className="agent-chat-disclaimer">{lastResult?.disclaimer || 'AI 仅辅助整理事实和证据，不替代主管或法务决策。当前身份：' + roleNames[role]}</small></section>;
}
