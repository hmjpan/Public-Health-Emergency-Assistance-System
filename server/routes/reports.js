// 一线极简上报 —— 哪里/什么情况/规模多大/报告人，提交即完成
const { Router } = require('express');
const { load, save, uid, now } = require('../store');
const { requirePerm } = require('../rbac');
const { resolveEventType } = require('../eventTypes');

const router = Router();

// 上报列表
router.get('/', requirePerm('report:read'), (req, res) => {
  const { status } = req.query;
  let list = load('reports');
  if (status) list = list.filter(r => r.status === status);
  list = list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ ok: true, data: list });
});

// 提交上报（极简入口，任何登录人可报）
router.post('/', (req, res) => {
  if (!req.user) return res.json({ ok: false, error: '未登录' });
  const body = req.body || {};
  if (!body.location || !body.situation) return res.json({ ok: false, error: '请填写地点与情况' });
  const typePack = resolveEventType({ title: body.situation, type: body.typeGuess });
  const r = {
    id: uid('rpt'),
    location: body.location,
    situation: body.situation,
    scale: body.scale || '',
    reporter: body.reporter || req.user.name,
    reporterPhone: body.reporterPhone || req.user.phone || '',
    typeGuess: typePack.typeKey,
    typeName: typePack.name,
    attachments: body.attachments || [],
    status: 'pending',   // pending(待研判) / adopted(已采纳建事件) / rejected(已排除)
    createdAt: now(),
    reviewedBy: null,
    eventId: null
  };
  const list = load('reports');
  list.push(r);
  save('reports', list);
  res.json({ ok: true, data: r });
});

// 决策层研判：采纳/排除
router.post('/:id/review', requirePerm('dispatch:launch'), (req, res) => {
  const list = load('reports');
  const r = list.find(x => x.id === req.params.id);
  if (!r) return res.json({ ok: false, error: '上报不存在' });
  const { action, typeKey } = req.body || {};
  if (action === 'reject') {
    r.status = 'rejected';
    r.reviewedBy = req.user.name;
    save('reports', list);
    return res.json({ ok: true, data: r });
  }
  if (action === 'adopt') {
    r.status = 'adopted';
    r.reviewedBy = req.user.name;
    if (typeKey) r.typeGuess = typeKey;
    save('reports', list);
    return res.json({ ok: true, data: r });
  }
  return res.json({ ok: false, error: 'action 需为 adopt/reject' });
});

module.exports = router;
