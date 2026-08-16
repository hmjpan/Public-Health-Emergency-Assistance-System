// 三阶段工作流状态机 + 启动/现场完成标准校验
// 阶段: detected(监测预警) → responding(应急响应启动) → field(现场处置) → closed(终止评估)
const { load, save, uid, now } = require('./store');
const { resolveEventType } = require('./eventTypes');

const STAGES = [
  { key: 'detected', name: '监测预警', desc: '报告与研判' },
  { key: 'responding', name: '应急响应启动', desc: '人员出动与物资准备' },
  { key: 'field', name: '现场处置', desc: '任务落地与信息流转' },
  { key: 'closed', name: '终止与评估', desc: '终报与复盘' }
];

function getStage(key) { return STAGES.find(s => s.key === key) || STAGES[0]; }
function nextStage(cur) {
  const i = STAGES.findIndex(s => s.key === cur);
  return (i >= 0 && i < STAGES.length - 1) ? STAGES[i + 1] : null;
}

// ---- 启动阶段完成标准校验 ----
// 关键小组均已出发/抵达；标准物资包均已装车/送达；保障车辆均已到位
function checkLaunchComplete(eventId) {
  const personnel = load('personnel').filter(p => p.eventId === eventId);
  const materials = load('materials').filter(m => m.eventId === eventId);
  const vehicles = load('vehicles').filter(v => v.eventId === eventId);

  const keyGroups = [...new Set(personnel.map(p => p.group))];
  const groupsReady = keyGroups.length > 0 && keyGroups.every(g =>
    personnel.filter(p => p.group === g).every(p => ['departed', 'arrived', 'remote'].includes(p.status))
  );
  const materialsReady = materials.length > 0 && materials.every(m => ['loaded', 'sent', 'delivered', 'signed'].includes(m.status));
  const vehiclesReady = vehicles.length > 0 && vehicles.every(v => v.status === 'ready' || v.status === 'arrived');

  return {
    groupsReady, materialsReady, vehiclesReady,
    allReady: groupsReady && materialsReady && vehiclesReady,
    detail: {
      groups: keyGroups.map(g => ({
        group: g,
        total: personnel.filter(p => p.group === g).length,
        ready: personnel.filter(p => p.group === g && ['departed', 'arrived', 'remote'].includes(p.status)).length
      })),
      materials: materials.map(m => ({ id: m.id, pack: m.pack, status: m.status })),
      vehicles: vehicles.map(v => ({ id: v.id, plate: v.plate, status: v.status }))
    }
  };
}

// ---- 现场处置完成标准校验 ----
// 依据任务完成度 + 表单回传 + 关键指标
function checkFieldComplete(eventId) {
  const tasks = load('tasks').filter(t => t.eventId === eventId);
  const forms = load('forms').filter(f => f.eventId === eventId);
  const briefs = load('briefs').filter(b => b.eventId === eventId);

  const criticalTasks = tasks.filter(t => t.critical);
  const tasksDone = criticalTasks.length > 0 && criticalTasks.every(t => t.status === 'done');
  const blockedTasks = tasks.filter(t => t.status === 'blocked').length;
  const formsBack = forms.length > 0;

  return {
    tasksDone, formsBack, blockedTasks,
    allReady: tasksDone && formsBack && blockedTasks === 0,
    detail: {
      taskTotal: tasks.length,
      taskDone: tasks.filter(t => t.status === 'done').length,
      criticalTotal: criticalTasks.length,
      criticalDone: criticalTasks.filter(t => t.status === 'done').length,
      formsCount: forms.length,
      briefsCount: briefs.length,
      blocked: tasks.filter(t => t.status === 'blocked').map(t => t.title)
    }
  };
}

// 推进阶段（仅决策层）
function advanceStage(event, byUser) {
  const cur = event.stage;
  if (cur === 'detected') {
    // 由一键启动触发，不走 advance
    return { ok: false, error: '请通过一键启动进入响应阶段' };
  }
  if (cur === 'responding') {
    const chk = checkLaunchComplete(event.id);
    if (!chk.allReady) {
      return { ok: false, error: '启动阶段完成标准未达成', check: chk };
    }
    event.stage = 'field';
    event.stageEnteredAt = now();
    return { ok: true, event, check: chk };
  }
  if (cur === 'field') {
    const chk = checkFieldComplete(event.id);
    if (!chk.allReady) {
      return { ok: false, error: '现场处置完成标准未达成', check: chk };
    }
    event.stage = 'closed';
    event.status = 'closed';
    event.closedAt = now();
    event.stageEnteredAt = now();
    return { ok: true, event, check: chk };
  }
  return { ok: false, error: '事件已终止' };
}

// 事件全景观测
function buildOverview(event) {
  const typePack = resolveEventType(event);
  const reviewed = load('reviews').some(r => r.eventId === event.id);
  return {
    ...event,
    typeName: typePack.name,
    typeIcon: typePack.icon,
    stageName: getStage(event.stage).name,
    reviewed,
    launchCriteria: typePack.launchCriteria,
    fieldCriteria: typePack.fieldCriteria,
    launchCheck: event.stage === 'responding' ? checkLaunchComplete(event.id) : null,
    fieldCheck: event.stage === 'field' ? checkFieldComplete(event.id) : null
  };
}

module.exports = { STAGES, getStage, nextStage, checkLaunchComplete, checkFieldComplete, advanceStage, buildOverview };
