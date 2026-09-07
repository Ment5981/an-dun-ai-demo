# 顺丰快递纠纷智能取证与法律处置系统 · MVP 技术设计

面向 2026 顺丰 AI 应用挑战赛。核心原则：**事发即固证，而不是诉讼时找证据**。本文记录系统边界、业务模型和交付验收方式；最终接口与权限应以服务器实现及自动化验证为准。

## 1. 架构与运行方式

```text
浏览器 · React / TypeScript / Vite
  ├─ 身份登录、角色工作台、案件详情、证据与期限
  ├─ 案件研判、处置流程、文书、知识检索、审计
  └─ 同源 /api 请求
            ↓
Node.js API 服务器
  ├─ 密码校验、服务端会话、角色 / 案件范围授权
  ├─ 案件服务、证据存储与 SHA-256、期限任务
  ├─ 知识检索 → 有来源的辅助研判 → 文书草稿
  └─ SQLite 数据库 + 本地私有证据目录
```

使用现有 React 界面，增加单进程 API 与 SQLite，不引入微服务、消息队列或独立向量数据库。开发环境由一键启动脚本同时启动 Vite 与 API；构建后由 API 服务提供静态页面。同一份 SQLite 数据支撑页面刷新和服务重启后的数据保留。

证据文件通过授权接口上传、下载，不能通过静态目录直接访问。数据库保存原始文件名、存储名、摘要、大小、上传人和时间；SHA-256 用于发现上传后文件内容变化，不能单独证明证据真实或具备司法证明力。

## 2. 页面结构

| 页面 | 主要内容 | 角色差异 |
| --- | --- | --- |
| 登录 | 演示账号、身份选择、密码校验 | 身份需与账号所属角色匹配 |
| 工作台 | 立即处理、即将到期、案件统计、我的案件 | 快递员看本人案件并转交主管；主管看辖区并请求法务；法务看全量接收与复核队列 |
| 新建案件 | 运单、损失金额、发现时间、案情、紧急期限 | 创建后自动分类并生成澄清问题和固证任务 |
| 案件详情 | 案情与运单、状态、责任风险、下一步行动 | 按身份显示可执行操作 |
| 固证清单 | 立即固定 / 待补充 / 已具备、附件上传、摘要 | 文件与相应证据要求关联 |
| 研判与处置 | 争议焦点、高中低风险、来源、SOP | 高金额或严重风险转法务人工审核 |
| 时间线 | 报案、分析、证据、任务、流转、文书、归档 | 只显示已授权案件的事件 |
| 行动中心 | 监控覆盖、保险报案、补证、人工确认期限 | 法定举证截止日期需要人工核对 |
| 文书 | 情况说明、证据目录、监控调取函、答辩材料 | 所有输出为可审阅草稿 |
| 知识库 | 法律、行业规则、内部 SOP、历史案例、模板 | 已登录用户可提交自己的历史案例附件；法务审核后才进入 AI 检索 |
| 操作日志 | 操作人、动作、对象、时间 | 主管看辖区、法务看全部；快递员通过本人案件时间线追溯 |

## 3. 数据库 Schema

采用关系模型。案件、证据、文书、任务均有独立主键，引用关系连接到案件和操作人。枚举状态以服务端校验为准。

