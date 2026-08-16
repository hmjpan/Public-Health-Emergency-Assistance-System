// 系统管理 —— 用户账号
const { Router } = require('express');
const { load, save, uid } = require('../store');
const { requirePerm, ROLE_NAME } = require('../rbac');

const router = Router();

router.get('/users', requirePerm('admin:users'), (req, res) => {
  const users = load('users').map(u => ({ id: u.id, username: u.username, name: u.name, role: u.role, roleName: ROLE_NAME[u.role] || u.role, dept: u.dept, group: u.group, phone: u.phone }));
  res.json({ ok: true, data: users });
});

router.post('/users', requirePerm('admin:users'), (req, res) => {
  const b = req.body || {};
  if (!b.username || !b.name || !b.role) return res.json({ ok: false, error: '缺少账号/姓名/角色' });
  const users = load('users');
  if (users.some(u => u.username === b.username)) return res.json({ ok: false, error: '账号已存在' });
  const u = { id: uid('u'), username: b.username, password: b.password || '123456', name: b.name, role: b.role, dept: b.dept || '', group: b.group || '', phone: b.phone || '' };
  users.push(u);
  save('users', users);
  res.json({ ok: true, data: { id: u.id, username: u.username } });
});

module.exports = router;
