import {
  Avatar,
  Button,
  Checkbox,
  Input,
  Tab,
  TabList,
  Textarea,
} from "@fluentui/react-components";
import {
  Add24Regular,
  AlertUrgent24Filled,
  ArrowRight24Regular,
  ArrowUpload24Regular,
  BotSparkle24Regular,
  Box24Regular,
  BrainCircuit24Regular,
  Briefcase24Regular,
  CheckmarkCircle24Regular,
  ChevronRight20Regular,
  Clock24Regular,
  DataTrending24Regular,
  Database24Regular,
  DocumentText24Regular,
  History24Regular,
  Home24Regular,
  MoreHorizontal20Regular,
  PanelLeft24Regular,
  PeopleTeam24Regular,
  Person24Regular,
  Play24Filled,
  ScaleFill24Regular,
  Search24Regular,
  Send24Regular,
  Settings24Regular,
  ShieldError24Regular,
  ShieldTask24Regular,
  Sparkle24Filled,
  TargetArrow24Regular,
  TaskListSquareLtr24Regular,
} from "@fluentui/react-icons";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

type PageId = "workbench" | "intake" | "case" | "actions" | "insights";
type CaseTab = "overview" | "facts" | "evidence" | "risk" | "action" | "timeline" | "assistant";

type CaseItem = {
  id: string;
  name: string;
  waybill: string;
  type: string;
  risk: "高" | "中" | "低";
  stage: string;
  completeness: number;
  owner: string;
  next: string;
  due: string;
};

const cases: CaseItem[] = [
  {
    id: "YS20260901001",
    name: "深圳相机货损",
    waybill: "SF1438290175621",
    type: "运输货损",
    risk: "高",
    stage: "证据保全",
    completeness: 76,
    owner: "陈思远",
    next: "固定分拨中心监控",
    due: "今天 18:00",
  },
  {
    id: "YS20260831018",
    name: "上海高值件丢失",
    waybill: "SF1023846721908",
    type: "运输丢件",
    risk: "高",
    stage: "法务初评",
    completeness: 88,
    owner: "宋予安",
    next: "复核赔偿口径",
    due: "明天 10:00",
  },
  {
    id: "YS20260830052",
    name: "广州签收争议",
    waybill: "SF2284029673150",
    type: "签收争议",
    risk: "低",
    stage: "事实核验",
    completeness: 64,
    owner: "何清越",
    next: "补充签收底单",
    due: "9 月 3 日",
  },
  {
    id: "YS20260829036",
    name: "杭州生鲜延误",
    waybill: "SF3340917628041",
    type: "运输延误",
    risk: "中",
    stage: "协商处理",
    completeness: 93,
    owner: "陈思远",
    next: "确认客户方案",
    due: "9 月 4 日",
  },
  {
    id: "YS20260828011",
    name: "成都代下单争议",
    waybill: "SF6190382745206",
    type: "代下单争议",
    risk: "中",
    stage: "待补证据",
    completeness: 57,
    owner: "周墨",
    next: "补充授权记录",
    due: "9 月 5 日",
  },
];

const navItems: Array<{ id: PageId; label: string; icon: React.ReactNode; badge?: string }> = [
  { id: "workbench", label: "案件工作台", icon: <Home24Regular /> },
  { id: "intake", label: "AI 智能报案", icon: <BotSparkle24Regular /> },
  { id: "case", label: "案件工作区", icon: <Briefcase24Regular /> },
  { id: "actions", label: "行动中心", icon: <TaskListSquareLtr24Regular />, badge: "4" },
  { id: "insights", label: "管理驾驶舱", icon: <DataTrending24Regular /> },
];

const riskClass: Record<CaseItem["risk"], string> = {
  高: "risk-high",
  中: "risk-medium",
  低: "risk-low",
};

function Brand() {
  return (
    <div className="brand" aria-label="案盾 AI">
      <div className="brand-mark"><ShieldTask24Regular /></div>
      <div>
        <strong>案盾 AI</strong>
        <span>智能案件助手</span>
      </div>
    </div>
  );
}

function RiskBadge({ risk }: { risk: CaseItem["risk"] }) {
  return <span className={`risk-badge ${riskClass[risk]}`}><i />{risk}风险</span>;
}

function DemoTag({ label = "Demo Data" }: { label?: string }) {
  return <span className="demo-tag">{label}</span>;
}

