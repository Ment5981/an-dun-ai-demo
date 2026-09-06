// Reviewed public sources and explicitly labelled competition demonstration material.
// This is a pinned, human-reviewed seed corpus, not a continuously updated law service.
const verifiedAt = '2026-09-07';
const civilCode = 'https://gdca.miit.gov.cn/zwgk/zcwj/flfg/art/2020/art_573d6ef5018b46b6a4e1f31ca085a710.html';
const expressRegulation = 'https://www.mee.gov.cn/zcwj/gwywj/202504/t20250422_1117316.shtml';
const expressRules = 'https://xxgk.mot.gov.cn/2020/jigou/fgs/202401/t20240104_3980683.html';

export const knowledgeSeeds = [
  {
    id: 'law-civil-831', title: '民法典第八百三十一条 · 提货检验与异议', type: '法律法规',
    content: '【条文释义】提货检验按约定期限进行；期限不能确定时，应在合理期限内检验。未在相应期限提出数量、毁损异议，仅构成按运输单证完成交付的初步证据。签收记录不能直接替代对损害事实、提出异议时间和其他证据的审查。',
    sourceUrl: civilCode, version: '2020-05-28通过；2021-01-01施行',
    keywords: ['签收争议', '签收', '验收', '破损', '异议', '交付', '开箱'], isDemo: false, verifiedAt,
  },
  {
    id: 'law-civil-832', title: '民法典第八百三十二条 · 货物毁损、灭失责任', type: '法律法规',
    content: '【条文释义】运输中的货物毁损、灭失涉及承运人赔偿责任。承运人主张免责时，需要证明法条规定的原因，例如不可抗力、货物自身自然性质或合理损耗、托运人或收货人过错。是否具备相应事实及因果关系，应结合证据由法务审核，不能根据单方陈述直接免责。',
    sourceUrl: civilCode, version: '2020-05-28通过；2021-01-01施行',
    keywords: ['破损', '丢失', '损毁', '灭失', '责任', '包装', '运输', '承运人', '不可抗力'], isDemo: false, verifiedAt,
  },
  {
    id: 'law-civil-833', title: '民法典第八百三十三条 · 损失赔偿额', type: '法律法规',
    content: '【条文释义】货损赔偿金额需先核对当事人约定；约定缺失或不明确且经法定补充方式仍不能确定时，涉及交付或应交付时到达地的市场价格。法律、行政法规另有计算方式或限额规定的，依相应规定。主张金额、购买凭证、实际损失和约定条款应分别核验。',
    sourceUrl: civilCode, version: '2020-05-28通过；2021-01-01施行',
    keywords: ['赔偿纠纷', '赔偿', '货值', '价值', '发票', '损失', '价格', '金额', '保价'], isDemo: false, verifiedAt,
  },
  {
    id: 'law-express-28', title: '快递暂行条例第二十八条 · 保价与未保价赔偿', type: '法律法规',
    content: '【2025年修订文本释义】快件发生延误、丢失、损毁或内件短少时，保价件需核对企业与寄件人约定的保价规则；未保价件依民事法律确定赔偿责任。保价不等同于保险，也不能由系统自动推导全额赔付或固定倍数上限。应保存运单、保价条款及告知记录。',
    sourceUrl: expressRegulation, version: '2025-04-13第二次修订；本次修改2025-06-01施行',
    keywords: ['保价', '未保价', '保险', '赔偿纠纷', '赔偿', '丢失', '破损', '延误', '短少', '运单'], isDemo: false, verifiedAt,
  },
  {
    id: 'law-express-29', title: '快递暂行条例第二十九条 · 投诉处理', type: '法律法规',
    content: '【条文释义】快递企业应提供全程信息化管理、查询和畅通联络。收到服务质量投诉后，应在七日内处理并告知用户。该期限针对投诉处理，不是所有案件的举证期限、赔付期限或保险报案期限；应准确记录实际收到投诉的时间。',
    sourceUrl: expressRegulation, version: '2025-04-13第二次修订；本次修改2025-06-01施行',
    keywords: ['投诉', '升级', '期限', '处理', '查询', '沟通', '延误', '赔偿纠纷'], isDemo: false, verifiedAt,
  },
  {
    id: 'industry-delivery-2024', title: '快递市场管理办法第二十六至二十八条 · 投递与签收', type: '行业规则',
    content: '【规章释义】服务操作应保障物品安全、如实记录寄递过程并告知验收。签收可采用易辨认、可保存的明示方式，也可由指定代收人确认；无法当面验收时应另行约定投递和确认方式。未经用户同意，企业不得代确认收到或擅自投至智能快件箱、服务站。签收争议应核查投递地点、授权、签收和联系记录。',
    sourceUrl: expressRules, version: '交通运输部令2023年第22号；2024-03-01施行',
    keywords: ['签收争议', '错发', '代收', '签收', '授权', '驿站', '投递', '监控', '破损', '运输轨迹'], isDemo: false, verifiedAt,
  },
  {
    id: 'demo-sop-preserve', title: '事发即固证 · 现场证据保全SOP（演示）', type: '内部SOP',
    content: '【比赛演示规范，非顺丰正式内部制度】立即保存带时间信息的外包装、封口、内件全景与细节，保留原包装及原文件。导出运单、节点交接与完整沟通记录；记录监控位置、覆盖时间、保管人和提取过程。上传计算SHA-256用于后续文件一致性核对；该哈希不是公证、可信时间戳或证据真实性认定。监控留存期由现场确认；界面的两小时提醒只是演示作业建议。',
    sourceUrl: '', version: '比赛演示 v1.0 · 2026-09-07',
    keywords: ['监控', '覆盖', '保全', '固证', '证据', '破损', '丢失', '聊天记录', '包装', '运单', '取证'], isDemo: true, verifiedAt,
  },
  {
    id: 'demo-sop-escalate', title: '期限登记与重大案件升级SOP（演示）', type: '内部SOP',
    content: '【比赛演示规则，非顺丰授权标准】主张金额达到一万元、重大事件或存在刑事风险线索时进入人工法务复核；阈值仅用于比赛分流，既不决定赔偿权限也不是法律标准。收到法院或保险材料时登记原文载明的具体截止时间、来源及经办人；未确认截止日不得推算法定期限。保价不等于投保，需另行确认保险合同及报案要求。',
    sourceUrl: '', version: '比赛演示 v1.0 · 2026-09-07',
    keywords: ['高金额', '重大', '刑事', '报案', '保险', '期限', '举证', '法务', '升级', '赔偿'], isDemo: true, verifiedAt,
  },
  {
    id: 'demo-case-porcelain', title: '易碎品破损取证复盘（模拟案例）', type: '历史案例',
    content: '【完全虚构的演示案例，无真实案号或裁判结果】收件人反馈瓷器破损。演示处理过程包括收集寄前状态、包装照片、运输交接、收件开箱过程、完整对话及货值凭证，逐项核对损害发现时间与证据缺口。用于说明取证方法，不能推定其他案件责任，不提供胜诉率或赔付结果。',
    sourceUrl: '', version: '模拟案例 v1.0 · 2026-09-07',
    keywords: ['破损', '瓷器', '易碎品', '包装', '案例', '开箱', '复盘', '寄前'], isDemo: true, verifiedAt,
  },
  {
    id: 'demo-template-documents', title: '情况说明、证据目录及法律文书模板（演示）', type: '文书模板',
    content: '【比赛演示模板，未经企业法务核准】情况说明仅写明案情来源、已核实事实、待核实事项与采取的行动。证据目录列出编号、文件名、来源、上传时间、完整性校验值及拟证明事项。监控调取函写明位置、时间范围、用途与接收方式；答辩材料需预留法院、案号、诉讼请求及法务意见，缺失信息标记待补充，不得编造。所有生成文件均为待审核草稿。',
    sourceUrl: '', version: '比赛演示 v1.0 · 2026-09-07',
    keywords: ['文书', '情况说明', '证据目录', '监控调取函', '答辩', '模板', '归档', '证据'], isDemo: true, verifiedAt,
  },
];
