// 规则引擎接口 -- D0/D1/D2 确定性结论 + rule_results 存证
// 供 Web 参谋面板与（未来）MCP 工具同源调用
const { Router } = require('express');
const { load, save, uid, now } = require('../store');
const { requirePerm } = require('../rbac');
const engine = require('../rules/engine');

const router = Router();

// 规则结论存证（append-only）
function persistResult(kind, input, output, by) {
  const list = load('rule_results');
  const r = {
    id: uid('rr'), kind, input, output,
    ruleVersion: output && output.ruleVersion,
    createdBy: by || 'api', createdAt: now()
  };
  list.push(r);
  save('rule_results', list);
  return r;
}

// ① 研判定级（D0）
// body: { typeKey, cases, deaths, scope, spread, typeTag, reportId? }
router.post('/grade-evaluate', (req, res) => {
  if (!req.user) return res.json({ ok: false, error: '未登录' });
  try {
    const out = engine.gradeEvaluate(req.body || {});
    const persisted = out.ok ? persistResult('grade', req.body, out, req.user.name) : null;
    res.json({ ok: out.ok, error: out.error, data: { ...out, ruleResultId: persisted ? persisted.id : null } });
  } catch (e) {
    // 引擎异常兜底：绝不输出错误结论（第16章 FMEA #5）
    console.error('[规则引擎] grade 异常:', e.message);
    res.json({ ok: false, error: '规则服务异常，请人工判定（分级标准速查可用）', kind: 'engine_error' });
  }
});

// ② 时限校验（D0）
// body: { stages: [{stage, startAt, doneAt}] }
router.post('/sla-check', (req, res) => {
  if (!req.user) return res.json({ ok: false, error: '未登录' });
  try {
    const out = engine.slaCheck((req.body || {}).stages);
    res.json({ ok: true, data: out });
  } catch (e) {
    console.error('[规则引擎] sla 异常:', e.message);
    res.json({ ok: false, error: '时限校验异常' });
  }
});

// 事件时限总检（按事件时间线自动组装 stages）
router.get('/sla-check/:eventId', requirePerm('event:read'), (req, res) => {
  try {
    const e = load('events').find(x => x.id === req.params.eventId);
    if (!e) return res.json({ ok: false, error: '事件不存在' });
    const tl = load('timeline').filter(t => t.eventId === e.id).sort((a, b) => new Date(a.at) - new Date(b.at));
    const launch = tl.find(t => t.action === '一键启动');
    const first = tl[0];
    const stages = [
      { stage: '初报', startAt: first ? first.at : e.createdAt, doneAt: launch ? launch.at : null },
      { stage: '响应启动', startAt: launch ? launch.at : e.createdAt, doneAt: null }
    ];
    const out = engine.slaCheck(stages);
    res.json({ ok: true, data: out });
  } catch (e) {
    res.json({ ok: false, error: '时限校验异常' });
  }
});

// ③ 标准编成（D1）
router.get('/staff-assign', requirePerm('event:read'), (req, res) => {
  try {
    const out = engine.staffAssign(req.query.typeKey, req.query.level);
    if (!out.ok) return res.json(out);
    const persisted = persistResult('staff', { typeKey: req.query.typeKey, level: req.query.level }, out, req.user.name);
    // 附通讯录可用性对照（编成建议单：标准编成 + 人员建议列表 + 缺口提示）
    const directory = load('directory');
    const groups = out.groups.map(g => {
      const members = directory.filter(d => d.group === g.group && d.confirmStatus === 'confirmed');
      return {
        ...g,
        suggested: members.slice(0, g.minCount).map(m => ({ name: m.name, phone: m.phone, position: m.position })),
        shortage: members.length < g.minCount,
        availableCount: members.length
      };
    });
    res.json({ ok: true, data: { ...out, groups, ruleResultId: persisted.id } });
  } catch (e) {
    console.error('[规则引擎] staff 异常:', e.message);
    res.json({ ok: false, error: '编成服务异常，请人工编队' });
  }
});

// ④ 知识匹配（D2）
// query: typeKey, level, stage
router.get('/plan-match', requirePerm('event:read'), (req, res) => {
  try {
    const factors = { typeKey: req.query.typeKey, level: req.query.level, stage: req.query.stage };
    const knowledge = load('knowledge');
    const out = engine.planMatch(factors, knowledge);
    const persisted = persistResult('plan', factors, out, req.user.name);
    res.json({ ok: true, data: { ...out, ruleResultId: persisted.id } });
  } catch (e) {
    console.error('[规则引擎] plan 异常:', e.message);
    res.json({ ok: false, error: '预案匹配异常，请查阅预案库' });
  }
});

// 分级标准速查（静态降级兜底，三级降级链末端）
router.get('/grading-quickref', (req, res) => {
  try {
    const table = JSON.parse(require('fs').readFileSync(engine.RULES_DIR + '/grading.json', 'utf8'));
    res.json({ ok: true, data: { ruleVersion: table.rule_version, variables: table.variables, rules: table.rules.map(r => ({ id: r.id, typeKey: r.typeKey, expr: r.expr, level: r.level, basis: r.basis })) } });
  } catch (e) {
    res.json({ ok: false, error: '速查表不可用' });
  }
});

// 规则引擎自检（健康检查：表加载+表达式全部可求值）
router.get('/health', (req, res) => {
  try {
    engine.reloadRules();
    const g = engine.gradeEvaluate({ typeKey: 'FOOD', cases: 60 });
    res.json({ ok: true, data: { status: 'healthy', probe: g.suggestedLevel === 'III级' } });
  } catch (e) {
    res.json({ ok: false, error: '规则引擎自检失败: ' + e.message });
  }
});

module.exports = router;
