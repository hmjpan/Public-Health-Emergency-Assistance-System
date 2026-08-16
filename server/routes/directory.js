// 通讯录 —— 常态下唯一维护工作：人员/联系方式/岗位确认 + 每月测试
const { Router } = require('express');
const { load, save, uid, now } = require('../store');
const { requirePerm } = require('../rbac');
const { sendNotification } = require('../notify');

const router = Router();

// 通讯录列表
router.get('/', requirePerm('directory:read'), (req, res) => {
  const { group, status } = req.query;
  let list = load('directory');
  if (group) list = list.filter(d => d.group === group);
  if (status) list = list.filter(d => d.confirmStatus === status);
  res.json({ ok: true, data: list });
});

// 分组汇总
router.get('/groups', requirePerm('directory:read'), (req, res) => {
  const list = load('directory');
  const groups = {};
  list.forEach(d => {
    const g = groups[d.group] = groups[d.group] || { group: d.group, total: 0, confirmed: 0, unconfirmed: 0 };
    g.total++;
    if (d.confirmStatus === 'confirmed') g.confirmed++; else g.unconfirmed++;
  });
  res.json({ ok: true, data: Object.values(groups) });
});

// 新增/更新人员
router.post('/', requirePerm('directory:write'), (req, res) => {
  const list = load('directory');
  const body = req.body || {};
  if (!body.name || !body.group) return res.json({ ok: false, error: '缺少姓名或小组' });
  const item = {
    id: uid('dir'),
    name: body.name,
    group: body.group,
    role: body.role || 'member',
    phone: body.phone || '',
    position: body.position || '',
    superiorId: body.superiorId || null,
    confirmStatus: 'unconfirmed',
    lastConfirmAt: null,
    createdAt: now()
  };
  list.push(item);
  save('directory', list);
  res.json({ ok: true, data: item });
});

router.patch('/:id', requirePerm('directory:write'), (req, res) => {
  const list = load('directory');
  const d = list.find(x => x.id === req.params.id);
  if (!d) return res.json({ ok: false, error: '人员不存在' });
  ['name', 'group', 'role', 'phone', 'position', 'superiorId'].forEach(k => {
    if (req.body[k] !== undefined) d[k] = req.body[k];
  });
  save('directory', list);
  res.json({ ok: true, data: d });
});

router.delete('/:id', requirePerm('directory:write'), (req, res) => {
  let list = load('directory');
  list = list.filter(x => x.id !== req.params.id);
  save('directory', list);
  res.json({ ok: true, data: { removed: req.params.id } });
});

// 每月测试通知：向全员发送岗位/联系方式确认
router.post('/test-notify', requirePerm('admin:directory'), (req, res) => {
  const list = load('directory');
  const users = load('users');
  let sent = 0;
  list.forEach(d => {
    const user = users.find(u => u.phone === d.phone || u.name === d.name) || d;
    sendNotification('', {
      id: d.id, name: d.name, phone: d.phone, role: d.role, superiorId: d.superiorId
    }, `【月度测试】请确认您的岗位(${d.position || d.group})与联系方式(${d.phone})是否准确`, {
      kind: 'test', ackMinutes: 60 * 24 // 测试通知24h内确认
    });
    d.confirmStatus = 'pending';
    sent++;
  });
  save('directory', list);
  res.json({ ok: true, data: { sent } });
});

// 人员确认岗位与联系方式（由测试通知触发）
router.post('/:id/confirm', (req, res) => {
  const list = load('directory');
  const d = list.find(x => x.id === req.params.id);
  if (!d) return res.json({ ok: false, error: '人员不存在' });
  if (req.body.phone) d.phone = req.body.phone;
  if (req.body.position) d.position = req.body.position;
  d.confirmStatus = 'confirmed';
  d.lastConfirmAt = now();
  save('directory', list);
  res.json({ ok: true, data: d });
});

// 未确认预警：把超时未确认的推送给管理员
router.get('/unconfirmed-alerts', requirePerm('admin:directory'), (req, res) => {
  const list = load('directory').filter(d => d.confirmStatus !== 'confirmed');
  res.json({ ok: true, data: list });
});

module.exports = router;
