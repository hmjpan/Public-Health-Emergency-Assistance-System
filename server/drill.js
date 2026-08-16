// 演练模式 -- 脚本管理 + 演练事件标记 + 注入点推进 + 评估报告生成
const { load, save, uid, now } = require('./store');

// 演练脚本：预设情景 + 注入点序列 + 标准时效
// 注入点 injectPoint: 演练过程中按序触发的情景事件（如"新发2例""密接转确诊""舆情出现"）
/*
script = {
  id, name, typeKey, scenario(情景描述), objective(演练目标),
  injects: [{ seq, name, desc, trigger(手动/自动), atMinutes(距演练开始分钟数), action(提示动作) }],
  standardSla: { launchH, toFieldH, totalH },  // 标准时效，用于评估对照
  createdAt
}
*/

function addScript(data, byUser) {
  const list = load('drill_scripts');
  const s = {
    id: uid('ds'), name: data.name || '未命名演练',
    typeKey: data.typeKey || 'INF',
    scenario: data.scenario || '', objective: data.objective || '',
    injects: data.injects || [],
    standardSla: data.standardSla || { launchH: 0.5, toFieldH: 2, totalH: 48 },
    status: 'draft',  // draft(草稿) / published(已发布)
    createdAt: now(), createdBy: byUser
  };
  list.push(s); save('drill_scripts', list); return s;
}

// 启动演练：基于脚本创建演练事件(isDrill:true) + 生成注入点执行计划
function startDrill(scriptId, launchBody, byUser) {
  const scripts = load('drill_scripts');
  const script = scripts.find(s => s.id === scriptId);
  if (!script) return { ok: false, error: '演练脚本不存在' };

  // 生成演练会话（记录注入点执行进度）
  const sessions = load('drill_sessions');
  const session = {
    id: uid('dse'), scriptId, status: 'running',  // running / finished
    startedAt: now(), finishedAt: null,
    injectProgress: script.injects.map((inj, i) => ({ seq: i + 1, ...inj, triggered: false, triggeredAt: null })),
    eventId: null  // 由调用方填入
  };
  sessions.push(session); save('drill_sessions', sessions);
  return { ok: true, data: { session, script } };
}

// 触发注入点
function triggerInject(sessionId, injectSeq, byUser) {
  const sessions = load('drill_sessions');
  const session = sessions.find(s => s.id === sessionId);
  if (!session) return { ok: false, error: '演练会话不存在' };
  const inj = session.injectProgress.find(p => p.seq === injectSeq);
  if (!inj) return { ok: false, error: '注入点不存在' };
  if (inj.triggered) return { ok: false, error: '该注入点已触发' };
  inj.triggered = true;
  inj.triggeredAt = now();
  inj.triggeredBy = byUser;
  save('drill_sessions', sessions);

  // 记入时间线
  if (session.eventId) {
    const timeline = load('timeline');
    timeline.push({ id: uid('tl'), eventId: session.eventId, at: now(), actor: byUser, action: '演练注入', detail: `[${inj.name}] ${inj.desc}` });
    save('timeline', timeline);
  }
  return { ok: true, data: inj };
}

// 生成演练评估报告
// 对照标准时效 + 参与率 + 注入点完成率 + 任务完成率
function generateAssessment(sessionId) {
  const sessions = load('drill_sessions');
  const session = sessions.find(s => s.id === sessionId);
  if (!session) return { ok: false, error: '演练会话不存在' };
  const scripts = load('drill_scripts');
  const script = scripts.find(s => s.id === session.scriptId);
  if (!script) return { ok: false, error: '脚本不存在' };

  const eventId = session.eventId;
  const events = load('events');
  const event = events.find(e => e.id === eventId);
  const timeline = load('timeline').filter(t => t.eventId === eventId).sort((a, b) => new Date(a.at) - new Date(b.at));
  const personnel = load('personnel').filter(p => p.eventId === eventId);
  const tasks = load('tasks').filter(t => t.eventId === eventId);
  const cases = load('cases').filter(c => c.eventId === eventId);
  const notifications = load('notifications').filter(n => n.eventId === eventId);

  // 时效计算
  const start = timeline[0] ? new Date(timeline[0].at) : (event ? new Date(event.createdAt) : new Date());
  const launch = timeline.find(t => t.action === '一键启动');
  const advance = timeline.filter(t => t.action === '阶段推进');
  const toField = advance.length ? new Date(advance[0].at) : null;
  const end = session.finishedAt ? new Date(session.finishedAt) : new Date();
  const h = (a, b) => b && a ? +((b - a) / 3600000).toFixed(2) : null;
  const actualLaunchH = h(start, launch ? new Date(launch.at) : start);
  const actualToFieldH = h(start, toField);
  const actualTotalH = h(start, end);

  const std = script.standardSla || {};
  const slaScore = (() => {
    const checks = [];
    if (std.launchH && actualLaunchH != null) checks.push(actualLaunchH <= std.launchH);
    if (std.toFieldH && actualToFieldH != null) checks.push(actualToFieldH <= std.toFieldH);
    if (std.totalH && actualTotalH != null) checks.push(actualTotalH <= std.totalH);
    return checks.length ? Math.round(checks.filter(Boolean).length / checks.length * 100) : 100;
  })();

  // 参与率：通知确认率
  const ackRate = notifications.length ? Math.round(notifications.filter(n => n.status === 'acked').length / notifications.length * 100) : 100;
  // 人员到位率
  const arriveRate = personnel.length ? Math.round(personnel.filter(p => ['arrived', 'departed'].includes(p.status)).length / personnel.length * 100) : 100;
  // 任务完成率
  const taskRate = tasks.length ? Math.round(tasks.filter(t => t.status === 'done').length / tasks.length * 100) : 100;
  // 注入点完成率
  const injectRate = session.injectProgress.length ? Math.round(session.injectProgress.filter(p => p.triggered).length / session.injectProgress.length * 100) : 100;

  // 综合评分
  const overall = Math.round((slaScore + ackRate + arriveRate + taskRate + injectRate) / 5);

  const assessment = {
    id: uid('da'), sessionId, eventId,
    scriptName: script.name, scenario: script.scenario,
    startedAt: session.startedAt, finishedAt: session.finishedAt || now(),
    sla: { actualLaunchH, actualToFieldH, actualTotalH, standard: std, score: slaScore },
    participation: { notified: notifications.length, acked: notifications.filter(n => n.status === 'acked').length, ackRate, personnelTotal: personnel.length, arrived: personnel.filter(p => p.status === 'arrived').length, arriveRate },
    tasks: { total: tasks.length, done: tasks.filter(t => t.status === 'done').length, taskRate },
    cases: { total: cases.length },
    injects: { total: session.injectProgress.length, triggered: session.injectProgress.filter(p => p.triggered).length, injectRate, detail: session.injectProgress },
    overall,
    grade: overall >= 90 ? '优秀' : overall >= 75 ? '良好' : overall >= 60 ? '合格' : '不合格',
    timeline: timeline.slice(0, 20),
    generatedAt: now()
  };

  // 保存评估报告
  const assessments = load('drill_assessments');
  const existing = assessments.findIndex(a => a.sessionId === sessionId);
  if (existing >= 0) assessments[existing] = assessment;
  else assessments.push(assessment);
  save('drill_assessments', assessments);

  // 结束演练会话
  session.status = 'finished';
  session.finishedAt = now();
  save('drill_sessions', sessions);

  return { ok: true, data: assessment };
}

module.exports = { addScript, startDrill, triggerInject, generateAssessment };
