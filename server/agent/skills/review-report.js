// Skill: ReviewReport — 复盘报告生成
// Review 专属，确定性统计 + LLM分析
// v1.1.0: 增加 evidence chain + 缺失数据检测
const { SkillResult } = require('../skill-base');
const llm = require('../llm/provider');
const { load } = require('../../store');
const { resolveEventType } = require('../../eventTypes');

const SYSTEM_PROMPT = `你是应急管理复盘专家。根据事件处置全过程数据，撰写复盘报告。
包含：事件概述、响应时间线、成效亮点、不足与问题、改进建议、经验教训。
输出 JSON 格式：
{"summary": "事件概述", "timeline": "时间线摘要", "highlights": "成效亮点", "issues": "不足与问题", "improvements": "改进建议", "lessons": "经验教训"}`;

module.exports = {
  name: 'ReviewReport',
  version: '1.1.0',
  agent: 'review',
  detLevel: 'D3',
  description: '基于事件处置全过程数据（确定性统计+LLM分析），生成结构化复盘报告（成效亮点、不足分析、改进建议、经验教训）',
  inputSchema: {
    eventId: 'string'
  },
  outputSchema: {
    summary: 'string', timeline: 'array', highlights: 'array',
    issues: 'array', improvements: 'array', lessons: 'array',
    stats: 'object',
    evidence: 'object{provenance, data_sources, stats_computed, missing_evidence}'
  },
  async execute(input) {
    const { eventId } = input || {};
    if (!eventId) {
      return new SkillResult({ ok: false, error: '缺少 eventId', meta: { skillName: 'ReviewReport', skillVersion: '1.1.0', detLevel: 'D3', llmUsed: false, evidence: { methodology: '输入校验失败' } } });
    }

    // 收集事件数据
    const events = load('events');
    const event = events.find(e => e.id === eventId);
    const tasks = load('tasks').filter(t => t.eventId === eventId);
    const notifications = load('notifications').filter(n => n.eventId === eventId);
    const personnel = load('personnel').filter(p => p.eventId === eventId);
    const cases = load('cases').filter(c => c.eventId === eventId);
    const agentSessions = load('agent_sessions').filter(s => s.eventId === eventId);

    // 统计数据（确定性计算）
    const stats = {
      totalTasks: tasks.length,
      tasksDone: tasks.filter(t => t.status === 'done').length,
      tasksBlocked: tasks.filter(t => t.status === 'blocked').length,
      totalNotifications: notifications.length,
      ackedNotifications: notifications.filter(n => n.status === 'acked').length,
      escalatedNotifications: notifications.filter(n => n.status === 'escalated').length,
      totalPersonnel: personnel.length,
      totalCases: cases.length,
      totalAgentSessions: agentSessions.length,
      eventDuration: event ? Math.max(0, Math.round((new Date(event.closedAt || new Date().toISOString()) - new Date(event.detectedAt || event.createdAt || new Date().toISOString())) / 3600000)) : 0
    };
    stats.ackRate = stats.totalNotifications > 0 ? (stats.ackedNotifications / stats.totalNotifications * 100).toFixed(1) + '%' : 'N/A';
    stats.taskCompleteRate = stats.totalTasks > 0 ? (stats.tasksDone / stats.totalTasks * 100).toFixed(1) + '%' : 'N/A';

    // 缺失数据检测
    const missingEvidence = [];
    if (tasks.length === 0) missingEvidence.push('无任务数据');
    if (notifications.length === 0) missingEvidence.push('无通知数据');
    if (personnel.length === 0) missingEvidence.push('无人员参与数据');
    if (!event) missingEvidence.push('事件记录不存在');

    const typePack = event ? resolveEventType(event) : null;

    // 调用 LLM
    const prompt = `事件: ${event ? event.title || event.id : '未知'}
类型: ${typePack ? typePack.name : '未知'}
时间线: 从${event ? (event.detectedAt || event.createdAt) : '未知'}到${event ? (event.closedAt || '进行中') : '未知'}
任务: ${stats.totalTasks}个，完成${stats.tasksDone}个，阻塞${stats.tasksBlocked}个
通知: ${stats.totalNotifications}条，确认率${stats.ackRate}，升级${stats.escalatedNotifications}条
人员: ${stats.totalPersonnel}人
病例: ${stats.totalCases}例
Agent交互: ${stats.totalAgentSessions}次`;

    const llmResult = await llm.chat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ], { temperature: 0.3, maxTokens: 2048 });

    let llmParsed = null;
    if (llmResult.llmUsed && llmResult.content) {
      try {
        const jsonMatch = llmResult.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) llmParsed = JSON.parse(jsonMatch[0]);
      } catch (e) { /* fallback */ }
    }

    const evidence = {
      provenance: `全过程数据表(events/tasks/notifications/personnel/cases/agent_sessions) + LLM(${llmResult.llmUsed ? '已调用' : '未调用'})`,
      data_sources: ['events', 'tasks', 'notifications', 'personnel', 'cases', 'agent_sessions'],
      stats_computed: ['taskCompleteRate', 'ackRate', 'eventDuration', 'totalAgentSessions'],
      missing_evidence: missingEvidence,
      methodology: '确定性统计 + LLM趋势分析和改进建议'
    };

    return new SkillResult({
      ok: true,
      data: {
        summary: llmParsed ? llmParsed.summary : `事件${event ? event.title || event.id : ''}处置复盘`,
        timeline: llmParsed ? (llmParsed.timeline || []) : [],
        highlights: llmParsed ? (llmParsed.highlights || []) : [],
        issues: llmParsed ? (llmParsed.issues || ['待补充']) : ['待补充'],
        improvements: llmParsed ? (llmParsed.improvements || ['待补充']) : ['待补充'],
        lessons: llmParsed ? (llmParsed.lessons || []) : [],
        stats,
        evidence
      },
      meta: {
        skillName: 'ReviewReport',
        skillVersion: '1.1.0',
        detLevel: 'D3',
        llmUsed: llmResult.llmUsed,
        model: llmResult.model,
        evidence
      }
    });
  }
};
