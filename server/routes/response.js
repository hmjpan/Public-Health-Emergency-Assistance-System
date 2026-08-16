// 应急响应启动阶段 —— 人员出动 / 物资调拨 / 车辆后勤（强制状态更新）
const { Router } = require('express');
const { load, save, uid, now } = require('../store');
const { requirePerm } = require('../rbac');
const { checkLaunchComplete } = require('../workflow');

const router = Router();

/* ========== 人员出动 ========== */
// 状态机: notified→confirmed→departed→arrived；或 remote / unable
router.get('/personnel', requirePerm('personnel:read'), (req, res) => {
  const { eventId, group } = req.query;
  let list = load('personnel');
  if (eventId) list = list.filter(p => p.eventId === eventId);
  if (group) list = list.filter(p => p.group === group);
  res.json({ ok: true, data: list });
});

// 确认响应: 立即出动/远程支持/无法响应
router.post('/personnel/:id/confirm', requirePerm('personnel:update'), (req, res) => {
  const list = load('personnel');
  const p = list.find(x => x.id === req.params.id);
  if (!p) return res.json({ ok: false, error: '出动记录不存在' });
  const { mode } = req.body || {}; // dispatch / remote / unable
  if (mode === 'remote') p.status = 'remote';
  else if (mode === 'unable') p.status = 'unable';
  else p.status = 'confirmed';
  p.confirmMode = mode || 'dispatch';
  p.updatedAt = now();
  save('personnel', list);
  res.json({ ok: true, data: p });
});

// 出发报备: 出发时间/人员名单/交通/预计到达 + 装备勾选
router.post('/personnel/:id/depart', requirePerm('personnel:update'), (req, res) => {
  const list = load('personnel');
  const p = list.find(x => x.id === req.params.id);
  if (!p) return res.json({ ok: false, error: '出动记录不存在' });
  const b = req.body || {};
  p.status = 'departed';
  p.departAt = b.departAt || now();
  p.members = b.members || '';
  p.vehicle = b.vehicle || '';
  p.eta = b.eta || '';
  p.equipmentOk = !!b.equipmentOk;
  p.updatedAt = now();
  save('personnel', list);
  res.json({ ok: true, data: p });
});

// 抵达确认
router.post('/personnel/:id/arrive', requirePerm('personnel:update'), (req, res) => {
  const list = load('personnel');
  const p = list.find(x => x.id === req.params.id);
  if (!p) return res.json({ ok: false, error: '出动记录不存在' });
  p.status = 'arrived';
  p.arriveAt = now();
  p.updatedAt = now();
  save('personnel', list);
  res.json({ ok: true, data: p });
});

/* ========== 物资调拨 ========== */
router.get('/materials', requirePerm('material:read'), (req, res) => {
  const { eventId } = req.query;
  let list = load('materials');
  if (eventId) list = list.filter(m => m.eventId === eventId);
  res.json({ ok: true, data: list });
});

// 物资状态推进: preparing→loaded→sent→delivered→signed
const MAT_FLOW = ['preparing', 'loaded', 'sent', 'delivered', 'signed'];
router.post('/materials/:id/advance', requirePerm('material:dispatch'), (req, res) => {
  const list = load('materials');
  const m = list.find(x => x.id === req.params.id);
  if (!m) return res.json({ ok: false, error: '物资包不存在' });
  const b = req.body || {};
  if (b.shortage !== undefined) m.shortage = !!b.shortage;
  const cur = MAT_FLOW.indexOf(m.status);
  const next = MAT_FLOW[cur + 1];
  if (next) {
    m.status = next;
    const ts = now();
    if (next === 'loaded') m.loadedAt = ts;
    if (next === 'sent') m.sentAt = ts;
    if (next === 'delivered') m.deliveredAt = ts;
  }
  m.updatedAt = now();
  save('materials', list);
  res.json({ ok: true, data: m });
});

// 现场签收（闭环）
router.post('/materials/:id/sign', requirePerm('material:sign'), (req, res) => {
  const list = load('materials');
  const m = list.find(x => x.id === req.params.id);
  if (!m) return res.json({ ok: false, error: '物资包不存在' });
  m.status = 'signed';
  m.signedAt = now();
  m.signedBy = req.user.name;
  m.updatedAt = now();
  save('materials', list);
  res.json({ ok: true, data: m });
});

/* ========== 车辆后勤 ========== */
router.get('/vehicles', requirePerm('vehicle:read'), (req, res) => {
  const { eventId } = req.query;
  let list = load('vehicles');
  if (eventId) list = list.filter(v => v.eventId === eventId);
  res.json({ ok: true, data: list });
});

// 车辆就位
router.post('/vehicles/:id/ready', requirePerm('vehicle:update'), (req, res) => {
  const list = load('vehicles');
  const v = list.find(x => x.id === req.params.id);
  if (!v) return res.json({ ok: false, error: '车辆记录不存在' });
  const b = req.body || {};
  v.status = 'ready';
  v.plate = b.plate || v.plate;
  v.standbyPlace = b.standbyPlace || '';
  // 如需进入管控区域，生成电子通行证明
  if (b.needPass) v.passCode = 'EPASS-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  v.updatedAt = now();
  save('vehicles', list);
  res.json({ ok: true, data: v });
});

/* ========== 启动完成校验 ========== */
router.get('/launch-check/:eventId', requirePerm('response:read'), (req, res) => {
  res.json({ ok: true, data: checkLaunchComplete(req.params.eventId) });
});

module.exports = router;
