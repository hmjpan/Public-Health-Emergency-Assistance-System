// 信息发布与舆情 —— 发布三段式(起草→审批→发布) + 舆情监测 + 口径模板
const { Router } = require('express');
const { load, save, uid, now } = require('../store');
const { requirePerm } = require('../rbac');

const router = Router();

/* ============ 信息发布 ============ */
router.get('/', requirePerm('publish:read'), (req, res) => {
  let list = load('publishes');
  if (req.query.eventId) list = list.filter(p => p.eventId === req.query.eventId);
  res.json({ ok: true, data: list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

// 起草
router.post('/', requirePerm('publish:write'), (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.content) return res.json({ ok: false, error: '缺少标题或内容' });
  const list = load('publishes');
  const p = {
    id: uid('pub'), eventId: b.eventId || '', title: b.title, content: b.content,
    channel: b.channel || '官网', status: 'draft', approvedBy: null, publishedAt: null,
    by: req.user.name, createdAt: now()
  };
  list.push(p); save('publishes', list);
  res.json({ ok: true, data: p });
});

// 提交审批
router.post('/:id/submit', requirePerm('publish:write'), (req, res) => {
  const list = load('publishes');
  const p = list.find(x => x.id === req.params.id);
  if (!p) return res.json({ ok: false, error: '发布稿不存在' });
  p.status = 'pending'; save('publishes', list);
  res.json({ ok: true, data: p });
});

// 决策层审批（单线决策：仅 commander）
router.post('/:id/approve', requirePerm('publish:approve'), (req, res) => {
  const list = load('publishes');
  const p = list.find(x => x.id === req.params.id);
  if (!p) return res.json({ ok: false, error: '发布稿不存在' });
  p.status = (req.body && req.body.reject) ? 'draft' : 'approved';
  p.approvedBy = req.user.name;
  save('publishes', list);
  res.json({ ok: true, data: p });
});

// 发布
router.post('/:id/publish', requirePerm('publish:send'), (req, res) => {
  const list = load('publishes');
  const p = list.find(x => x.id === req.params.id);
  if (!p) return res.json({ ok: false, error: '发布稿不存在' });
  if (p.status !== 'approved') return res.json({ ok: false, error: '须先经决策层审批' });
  p.status = 'published'; p.publishedAt = now();
  save('publishes', list);
  res.json({ ok: true, data: p });
});

/* ============ 舆情监测 ============ */
router.get('/sentiment/list', requirePerm('sentiment:read'), (req, res) => {
  let list = load('sentiments');
  if (req.query.eventId) list = list.filter(s => s.eventId === req.query.eventId);
  if (req.query.rumor === '1') list = list.filter(s => s.isRumor && !s.handled);
  res.json({ ok: true, data: list.sort((a, b) => new Date(b.at) - new Date(a.at)) });
});

router.post('/sentiment', requirePerm('sentiment:write'), (req, res) => {
  const b = req.body || {};
  const list = load('sentiments');
  const s = {
    id: uid('st'), eventId: b.eventId || '', source: b.source || '网络',
    content: b.content || '', emotion: b.emotion || '中', isRumor: !!b.isRumor,
    handled: false, at: now(), by: req.user.name
  };
  list.push(s); save('sentiments', list);
  res.json({ ok: true, data: s });
});

router.post('/sentiment/:id/handle', requirePerm('sentiment:write'), (req, res) => {
  const list = load('sentiments');
  const s = list.find(x => x.id === req.params.id);
  if (!s) return res.json({ ok: false, error: '舆情不存在' });
  s.handled = true; s.handledBy = req.user.name; s.handledAt = now();
  save('sentiments', list);
  res.json({ ok: true, data: s });
});

// 口径模板（按事件类型）
const PRESS_TEMPLATES = {
  INF: '【传染病疫情口径模板】\n经初查,我区XX地发现X例XX病例。目前已启动应急响应,开展流调溯源、密接管控、疫点消杀。疫情总体可控,请广大市民做好个人防护,不信谣不传谣。',
  FOOD: '【食源性疾病口径模板】\nX月X日,XX单位发生疑似食源性疾病事件,涉及X人。患者已得到妥善救治,涉事食品及留样已封存送检,相关单位已责令停业整顿。',
  ENV: '【环境污染口径模板】\nX地发生XX污染事件,相关部门已第一时间到场封控污染源,开展环境监测与人群健康监护。目前未收到人员重症报告,环境复测进行中。',
  UNK: '【情况通报模板】\n针对近日网传XX情况,有关部门已介入调查,将及时公布进展。请公众以官方发布为准。'
};
router.get('/templates', (req, res) => {
  res.json({ ok: true, data: PRESS_TEMPLATES[req.query.typeKey] || PRESS_TEMPLATES.UNK });
});

module.exports = router;
