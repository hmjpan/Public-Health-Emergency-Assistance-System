// 双模式切换 — 辅助处置模式 / 模拟演练模式
// assist: Agent 只提供建议，不直接修改数据
// drill: Agent 可以代替角色操作（单人演练）
const { load, save, uid, now } = require('../store');

/**
 * 获取事件当前模式
 */
function getEventMode(eventId) {
  const modes = load('agent_modes');
  const record = modes.find(m => m.eventId === eventId);
  return record ? record.mode : 'assist';
}

/**
 * 设置事件模式
 */
function setEventMode(eventId, mode) {
  if (!['assist', 'drill'].includes(mode)) {
    return { ok: false, error: 'mode 须为 assist 或 drill' };
  }
  const modes = load('agent_modes');
  let record = modes.find(m => m.eventId === eventId);
  if (record) {
    record.mode = mode;
    record.updatedAt = now();
  } else {
    record = { id: uid('am'), eventId, mode, createdAt: now(), updatedAt: now() };
    modes.push(record);
  }
  save('agent_modes', modes);
  return { ok: true, data: { eventId, mode } };
}

/**
 * Agent 是否可以直接写数据
 * assist 模式下 Agent 只能建议，不能直接修改数据
 * drill 模式下 Agent 可以代替角色操作
 */
function canAgentWrite(agentId, eventId) {
  const mode = getEventMode(eventId);
  return mode === 'drill';
}

/**
 * drill 模式下，为每个 Agent 分配虚拟人员身份
 */
function assignDrillRoles(eventId) {
  const users = load('users');
  const roleMap = {
    sentinel: 'sentinel_user',
    commander: 'commander',
    dispatch: 'dispatcher',
    field: 'field_leader',
    medical: 'medical_leader',
    communication: 'comm_leader',
    review: 'reviewer'
  };
  const assignments = {};
  for (const [agentId, roleKey] of Object.entries(roleMap)) {
    const user = users.find(u => u.role === roleKey || u.username === roleKey);
    assignments[agentId] = user ? { userId: user.id, name: user.name, role: user.role } : { userId: null, name: agentId + '(虚拟)', role: roleKey };
  }
  return assignments;
}

module.exports = { getEventMode, setEventMode, canAgentWrite, assignDrillRoles };
