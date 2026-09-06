const showDate = value => value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '【待补充】';

/** Templates contain only case-entered facts and actual evidence metadata. Every output is a draft. */
export function buildDocument(type, item, user) {
  const createdAt = new Date().toISOString();
  const evidenceList = item.evidence.length ? item.evidence.map((e, i) =>
    `${i + 1}. ${e.title}\n   文件：${e.originalName}；大小：${e.size} 字节\n   上传时间：${showDate(e.createdAt)}；上传人：${e.uploadedByName || e.uploadedBy}\n   SHA-256：${e.sha256}\n   证明目的：【请人工核实并填写】`).join('\n') : '【尚无已上传证据，请先完成固证】';
  const heading = `${type}（草稿 · 待人工审核）\n案件编号：${item.id}\n案件标题：${item.title}\n运单号：${item.waybill}\n生成时间：${showDate(createdAt)}\n制备人：${user.name}\n`;
  const shared = `\n使用说明：本材料由系统依已录入案情与实际上传证据生成，未核验案情真实性。空缺信息以【待补充】标明；不构成法律意见、责任确认或对外承诺。对外提交前须由有权限人员审核。\n`;
  const facts = `一、已录入基本情况\n事件时间：${showDate(item.incidentAt)}\n物品：${item.goods || '【待补充】'}\n争议金额：人民币 ${Number(item.amount).toFixed(2)} 元（录入值，非核定赔偿额）\n保价情况：${item.insured ? '已填报保价，条款及金额待核验' : '未填报保价'}\n当事人陈述：${item.description}\n`;
  const templates = {
    '情况说明': `${facts}\n二、已固定证据\n${evidenceList}\n\n三、尚待核实事项\n${item.analysis?.questions?.map((q, i) => `${i + 1}. ${q.question}\n答复：${item.clarificationAnswers?.[q.id] || '【待补充】'}`).join('\n') || '【待补充】'}\n\n四、后续处置\n【请补充核实结果、处理经过、客户反馈，并由经办人签字】\n经办人签字：________ 日期：________\n`,
    '证据目录': `\n证据说明：以下条目只反映本系统已保存文件，不证明内容真实或具备完整证据效力；原始载体、形成过程、保管交接记录仍须核验。\n\n${evidenceList}\n\n提交人：________ 日期：________\n`,
    '监控调取函': `\n致：【监控保管单位 / 负责人】\n\n因运单 ${item.waybill} 涉及${item.category}争议，为及时保全相关资料，请协助保留并提供下列监控。\n事件时间：${showDate(item.incidentAt)}\n拟调取时段：【请明确起止时间，覆盖事前、事中、事后】\n监控地点 / 摄像头编号：【待补充】\n案情摘要：${item.description}\n系统录入的预计覆盖时间：${showDate(item.monitorDeadline)}（请向实际保管人核实）\n\n请保留原始格式、时间戳、设备编号及导出过程记录，明确交接人、交接时间及校验值。涉及个人信息的，按本单位授权流程限定调取范围和使用权限。\n本函为业务协查草稿，不属于司法调查令。\n\n申请单位：【待补充】\n经办人 / 联系方式：【待补充】\n审批人：________ 日期：________\n`,
    '答辩材料': `\n【法务审核专用草稿，不可直接提交】\n法院名称：【待补充】\n案号：【待补充，不得推测】\n答辩人 / 送达地址 / 联系方式：【待补充】\n被答辩人：【待补充】\n\n${facts}\n二、诉讼请求及逐项答复\n【请根据真实起诉状逐项填写，不由系统推测】\n\n三、可供核验的证据\n${evidenceList}\n\n四、法律依据核验线索\n${item.analysis?.citations?.map(c => `${c.title}\n版本：${c.version || '待核实'}\n来源：${c.sourceUrl || '内部资料，待核实'}\n适用性：【由法务结合完整事实审核】`).join('\n\n') || '【未检索到可追溯依据，请由法务补充】'}\n\n五、答辩意见与请求\n【由法务审核事实、程序及适用法律后填写】\n\n答辩人签章：________ 日期：________\n`,
  };
  if (!templates[type]) throw new Error('不支持的文书类型');
  return heading + templates[type] + shared;
}
