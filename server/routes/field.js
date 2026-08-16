// 现场处置 —— 现场指挥建立 / 任务包分发 / 表单回传 / 定时简报 / 紧急上报 / 指令下传 / 资源申请
const { Router } = require('express');
const { load, save, uid, now } = require('../store');
const { requirePerm } = require('../rbac');
const { resolveEventType } = require('../eventTypes');
const { sendNotification } = require('../notify');
const { checkFieldComplete } = require('../workflow');

const router = Router();

function hoursLater(h) { return new Date(Date.now() + (Number(h) || 0) * 3600000).toISOString(); }
function addTimeline(eventId, actor, action, detail) {
  const tl = load('timeline');
  tl.push({ id: uid('tl'), eventId, at: now(), actor, action, detail });
  save('timeline', tl);
}

/* ========== 现场指挥建立 ========== */
// 自动指定最先抵达的高级别人员为临时现场指挥员，决策层确认/调整
router.post('/:eventId/commander/assign', requirePerm('dispatch:launch'), (req, res) => {
  const events = load('events');
  const e = events.find(x => x.id === req.params.eventId);
  if (!e) return res.json({ ok: false, error: '事件不存在' });
  let cid = req.body.personId;
  if (!cid) {
    // 自动：最先抵达的 group_leader；无人抵达时取已出动/在编的组长兜底
    const ps = load('personnel').filter(p => p.eventId === e.id);
    const arrived = ps
      .filter(p => p.status === 'arrived')
      .sort((a, b) => new Date(a.arriveAt) - new Date(b.arriveAt));
    const leader = arrived.find(p => p.role === 'group_leader') || arrived[0]
      || ps.find(p => p.role === 'group_leader') || ps[0];
    cid = leader ? leader.personId : null;
  }
  if (!cid) return res.json({ ok: false, error: '暂无可指派人员' });
  e.fieldCommanderId = cid;
  save('events', events);
  const p = load('directory').find(d => d.id === cid) || {};
  addTimeline(e.id, req.user.name, '指定现场指挥员', p.name || cid);
  res.json({ ok: true, data: { fieldCommanderId: cid, name: p.name || '' } });
});

/* ========== 任务包激活与分发 ========== */
// 激活任务包（现场指挥员或决策层）：按事件类型生成任务工单
router.post('/:eventId/tasks/activate', (req, res) => {
  if (!req.user) return res.json({ ok: false, error: '未登录' });
  const events = load('events');
  const e = events.find(x => x.id === req.params.eventId);
  if (!e) return res.json({ ok: false, error: '事件不存在' });
  const isFC = e.fieldCommanderId && req.user.name && (load('directory').find(d => d.id === e.fieldCommanderId) || {}).name === req.user.name;
  const canDispatch = ['commander', 'deputy'].includes(req.user.role) || isFC || req.user.role === 'group_leader';
  if (!canDispatch) return res.json({ ok: false, error: '仅现场指挥员或决策层可分发任务' });

  let tasks = load('tasks');
  if (tasks.some(t => t.eventId === e.id)) return res.json({ ok: false, error: '任务包已激活' });
  const typePack = resolveEventType(e);
  const created = now();
  const newTasks = typePack.taskPacks.map((tp, i) => ({
    id: uid('task'),
    eventId: e.id,
    seq: i + 1,
    group: tp.group,
    title: tp.title,
    steps: tp.steps,
    formKeys: tp.formKeys,
    status: 'pending',   // pending/doing/done/blocked
    assignee: null,
    critical: true,
    createdAt: created,
    dueAt: hoursLater(tp.slaHours || 24),
    feedback: null,
    blockedReason: null
  }));
  tasks = tasks.concat(newTasks);
  save('tasks', tasks);
  addTimeline(e.id, req.user.name, '激活任务包', `分发${newTasks.length}项任务`);
  res.json({ ok: true, data: newTasks });
});

