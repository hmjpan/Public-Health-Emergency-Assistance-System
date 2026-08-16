// AgentTeams 编排引擎 — 实现 Manager→TeamLeader→Worker 分层协同
// 基于 AGENTS.md 团队定义，管理事件全生命周期的 Agent 协同
const { getAgent, listAgents, registry } = require('./index');
const { load, save, uid, now } = require('../store');
const { getEventMode, canAgentWrite } = require('./mode-switch');

// 团队层级定义
const TEAM = {
  manager: { id: 'manager', name: '卫盾编排器', role: 'Manager' },
  teamLeaders: {
    command: { id: 'commander', name: '指挥决策组', leader: 'commander', members: ['sentinel'] },
    field: { id: 'field', name: '现场处置组', leader: 'field', members: ['medical'] },
    support: { id: 'support', name: '保障协调组', leader: 'dispatch', members: ['communication', 'review'] }
  }
};

// 事件阶段→Agent触发映射
const STAGE_TRIGGERS = {
  detected: [
    { agent: 'sentinel', trigger: 'new_report' }
  ],
  responding: [
    { agent: 'commander', trigger: 'grade' },
    { agent: 'commander', trigger: 'launch' },
    { agent: 'dispatch', trigger: 'launch' },
    { agent: 'communication', trigger: 'notify' }
  ],
  field: [
    { agent: 'field', trigger: 'task' },
    { agent: 'field', trigger: 'guidance' },
    { agent: 'medical', trigger: 'update' }
  ],
  closed: [
    { agent: 'review', trigger: 'review' },
    { agent: 'communication', trigger: 'draft' }
  ]
};

/**
 * 编排引擎：执行事件全流程 Agent 协同
 * @param {string} eventId - 事件ID
 * @param {string} stage - 当前阶段（可选，不传则自动判断）
 * @param {Object} context - 额外上下文
 * @returns {Object} 编排结果（含 Trace ID、各 Agent 执行结果）
 */
async function orchestrate(eventId, stage, context = {}) {
  const traceId = 'trace_' + uid('');
  const startTime = now();

  // 获取事件状态
  const events = load('events');
  const event = events.find(e => e.id === eventId);
  if (!event) {
    return { ok: false, error: '事件不存在: ' + eventId, traceId };
  }

  const currentStage = stage || event.stage || 'detected';
  const mode = getEventMode(eventId);

  // 获取该阶段要触发的 Agent
  const triggers = STAGE_TRIGGERS[currentStage] || [];
  const agentResults = [];

  for (const t of triggers) {
    const agent = getAgent(t.agent);
    if (!agent) continue;

    try {
      // 编排上下文增强：通讯 Agent 通知时自动携带事件已通知人员作为目标
      let agentContext = { ...context, traceId, mode };
      if (t.agent === 'communication' && (t.trigger === 'notify' || t.trigger === 'alert')) {
        const personnel = load('personnel').filter(p => p.eventId === eventId);
        agentContext.targets = personnel.map(p => ({
          id: p.personId, name: p.name, phone: p.phone, role: p.role, superiorId: null
        }));
        agentContext.content = `【Agent协同通知】${event.title} @${event.location} 需协同处置`;
        if (!agentContext.targets.length) agentContext.targets = [{ id: 'cmd', name: '指挥长', phone: '', role: 'commander' }];
      }

      const result = await agent.react(event, t.trigger, agentContext);

      // drill 模式下 Agent 可直接写数据
      if (mode === 'drill' && result.ok) {
        await applyDrillActions(eventId, t.agent, t.trigger, result);
      }

      agentResults.push({
        agentId: t.agent,
        agentName: agent.name,
        trigger: t.trigger,
        ok: result.ok,
        suggestions: result.suggestions,
        skillResults: result.skillResults.map(sr => ({
          skillName: sr.skillName,
          ok: sr.result.ok,
          durationMs: sr.result.meta.durationMs,
          llmUsed: sr.result.meta.llmUsed
        })),
        traceId
      });
    } catch (e) {
      agentResults.push({
        agentId: t.agent, trigger: t.trigger,
        ok: false, error: e.message, traceId
      });
    }
  }

  // 记录编排日志
  const log = {
    id: uid('orch'),
    traceId,
    eventId,
    stage: currentStage,
    mode,
    agentResults,
    startedAt: startTime,
    completedAt: now()
  };

  const orchLogs = load('orchestration_logs');
  orchLogs.push(log);
  save('orchestration_logs', orchLogs);

  return {
    ok: true,
    traceId,
    eventId,
    stage: currentStage,
    mode,
    agentResults,
    agentCount: agentResults.length,
    successCount: agentResults.filter(r => r.ok).length
  };
}

/**
 * drill 模式下应用 Agent 的执行结果（自动写数据）
 */
async function applyDrillActions(eventId, agentId, trigger, result) {
  // drill 模式下根据 Agent 建议自动执行部分操作
  // 例如：sentinel 自动分类、commander 自动定级等
  if (agentId === 'sentinel' && trigger === 'new_report') {
    const classify = result.suggestions.find(s => s.type === 'classification');
    if (classify && classify.data) {
      const events = load('events');
      const event = events.find(e => e.id === eventId);
      if (event) {
        event.typeKey = classify.data.typeKey;
        save('events', events);
      }
    }
  }
}

/**
 * 获取编排日志
 */
function getOrchestrationLogs(eventId, limit = 20) {
  const logs = load('orchestration_logs')
    .filter(l => l.eventId === eventId)
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  return logs.slice(0, limit);
}

/**
 * 获取 Trace 详情（全链路追踪）
 */
function getTrace(traceId) {
  const logs = load('orchestration_logs');
  const log = logs.find(l => l.traceId === traceId);
  if (!log) return null;

  // 获取该 trace 下所有 agent_sessions（会话已携带 traceId）
  const sessions = load('agent_sessions').filter(s =>
    s.traceId === traceId || log.agentResults.some(r => r.traceId === traceId)
  );

  // 获取该 trace 下所有 rule_results
  const ruleResults = load('rule_results').filter(r =>
    r.at >= log.startedAt && r.at <= log.completedAt
  );

  return {
    traceId,
    eventId: log.eventId,
    stage: log.stage,
    mode: log.mode,
    startedAt: log.startedAt,
    completedAt: log.completedAt,
    agents: log.agentResults,
    sessions,
    ruleResults: ruleResults.slice(0, 50)
  };
}

module.exports = { TEAM, STAGE_TRIGGERS, orchestrate, getOrchestrationLogs, getTrace };