| 实体 | 关键字段与关系 | 用途 |
| --- | --- | --- |
| Role | id、name | courier / supervisor / legal |
| User | id、username、passwordHash、role、name、org、createdAt | 用户、scrypt 密码哈希与组织范围 |
| Session | tokenHash、userId、expiresAt | 服务端认证会话与退出失效 |
| Case | id、title、description、category、status、risk、amount、goods、insured、major、criminalRisk、escalated、ownerId、org、incidentAt、monitorDeadline、insuranceDeadline、proofDeadline、clarificationAnswers、legalReviewedAt、currentHandlerRole、currentHandlerId、handoffStatus、handoffNote、handoffAt、isDemo、createdAt、updatedAt | 案件主记录、人工审核锁、当前处理角色与交接状态 |
| Waybill | id、caseId、number、goods、insured、createdAt | 运单号、物品与保价声明；caseId 唯一关联案件 |
| Evidence | id、caseId、title、category、status、storageName、originalName、mimeType、size、sha256、uploadedBy、createdAt | 实际附件；清单中未上传的要求保存在分析和关联任务中 |
| AIAnalysis | id、caseId、result、mode、createdBy、createdAt | result 为结构化 JSON，留存每次研判结果及引用 |
| Task | id、caseId、title、kind、evidenceKey、priority、dueAt、status、assignedTo、createdAt、completedAt、completionNote | 固证、补证、人工确认与期限提醒 |
| LegalDocument | id、caseId、type、title、content、status、createdBy、createdAt | 可审阅和下载的文书草稿 |
| Knowledge | id、title、type、content、sourceUrl、version、keywords、isDemo、verifiedAt、createdBy、reviewStatus、attachmentName、storageName、mimeType、size、sha256、createdAt | 检索来源、版本、用户投稿审核状态与私有原文件 |
| AuditLog | id、userId、caseId、action、detail、org、createdAt | 可追溯的操作审计与案件时间线 |

数据库启用外键约束、WAL 日志和 5 秒忙等待；按案件所有人、组织、任务状态与到期时间、分析时间、审计案件建立索引。建表源码见 [`server/schema.sql`](../server/schema.sql)。

案件状态为 `取证中 / 待补证 / 协商中 / 赔偿审批 / 法务处理中 / 已归档`；风险为 `高 / 中 / 低`；任务状态为 `待处理 / 已完成`。案件升级法务后，需由法务审核并处理归档；未完成任务应先完成或明确处理，避免隐藏关键待办。后续分析不得自行解除人工法务锁定。

## 4. 权限边界

| 操作 | 快递员 | 网点 / 区域主管 | 法务 |
| --- | --- | --- | --- |
| 查看案件 | 本人创建 | 本辖区 | 全部 |
| 创建、澄清、分析、上传证据 | 授权案件 | 授权案件 | 全部 |
| 下载证据和文书 | 授权案件 | 授权案件 | 全部 |
| 发起补证、协商、转交主管 | 本人案件 | — | — |
| 接收主管交接、退回快递员、请求法务 | — | 本辖区案件 | — |
| 接收法务、退回主管、审核完成 | — | — | 全部 |
| 赔偿审批与归档 | 不可执行 | 普通辖区案件 | 全部；重大案件人工审核 |
| 提交历史经验案例 | 可提交，待法务审核 | 可提交，待法务审核 | 可提交并可审核 |
| 维护法律法规、行业规则、内部 SOP、模板 | 不可执行 | 不可执行 | 可执行 |
| 查看日志 | 本人案件时间线 | 本辖区审计与时间线 | 全部 |

前端隐藏按钮仅改善交互；每个 API 必须独立校验登录、角色与对象归属。服务器从会话读取角色、人员与组织，不能相信客户端提交的 role / ownerId / org。会话 Cookie 为 `sf_session`，设置 HttpOnly 与 SameSite=Lax，服务端只保存令牌的 SHA-256，12 小时过期。浏览器写操作校验 Origin，允许来源通过 `ALLOWED_ORIGINS` 配置。

## 5. AI 与可追溯知识检索

1. 从案件描述、运单、澄清回答和固证状态构建查询。
2. 检索法律法规、行业规则、内部 SOP、历史案例和文书模板，返回知识 ID、标题、来源链接与支持性片段。
3. 以检索到的内容辅助输出分类、澄清问题、争议焦点、固证要求、风险和下一步 SOP。
4. 引用必须可映射回真实知识条目；无检索依据时明确提示缺少依据，不生成法条、案号或胜诉率。
5. 知识中的内部 SOP、演示历史案例、模板与正式法律分别标注。法院通知载明的期限由人员确认，系统不凭案情推算法定举证截止日期。

