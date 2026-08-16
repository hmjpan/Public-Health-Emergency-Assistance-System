// 一键启动 —— 决策层确认发布 → 系统按事件类型匹配通知组 → 多通道并行通知 → 强制反馈闭环
const { Router } = require('express');
const { load, save, uid, now } = require('../store');
const { requirePerm } = require('../rbac');
const { resolveEventType, listEventTypes } = require('../eventTypes');
const { sendNotification } = require('../notify');
const { buildOverview } = require('../workflow');

const router = Router();

// 事件类型目录
router.get('/meta/types', (req, res) => {
  res.json({ ok: true, data: listEventTypes() });
});

// 事件列表
router.get('/events', requirePerm('event:read'), (req, res) => {
  let events = load('events');
  events = events.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ ok: true, data: events.map(e => buildOverview(e)) });
});

// 事件详情（全景，含表单定义）
router.get('/events/:id', requirePerm('event:read'), (req, res) => {
  const e = load('events').find(x => x.id === req.params.id);
  if (!e) return res.json({ ok: false, error: '事件不存在' });
  const typePack = resolveEventType(e);
  const overview = buildOverview(e);
  overview.formDefs = typePack.forms || [];
  res.json({ ok: true, data: overview });
});

// 一键启动（核心）：仅决策层
// body: { reportId?, typeKey?, title, location, scale, level?, notifyGroups?[可临时增删], extraTargets?[] }
router.post('/launch', requirePerm('dispatch:launch'), (req, res) => {
  const body = req.body || {};
  const directory = load('directory');
  const users = load('users');

  // 1. 解析事件类型
  let typePack;
  if (body.reportId) {
    const report = load('reports').find(r => r.id === body.reportId);
    typePack = resolveEventType({ typeKey: body.typeKey || (report && report.typeGuess), title: body.title || (report && report.situation) });
  } else {
    typePack = resolveEventType({ typeKey: body.typeKey, title: body.title });
  }

  // 2. 确定通知组（可临时增删）
  const groups = Array.isArray(body.notifyGroups) && body.notifyGroups.length
    ? body.notifyGroups
    : typePack.notifyGroups;

  // 3. 创建事件，进入响应阶段
  const events = load('events');
  const event = {
    id: uid('ev'),
    title: body.title || (typePack.name + '事件'),
    typeKey: typePack.typeKey,
    typeName: typePack.name,
    location: body.location || '',
    scale: body.scale || '',
    level: body.level || 'IV级',
    stage: 'responding',
    status: '处置中',
    reportId: body.reportId || null,
    notifyGroups: groups,
    createdAt: now(),
    stageEnteredAt: now(),
    launchedBy: req.user.name,
    fieldCommanderId: null,
    closedAt: null,
    isDrill: !!body.isDrill,        // 演练标记：true=演练事件，不计入正式统计
    drillScriptId: body.drillScriptId || null
  };
  events.push(event);
  save('events', events);

  // 关联上报
  if (body.reportId) {
    const reports = load('reports');
    const rep = reports.find(r => r.id === body.reportId);
    if (rep) { rep.eventId = event.id; rep.status = 'adopted'; save('reports', reports); }
  }

  // 4. 多通道并行通知 + 生成出动/物资/车辆记录
  const content = `【应急启动】${event.title} @${event.location}。首批任务:${typePack.firstTaskSummary}。请立即响应并确认。`;
  const personnel = load('personnel');
  const notifications = [];
  const seen = new Set();

  groups.forEach(g => {
    directory.filter(d => d.group === g).forEach(d => {
      if (seen.has(d.id)) return;
      seen.add(d.id);
      // 通知
      const n = sendNotification(event.id, d, content, { kind: 'alert' });
      notifications.push(n.id);
      // 出动记录
      personnel.push({
        id: uid('per'),
        eventId: event.id,
        personId: d.id,
        name: d.name,
        group: g,
        role: d.role,
        phone: d.phone,
        notificationId: n.id,
        status: 'notified',   // notified/confirmed/departed/arrived/remote/unable
        confirmMode: null,
        departAt: null, eta: null, vehicle: '', members: '',
        equipmentOk: false,
        arriveAt: null,
        updatedAt: now()
      });
    });
  });
  save('personnel', personnel);

  // 5. 物资：按类型生成标准物资包备货单
  const materials = load('materials');
  typePack.materialPacks.forEach(p => {
    materials.push({
      id: uid('mat'),
      eventId: event.id,
      pack: p.pack,
      items: p.items,
      status: 'preparing',  // preparing/loaded/sent/delivered/signed
      shortage: false,
      loadedAt: null, sentAt: null, deliveredAt: null, signedAt: null,
      signedBy: null,
      updatedAt: now()
    });
  });
  save('materials', materials);

  // 6. 车辆：通知车辆保障人员并生成车辆调度记录
  const vehicles = load('vehicles');
  directory.filter(d => d.group === '车辆保障组' || d.role === 'driver').forEach(d => {
    vehicles.push({
      id: uid('veh'),
      eventId: event.id,
      driverId: d.id,
      driverName: d.name,
      phone: d.phone,
      plate: '',
      status: 'notified',   // notified/ready/arrived
      standbyPlace: '',
      passCode: null,
      updatedAt: now()
    });
  });
  save('vehicles', vehicles);

  // 7. 时间线
  const timeline = load('timeline');
  timeline.push({ id: uid('tl'), eventId: event.id, at: now(), actor: req.user.name, action: '一键启动', detail: `启动响应,通知${seen.size}人,生成${typePack.materialPacks.length}个物资包` });
  save('timeline', timeline);

  // 节点报告钩子（M09）
  try { require('../routine').autoMilestone(event.id, '一键启动', `${event.title} 启动${event.level}响应`, req.user.name); } catch (e) {}

  res.json({
    ok: true,
    data: {
      event: buildOverview(event),
      notified: seen.size,
      groups,
      notifications: notifications.length,
      materialPacks: typePack.materialPacks.length
    }
  });
});

