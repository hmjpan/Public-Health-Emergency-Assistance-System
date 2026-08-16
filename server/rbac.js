// RBAC 角色权限 —— 单线决策：仅 commander/deputy 可发指令；现场指令仅 field 指挥员可分发
const { load } = require('./store');

// 角色 → 权限标识
const ROLE_PERMS = {
  commander:    ['dashboard:view','report:read','dispatch:launch','dispatch:read','event:read','event:write','response:read','personnel:read','personnel:update','material:read','material:write','material:dispatch','material:sign','vehicle:read','vehicle:update','field:read','task:read','task:update','task:assign','instruction:issue','instruction:read','brief:read','request:approve','form:read','directory:read','stage:advance','feedback:read','case:read','case:write','case:update','resource:read','resource:write','resource:update','resource:dispatch','review:read','review:write','rect:write','rect:close','knowledge:read','knowledge:write','publish:read','publish:write','publish:approve','publish:send','sentiment:read','sentiment:write','drill:read','drill:write','drill:start','drill:assess','report:write'],
  deputy:       ['dashboard:view','report:read','dispatch:launch','dispatch:read','event:read','event:write','response:read','personnel:read','material:read','vehicle:read','field:read','task:read','instruction:issue','instruction:read','brief:read','request:approve','form:read','directory:read','stage:advance','feedback:read','case:read','case:write','case:update','resource:read','resource:write','resource:update','resource:dispatch','review:read','review:write','rect:write','rect:close','knowledge:read','knowledge:write','publish:read','publish:approve','publish:send','sentiment:read','sentiment:write','drill:read','drill:write','drill:start','drill:assess'],
  group_leader: ['dashboard:view','event:read','personnel:update','personnel:read','task:read','task:update','task:assign','form:write','form:read','brief:write','instruction:read','instruction:ack','request:write','material:read','material:sign','directory:read','feedback:read','case:read','case:write','resource:read','review:read','knowledge:read','drill:read'],
  member:       ['event:read','personnel:update','personnel:read','task:read','task:update','form:write','form:read','instruction:read','instruction:ack','material:sign','directory:read','notify:ack','case:read','knowledge:read'],
  material_mgr: ['dashboard:view','event:read','material:read','material:write','material:dispatch','vehicle:read','request:read','request:handle','directory:read','resource:read','resource:update','resource:dispatch','knowledge:read'],
  medic:        ['dashboard:view','event:read','case:read','case:write','case:update','resource:read','resource:update','resource:dispatch','form:write','form:read','directory:read','feedback:read','knowledge:read'],
  spokesman:    ['dashboard:view','event:read','publish:read','publish:write','publish:send','sentiment:read','sentiment:write','knowledge:read','directory:read'],
  reviewer:     ['dashboard:view','event:read','case:read','review:read','review:write','rect:write','rect:close','knowledge:read','knowledge:write','directory:read'],
  drill_mgr:    ['dashboard:view','event:read','drill:read','drill:write','drill:start','drill:assess','directory:read','knowledge:read'],
  driver:       ['event:read','vehicle:update','vehicle:read','personnel:read','directory:read','notify:ack'],
  info:         ['dashboard:view','report:write','report:read','event:read','brief:read','form:read','instruction:read','feedback:read','directory:read','case:read','resource:read','knowledge:read'],
  admin:        ['admin:users','admin:directory','admin:config','directory:read','directory:write','dashboard:view','knowledge:read','drill:read','drill:write','drill:start','drill:assess']
};

const ROLE_NAME = {
  commander: '指挥长', deputy: '副指挥', group_leader: '组长', member: '队员',
  material_mgr: '物资管理员', medic: '医疗救治员', spokesman: '宣教发言人', reviewer: '复盘评估员',
  drill_mgr: '演练管理员', driver: '驾驶员', info: '信息员', admin: '平台管理员'
};

// 各角色默认首页
const ROLE_HOME = {
  commander: 'dashboard', deputy: 'dashboard', group_leader: 'field', member: 'tasks',
  material_mgr: 'materials', medic: 'medical', spokesman: 'publishing', reviewer: 'review',
  drill_mgr: 'drill', driver: 'response', info: 'report', admin: 'admin'
};

// 各角色可见导航
const ROLE_NAV = {
  commander: ['dashboard','dispatch','response','materials','field','medical','routine','publishing','review','statistics','drill','tasks','report','agent'],
  deputy:    ['dashboard','dispatch','response','materials','field','medical','routine','publishing','review','statistics','drill','tasks','report','agent'],
  group_leader: ['field','tasks','response','materials','medical','routine','dashboard'],
  member:    ['tasks','field','response','medical'],
  material_mgr: ['materials','response','medical','dashboard'],
  medic:     ['medical','field','routine','dashboard'],
  spokesman: ['publishing','dashboard'],
  reviewer:  ['review','statistics','dashboard','agent'],
  drill_mgr: ['drill','dashboard','agent'],
  driver:    ['response'],
  info:      ['report','routine','dashboard','field','medical'],
  admin:     ['admin','dashboard','agent']
};

const SESSIONS = {};

function createSession(user) {
  const token = 'tok_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  SESSIONS[token] = user.id;
  return token;
}

function getUser(token) {
  if (!token) return null;
  const uid = SESSIONS[token];
  if (!uid) return null;
  const users = load('users');
  return users.find(u => u.id === uid) || null;
}

function authMiddleware(req, res, next) {
  const token = req.headers['x-token'];
  req.user = getUser(token);
  req.token = token;
  next();
}

function requirePerm(perm) {
  return (req, res, next) => {
    if (!req.user) return res.json({ ok: false, error: '未登录' });
    const perms = ROLE_PERMS[req.user.role] || [];
    if (!perms.includes(perm)) return res.json({ ok: false, error: '无权限: ' + perm });
    next();
  };
}

function hasPerm(role, perm) {
  return (ROLE_PERMS[role] || []).includes(perm);
}

module.exports = { ROLE_PERMS, ROLE_NAME, ROLE_HOME, ROLE_NAV, createSession, getUser, authMiddleware, requirePerm, hasPerm };
