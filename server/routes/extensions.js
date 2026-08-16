// 类型包差异化扩展 —— 接口
const { Router } = require('express');
const { load, save, now } = require('../store');
const { requirePerm } = require('../rbac');
const {
  CONTACT_STATUS, addContact, contactBoard, contactToCase,
  addMealExposure, ENV_STATUS, addEnvElimination, envRetest, envConfirm
} = require('../extensions');

const router = Router();

/* ============ 密接追踪 ============ */
router.get('/contacts', requirePerm('case:read'), (req, res) => {
  res.json({ ok: true, data: contactBoard(req.query.eventId) });
});

router.post('/contacts', requirePerm('case:write'), (req, res) => {
  const c = addContact(req.body || {}, req.user.name);
  res.json({ ok: true, data: c });
});

// 管理操作：转运/在管/解除
router.post('/contacts/:id/manage', requirePerm('case:update'), (req, res) => {
  const list = load('contacts');
  const c = list.find(x => x.id === req.params.id);
  if (!c) return res.json({ ok: false, error: '密接不存在' });
  const b = req.body || {};
  if (b.status) c.status = b.status;
  if (b.manageType) c.manageType = b.manageType;
  if (b.quarantineSite) c.quarantineSite = b.quarantineSite;
  if (b.releaseDue) c.releaseDue = b.releaseDue;
  if (b.healthNote) c.healthLog.push({ date: now(), symptom: b.healthNote });
  c.updatedAt = now();
  save('contacts', list);
  res.json({ ok: true, data: c });
});

router.post('/contacts/:id/release', requirePerm('case:update'), (req, res) => {
  const list = load('contacts');
  const c = list.find(x => x.id === req.params.id);
  if (!c) return res.json({ ok: false, error: '密接不存在' });
  c.status = 'released'; c.updatedAt = now();
  save('contacts', list);
  res.json({ ok: true, data: c });
});

// 密接转确诊（自动生成新病例）
router.post('/contacts/:id/to-case', requirePerm('case:update'), (req, res) => {
  const r = contactToCase(req.params.id, req.user.name);
  res.json(r.ok ? { ok: true, data: r.data } : r);
});

/* ============ 暴露餐次 ============ */
router.get('/meals', requirePerm('case:read'), (req, res) => {
  let list = load('meal_exposures');
  if (req.query.eventId) list = list.filter(m => m.eventId === req.query.eventId);
  list = list.sort((a, b) => b.attackRate - a.attackRate); // 罹患率降序,最可疑在前
  res.json({ ok: true, data: list });
});

router.post('/meals', requirePerm('case:write'), (req, res) => {
  const m = addMealExposure(req.body || {}, req.user.name);
  res.json({ ok: true, data: m });
});

/* ============ 环境消除 ============ */
router.get('/env', requirePerm('case:read'), (req, res) => {
  let list = load('env_eliminations');
  if (req.query.eventId) list = list.filter(e => e.eventId === req.query.eventId);
  res.json({ ok: true, data: list });
});

router.post('/env', requirePerm('case:write'), (req, res) => {
  const e = addEnvElimination(req.body || {}, req.user.name);
  res.json({ ok: true, data: e });
});

router.post('/env/:id/retest', requirePerm('case:update'), (req, res) => {
  const r = envRetest(req.params.id, req.body || {}, req.user.name);
  res.json(r.ok ? { ok: true, data: Object.assign({ allQualified: r.allQualified }, r.data || {}) } : r);
});

router.post('/env/:id/confirm', requirePerm('stage:advance'), (req, res) => {
  const r = envConfirm(req.params.id, req.user.name);
  res.json(r.ok ? { ok: true, data: r.data } : r);
});

module.exports = router;