router.get('/:eventId/tasks', requirePerm('task:read'), (req, res) => {
  const list = load('tasks').filter(t => t.eventId === req.params.eventId);
  res.json({ ok: true, data: list });
});

// 任务状态更新
router.post('/tasks/:id/status', requirePerm('task:update'), (req, res) => {
  const list = load('tasks');
  const t = list.find(x => x.id === req.params.id);
  if (!t) return res.json({ ok: false, error: '任务不存在' });
  const b = req.body || {};
  if (b.status) t.status = b.status;
  if (b.feedback !== undefined) t.feedback = b.feedback;
  if (b.blockedReason !== undefined) t.blockedReason = b.blockedReason;
  if (b.assignee !== undefined) t.assignee = b.assignee;
  t.updatedAt = now();
  save('tasks', list);
  addTimeline(t.eventId, req.user.name, '任务更新', `${t.title} → ${b.status || ''}`);
  res.json({ ok: true, data: t });
});

/* ========== 标准化表单采集回传 ========== */
router.post('/:eventId/forms', requirePerm('form:write'), (req, res) => {
  const b = req.body || {};
  const list = load('forms');
  const f = {
    id: uid('form'),
    eventId: req.params.eventId,
    formKey: b.formKey || '',
    formName: b.formName || '',
    data: b.data || {},
    attachments: b.attachments || [],   // 拍照/录音/录像
    urgent: !!b.urgent,
    filledBy: req.user.name,
    createdAt: now()
  };
  list.push(f);
  save('forms', list);
  // 关键信息强提醒
  if (f.urgent) {
    const users = load('users');
    const cmd = users.find(u => u.role === 'commander');
    if (cmd) sendNotification(f.eventId, cmd, `【紧急表单】${f.formName} 含关键信息,请查看`, { kind: 'alert', ackMinutes: 10 });
  }
  res.json({ ok: true, data: f });
});

router.get('/:eventId/forms', requirePerm('form:read'), (req, res) => {
  const list = load('forms').filter(f => f.eventId === req.params.eventId);
  res.json({ ok: true, data: list });
});

/* ========== 定时简报 ========== */
router.post('/:eventId/briefs', requirePerm('brief:write'), (req, res) => {
  const b = req.body || {};
  const list = load('briefs');
  const item = {
    id: uid('brf'),
    eventId: req.params.eventId,
    investigated: b.investigated || 0,
    sampled: b.sampled || 0,
    disinfectedArea: b.disinfectedArea || 0,
    difficulties: b.difficulties || '',
    needs: b.needs || '',
    summary: b.summary || '',
    by: req.user.name,
    createdAt: now()
  };
  list.push(item);
  save('briefs', list);
  addTimeline(req.params.eventId, req.user.name, '提交简报', `已调查${item.investigated} 已采样${item.sampled}`);
  res.json({ ok: true, data: item });
});

router.get('/:eventId/briefs', requirePerm('brief:read'), (req, res) => {
  const list = load('briefs').filter(x => x.eventId === req.params.eventId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ ok: true, data: list });
});

/* ========== 紧急上报（直达决策层） ========== */
router.post('/:eventId/urgent', (req, res) => {
  if (!req.user) return res.json({ ok: false, error: '未登录' });
  const b = req.body || {};
  const users = load('users');
  const cmd = users.find(u => u.role === 'commander');
  const content = `【紧急上报】${b.title || '现场紧急情况'}:${b.detail || ''}`;
  if (cmd) sendNotification(req.params.eventId, cmd, content, { kind: 'alert', ackMinutes: 5 });
  addTimeline(req.params.eventId, req.user.name, '紧急上报', b.title || '');
  res.json({ ok: true, data: { delivered: !!cmd } });
});

