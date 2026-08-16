// 可观测层 — Trace 全链路追踪
// 设计：每次 Agent 调用生成 traceId，串联 Agent→Skill→LLM/MCP 全链路
// 数据写入 agent_traces 表
const { load, save, uid, now } = require('../store');

/**
 * 创建 Trace Span
 */
function createSpan({ traceId, parentSpanId, operation, agentId, skillName, input }) {
  return {
    spanId: 'span_' + uid(''),
    traceId: traceId || 'trace_' + uid(''),
    parentSpanId: parentSpanId || null,
    operation,
    agentId: agentId || null,
    skillName: skillName || null,
    input: input ? JSON.parse(JSON.stringify(input)) : null,
    output: null,
    status: 'started',
    error: null,
    startedAt: now(),
    completedAt: null,
    durationMs: 0,
    meta: {}
  };
}

/**
 * 完成 Span
 */
function completeSpan(span, output, error) {
  span.completedAt = now();
  span.durationMs = new Date(span.completedAt) - new Date(span.startedAt);
  span.status = error ? 'error' : 'ok';
  span.output = output ? JSON.parse(JSON.stringify(output)) : null;
  span.error = error || null;
  return span;
}

/**
 * 记录 Trace（持久化到 agent_traces 表）
 */
function recordTrace(span) {
  try {
    const traces = load('agent_traces');
    // 查找并更新或追加
    const idx = traces.findIndex(t => t.spanId === span.spanId);
    if (idx >= 0) {
      traces[idx] = { ...traces[idx], ...span };
    } else {
      traces.push(span);
    }
    save('agent_traces', traces);
  } catch (e) {
    console.warn('[Trace] 记录失败:', e.message);
  }
}

/**
 * 获取完整 Trace（按 traceId 聚合所有 span）
 */
function getTrace(traceId) {
  const traces = load('agent_traces');
  const spans = traces.filter(t => t.traceId === traceId);
  spans.sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
  return {
    traceId,
    spans,
    totalSpans: spans.length,
    totalDurationMs: spans.reduce((sum, s) => sum + (s.durationMs || 0), 0),
    status: spans.every(s => s.status === 'ok') ? 'ok' : (spans.some(s => s.status === 'error') ? 'error' : 'partial')
  };
}

/**
 * 获取最近的 Trace 列表
 */
function listTraces(limit = 50) {
  const traces = load('agent_traces');
  // 按 traceId 分组，取每组最新的一条
  const groups = {};
  traces.forEach(t => {
    if (!groups[t.traceId] || t.startedAt > groups[t.traceId].startedAt) {
      groups[t.traceId] = t;
    }
  });
  const list = Object.values(groups).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  return list.slice(0, limit).map(t => ({
    traceId: t.traceId,
    operation: t.operation,
    agentId: t.agentId,
    skillName: t.skillName,
    status: t.status,
    startedAt: t.startedAt,
    durationMs: t.durationMs
  }));
}

/**
 * 获取 Metrics 统计
 */
function getMetrics() {
  const traces = load('agent_traces');
  const ruleResults = load('rule_results');
  const agentSessions = load('agent_sessions');
  const notifications = load('notifications');

  return {
    traces: {
      total: [...new Set(traces.map(t => t.traceId))].length,
      ok: traces.filter(t => t.status === 'ok').length,
      error: traces.filter(t => t.status === 'error').length,
      avgDurationMs: traces.length > 0 ? Math.round(traces.reduce((s, t) => s + (t.durationMs || 0), 0) / traces.length) : 0
    },
    skills: {
      totalCalls: ruleResults.length,
      llmCalls: ruleResults.filter(r => r.llmUsed).length,
      deterministicCalls: ruleResults.filter(r => !r.llmUsed).length,
      avgDurationMs: ruleResults.length > 0 ? Math.round(ruleResults.reduce((s, r) => s + (r.durationMs || 0), 0) / ruleResults.length) : 0
    },
    agents: {
      totalSessions: agentSessions.length,
      byAgent: countBy(agentSessions, 'agentId'),
      todaySessions: agentSessions.filter(s => s.startedAt && s.startedAt.slice(0, 10) === new Date().toISOString().slice(0, 10)).length
    },
    notifications: {
      total: notifications.length,
      acked: notifications.filter(n => n.status === 'acked').length,
      escalated: notifications.filter(n => n.status === 'escalated').length,
      pending: notifications.filter(n => n.status === 'sent').length,
      ackRate: notifications.length > 0 ? (notifications.filter(n => n.status === 'acked').length / notifications.length * 100).toFixed(1) + '%' : 'N/A'
    }
  };
}

function countBy(arr, key) {
  const map = {};
  arr.forEach(item => { if (item[key]) map[item[key]] = (map[item[key]] || 0) + 1; });
  return map;
}

module.exports = { createSpan, completeSpan, recordTrace, getTrace, listTraces, getMetrics };
