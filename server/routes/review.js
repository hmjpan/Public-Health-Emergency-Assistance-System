// 终止评估与复盘整改 —— 复盘 + 整改闭环 + 知识沉淀回流
const { Router } = require('express');
const { load, save, uid, now } = require('../store');
const { requirePerm } = require('../rbac');

const router = Router();

/* ============ 复盘 ============ */
router.post('/:eventId', requirePerm('review:write'), (req, res) => {
  const reviews = load('reviews');
  if (reviews.some(r => r.eventId === req.params.eventId)) {
    return res.json({ ok: false, error: '该事件已发起复盘' });
  }
  const b = req.body || {};
  const r = {
    id: uid('rev'), eventId: req.params.eventId,
    summary: b.summary || '', metrics: b.metrics || {},
    problems: b.problems || [], lessons: b.lessons || [],
    by: req.user.name, createdAt: now()
  };
  reviews.push(r); save('reviews', r ? reviews : reviews);
  res.json({ ok: true, data: r });
});

router.get('/:eventId', requirePerm('review:read'), (req, res) => {
  const r = load('reviews').find(x => x.eventId === req.params.eventId);
  const rects = load('rectifications').filter(x => x.eventId === req.params.eventId);
  res.json({ ok: true, data: { review: r || null, rectifications: rects } });
});

/* ============ 整改台账 ============ */
// 全部整改项（跨事件，供整改看板）
router.get('/rectifications/all', requirePerm('review:read'), (req, res) => {
  const events = load('events');
  const titleMap = {};
  events.forEach(e => titleMap[e.id] = e.title);
  let list = load('rectifications').map(r => ({ ...r, eventTitle: titleMap[r.eventId] || '' }));
  if (req.query.status) list = list.filter(r => r.status === req.query.status);
  res.json({ ok: true, data: list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

router.post('/:eventId/rectifications', requirePerm('rect:write'), (req, res) => {
  const b = req.body || {};
  if (!b.problem) return res.json({ ok: false, error: '缺少问题描述' });
  const list = load('rectifications');
  const item = {
    id: uid('rect'), eventId: req.params.eventId,
    problem: b.problem, measure: b.measure || '', owner: b.owner || '', deadline: b.deadline || '',
    status: 'open', verifiedBy: null, closedAt: null, createdAt: now(), progress: []
  };
  list.push(item); save('rectifications', list);
  res.json({ ok: true, data: item });
});

router.post('/rectifications/:id/progress', requirePerm('rect:write'), (req, res) => {
  const list = load('rectifications');
  const r = list.find(x => x.id === req.params.id);
  if (!r) return res.json({ ok: false, error: '整改项不存在' });
  const b = req.body || {};
  if (b.status) r.status = b.status;
  if (b.note) r.progress.push({ at: now(), by: req.user.name, note: b.note });
  save('rectifications', list);
  res.json({ ok: true, data: r });
});

router.post('/rectifications/:id/verify', requirePerm('rect:close'), (req, res) => {
  const list = load('rectifications');
  const r = list.find(x => x.id === req.params.id);
  if (!r) return res.json({ ok: false, error: '整改项不存在' });
  r.status = 'verified'; r.verifiedBy = req.user.name; r.closedAt = now();
  save('rectifications', list);
  res.json({ ok: true, data: r });
});

/* ============ 知识库（复盘结论回流） ============ */
router.get('/knowledge/list', requirePerm('knowledge:read'), (req, res) => {
  let list = load('knowledge');
  if (req.query.typeKey) list = list.filter(k => k.typeKey === req.query.typeKey);
  res.json({ ok: true, data: list });
});

router.post('/knowledge', requirePerm('knowledge:write'), (req, res) => {
  const b = req.body || {};
  if (!b.title) return res.json({ ok: false, error: '缺少标题' });
  const list = load('knowledge');
  const k = {
    id: uid('kn'), type: b.type || 'SOP', title: b.title, content: b.content || '',
    typeKey: b.typeKey || '', sourceEventId: b.sourceEventId || '', createdAt: now(), by: req.user.name
  };
  list.push(k); save('knowledge', list);
  res.json({ ok: true, data: k });
});

module.exports = router;