每次分析的 `AIAnalysis.result.aiTrace` 会保存可供界面展示的 AI 处理轨迹，包含五个阶段：案件分类、RAG 知识检索、证据缺口识别、责任风险辅助研判、处置建议生成。每个阶段会记录状态、输出、解释和相关来源 ID；`sources` 保存检索排名、知识 ID、版本、来源链接、匹配词和分数，`evidence` 保存已具备 / 待补类别，`humanReviewReasons` 说明为什么仍需主管或法务复核，`runtime` 标记规则模式、模型模式、模型名称、供应商状态和调用耗时。前端可以据此把“AI 做了什么、依据什么、还缺什么、谁必须复核”呈现为一张 AI 处理卡，而不是只展示一段不可解释的摘要。

模型模式仍受候选集约束：模型只能选择服务端已经生成的争议焦点、澄清问题和知识来源 ID；服务端独立计算风险、证据要求、关键期限和升级条件。模型未配置、调用失败、来源为空或输出校验失败时，`runtime.status` 和 `fallbackReason` 会明确记录原因，并自动回到规则 + RAG 模式。`guardrails` 随分析保存，便于演示和审计时说明 AI 的边界。

无需外部模型密钥即可演示完整业务链路；本地规则与检索输出应在页面明确标明。外部模型模式通过 `.env` 中的 `AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL` 接入 OpenAI-compatible 服务（本项目已支持阿里云百炼兼容地址）；在需要代理的 Node 24+ 环境由启动脚本启用环境代理。外部模型仅作为辅助生成能力，不能绕过角色授权、数据持久化、引用验证或重大案件升级规则。MVP 中未配置专门 OCR、语音转写和视频理解，上传文件不能被描述为已自动理解全部内容。

## 6. API 设计原则

所有业务接口位于 `/api`；请求和响应使用 JSON，文件上传使用 multipart/form-data，证据和文书下载使用授权文件响应。

| 方法与路径 | 请求 / 响应概要 | 访问边界 |
| --- | --- | --- |
| `POST /api/auth/login` | `{ username, password, role }` → `{ user }`，设置会话 Cookie | 公开，账号角色必须匹配 |
| `GET /api/auth/me` | `{ user }` | 已登录 |
| `POST /api/auth/logout` | 注销当前会话 | 当前会话 |
| `GET /api/cases` | `{ cases }` | 按本人 / 组织 / 全部过滤 |
| `POST /api/cases` | `{ title, waybill, description, amount, insured, goods, incidentAt, monitorDeadline?, insuranceDeadline?, proofDeadline?, major?, criminalRisk? }` → `{ case }` | 所有人 / 组织由会话决定 |
| `GET /api/cases/:id` | `{ case }`，含 evidence、analysis、tasks、documents、timeline | 已授权案件 |
| `POST /api/cases/:id/analysis` | `{ answers?: { [questionId]: answer } }` → `{ case }` | 已授权案件，保存分析版本 |
| `POST /api/cases/:id/evidence` | multipart：`file`、`title`、`category` → `{ case }` | 已授权案件；单文件上限 40 MB |
| `GET /api/evidence/:id/download` | 附件下载 | 再次校验关联案件范围 |
| `GET /api/evidence/:id/verify` | `{ id, sha256, actualSha256, valid, verifiedAt }` | 再次校验关联案件范围 |
| `POST /api/cases/:id/transition` | `{ action, note }` → `{ case }` | action 权限和法务锁校验 |
| `GET /api/tasks` | `{ tasks }` | 仅已授权案件 |
| `PATCH /api/tasks/:id` | `{ status: "已完成" | "待处理", note? }` → `{ task }` | 已授权案件；证据任务需实际附件 |
| `POST /api/cases/:id/documents` | `{ type }` → `{ case }` | 已授权案件；答辩材料仅法务可生成 |
| `GET /api/documents/:id/download` | 文书文本下载 | 再次校验关联案件范围；答辩材料仅法务可见 |
| `GET /api/knowledge?q=&type=` | `{ items }`，含来源信息 | 已登录 |
| `POST /api/knowledge` | `{ title, type, content, sourceUrl, version }` → `{ item }` | 历史案例允许三类角色提交；其他类型仅法务 |
| `POST /api/knowledge/upload` | multipart：`file`、`title`、`type`、`content?`、`sourceUrl?`、`version?` → `{ item }` | 历史案例附件可由业务角色提交；原文件私有保存 |
| `PATCH /api/knowledge/:id/review` | `{ status: "已审核" | "已退回", note }` → `{ item }` | 仅法务；只有已审核经验案例进入 AI 检索 |
| `GET /api/knowledge/:id/download` | 原始经验案例附件下载 | 已登录，按随机存储名受控访问 |
| `GET /api/audit` | `{ logs }` | 仅主管与法务；主管限本组织事件 |

