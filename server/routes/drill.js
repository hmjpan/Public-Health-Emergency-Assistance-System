// 演练模式 -- 接口
const { Router } = require('express');
const { load, save, uid, now } = require('../store');
const { requirePerm } = require('../rbac');
const { addScript, startDrill, triggerInject, generateAssessment } = require('../drill');

const router = Router();

/* ========== 演练脚本库 ========== */
router.get('/scripts', requirePerm('drill:read'), (req, res) => {
  let list = load('drill_scripts');
  if (req.query.typeKey) list = list.filter(s => s.typeKey === req.query.typeKey);
  if (req.query.status) list = list.filter(s => s.status === req.query.status);
  res.json({ ok: true, data: list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

router.get('/scripts/:id', requirePerm('drill:read'), (req, res) => {
  const s = load('drill_scripts').find(x => x.id === req.params.id);
  if (!s) return res.json({ ok: false, error: '脚本不存在' });
  res.json({ ok: true, data: s });
});

router.post('/scripts', requirePerm('drill:write'), (req, res) => {
  const s = addScript(req.body || {}, req.user.name);
  res.json({ ok: true, data: s });
});

router.patch('/scripts/:id', requirePerm('drill:write'), (req, res) => {
  const list = load('drill_scripts');
  const s = list.find(x => x.id === req.params.id);
  if (!s) return res.json({ ok: false, error: '脚本不存在' });
  ['name', 'typeKey', 'scenario', 'objective', 'injects', 'standardSla', 'status'].forEach(k => {
    if (req.body[k] !== undefined) s[k] = req.body[k];
  });
  save('drill_scripts', list);
  res.json({ ok: true, data: s });
});

router.delete('/scripts/:id', requirePerm('drill:write'), (req, res) => {
  let list = load('drill_scripts');
  list = list.filter(x => x.id !== req.params.id);
  save('drill_scripts', list);
  res.json({ ok: true, data: { removed: req.params.id } });
});

/* ========== 启动演练 ========== */
// 启动演练：基于脚本创建演练事件(isDrill) + 生成注入点执行计划
router.post('/start', requirePerm('drill:start'), async (req, res) => {
  const { scriptId, title, location, level } = req.body || {};
  if (!scriptId) return res.json({ ok: false, error: '缺少scriptId' });

  // 1. 创建演练会话
  const r = startDrill(scriptId, req.body, req.user.name);
  if (!r.ok) return res.json(r);
  const { session, script } = r.data;

  // 2. 创建演练事件（复用 dispatch launch 逻辑，isDrill:true）
  const dispatch = require('./dispatch');
  // 直接内联调用 dispatch 的 launch 逻辑（避免 HTTP 转发）
  const { resolveEventType } = require('../eventTypes');
  const { sendNotification } = require('../notify');
  const { buildOverview } = require('../workflow');
  const directory = load('directory');
  const typePack = resolveEventType({ typeKey: script.typeKey });
  const groups = typePack.notifyGroups;
  const events = load('events');
  const event = {
    id: uid('ev'),
    title: title || ('【演练】' + script.name),
    typeKey: typePack.typeKey, typeName: typePack.name,
    location: location || '', scale: '演练', level: level || 'IV级',
    stage: 'responding', status: '处置中',
    notifyGroups: groups,
    createdAt: now(), stageEnteredAt: now(),
    launchedBy: req.user.name, fieldCommanderId: null, closedAt: null,
    isDrill: true, drillScriptId: scriptId, drillSessionId: session.id
  };
  events.push(event);
  save('events', events);

  // 关联会话与事件
  const sessions = load('drill_sessions');
  const ss = sessions.find(x => x.id === session.id);
  if (ss) { ss.eventId = event.id; save('drill_sessions', sessions); }

  // 3. 通知 + 出动/物资/车辆（同 dispatch launch）
  const content = `【演练通知】${event.title}。情景:${script.scenario.slice(0, 60)}。首批任务:${typePack.firstTaskSummary}`;
  const personnel = load('personnel');
  const seen = new Set();
  groups.forEach(g => {
    directory.filter(d => d.group === g).forEach(d => {
      if (seen.has(d.id)) return;
      seen.add(d.id);
      const n = sendNotification(event.id, d, content, { kind: 'alert' });
      personnel.push({
        id: uid('per'), eventId: event.id, personId: d.id, name: d.name, group: g, role: d.role, phone: d.phone,
        notificationId: n.id, status: 'notified', confirmMode: null, departAt: null, eta: null, vehicle: '', members: '',
        equipmentOk: false, arriveAt: null, updatedAt: now()
      });
    });
  });
  save('personnel', personnel);

  // 物资
  const materials = load('materials');
  typePack.materialPacks.forEach(p => {
    materials.push({ id: uid('mat'), eventId: event.id, pack: p.pack, items: p.items, status: 'preparing', shortage: false, loadedAt: null, sentAt: null, deliveredAt: null, signedAt: null, signedBy: null, updatedAt: now() });
  });
  save('materials', materials);

  // 车辆
  const vehicles = load('vehicles');
  directory.filter(d => d.group === '车辆保障组' || d.role === 'driver').forEach(d => {
    vehicles.push({ id: uid('veh'), eventId: event.id, driverId: d.id, driverName: d.name, phone: d.phone, plate: '', status: 'notified', standbyPlace: '', passCode: null, updatedAt: now() });
  });
  save('vehicles', vehicles);

  // 时间线
  const timeline = load('timeline');
  timeline.push({ id: uid('tl'), eventId: event.id, at: now(), actor: req.user.name, action: '演练启动', detail: `脚本:${script.name} 通知${seen.size}人` });
  save('timeline', timeline);

  // 节点报告
  try { require('../routine').autoMilestone(event.id, '演练启动', script.name, req.user.name); } catch (e) {}

  res.json({
    ok: true,
    data: {
      event: buildOverview(event),
      session: { id: session.id, injectCount: session.injectProgress.length, status: 'running' },
      script: { name: script.name, scenario: script.scenario },
      notified: seen.size
    }
  });
});

/* ========== 注入点 ========== */
router.get('/sessions/:id', requirePerm('drill:read'), (req, res) => {
  const s = load('drill_sessions').find(x => x.id === req.params.id);
  if (!s) return res.json({ ok: false, error: '演练会话不存在' });
  res.json({ ok: true, data: s });
});

router.post('/sessions/:id/inject/:seq', requirePerm('drill:write'), (req, res) => {
  const r = triggerInject(req.params.id, +req.params.seq, req.user.name);
  res.json(r.ok ? { ok: true, data: r.data } : r);
});

/* ========== 评估报告 ========== */
router.post('/sessions/:id/assess', requirePerm('drill:assess'), (req, res) => {
  const r = generateAssessment(req.params.id);
  res.json(r);
});

router.get('/assessments', requirePerm('drill:read'), (req, res) => {
  let list = load('drill_assessments');
  if (req.query.sessionId) list = list.filter(a => a.sessionId === req.query.sessionId);
  res.json({ ok: true, data: list.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt)) });
});

router.get('/assessments/:sessionId', requirePerm('drill:read'), (req, res) => {
  const a = load('drill_assessments').find(x => x.sessionId === req.params.sessionId);
  if (!a) return res.json({ ok: false, error: '评估报告不存在' });
  res.json({ ok: true, data: a });
});

module.exports = router;
