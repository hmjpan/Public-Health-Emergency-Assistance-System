// 医疗救治与资源调度 —— 接口
const { Router } = require('express');
const { load, save, uid, now } = require('../store');
const { requirePerm } = require('../rbac');
const {
  CASE_STATUS, registerCase, transitionCase, caseBoard,
  enrichHospital, resourceBoard, updateMedicine
} = require('../medical');

const router = Router();

/* ================= 病例全流程跟踪 ================= */
// 病例登记（流调确认后调用）
router.post('/cases', requirePerm('case:write'), (req, res) => {
  const b = req.body || {};
  if (!b.eventId) return res.json({ ok: false, error: '缺少eventId' });
  const c = registerCase(b, req.user.name);
  // 生成节点报告钩子（M09预留，记入timeline）
  const tl = load('timeline');
  tl.push({ id: uid('tl'), eventId: c.eventId, at: now(), actor: req.user.name, action: '病例登记', detail: `${c.trackNo} ${c.name}` });
  save('timeline', tl);
  res.json({ ok: true, data: c });
});

// 病例列表
router.get('/cases', requirePerm('case:read'), (req, res) => {
  const { eventId, status, hospitalId, keyword } = req.query;
  let list = load('cases');
  if (eventId) list = list.filter(c => c.eventId === eventId);
  if (status) list = list.filter(c => c.status === status);
  if (hospitalId) list = list.filter(c => c.hospitalId === hospitalId);
  if (keyword) list = list.filter(c => (c.name + c.trackNo).includes(keyword));
  list = list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ ok: true, data: list });
});

// 病例汇总看板
router.get('/cases/board', requirePerm('case:read'), (req, res) => {
  res.json({ ok: true, data: caseBoard(req.query.eventId) });
});

// 病例状态枚举
router.get('/cases/meta/status', (req, res) => {
  res.json({ ok: true, data: CASE_STATUS });
});

// 病例详情（含轨迹）
router.get('/cases/:id', requirePerm('case:read'), (req, res) => {
  const c = load('cases').find(x => x.id === req.params.id);
  if (!c) return res.json({ ok: false, error: '病例不存在' });
  const hospital = c.hospitalId ? load('hospitals').find(h => h.id === c.hospitalId) : null;
  res.json({ ok: true, data: { ...c, statusName: CASE_STATUS[c.status], hospitalName: hospital ? hospital.name : '' } });
});

// 状态流转
router.post('/cases/:id/transition', requirePerm('case:update'), (req, res) => {
  const { toStatus, note, hospitalId } = req.body || {};
  if (!toStatus) return res.json({ ok: false, error: '缺少toStatus' });
  const r = transitionCase(req.params.id, toStatus, note, req.user.name);
  if (!r.ok) return res.json(r);
  // 同步所在机构
  if (hospitalId) {
    const cases = load('cases');
    const c = cases.find(x => x.id === req.params.id);
    if (c) { c.hospitalId = hospitalId; save('cases', cases); r.data.hospitalId = hospitalId; }
  }
  const tl = load('timeline');
  tl.push({ id: uid('tl'), eventId: r.data.eventId, at: now(), actor: req.user.name, action: '病例流转', detail: `${r.data.trackNo} → ${CASE_STATUS[toStatus]}` });
  save('timeline', tl);
  // 节点报告钩子（M09）：出院/转院/死亡等转归
  if (['discharged', 'transferred_out', 'dead'].includes(toStatus)) {
    try { require('../routine').autoMilestone(r.data.eventId, '病例转归', `${r.data.trackNo} ${CASE_STATUS[toStatus]}`, req.user.name); } catch (e) {}
  }
  res.json({ ok: true, data: r.data });
});

// 更新病情/隔离等
router.patch('/cases/:id', requirePerm('case:update'), (req, res) => {
  const cases = load('cases');
  const c = cases.find(x => x.id === req.params.id);
  if (!c) return res.json({ ok: false, error: '病例不存在' });
  ['severity', 'isolationType', 'hospitalId', 'phone', 'address'].forEach(k => {
    if (req.body[k] !== undefined) c[k] = req.body[k];
  });
  c.updatedAt = now();
  save('cases', cases);
  res.json({ ok: true, data: c });
});

/* ================= 医疗资源 ================= */
// 资源汇总看板
router.get('/resources/board', requirePerm('resource:read'), (req, res) => {
  res.json({ ok: true, data: resourceBoard() });
});

// 定点机构列表
router.get('/hospitals', requirePerm('resource:read'), (req, res) => {
  res.json({ ok: true, data: load('hospitals').map(enrichHospital) });
});

// 登记机构
router.post('/hospitals', requirePerm('resource:write'), (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.json({ ok: false, error: '缺少机构名' });
  const list = load('hospitals');
  const h = {
    id: uid('hos'), name: b.name, level: b.level || '二级', designated: b.designated !== false,
    contact: b.contact || '', phone: b.phone || '',
    bedTotal: +b.bedTotal || 0, bedOccupied: +b.bedOccupied || 0, bedReserve: +b.bedReserve || 0,
    icuTotal: +b.icuTotal || 0, icuOccupied: +b.icuOccupied || 0,
    staffOnDuty: +b.staffOnDuty || 0, staffAvailable: +b.staffAvailable || 0,
    updatedAt: now()
  };
  list.push(h); save('hospitals', list);
  res.json({ ok: true, data: enrichHospital(h) });
});

