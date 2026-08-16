// 认证
const { Router } = require('express');
const { load } = require('../store');
const { createSession, ROLE_NAME, ROLE_HOME, ROLE_NAV } = require('../rbac');

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const users = load('users');
  const u = users.find(x => x.username === username && x.password === password);
  if (!u) return res.json({ ok: false, error: '账号或密码错误' });
  const token = createSession(u);
  res.json({
    ok: true,
    data: {
      token,
      user: {
        id: u.id, username: u.username, name: u.name, role: u.role,
        roleName: ROLE_NAME[u.role] || u.role, dept: u.dept || '', group: u.group || '',
        home: ROLE_HOME[u.role] || 'dashboard', nav: ROLE_NAV[u.role] || ['dashboard']
      }
    }
  });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.json({ ok: false, error: '未登录' });
  const u = req.user;
  res.json({
    ok: true,
    data: {
      id: u.id, username: u.username, name: u.name, role: u.role,
      roleName: ROLE_NAME[u.role] || u.role, dept: u.dept || '', group: u.group || '',
      home: ROLE_HOME[u.role] || 'dashboard', nav: ROLE_NAV[u.role] || ['dashboard']
    }
  });
});

module.exports = router;
