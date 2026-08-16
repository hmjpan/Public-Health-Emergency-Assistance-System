// Agent API 路由
const express = require('express');
const router = express.Router();
const { registry, getAgent, listAgents } = require('../agent');
const { load, save, uid, now } = require('../store');

// GET /agent/agents — 列出所有 Agent 及其 Skills
router.get('/agents', (req, res) => {
  try {
    const agents = listAgents();
    res.json({ ok: true, data: agents });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// GET /agent/skills — 列出所有 Skill 及其规格
router.get('/skills', (req, res) => {
  try {
    const skills = registry.list();
    res.json({ ok: true, data: skills });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// POST /agent/react — Agent 执行
// body: { agentId, eventId, trigger, context }
router.post('/react', async (req, res) => {
  try {
    const { agentId, eventId, trigger, context } = req.body;
    if (!agentId) return res.json({ ok: false, error: '缺少 agentId' });

    const agent = getAgent(agentId);
    if (!agent) return res.json({ ok: false, error: `Agent ${agentId} 不存在` });

    // 构建事件状态
    let eventState = {};
    if (eventId) {
      const events = load('events');
      const event = events.find(e => e.id === eventId);
      if (event) {
        eventState = event;
      }
    }

    const result = await agent.react(eventState, trigger || 'default', context || {});
    res.json({ ok: true, data: result });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// GET /agent/sessions/:eventId — 查看某事件所有 Agent 交互记录
router.get('/sessions/:eventId', (req, res) => {
  try {
    const { eventId } = req.params;
    const sessions = load('agent_sessions').filter(s => s.eventId === eventId);
    // 按时间倒序
    sessions.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    res.json({ ok: true, data: sessions });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// GET /agent/stats — Agent 活动统计
router.get('/stats', (req, res) => {
  try {
    const sessions = load('agent_sessions');
    const stats = {
      totalSessions: sessions.length,
      byAgent: {},
      byTrigger: {},
      todaySessions: 0
    };
    const today = new Date().toISOString().slice(0, 10);
    sessions.forEach(s => {
      stats.byAgent[s.agentId] = (stats.byAgent[s.agentId] || 0) + 1;
      stats.byTrigger[s.trigger] = (stats.byTrigger[s.trigger] || 0) + 1;
      if (s.startedAt && s.startedAt.slice(0, 10) === today) stats.todaySessions++;
    });
    res.json({ ok: true, data: stats });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// POST /agent/mode/:eventId — 切换模式（辅助处置/模拟演练）
router.post('/mode/:eventId', (req, res) => {
  try {
    const { eventId } = req.params;
    const { mode } = req.body; // assist | drill
    if (!['assist', 'drill'].includes(mode)) {
      return res.json({ ok: false, error: 'mode 须为 assist 或 drill' });
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
    res.json({ ok: true, data: { eventId, mode } });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// GET /agent/mode/:eventId — 查询模式
router.get('/mode/:eventId', (req, res) => {
  try {
    const { eventId } = req.params;
    const modes = load('agent_modes');
    const record = modes.find(m => m.eventId === eventId);
    res.json({ ok: true, data: { eventId, mode: record ? record.mode : 'assist' } });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ---- AgentTeams 编排 ----
const { orchestrate, getOrchestrationLogs, getTrace: getOrchTrace } = require('../agent/orchestrator');

// POST /agent/orchestrate — 编排引擎：执行事件全流程 Agent 协同
router.post('/orchestrate', async (req, res) => {
  try {
    const { eventId, stage, context } = req.body;
    if (!eventId) return res.json({ ok: false, error: '缺少 eventId' });
    const result = await orchestrate(eventId, stage, context || {});
    res.json({ ok: true, data: result });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// GET /agent/orchestrate/:eventId — 查看编排日志
router.get('/orchestrate/:eventId', (req, res) => {
  try {
    const logs = getOrchestrationLogs(req.params.eventId);
    res.json({ ok: true, data: logs });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ---- MCP 协议 ----
const mcp = require('../agent/mcp-server');

// GET /agent/mcp/tools — 列出所有 MCP 工具
router.get('/mcp/tools', (req, res) => {
  try {
    res.json({ ok: true, data: mcp.listTools() });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// POST /agent/mcp/call — 调用 MCP 工具
router.post('/mcp/call', async (req, res) => {
  try {
    const { tool, input } = req.body;
    if (!tool) return res.json({ ok: false, error: '缺少 tool 参数' });
    const result = await mcp.callTool(tool, input || {});
    res.json({ ok: true, data: result });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ---- AgentTeams 适配 ----
const teams = require('../agent/teams/adapter');

// GET /agent/teams/workers — AgentTeams Worker 配置（YAML）
router.get('/teams/workers', (req, res) => {
  try {
    res.json({ ok: true, data: { yaml: teams.generateWorkerConfig() } });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// GET /agent/teams/skills — AgentTeams SKILL.md 配置（markdown）
router.get('/teams/skills', (req, res) => {
  try {
    res.json({ ok: true, data: teams.generateSkillMarkdown() });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ---- 可观测 ----
const obs = require('../agent/observability');

// GET /agent/traces — 最近 Trace 列表
router.get('/traces', (req, res) => {
  try {
    res.json({ ok: true, data: obs.listTraces(50) });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// GET /agent/trace/:traceId — Trace 详情（编排链 + 全链路 Span）
router.get('/trace/:traceId', (req, res) => {
  try {
    const orch = getOrchTrace(req.params.traceId);
    const spans = obs.getTrace(req.params.traceId);
    if (!orch && (!spans || !spans.totalSpans)) return res.json({ ok: false, error: 'Trace 不存在' });
    res.json({ ok: true, data: { orchestration: orch, spans } });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// GET /agent/metrics — Metrics 统计
router.get('/metrics', (req, res) => {
  try {
    res.json({ ok: true, data: obs.getMetrics() });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

module.exports = router;
