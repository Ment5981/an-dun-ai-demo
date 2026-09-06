import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { all, one, run, uid, now, transaction, hashPassword, uploadsDir, sha256, audit, knowledgeRows } from './db.mjs';
import { knowledgeSeeds } from './knowledge-seed.mjs';
import { analyzeCase } from './ai.mjs';
import { caseRow, evidenceRows, saveAnalysis } from './cases.mjs';

export async function seedDatabase() {
  const timestamp = now();
  transaction(() => {
    for (const [id, name] of [['courier', '快递员'], ['supervisor', '网点 / 区域主管'], ['legal', '法务']]) {
      run('INSERT OR IGNORE INTO Role (id,name) VALUES (?,?)', id, name);
    }
    const users = [
      ['user_courier', 'courier', '张晨', 'courier', '深圳南山科技园营业点'],
      ['user_supervisor', 'supervisor', '李敏', 'supervisor', '深圳南山科技园营业点'],
      ['user_legal', 'legal', '王律师', 'legal', '集团法务中心'],
      ['user_courier_2', 'courier2', '陈磊', 'courier', '深圳南山科技园营业点'],
      ['user_courier_3', 'courier3', '周悦', 'courier', '广州天河珠江新城营业点'],
    ];
    for (const [id, username, name, role, org] of users) {
      if (!one('SELECT id FROM User WHERE id=?', id)) {
        run('INSERT INTO User (id,username,name,role,org,passwordHash,createdAt) VALUES (?,?,?,?,?,?,?)', id, username, name, role, org, hashPassword(process.env.DEMO_PASSWORD || 'Sf2026!demo'), timestamp);
      }
    }
    for (const item of knowledgeSeeds) {
      run('INSERT OR IGNORE INTO Knowledge (id,title,type,content,sourceUrl,version,keywords,isDemo,verifiedAt,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
        item.id, item.title, item.type, item.content, item.sourceUrl || '', item.version || '演示版本', JSON.stringify(item.keywords || []), item.isDemo ? 1 : 0, item.verifiedAt || null, timestamp);
    }
  });
  if (one('SELECT COUNT(*) AS count FROM "Case"').count > 0 || process.env.SEED_DEMO === 'false') return;
  const date = hours => new Date(Date.now() + hours * 3600000).toISOString();
  const samples = [
    { id: 'case-2026-001', title: '相机运输破损争议', waybill: 'SF-DEMO-20260001', description: '【演示案例】客户反馈收到相机后镜头破裂，外包装一角凹陷。揽收时寄件人自行包装；收件人称签收后 30 分钟内开箱发现异常，双方对破损发生环节及保价赔付范围存在争议。网点监控预计约 5 小时后覆盖，请立即固定揽收、分拣、派送影像。', amount: 12800, goods: '相机及镜头', insured: true, ownerId: 'user_courier', hours: -3, monitorDeadline: date(5), insuranceDeadline: date(20), evidences: [['waybill', '运单信息', '模拟运单 SF-DEMO-20260001；商品相机；申报争议金额 12800 元。此文件为演示文本，不是真实运单。'], ['chat', '客户沟通记录', '模拟客户沟通：签收后开箱发现镜头破裂，外箱一角凹陷。仅为演示文本，尚待获取完整原始聊天记录。']] },
    { id: 'case-2026-002', title: '生鲜件签收争议', waybill: 'SF-DEMO-20260002', description: '【演示案例】系统显示快件已签收，收件人表示未授权门卫代收且未找到包裹。派件员回忆包裹放置在小区门卫室，需核实收件授权、交付记录和门卫监控。', amount: 680, goods: '生鲜礼盒', insured: false, ownerId: 'user_courier', hours: -7, monitorDeadline: date(12), evidences: [['waybill', '运单信息', '模拟生鲜运单 SF-DEMO-20260002；需核验授权及代收情况。'], ['tracking', '物流轨迹', '模拟物流记录：今日 09:15 到件；11:20 系统显示签收。此记录仅用于演示。']] },
    { id: 'case-2026-003', title: '文件快件丢失待核实', waybill: 'SF-DEMO-20260003', description: '【演示案例】寄件人反映文件快件超过预期未送达，物流轨迹在中转场后中断。目前尚不能确认丢失，需要核验扫描记录、交接清单并联系中转场。寄件人主张文件补办费用 1200 元。', amount: 1200, goods: '纸质业务文件', insured: false, ownerId: 'user_courier', hours: -28, monitorDeadline: date(2), evidences: [['waybill', '运单信息', '模拟文件快件 SF-DEMO-20260003；争议金额来自寄件人陈述，尚未核定。']] },
    { id: 'case-2026-004', title: '同楼栋包裹错发纠纷', waybill: 'SF-DEMO-20260004', description: '【演示案例】两位收件人反映包裹被错发，均愿配合核验。需核对运单、派送轨迹、错收人信息并安排安全取回及重新交付，避免二次损坏。', amount: 360, goods: '日用品', insured: false, ownerId: 'user_courier_2', hours: -10, evidences: [['waybill', '运单信息', '模拟错发运单 SF-DEMO-20260004；原始客户身份资料尚未收集。'], ['delivery', '派送记录', '模拟派送交接摘要：存在同楼栋错发争议，未确认责任。']] },
    { id: 'case-2026-005', title: '珠宝赔偿争议 · 法务审核', waybill: 'SF-DEMO-20260005', description: '【演示案例】寄件人主张价值 56000 元的珠宝快件疑似遗失，并怀疑存在人为调包，目前无证据证实。涉及高金额及潜在刑事风险，请人工法务介入并保全完整交接链。', amount: 56000, goods: '珠宝', insured: true, criminalRisk: true, major: true, ownerId: 'user_courier_3', hours: -18, monitorDeadline: date(3), proofDeadline: date(72), evidences: [['waybill', '运单信息', '模拟珠宝运单 SF-DEMO-20260005；申报价值和保价条款待核验。']] },
  ];
  for (const sample of samples) {
    const owner = one('SELECT * FROM User WHERE id=?', sample.ownerId);
    const createdAt = date(sample.hours);
    transaction(() => {
      run('INSERT INTO "Case" (id,title,description,amount,goods,insured,major,criminalRisk,ownerId,org,incidentAt,monitorDeadline,insuranceDeadline,proofDeadline,isDemo,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        sample.id, sample.title, sample.description, sample.amount, sample.goods, sample.insured ? 1 : 0, sample.major ? 1 : 0, sample.criminalRisk ? 1 : 0, owner.id, owner.org, createdAt, sample.monitorDeadline || null, sample.insuranceDeadline || null, sample.proofDeadline || null, 1, createdAt, createdAt);
      run('INSERT INTO Waybill (id,caseId,number,goods,insured,createdAt) VALUES (?,?,?,?,?,?)', uid('wb_'), sample.id, sample.waybill, sample.goods, sample.insured ? 1 : 0, createdAt);
      audit(owner, '新建案件', '初始化演示案件，案情及附件均为模拟数据。', sample.id);
      for (const [category, title, content] of sample.evidences) {
        const id = uid('ev_');
        const storageName = `${id}.txt`;
        const buffer = Buffer.from(`【黑客松演示材料，不对应真实事件】\n${content}\n`, 'utf8');
        writeFileSync(join(uploadsDir, storageName), buffer, { flag: 'wx' });
        run('INSERT INTO Evidence (id,caseId,title,category,originalName,storageName,mimeType,size,sha256,uploadedBy,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          id, sample.id, `${title}（演示）`, category, `${title}-演示.txt`, storageName, 'text/plain', buffer.length, sha256(buffer), owner.id, createdAt);
        audit(owner, '上传证据', `${title}（演示文本文件，已保存并计算 SHA-256）`, sample.id);
      }
    });
    const item = caseRow(sample.id);
    const analysis = await analyzeCase({ ...item, _rulesOnly: true }, evidenceRows(sample.id), knowledgeRows());
    transaction(() => saveAnalysis(item, analysis, owner));
  }
}