/* ========== 指令下传（单线决策，强制反馈闭环） ========== */
router.post('/:eventId/instructions', requirePerm('instruction:issue'), (req, res) => {
  const b = req.body || {};
  if (!b.targetName || !b.task) return res.json({ ok: false, error: '缺少对象或任务' });
  const list = load('instructions');
  const directory = load('directory');
  const target = directory.find(d => d.name === b.targetName) || { id: 'ext', name: b.targetName, phone: b.targetPhone || '' };
  const ins = {
    id: uid('ins'),
    eventId: req.params.eventId,
    targetName: b.targetName,
    task: b.task,
    deadline: b.deadline || hoursLater(4),
    feedbackRequired: b.feedbackRequired !== false,
    status: 'issued',   // issued/acked/done
    issuedBy: req.user.name,
    issuedAt: now(),
    ackAt: null, doneAt: null, feedback: null
  };
  // 强制反馈闭环：发通知带确认时限
  const n = sendNotification(ins.eventId, target, `【指令】${b.task}(时限:${(b.deadline || '').slice(0, 16)})`, {
    kind: 'instruction', refId: ins.id, ackMinutes: 5
  });
  ins.notificationId = n.id;
  list.push(ins);
  save('instructions', list);
  addTimeline(ins.eventId, req.user.name, '下达指令', `${b.targetName}:${b.task}`);
  res.json({ ok: true, data: ins });
});

// 指令确认/完成反馈
router.post('/instructions/:id/ack', requirePerm('instruction:ack'), (req, res) => {
  const list = load('instructions');
  const ins = list.find(x => x.id === req.params.id);
  if (!ins) return res.json({ ok: false, error: '指令不存在' });
  const b = req.body || {};
  if (b.done) { ins.status = 'done'; ins.doneAt = now(); ins.feedback = b.feedback || ''; }
  else { ins.status = 'acked'; ins.ackAt = now(); }
  save('instructions', list);
  res.json({ ok: true, data: ins });
});

router.get('/:eventId/instructions', requirePerm('instruction:read'), (req, res) => {
  const list = load('instructions').filter(x => x.eventId === req.params.eventId).sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
  res.json({ ok: true, data: list });
});

/* ========== 资源动态申请 ========== */
router.post('/:eventId/requests', requirePerm('request:write'), (req, res) => {
  const b = req.body || {};
  const list = load('requests');
  const r = {
    id: uid('req'),
    eventId: req.params.eventId,
    kind: b.kind || 'material',   // material / personnel
    detail: b.detail || '',
    qty: b.qty || '',
    status: 'pending',   // pending/approved/dispatched/signed
    by: req.user.name,
    createdAt: now(),
    handledBy: null
  };
  list.push(r);
  save('requests', list);
  addTimeline(r.eventId, req.user.name, '资源申请', `${r.kind === 'material' ? '物资' : '人员'}:${r.detail}`);
  res.json({ ok: true, data: r });
});

router.get('/:eventId/requests', requirePerm('request:read'), (req, res) => {
  const list = load('requests').filter(x => x.eventId === req.params.eventId);
  res.json({ ok: true, data: list });
});

// 决策层审批/保障组调配
router.post('/requests/:id/handle', (req, res) => {
  if (!req.user) return res.json({ ok: false, error: '未登录' });
  const can = ['commander', 'deputy', 'material_mgr'].includes(req.user.role);
  if (!can) return res.json({ ok: false, error: '无权限' });
  const list = load('requests');
  const r = list.find(x => x.id === req.params.id);
  if (!r) return res.json({ ok: false, error: '申请不存在' });
  const b = req.body || {};
  if (b.status) r.status = b.status;
  r.handledBy = req.user.name;
  r.updatedAt = now();
  save('requests', list);
  res.json({ ok: true, data: r });
});

/* ========== 现场完成校验 ========== */
router.get('/:eventId/field-check', requirePerm('field:read'), (req, res) => {
  res.json({ ok: true, data: checkFieldComplete(req.params.eventId) });
});

module.exports = router;