// 我的待确认通知（强制反馈闭环查询入口）
router.get('/notifications/my', (req, res) => {
  if (!req.user) return res.json({ ok: false, error: '未登录' });
  const notifications = load('notifications');
  const mine = notifications
    .filter(n => n.targetId === req.user.id && n.status === 'sent')
    .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
  res.json({ ok: true, data: mine });
});

// 通知确认（强制反馈闭环入口）
router.post('/notifications/:id/ack', (req, res) => {
  if (!req.user) return res.json({ ok: false, error: '未登录' });
  const { ackNotification } = require('../notify');
  const r = ackNotification(req.params.id, req.user.id);
  if (!r.ok) return res.json(r);
  // 同步人员出动状态
  const personnel = load('personnel');
  const p = personnel.find(x => x.notificationId === req.params.id);
  if (p && p.status === 'notified') {
    p.status = 'confirmed';
    p.updatedAt = now();
    save('personnel', personnel);
  }
  res.json({ ok: true, data: r.data });
});

// 阶段推进（决策层，校验完成标准）: responding→field / field→closed
router.post('/events/:id/advance', requirePerm('stage:advance'), (req, res) => {
  const events = load('events');
  const e = events.find(x => x.id === req.params.id);
  if (!e) return res.json({ ok: false, error: '事件不存在' });
  const { advanceStage } = require('../workflow');
  const r = advanceStage(e, req.user);
  if (!r.ok) {
    // 返回未达成明细，前端可提示
    return res.json({ ok: false, error: r.error + (r.check ? '：' + JSON.stringify(summarizeCheck(r.check)) : '') });
  }
  save('events', events);
  const timeline = load('timeline');
  timeline.push({ id: uid('tl'), eventId: e.id, at: now(), actor: req.user.name, action: '阶段推进', detail: '进入 ' + e.stage });
  save('timeline', timeline);
  // 节点报告钩子（M09）
  try { require('../routine').autoMilestone(e.id, '阶段推进', '进入 ' + e.stage, req.user.name); } catch (e) {}
  res.json({ ok: true, data: buildOverview(e) });
});

function summarizeCheck(chk) {
  if (!chk || !chk.detail) return '';
  const parts = [];
  if (chk.groupsReady === false) parts.push('小组未全部出动');
  if (chk.materialsReady === false) parts.push('物资未全部装车');
  if (chk.vehiclesReady === false) parts.push('车辆未全部到位');
  if (chk.tasksDone === false && chk.detail.criticalTotal != null) parts.push(`关键任务${chk.detail.criticalDone}/${chk.detail.criticalTotal}`);
  if (chk.blockedTasks) parts.push(`受阻任务${chk.blockedTasks}`);
  return parts.join('、');
}

module.exports = router;