`action` 取值：`supplement / negotiate / compensate / escalate / archive`，以及角色交接 `handoff_supervisor / accept_supervisor / return_courier / request_legal / accept_legal / return_supervisor / legal_approve`。文书 `type` 取值：`情况说明 / 证据目录 / 监控调取函 / 答辩材料`。知识 `type` 取值：`法律法规 / 行业规则 / 内部SOP / 历史案例 / 文书模板`。证据 `category` 取值：`waybill / packaging / monitor / chat / value / delivery / tracking / identity`。

未登录返回 `401`，角色不足返回 `403`；无访问权限的案件、证据和文书返回 `404`，避免暴露对象是否存在。字段错误和状态冲突由服务器返回 `{ error, code? }`。自动化验收脚本直接调用真实 API，不使用 mock 代替数据库、授权或文件持久化验证。

服务端入口为 `server/index.mjs`。`PORT` 默认为 `3001`，`HOST` 默认为 `127.0.0.1`；`DATA_DIR` 控制 SQLite 和私有证据目录，默认 `data/`。SQLite 文件为 `sf-disputes.sqlite`，证据目录为 `evidence/`。验收脚本为每次运行创建独立临时 `DATA_DIR` 与随机端口，测试不会修改演示数据库。

## 7. 开发与验收 Tasks

- [x] 服务端：SQLite 初始化、种子账号、会话认证、角色与案件范围授权。
- [x] 案件闭环：创建、澄清、分类、固证清单、风险、处置、法务审核、归档。
- [x] 证据：真实上传、受控下载、SHA-256、记录元数据。
- [x] 期限：监控覆盖、保险报案、自定义举证期限、待办状态。
- [x] AI：有来源的检索、五阶段可解释处理轨迹、结构化辅助分析、强制升级、明确本地模式边界。
- [x] 文书：按案情生成四类可审阅草稿并下载。
- [x] 前端：三类工作台、案件详情、责任卡片、固证清单、时间线与下一步行动。
- [x] 运行：开发一键启动、生产静态服务、构建说明与演示账号。
- [x] 验收：隔离数据库 API 测试、浏览器端核心链路、构建检查。

交付前同步更新已验证项，记录实际运行的检查及剩余限制。

## 8. MVP 范围

此版本用于本地演示和流程验证。内部 SOP、高金额阈值及样例案件均为演示配置，不代表顺丰正式制度；需由企业法务确认后才能替换为正式口径。AI 输出属于辅助研判和文书草稿，不替代法务决策。

暂不覆盖生产 SSO、企业组织同步、第三方运单 / 监控系统接入、可信时间戳、公证 / 司法存证、后台短信推送、全文 OCR 或视频分析。提醒在应用内呈现；文件摘要仅验证本系统保存内容的一致性。
