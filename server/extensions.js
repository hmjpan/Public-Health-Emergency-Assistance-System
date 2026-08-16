// 类型包差异化扩展 —— 密接追踪(传染病) / 暴露餐次(食源) / 环境消除(环境污染)
const { load, save, uid, now } = require('./store');
const { registerCase } = require('./medical');
const { autoMilestone } = require('./routine');

/* ============ 密接/次密接追踪（传染病） ============ */
const CONTACT_STATUS = { pending: '待转运', managing: '在管', released: '已解除', to_case: '转确诊' };

function addContact(data, byUser) {
  const list = load('contacts');
  const ts = now();
  const c = {
    id: uid('ct'), eventId: data.eventId || '', caseId: data.caseId || '',
    name: data.name || '', phone: data.phone || '', relation: data.relation || '',
    contactType: data.contactType || '密接', exposureAt: data.exposureAt || '', exposureWay: data.exposureWay || '',
    manageType: data.manageType || '集中隔离', status: 'pending',
    quarantineSite: data.quarantineSite || '', releaseDue: data.releaseDue || '',
    healthLog: [], createdAt: ts, updatedAt: ts, createdBy: byUser
  };
  list.push(c); save('contacts', list); return c;
}

function contactBoard(eventId) {
  let list = load('contacts');
  if (eventId) list = list.filter(c => c.eventId === eventId);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);
  return {
    total: list.length,
    pending: list.filter(c => c.status === 'pending').length,
    managing: list.filter(c => c.status === 'managing').length,
    released: list.filter(c => c.status === 'released').length,
    toCase: list.filter(c => c.status === 'to_case').length,
    // 今日到期解除
    dueToday: list.filter(c => c.status === 'managing' && c.releaseDue && new Date(c.releaseDue) < tomorrow).length,
    list
  };
}

// 密接转确诊 → 自动生成新病例
function contactToCase(contactId, byUser) {
  const list = load('contacts');
  const c = list.find(x => x.id === contactId);
  if (!c) return { ok: false, error: '密接不存在' };
  c.status = 'to_case'; c.updatedAt = now();
  save('contacts', list);
  // 自动生成病例
  const newCase = registerCase({
    eventId: c.eventId, name: c.name, phone: c.phone,
    sourceCaseId: c.caseId, isolationType: c.manageType === '集中隔离' ? 'centralized' : 'home'
  }, byUser);
  autoMilestone(c.eventId, '密接转确诊', `${c.name} → ${newCase.trackNo}`, byUser);
  return { ok: true, data: { contact: c, case: newCase } };
}

/* ============ 暴露餐次调查（食源性） ============ */
function addMealExposure(data, byUser) {
  const list = load('meal_exposures');
  const attackRate = data.dinerCount ? +(((data.illnessCount || 0) / data.dinerCount) * 100).toFixed(1) : 0;
  const m = {
    id: uid('meal'), eventId: data.eventId || '',
    mealTime: data.mealTime || '', place: data.place || '',
    foodItems: data.foodItems || [], dinerCount: +data.dinerCount || 0, illnessCount: +data.illnessCount || 0,
    attackRate, suspectedFood: data.suspectedFood || [], sampleIds: data.sampleIds || [],
    createdAt: now(), createdBy: byUser
  };
  list.push(m); save('meal_exposures', list); return m;
}

/* ============ 环境消除确认（环境污染） ============ */
const ENV_STATUS = { treating: '治理中', retesting: '复测中', eliminated: '已消除', unqualified: '未达标' };

function addEnvElimination(data, byUser) {
  const list = load('env_eliminations');
  const e = {
    id: uid('env'), eventId: data.eventId || '', siteName: data.siteName || '',
    mediaType: data.mediaType || '空气', beforeValue: data.beforeValue || '',
    standard: data.standard || '', afterValue: '',
    monitorPoints: data.monitorPoints || [],   // [{point,value,qualified}]
    eliminateMeasures: data.eliminateMeasures || '',
    status: 'treating', confirmedBy: null, confirmedAt: null, createdAt: now(), createdBy: byUser
  };
  list.push(e); save('env_eliminations', list); return e;
}

// 复测：更新点位与达标情况
function envRetest(id, data, byUser) {
  const list = load('env_eliminations');
  const e = list.find(x => x.id === id);
  if (!e) return { ok: false, error: '记录不存在' };
  if (data.monitorPoints) e.monitorPoints = data.monitorPoints;
  if (data.afterValue !== undefined) e.afterValue = data.afterValue;
  const allQualified = e.monitorPoints.length > 0 && e.monitorPoints.every(p => p.qualified);
  e.status = allQualified ? 'retesting' : 'unqualified';
  e.updatedAt = now();
  save('env_eliminations', list);
  return { ok: true, data: e, allQualified };
}

// 决策层确认消除
function envConfirm(id, byUser) {
  const list = load('env_eliminations');
  const e = list.find(x => x.id === id);
  if (!e) return { ok: false, error: '记录不存在' };
  const allQualified = e.monitorPoints.length > 0 && e.monitorPoints.every(p => p.qualified);
  if (!allQualified) return { ok: false, error: '尚有监测点未达标,不能确认消除' };
  e.status = 'eliminated'; e.confirmedBy = byUser; e.confirmedAt = now();
  save('env_eliminations', list);
  autoMilestone(e.eventId, '环境消除确认', `${e.siteName}(${e.mediaType})`, byUser);
  return { ok: true, data: e };
}

module.exports = {
  CONTACT_STATUS, addContact, contactBoard, contactToCase,
  addMealExposure,
  ENV_STATUS, addEnvElimination, envRetest, envConfirm
};
