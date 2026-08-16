// 文书模板填充（D1）-- 简报/终报初稿：固定模板+确定性数据填充
// 第7章 brief-draft / report-draft 的零依赖实现（模式A）；评述段留空人工填写
const { Router } = require('express');
const { load, uid, now } = require('../store');
const { requirePerm } = require('../rbac');

const router = Router();

// 事件数据聚合（事实源只读）
function gatherEventData(eventId) {
  const e = load('events').find(x => x.id === eventId);
  if (!e) return null;
  const cases = load('cases').filter(c => c.eventId === eventId);
  const tasks = load('tasks').filter(t => t.eventId === eventId);
  const briefs = load('briefs').filter(b => b.eventId === eventId);
  const personnel = load('personnel').filter(p => p.eventId === eventId);
  const forms = load('forms').filter(f => f.eventId === eventId);
  const timeline = load('timeline').filter(t => t.eventId === eventId).sort((a, b) => new Date(a.at) - new Date(b.at));
  return { e, cases, tasks, briefs, personnel, forms, timeline };
}

// 简报初稿（D1：模板+数据；评述留空）
router.post('/brief-draft', requirePerm('event:read'), (req, res) => {
  const { eventId } = req.body || {};
  const d = gatherEventData(eventId);
  if (!d) return res.json({ ok: false, error: '事件不存在' });
  const lastBrief = d.briefs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

  const draft = {
    kind: 'brief',
    eventId,
    title: `【${d.e.typeName}】现场处置简报（第${d.briefs.length + 1}期）`,
    sections: {
      header: {
        事件名称: d.e.title, 事件类型: d.e.typeName, 级别: d.e.level,
        当前阶段: d.e.stageName || d.e.stage, 生成时间: now().slice(0, 16).replace('T', ' ')
      },
      data: {
        累计病例: d.cases.length,
        在治病例: d.cases.filter(c => !['discharged', 'transferred_out', 'dead'].includes(c.status)).length,
        重症病例: d.cases.filter(c => ['severe', 'critical'].includes(c.severity)).length,
        出院: d.cases.filter(c => c.status === 'discharged').length,
        已出动人员: d.personnel.filter(p => ['departed', 'arrived'].includes(p.status)).length,
        已抵达人员: d.personnel.filter(p => p.status === 'arrived').length,
        任务总数: d.tasks.length,
        任务完成: d.tasks.filter(t => t.status === 'done').length,
        受阻任务: d.tasks.filter(t => t.status === 'blocked').length,
        已回传表单: d.forms.length
      },
      prev: lastBrief ? { 上期已调查: lastBrief.investigated, 上期已采样: lastBrief.sampled, 上期消杀面积: lastBrief.disinfectedArea } : null,
      comment: '' // 评述段留空（D3 由人填写，模式B后可AI辅助）
    },
    detLevel: 'D1',
    notice: '数据段由系统自动填充（字段级可溯源）；评述段请人工填写',
    generatedAt: now(), generatedBy: req.user.name
  };
  res.json({ ok: true, data: draft });
});

// 终报/结案报告初稿（D1：全过程数据回放模板）
router.post('/final-draft', requirePerm('event:read'), (req, res) => {
  const { eventId } = req.body || {};
  const d = gatherEventData(eventId);
  if (!d) return res.json({ ok: false, error: '事件不存在' });

  const fmt = iso => (iso || '').slice(0, 16).replace('T', ' ');
  const keyNodes = d.timeline.filter(t => ['一键启动', '阶段推进', '演练启动', '病例登记'].includes(t.action));

  const draft = {
    kind: 'final',
    eventId,
    title: `【${d.e.typeName}】事件处置终报（初稿）`,
    sections: {
      basic: {
        事件名称: d.e.title, 类型: d.e.typeName, 级别: d.e.level,
        发生地点: d.e.location, 启动时间: fmt(d.e.createdAt), 终止时间: d.e.closedAt ? fmt(d.e.closedAt) : '（未终止）',
        启动人: d.e.launchedBy
      },
      process: keyNodes.map(t => ({ 时间: fmt(t.at), 节点: t.action, 说明: t.detail || '', 操作人: t.actor })),
      statistics: {
        累计病例: d.cases.length,
        治愈出院: d.cases.filter(c => c.status === 'discharged').length,
        转院: d.cases.filter(c => c.status === 'transferred_out').length,
        死亡: d.cases.filter(c => c.status === 'dead').length,
        出动人次: d.personnel.length,
        任务完成率: d.tasks.length ? Math.round(d.tasks.filter(t => t.status === 'done').length / d.tasks.length * 100) + '%' : '-',
        表单归档: d.forms.length, 简报期数: d.briefs.length
      },
      measures: (load('knowledge') || []).filter(k => k.kind === 'measure' && (k.typeKey === d.e.typeKey || !k.typeKey)).map(k => k.title),
      analysis: '',     // 原因分析：人工填写（模式B可AI辅助，须锚定数据）
      lesson: ''        // 经验教训：人工填写
      },
    detLevel: 'D1',
    notice: '数据段自动填充；原因分析与经验教训段请人工完成',
    generatedAt: now(), generatedBy: req.user.name
  };
  res.json({ ok: true, data: draft });
});

module.exports = router;