// 更新机构床位/ICU/人员（常态报告回写）
router.patch('/hospitals/:id', requirePerm('resource:update'), (req, res) => {
  const list = load('hospitals');
  const h = list.find(x => x.id === req.params.id);
  if (!h) return res.json({ ok: false, error: '机构不存在' });
  ['bedTotal', 'bedOccupied', 'bedReserve', 'icuTotal', 'icuOccupied', 'staffOnDuty', 'staffAvailable', 'name', 'level', 'contact', 'phone'].forEach(k => {
    if (req.body[k] !== undefined) h[k] = k.startsWith('bed') || k.startsWith('icu') || k.startsWith('staff') ? +req.body[k] || 0 : req.body[k];
  });
  h.updatedAt = now();
  save('hospitals', list);
  res.json({ ok: true, data: enrichHospital(h) });
});

// 单机构详情（设备+药品）
router.get('/hospitals/:id/detail', requirePerm('resource:read'), (req, res) => {
  const h = load('hospitals').find(x => x.id === req.params.id);
  if (!h) return res.json({ ok: false, error: '机构不存在' });
  const devices = load('devices').filter(d => d.hospitalId === h.id);
  const medicines = load('medicines').filter(m => m.hospitalId === h.id).map(m => ({
    ...m, daysLeft: m.dailyUse ? +((m.stock || 0) / m.dailyUse).toFixed(1) : 999
  }));
  res.json({ ok: true, data: { ...enrichHospital(h), devices, medicines } });
});

// 设备登记
router.post('/devices', requirePerm('resource:write'), (req, res) => {
  const b = req.body || {};
  const list = load('devices');
  const d = { id: uid('dev'), hospitalId: b.hospitalId || '', name: b.name || '设备', total: +b.total || 0, inUse: +b.inUse || 0, available: (+b.total || 0) - (+b.inUse || 0), updatedAt: now() };
  list.push(d); save('devices', list);
  res.json({ ok: true, data: d });
});

// 设备更新
router.patch('/devices/:id', requirePerm('resource:update'), (req, res) => {
  const list = load('devices');
  const d = list.find(x => x.id === req.params.id);
  if (!d) return res.json({ ok: false, error: '设备不存在' });
  if (req.body.total !== undefined) d.total = +req.body.total || 0;
  if (req.body.inUse !== undefined) d.inUse = +req.body.inUse || 0;
  if (req.body.name !== undefined) d.name = req.body.name;
  d.available = Math.max(0, (d.total || 0) - (d.inUse || 0));
  d.updatedAt = now();
  save('devices', list);
  res.json({ ok: true, data: d });
});

// 药品列表
router.get('/medicines', requirePerm('resource:read'), (req, res) => {
  let list = load('medicines').map(m => ({ ...m, daysLeft: m.dailyUse ? +((m.stock || 0) / m.dailyUse).toFixed(1) : 999, low: m.threshold != null && (m.dailyUse ? (m.stock || 0) / m.dailyUse : 999) < m.threshold }));
  if (req.query.lowStock === '1') list = list.filter(m => m.low);
  res.json({ ok: true, data: list });
});

// 药品登记
router.post('/medicines', requirePerm('resource:write'), (req, res) => {
  const b = req.body || {};
  const list = load('medicines');
  const m = { id: uid('med'), hospitalId: b.hospitalId || '', name: b.name || '药品', stock: +b.stock || 0, dailyUse: +b.dailyUse || 0, threshold: +b.threshold || 3, updatedAt: now() };
  list.push(m); save('medicines', list);
  res.json({ ok: true, data: m });
});

// 药品库存更新
router.patch('/medicines/:id', requirePerm('resource:update'), (req, res) => {
  const m = updateMedicine(req.params.id, req.body || {});
  if (!m) return res.json({ ok: false, error: '药品不存在' });
  res.json({ ok: true, data: m });
});

/* ================= 资源调度 ================= */
router.post('/dispatches', requirePerm('resource:dispatch'), (req, res) => {
  const b = req.body || {};
  const list = load('med_dispatches');
  const d = {
    id: uid('md'), eventId: b.eventId || '', kind: b.kind || 'bed', itemName: b.itemName || '',
    qty: +b.qty || 1, fromHospitalId: b.fromHospitalId || '', toHospitalId: b.toHospitalId || '',
    status: 'pending', requestedBy: req.user.name, handledBy: null, createdAt: now(), arrivedAt: null
  };
  list.push(d); save('med_dispatches', list);
  res.json({ ok: true, data: d });
});

router.get('/dispatches', requirePerm('resource:read'), (req, res) => {
  let list = load('med_dispatches');
  if (req.query.eventId) list = list.filter(d => d.eventId === req.query.eventId);
  res.json({ ok: true, data: list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

const MD_FLOW = ['pending', 'dispatched', 'arrived', 'signed'];
router.post('/dispatches/:id/advance', requirePerm('resource:dispatch'), (req, res) => {
  const list = load('med_dispatches');
  const d = list.find(x => x.id === req.params.id);
  if (!d) return res.json({ ok: false, error: '调度单不存在' });
  const next = MD_FLOW[MD_FLOW.indexOf(d.status) + 1];
  if (next) {
    d.status = next;
    if (next === 'arrived') d.arrivedAt = now();
    d.handledBy = req.user.name;
  }
  save('med_dispatches', list);
  res.json({ ok: true, data: d });
});

module.exports = router;