function Ring({ value, label, size = "normal" }: { value: number; label?: string; size?: "normal" | "large" }) {
  return (
    <div className={`ring ${size === "large" ? "ring-large" : ""}`} style={{ "--ring-value": `${value * 3.6}deg` } as React.CSSProperties}>
      <div className="ring-inner">
        <strong>{value}<small>%</small></strong>
        {label && <span>{label}</span>}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, delta, tone = "neutral" }: { icon: React.ReactNode; label: string; value: string; delta: string; tone?: "neutral" | "danger" | "good" }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon metric-${tone}`}>{icon}</div>
      <div className="metric-copy">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <span className={`metric-delta delta-${tone}`}>{delta}</span>
    </article>
  );
}

function PageHeading({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: React.ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

function Workbench({ onNewCase, onOpenCase }: { onNewCase: () => void; onOpenCase: () => void }) {
  const [filter, setFilter] = useState("全部案件");
  const filtered = filter === "全部案件" ? cases : cases.filter((item) => {
    if (filter === "高风险") return item.risk === "高";
    if (filter === "即将到期") return item.due.includes("今天") || item.due.includes("明天");
    if (filter === "待补证据") return item.stage.includes("证据") || item.stage.includes("补");
    return true;
  });

  return (
    <div className="page workbench-page">
      <PageHeading
        title="案件工作台"
        description="把风险、证据和下一步行动放在同一视野里。"
        actions={
          <><DemoTag /><Button appearance="primary" size="large" icon={<Add24Regular />} onClick={onNewCase}>智能报案</Button></>
        }
      />

      <section className="metric-grid" aria-label="案件概览">
        <MetricCard icon={<Briefcase24Regular />} label="进行中案件" value="24" delta="本周新增 6" />
        <MetricCard icon={<ShieldError24Regular />} label="高风险案件" value="5" delta="2 个待处理" tone="danger" />
        <MetricCard icon={<Clock24Regular />} label="48 小时内到期" value="7" delta="最早 5h 42m" tone="danger" />
        <MetricCard icon={<CheckmarkCircle24Regular />} label="本周已结案" value="12" delta="较上周 +18%" tone="good" />
      </section>

      <section className="priority-strip" aria-label="最高优先级行动">
        <div className="priority-signal"><AlertUrgent24Filled /></div>
        <div className="priority-copy">
          <span>P0 最高优先级</span>
          <h2>固定深圳 XX 分拨中心监控</h2>
          <p>监控预计明天覆盖，证据灭失将直接影响责任认定。</p>
        </div>
        <div className="priority-meta">
          <div><span>负责人</span><strong>深圳运营中心</strong></div>
          <div><span>截止时间</span><strong>今天 18:00</strong></div>
        </div>
        <Button appearance="primary" iconPosition="after" icon={<ArrowRight24Regular />} onClick={onOpenCase}>立即处理</Button>
      </section>

      <section className="surface cases-surface">
        <div className="surface-header">
          <div>
            <h2>案件队列</h2>
            <p>按业务风险权重实时排序</p>
          </div>
          <DemoTag />
        </div>
        <div className="filters" role="tablist" aria-label="案件筛选">
          {["全部案件", "高风险", "即将到期", "待补证据"].map((item) => (
            <button key={item} className={filter === item ? "filter-active" : ""} onClick={() => setFilter(item)}>{item}</button>
          ))}
        </div>
        <div className="case-table" role="table" aria-label="案件列表">
          <div className="case-row case-table-head" role="row">
            <span>案件</span><span>风险</span><span>阶段</span><span>完整度</span><span>下一步行动</span><span>截止</span><span />
          </div>
          <AnimatePresence mode="popLayout">
            {filtered.map((item) => (
              <motion.button
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="case-row case-table-row"
                role="row"
                key={item.id}
                onClick={onOpenCase}
              >
                <span className="case-name"><b>{item.name}</b><small>{item.waybill}</small></span>
                <span><RiskBadge risk={item.risk} /></span>
                <span className="stage-cell">{item.stage}</span>
                <span className="completeness-cell"><b>{item.completeness}%</b><i><i style={{ width: `${item.completeness}%` }} /></i></span>
                <span className="next-cell">{item.next}</span>
                <span className={item.due.includes("今天") ? "due-urgent" : ""}>{item.due}</span>
                <span><ChevronRight20Regular /></span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}

const intakeFacts = [
  { key: "案件类型", value: "运输货损", confidence: "98%", source: "用户描述" },
  { key: "货物", value: "相机镜头", confidence: "96%", source: "用户描述" },
  { key: "客户声称价值", value: "¥30,000", confidence: "94%", source: "客户声称" },
  { key: "保价状态", value: "未保价", confidence: "99%", source: "用户描述" },
  { key: "客户诉求", value: "全额赔偿", confidence: "97%", source: "用户描述" },
];

function Intake({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState(0);
  const [busy, setBusy] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const timers = useRef<number[]>([]);
  const [description, setDescription] = useState("客户寄了一台价值 3 万元的相机，收到后镜头损坏，没有保价，现在要求全额赔偿。");
  const [urgentInput, setUrgentInput] = useState("网点说监控明天会覆盖，需要尽快调取。");

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const later = (callback: () => void, delay: number) => {
    const id = window.setTimeout(callback, delay);
    timers.current.push(id);
  };

  const analyze = () => {
    if (!description.trim()) return;
    setBusy(true);
    later(() => {
      setBusy(false);
      setPhase(1);
    }, 900);
  };

  const autoRun = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    setAutoMode(true);
    setBusy(true);
    setPhase(0);
    later(() => { setBusy(false); setPhase(1); }, 800);
    later(() => setPhase(2), 1900);
    later(() => setPhase(3), 3100);
    later(() => { setPhase(4); setAutoMode(false); }, 4500);
  };

  const completeness = [18, 48, 64, 76, 91][phase];
  const visibleFacts = phase === 0 ? 0 : phase === 1 ? 5 : phase === 2 ? 6 : phase === 3 ? 7 : 8;

  return (
    <div className="page intake-page">
      <PageHeading
        eyebrow="Intake Agent"
        title="AI 智能报案"
        description="用自然语言讲清案情，AI 只追问真正影响风险判断的信息。"
        actions={<Button appearance="secondary" icon={<Play24Filled />} onClick={autoRun} disabled={autoMode}>自动演示</Button>}
      />

      <div className="intake-layout">
        <section className="surface conversation-panel">
          <div className="conversation-top">
            <div className="agent-avatar"><BotSparkle24Regular /></div>
            <div><strong>案盾 Intake Agent</strong><span>{autoMode ? "正在自动演示核心流程" : "等待关键信息"}</span></div>
            <div className="agent-state"><i />在线</div>
          </div>
          <div className="conversation-body" aria-live="polite">
            <div className="chat-message assistant-message">
              <div className="chat-avatar"><Sparkle24Filled /></div>
              <div>
                <p>请直接描述发生了什么。我会提取事实并提示需要立即保全的证据。</p>
                <span>案盾 AI</span>
              </div>
            </div>

            <div className="intake-compose">
              <label htmlFor="case-description">案件描述</label>
              <Textarea id="case-description" resize="vertical" value={description} onChange={(_, data) => setDescription(data.value)} disabled={phase > 0 || busy} />
              <div className="compose-footer">
                <Button appearance="subtle" icon={<ArrowUpload24Regular />} disabled>添加材料</Button>
                <Button appearance="primary" icon={busy ? <Sparkle24Filled /> : <Send24Regular />} onClick={analyze} disabled={phase > 0 || busy}>
                  {busy ? "正在识别事实" : "开始智能分析"}
                </Button>
              </div>
            </div>

            {phase >= 1 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="chat-message assistant-message analysis-message">
                <div className="chat-avatar"><BrainCircuit24Regular /></div>
                <div>
                  <strong>已识别为运输货损纠纷</strong>
                  <p>我提取了 5 项已知事实。客户声称价值与实际货值已区分记录，目前有 4 项关键信息待确认。</p>
                  <div className="inline-facts"><span>未保价</span><span>声称价值 ¥30,000</span><span>诉求 全额赔偿</span></div>
                </div>
              </motion.div>
            )}

            {phase === 1 && !autoMode && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="question-block">
                <span>优先追问 1 / 3</span>
                <h3>运单由谁下单？</h3>
                <p>用于判断合同关系及是否存在代下单授权争议。</p>
                <div className="choice-row">
                  <Button appearance="secondary" onClick={() => setPhase(2)}>寄件人本人</Button>
                  <Button appearance="secondary" onClick={() => setPhase(2)}>他人代下单</Button>
                  <Button appearance="secondary" onClick={() => setPhase(2)}>暂不清楚</Button>
                </div>
              </motion.div>
            )}

            {phase === 2 && !autoMode && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="question-block">
                <span>优先追问 2 / 3</span>
                <h3>收件人何时发现镜头损坏？</h3>
                <p>开箱时点会影响外包装、签收记录与运输责任判断。</p>
                <div className="choice-row">
                  <Button appearance="secondary" onClick={() => setPhase(3)}>签收时当场发现</Button>
                  <Button appearance="secondary" onClick={() => setPhase(3)}>签收后 20 分钟</Button>
                  <Button appearance="secondary" onClick={() => setPhase(3)}>当天稍晚发现</Button>
                </div>
              </motion.div>
            )}

            {phase === 3 && !autoMode && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="question-block urgent-question">
                <span>证据时效检查</span>
                <h3>网点监控是否存在覆盖风险？</h3>
                <p>这一信息会直接改变当前行动优先级。</p>
                <Textarea resize="vertical" value={urgentInput} onChange={(_, data) => setUrgentInput(data.value)} />
                <Button appearance="primary" icon={<Send24Regular />} onClick={() => setPhase(4)}>提交关键信息</Button>
              </motion.div>
            )}

            {phase >= 4 && (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="emergency-card">
                <div className="emergency-icon"><AlertUrgent24Filled /></div>
                <div className="emergency-copy">
                  <span>紧急中断已触发</span>
                  <h3>监控存在 24 小时内覆盖风险</h3>
                  <p>普通追问已暂停。系统已生成 P0 证据固定任务，需在今天 18:00 前完成。</p>
                  <div className="emergency-action"><strong>立即调取深圳 XX 分拨中心监控</strong><span>负责人：深圳运营中心</span></div>
                  <Button appearance="primary" iconPosition="after" icon={<ArrowRight24Regular />} onClick={onComplete}>创建案件并进入工作区</Button>
                </div>
              </motion.div>
            )}
          </div>
        </section>

        <aside className="surface case-profile">
          <div className="surface-header profile-header">
            <div><h2>实时案件画像</h2><p>字段均保留来源与置信度</p></div>
            <Ring value={completeness} />
          </div>
          {phase === 0 ? (
            <div className="profile-empty"><Database24Regular /><strong>等待事实提取</strong><p>提交案件描述后，结构化事实会显示在这里。</p></div>
          ) : (
            <div className="fact-list">
              {intakeFacts.map((fact, index) => (
                <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} className="fact-item" key={fact.key}>
                  <div><span>{fact.key}</span><strong>{fact.value}</strong></div>
                  <div className="fact-meta"><span>{fact.source}</span><b>{fact.confidence}</b></div>
                </motion.div>
              ))}
              {visibleFacts >= 6 && <div className="fact-item"><div><span>下单关系</span><strong>寄件人本人</strong></div><div className="fact-meta"><span>用户确认</span><b>100%</b></div></div>}
              {visibleFacts >= 7 && <div className="fact-item"><div><span>发现时点</span><strong>签收后 20 分钟</strong></div><div className="fact-meta"><span>用户确认</span><b>100%</b></div></div>}
              {visibleFacts >= 8 && <div className="fact-item fact-danger"><div><span>监控覆盖时间</span><strong>24 小时内</strong></div><div className="fact-meta"><span>网点反馈</span><b>高紧急度</b></div></div>}
            </div>
          )}
          <div className="profile-legend"><span><i className="confirmed" />已确认</span><span><i className="unknown" />待确认</span><span><i className="conflict" />存在冲突</span></div>
        </aside>
      </div>
    </div>
  );
}

const facts = {
  confirmed: [
    ["纠纷类型", "运输货损", "用户描述 · 98%"],
    ["客户声称价值", "¥30,000", "客户陈述 · 94%"],
    ["保价状态", "未保价", "运单接口 · 100%"],
    ["发现时点", "签收后 20 分钟", "用户确认 · 100%"],
  ],
  unknown: [
    ["实际货值凭证", "待补充", "影响赔偿基础"],
    ["外包装照片", "待补充", "影响责任认定"],
  ],
  conflict: [
    ["货物状态", "客户称镜头损坏", "派件员记录外观完好"],
  ],
};

const evidenceItems = [
  { name: "分拨中心监控", state: "紧急固定", owner: "深圳运营中心", due: "今天 18:00", tone: "danger", icon: <AlertUrgent24Filled /> },
  { name: "开箱视频", state: "待客户补充", owner: "客服团队", due: "明天 12:00", tone: "warning", icon: <DocumentText24Regular /> },
  { name: "运单与保价记录", state: "已获取", owner: "系统自动", due: "已完成", tone: "success", icon: <CheckmarkCircle24Regular /> },
  { name: "货值购买凭证", state: "待核验", owner: "法务承办人", due: "9 月 3 日", tone: "neutral", icon: <ScaleFill24Regular /> },
];

function OverviewTab({ actionDone, markDone }: { actionDone: boolean; markDone: () => void }) {
  return (
    <div className="overview-grid">
      <section className="surface case-summary">
        <div className="surface-header"><div><h2>AI 案件摘要</h2><p>基于当前已确认事实</p></div><DemoTag label="AI Generated" /></div>
        <p className="summary-text">客户主张一台未保价相机在运输后镜头损坏，要求按声称价值 3 万元全额赔偿。当前首要风险不是赔偿口径，而是分拨监控即将覆盖。</p>
        <div className="summary-stats">
          <div><span>纠纷类型</span><strong>运输货损</strong></div>
          <div><span>客户诉求</span><strong>¥30,000</strong></div>
          <div><span>案件阶段</span><strong>{actionDone ? "风险初评" : "证据保全"}</strong></div>
        </div>
      </section>
      <section className="surface completeness-panel">
        <Ring value={actionDone ? 86 : 76} label="完整度" size="large" />
        <div><h2>风险加权完整度</h2><p>已确认 7 项，待补 3 项，冲突 1 项。</p><span className="next-gain">补充货值凭证可提升 8%</span></div>
      </section>
      <section className="surface evidence-overview">
        <div className="surface-header"><div><h2>关键证据</h2><p>按灭失风险排序</p></div><Button appearance="subtle" size="small">查看全部</Button></div>
        <div className="evidence-mini-grid">
          {evidenceItems.slice(0, 3).map((item) => <EvidenceCard key={item.name} {...item} actionDone={actionDone} />)}
        </div>
      </section>
      <section className="surface issue-panel">
        <div className="surface-header"><div><h2>争议焦点</h2><p>需要人工法务判断</p></div><ScaleFill24Regular /></div>
        <div className="issue-list">
          <div><span>01</span><div><strong>限额赔偿条款能否有效适用</strong><p>需核验提示说明、客户知情及条款效力。</p></div></div>
          <div><span>02</span><div><strong>损坏是否发生于运输环节</strong><p>监控、开箱记录与外包装状态是关键证据。</p></div></div>
        </div>
      </section>
      {!actionDone && (
        <section className="surface action-callout">
          <div><TargetArrow24Regular /><span>Next Best Action</span><h2>立即固定分拨中心监控</h2><p>这一动作可避免关键客观证据灭失。</p></div>
          <Button appearance="primary" size="large" icon={<CheckmarkCircle24Regular />} onClick={markDone}>标记已固定</Button>
        </section>
      )}
    </div>
  );
}

function EvidenceCard({ name, state, owner, due, tone, icon, actionDone = false }: { name: string; state: string; owner: string; due: string; tone: string; icon: React.ReactNode; actionDone?: boolean }) {
  const isMonitor = name.includes("监控") && actionDone;
  return (
    <article className={`evidence-card evidence-${isMonitor ? "success" : tone}`}>
      <div className="evidence-icon">{isMonitor ? <CheckmarkCircle24Regular /> : icon}</div>
      <div><strong>{name}</strong><span>{isMonitor ? "已固定" : state}</span></div>
      <div className="evidence-meta"><span>{owner}</span><b>{isMonitor ? "刚刚完成" : due}</b></div>
    </article>
  );
}

function FactsTab() {
  return (
    <div className="facts-columns">
      <FactGroup title="已确认事实" count={facts.confirmed.length} tone="confirmed" rows={facts.confirmed} />
      <FactGroup title="待确认事实" count={facts.unknown.length} tone="unknown" rows={facts.unknown} />
      <FactGroup title="事实冲突" count={facts.conflict.length} tone="conflict" rows={facts.conflict} />
    </div>
  );
}

function FactGroup({ title, count, tone, rows }: { title: string; count: number; tone: string; rows: string[][] }) {
  return (
    <section className={`surface fact-group fact-group-${tone}`}>
      <div className="fact-group-title"><i /><h2>{title}</h2><span>{count}</span></div>
      <div className="fact-group-rows">
        {rows.map((row) => <div key={row[0]}><span>{row[0]}</span><strong>{row[1]}</strong><small>{row[2]}</small></div>)}
      </div>
    </section>
  );
}

function EvidenceTab({ actionDone }: { actionDone: boolean }) {
  return (
    <div className="evidence-tab">
      <div className="evidence-grid-large">
        {evidenceItems.map((item) => <EvidenceCard key={item.name} {...item} actionDone={actionDone} />)}
      </div>
      <section className="surface preservation-note">
        <ShieldError24Regular />
        <div><h2>证据保全规则已运行</h2><p>系统持续检测存储周期、获取渠道和责任部门。监控类证据进入 24 小时窗口时自动升级为 P0。</p></div>
        <span>Rule v3.4</span>
      </section>
    </div>
  );
}

function RiskTab() {
  return (
    <div className="risk-layout">
      <section className="surface risk-brief">
        <div className="risk-score"><Ring value={72} size="large" /><div><span>综合风险</span><strong>高</strong><p>需人工法务复核</p></div></div>
        <div className="risk-factors">
          <div><span>证据灭失风险</span><strong>高</strong></div>
          <div><span>赔偿金额风险</span><strong>中高</strong></div>
          <div><span>舆情升级风险</span><strong>低</strong></div>
        </div>
      </section>
      <section className="surface legal-analysis">
        <div className="surface-header"><div><h2>风险分析</h2><p>AI 辅助结论，不替代法律判断</p></div><DemoTag label="需人工复核" /></div>
        <article><span>争议焦点</span><h3>未保价是否当然适用限额赔偿</h3><p>需要结合运输合同提示方式、格式条款说明义务、实际损失证明及内部赔付规则综合判断。当前材料不足以直接确认赔偿上限。</p></article>
        <article><span>证据判断</span><h3>运输环节因果关系仍需补强</h3><p>分拨监控、外包装照片和开箱视频将共同影响损坏时点认定。监控覆盖风险应先于普通事实补充处理。</p></article>
      </section>
      <section className="surface citations-panel">
        <div className="surface-header"><div><h2>依据与引用</h2><p>可追溯知识来源</p></div><Database24Regular /></div>
        <div className="citation-list">
          <button><span>L1 法律法规</span><strong>《中华人民共和国民法典》运输合同相关条款</strong><ChevronRight20Regular /></button>
          <button><span>L2 内部制度</span><strong>高值易损品运输纠纷处理指引</strong><ChevronRight20Regular /></button>
          <button><span>L3 历史案件</span><strong>相似案件 12 件，近一年调解结案 8 件</strong><ChevronRight20Regular /></button>
        </div>
      </section>
    </div>
  );
}

const actionRows = [
  { id: "monitor", title: "固定深圳 XX 分拨中心监控", priority: "P0", owner: "深圳运营中心", due: "今天 18:00", reason: "监控即将覆盖" },
  { id: "video", title: "向客户补充开箱视频", priority: "P1", owner: "客服团队", due: "明天 12:00", reason: "核验损坏发现时点" },
  { id: "invoice", title: "核验相机购买凭证", priority: "P1", owner: "陈思远", due: "9 月 3 日", reason: "确认实际货值" },
];

function ActionTab({ actionDone, markDone }: { actionDone: boolean; markDone: () => void }) {
  const [done, setDone] = useState<string[]>(actionDone ? ["monitor"] : []);
  return (
    <section className="surface action-table-panel">
      <div className="surface-header"><div><h2>结构化行动</h2><p>责任人、截止时间和原因均可追踪</p></div><Button appearance="secondary" icon={<Add24Regular />}>新增行动</Button></div>
      <div className="action-rows">
        {actionRows.map((item) => {
          const checked = done.includes(item.id);
          return (
            <div className={`action-row ${checked ? "action-done" : ""}`} key={item.id}>
              <Checkbox checked={checked} onChange={(_, data) => {
                setDone((current) => data.checked ? [...current, item.id] : current.filter((id) => id !== item.id));
                if (item.id === "monitor" && data.checked) markDone();
              }} />
              <span className={`priority-code priority-${item.priority.toLowerCase()}`}>{item.priority}</span>
              <div><strong>{item.title}</strong><span>{item.reason}</span></div>
              <div><span>负责人</span><strong>{item.owner}</strong></div>
              <div><span>截止</span><strong>{item.due}</strong></div>
              <Button appearance="subtle" icon={<MoreHorizontal20Regular />} aria-label="更多操作" />
            </div>
          );
        })}
      </div>
    </section>
  );
}

const timelineEvents = [
  { time: "10:24", title: "P0 行动已生成", detail: "监控存在覆盖风险，Action Agent 自动升级优先级。", icon: <TargetArrow24Regular />, tone: "danger" },
  { time: "10:23", title: "关键事实已补充", detail: "网点反馈分拨监控将在明天覆盖。", icon: <AlertUrgent24Filled />, tone: "danger" },
  { time: "10:19", title: "案件创建", detail: "完成事实提取，案件完整度 76%。", icon: <Briefcase24Regular />, tone: "normal" },
  { time: "10:17", title: "运单信息已获取", detail: "Mock 运单接口返回未保价记录。", icon: <Database24Regular />, tone: "normal" },
  { time: "10:16", title: "业务人员发起报案", detail: "自然语言描述相机货损及客户诉求。", icon: <Person24Regular />, tone: "normal" },
];

function TimelineTab() {
  return (
    <section className="surface timeline-panel">
      <div className="surface-header"><div><h2>案件时间线</h2><p>所有事实、证据和行动变更均保留记录</p></div><History24Regular /></div>
      <div className="timeline-list">
        {timelineEvents.map((event) => <div className={`timeline-event timeline-${event.tone}`} key={`${event.time}-${event.title}`}><time>{event.time}</time><div className="timeline-icon">{event.icon}</div><div><strong>{event.title}</strong><p>{event.detail}</p></div></div>)}
      </div>
    </section>
  );
}

function AssistantTab() {
  const [value, setValue] = useState("为什么当前应先固定监控？");
  const [sent, setSent] = useState(false);
  return (
    <section className="surface case-assistant">
      <div className="assistant-hero"><div className="assistant-orb"><BrainCircuit24Regular /></div><h2>询问这个案件</h2><p>回答仅基于案件事实、可追溯知识和当前规则。</p></div>
      <div className="suggestion-row">
        {["总结当前风险", "还缺哪些证据", "生成协商要点"].map((item) => <button key={item} onClick={() => setValue(item)}>{item}</button>)}
      </div>
      {sent && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="assistant-answer"><Sparkle24Filled /><div><strong>当前应先固定监控</strong><p>监控具有明确的 24 小时覆盖窗口，一旦灭失将无法恢复。赔偿口径与货值凭证仍可后续核验，因此证据保全优先级更高。</p><span>依据：证据保全规则 v3.4</span></div></motion.div>}
      <div className="assistant-input"><Input value={value} onChange={(_, data) => setValue(data.value)} placeholder="询问案件事实、证据或风险" /><Button appearance="primary" icon={<Send24Regular />} onClick={() => setSent(true)}>发送</Button></div>
    </section>
  );
}

function CaseWorkspace({ onToast }: { onToast: (message: string) => void }) {
  const [tab, setTab] = useState<CaseTab>("overview");
  const [actionDone, setActionDone] = useState(false);

  const markDone = () => {
    if (!actionDone) {
      setActionDone(true);
      onToast("监控固定任务已完成，案件进入风险初评阶段");
    }
  };

  const tabContent: Record<CaseTab, React.ReactNode> = {
    overview: <OverviewTab actionDone={actionDone} markDone={markDone} />,
    facts: <FactsTab />,
    evidence: <EvidenceTab actionDone={actionDone} />,
    risk: <RiskTab />,
    action: <ActionTab actionDone={actionDone} markDone={markDone} />,
    timeline: <TimelineTab />,
    assistant: <AssistantTab />,
  };

  return (
    <div className="page case-page">
      <div className="case-titlebar">
        <div><div className="breadcrumb"><span>案件工作台</span><ChevronRight20Regular /><span>{cases[0].id}</span></div><h1>深圳相机货损</h1><p>{cases[0].waybill} · 运输货损 · 承办人 陈思远</p></div>
        <div className="case-title-actions"><DemoTag /><RiskBadge risk="高" /><Button appearance="secondary" icon={<Person24Regular />}>转交</Button><Button appearance="subtle" icon={<MoreHorizontal20Regular />} aria-label="更多" /></div>
      </div>

      <section className={`now-banner ${actionDone ? "now-banner-done" : ""}`}>
        <div className="now-icon">{actionDone ? <CheckmarkCircle24Regular /> : <AlertUrgent24Filled />}</div>
        <div><span>{actionDone ? "关键行动已完成" : "现在最重要的事情"}</span><h2>{actionDone ? "分拨中心监控已固定" : "立即固定深圳 XX 分拨中心监控"}</h2><p>{actionDone ? "证据状态已更新，可以进入责任与赔偿风险初评。" : "原因：存在覆盖风险，客观证据可能在 24 小时内灭失。"}</p></div>
        <div className="now-meta"><span>负责人<strong>深圳运营中心</strong></span><span>截止<strong>{actionDone ? "刚刚完成" : "今天 18:00"}</strong></span></div>
        {!actionDone && <Button appearance="primary" size="large" onClick={markDone}>标记已固定</Button>}
      </section>

      <div className="case-tabs-wrap">
        <TabList selectedValue={tab} onTabSelect={(_, data) => setTab(data.value as CaseTab)}>
          <Tab value="overview">概览</Tab>
          <Tab value="facts">事实</Tab>
          <Tab value="evidence">证据</Tab>
          <Tab value="risk">风险</Tab>
          <Tab value="action">行动</Tab>
          <Tab value="timeline">时间线</Tab>
          <Tab value="assistant" icon={<BotSparkle24Regular />}>AI 助手</Tab>
        </TabList>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          {tabContent[tab]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ActionCenter({ onOpenCase }: { onOpenCase: () => void }) {
  const [filter, setFilter] = useState("我的行动");
  const [completed, setCompleted] = useState<string[]>([]);
  const actions = [
    ...actionRows.map((item) => ({ ...item, caseName: "深圳相机货损" })),
    { id: "review", title: "复核高值件赔偿口径", priority: "P0", owner: "宋予安", due: "明天 10:00", reason: "客户主张金额较高", caseName: "上海高值件丢失" },
    { id: "proof", title: "补充代下单授权记录", priority: "P2", owner: "周墨", due: "9 月 5 日", reason: "确认合同相对方", caseName: "成都代下单争议" },
  ];
  return (
    <div className="page actions-page">
      <PageHeading title="行动中心" description="不让关键证据遗漏，不让关键节点过期。" actions={<><DemoTag /><Button appearance="primary" icon={<Add24Regular />}>新建行动</Button></>} />
      <div className="action-summary-grid">
        <div><span>今天到期</span><strong>4</strong><small>其中 P0 任务 2 个</small></div>
        <div><span>本周待办</span><strong>13</strong><small>已完成 8 个</small></div>
        <div><span>逾期行动</span><strong>1</strong><small>需要立即跟进</small></div>
        <div><span>平均响应</span><strong>2.6h</strong><small><DemoTag label="Pilot Target" /></small></div>
      </div>
      <section className="surface action-center-panel">
        <div className="action-toolbar">
          <div className="filters">{["我的行动", "全部行动", "即将到期", "已完成"].map((item) => <button className={filter === item ? "filter-active" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div>
          <Input contentBefore={<Search24Regular />} placeholder="搜索行动或案件" />
        </div>
        <div className="action-center-list">
          {actions.filter((item) => filter !== "已完成" || completed.includes(item.id)).map((item) => {
            const checked = completed.includes(item.id);
            return (
              <div className={`action-center-row ${checked ? "action-done" : ""}`} key={item.id}>
                <Checkbox checked={checked} onChange={(_, data) => setCompleted((current) => data.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />
                <span className={`priority-code priority-${item.priority.toLowerCase()}`}>{item.priority}</span>
                <button className="action-main" onClick={onOpenCase}><strong>{item.title}</strong><span>{item.caseName} · {item.reason}</span></button>
                <div><span>负责人</span><strong>{item.owner}</strong></div>
                <div><span>截止</span><strong className={item.due.includes("今天") ? "due-urgent" : ""}>{item.due}</strong></div>
                <Button appearance="subtle" icon={<ChevronRight20Regular />} onClick={onOpenCase} aria-label="打开案件" />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SparkBars({ values }: { values: number[] }) {
  const max = Math.max(...values);
  return <div className="spark-bars" aria-label="趋势图">{values.map((value, index) => <i key={index} style={{ height: `${Math.max(18, value / max * 100)}%` }} />)}</div>;
}

function Insights() {
  const [period, setPeriod] = useState("近 30 天");
  return (
    <div className="page insights-page">
      <PageHeading title="管理驾驶舱" description="看清 AI 帮助团队节省了什么，以及风险是否真正被接住。" actions={<div className="period-switch">{["近 7 天", "近 30 天", "本季度"].map((item) => <button className={period === item ? "period-active" : ""} onClick={() => setPeriod(item)} key={item}>{item}</button>)}</div>} />
      <div className="insight-note"><DemoTag /><span>以下数据均为演示数据或试点目标，不代表已实现结果。</span></div>
      <section className="insight-hero-grid">
        <article className="surface insight-primary">
          <div className="surface-header"><div><span>AI 辅助案件量</span><strong>186</strong></div><DemoTag /></div>
          <SparkBars values={[24, 36, 31, 48, 45, 58, 64, 61, 76, 84, 89, 98]} />
          <div className="chart-axis"><span>8 月 1 日</span><span>9 月 1 日</span></div>
        </article>
        <article className="surface efficiency-panel">
          <div className="surface-header"><div><h2>处理效率</h2><p>与传统流程基线对比</p></div><DemoTag label="Pilot Target" /></div>
          <div className="efficiency-list">
            <div><span>信息收集时间</span><strong>预计降低 50%</strong><i style={{ "--value": "50%" } as React.CSSProperties} /></div>
            <div><span>法务首次初评</span><strong>预计降低 60%</strong><i style={{ "--value": "60%" } as React.CSSProperties} /></div>
            <div><span>关键证据遗漏</span><strong>预计降低 80%</strong><i style={{ "--value": "80%" } as React.CSSProperties} /></div>
          </div>
        </article>
      </section>
      <section className="kpi-grid">
        <article className="surface kpi-card"><div><Clock24Regular /><span>平均建案时间</span></div><strong>3m 42s</strong><p>演示数据</p></article>
        <article className="surface kpi-card"><div><BrainCircuit24Regular /><span>平均完整度</span></div><strong>82%</strong><p>较传统表单 +21%</p></article>
        <article className="surface kpi-card"><div><TargetArrow24Regular /><span>建议采纳率</span></div><strong>74%</strong><p>演示数据</p></article>
        <article className="surface kpi-card"><div><ShieldTask24Regular /><span>节点提醒覆盖</span></div><strong>100%</strong><p>Pilot Target</p></article>
      </section>
      <section className="insight-bottom-grid">
        <article className="surface risk-distribution">
          <div className="surface-header"><div><h2>案件风险分布</h2><p>当前进行中案件</p></div><DemoTag /></div>
          <div className="donut-wrap"><div className="donut"><div><strong>24</strong><span>案件</span></div></div><div className="donut-legend"><span><i className="legend-high" />高风险<strong>5</strong></span><span><i className="legend-medium" />中风险<strong>11</strong></span><span><i className="legend-low" />低风险<strong>8</strong></span></div></div>
        </article>
        <article className="surface team-load">
          <div className="surface-header"><div><h2>团队行动负载</h2><p>按未完成行动数排序</p></div><PeopleTeam24Regular /></div>
          <div className="team-list">
            {[['陈思远', 9, 3], ['宋予安', 7, 2], ['何清越', 5, 0], ['周墨', 4, 1]].map(([name, total, urgent]) => <div key={name}><Avatar name={String(name)} size={32} /><div><strong>{name}</strong><span>{total} 个待办</span></div><b>{urgent ? `${urgent} 个 P0` : "状态正常"}</b></div>)}
          </div>
        </article>
      </section>
    </div>
  );
}

function DemoGuide({ onClose, onStart }: { onClose: () => void; onStart: () => void }) {
  return (
    <motion.div className="guide-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
      <motion.div className="guide-panel" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 30, opacity: 0 }} onMouseDown={(event) => event.stopPropagation()}>
        <div className="guide-head"><div><DemoTag label="3 分钟演示" /><h2>核心演示脚本</h2><p>从自然语言报案走到紧急证据行动。</p></div><Button appearance="subtle" icon={<MoreHorizontal20Regular />} onClick={onClose} aria-label="关闭" /></div>
        <div className="guide-steps">
          <div><span>1</span><div><strong>智能报案</strong><p>AI 从口语描述中提取事实，不混淆声称价值与实际货值。</p></div></div>
          <div><span>2</span><div><strong>动态追问</strong><p>只询问影响合同关系、证据和风险判断的信息。</p></div></div>
          <div><span>3</span><div><strong>紧急中断</strong><p>输入监控明天覆盖，立即触发 P0 证据固定任务。</p></div></div>
          <div><span>4</span><div><strong>行动闭环</strong><p>进入案件工作区，标记完成并查看风险、依据和时间线。</p></div></div>
        </div>
        <Button appearance="primary" size="large" icon={<Play24Filled />} onClick={onStart}>开始核心演示</Button>
      </motion.div>
    </motion.div>
  );
}

export default function App() {
  const [page, setPage] = useState<PageId>("workbench");
  const [guideOpen, setGuideOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const pageContent = useMemo(() => {
    if (page === "workbench") return <Workbench onNewCase={() => setPage("intake")} onOpenCase={() => setPage("case")} />;
    if (page === "intake") return <Intake onComplete={() => setPage("case")} />;
    if (page === "case") return <CaseWorkspace onToast={setToast} />;
    if (page === "actions") return <ActionCenter onOpenCase={() => setPage("case")} />;
    return <Insights />;
  }, [page]);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <Brand />
        <nav aria-label="主导航">
          <span className="nav-section-label">工作区</span>
          {navItems.map((item) => (
            <button key={item.id} className={`nav-item ${page === item.id ? "nav-active" : ""}`} onClick={() => { setPage(item.id); setMobileNav(false); }}>
              <span>{item.icon}</span><b>{item.label}</b>{item.badge && <i>{item.badge}</i>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item"><span><Settings24Regular /></span><b>系统设置</b></button>
          <div className="user-card"><Avatar name="陈思远" size={36} /><div><strong>陈思远</strong><span>法务承办人</span></div><MoreHorizontal20Regular /></div>
        </div>
      </aside>
      {mobileNav && <button className="mobile-scrim" aria-label="关闭导航" onClick={() => setMobileNav(false)} />}

      <div className="main-shell">
        <header className="topbar">
          <Button appearance="subtle" icon={<PanelLeft24Regular />} className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="打开导航" />
          <div className="global-search"><Search24Regular /><input aria-label="搜索案件、运单或行动" placeholder="搜索案件、运单或行动" /><kbd>⌘ K</kbd></div>
          <div className="topbar-actions">
            <Button appearance="secondary" icon={<Play24Filled />} onClick={() => setGuideOpen(true)}>演示脚本</Button>
            <div className="top-divider" />
            <span className="top-date">2026 年 9 月 1 日</span>
          </div>
        </header>
        <main>
          <AnimatePresence mode="wait">
            <motion.div key={page} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
              {pageContent}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {guideOpen && <DemoGuide onClose={() => setGuideOpen(false)} onStart={() => { setGuideOpen(false); setPage("intake"); }} />}
        {toast && <motion.div className="toast" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }}><CheckmarkCircle24Regular /><div><strong>操作成功</strong><span>{toast}</span></div></motion.div>}
      </AnimatePresence>
    </div>
  );
}
