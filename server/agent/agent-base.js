// Agent 基类 —— 7 个 Agent 的公共逻辑
// 设计：每个 Agent 有 identity(身份)、skills(可用Skill列表)、soul(系统提示词)
// react() 为核心循环：接收事件状态 → 选择 Skill → 执行 → 返回建议
const { registry } = require('./skill-base');
const { load, save, uid, now } = require('../store');
const { createSpan, completeSpan, recordTrace } = require('./observability');

class AgentBase {
  /**
   * @param {Object} config
   * @param {string} config.id - Agent 唯一标识
   * @param {string} config.name - Agent 显示名称
   * @param {string} config.role - 角色定位（如"哨兵"、"指挥决策"）
   * @param {string[]} config.skills - 可用 Skill 名称列表
   * @param {string} config.soul - 系统提示词（定义Agent的性格和行为边界）
   * @param {string} config.icon - 图标 emoji
   */
  constructor({ id, name, role, skills, soul, icon }) {
    this.id = id;
    this.name = name;
    this.role = role;
    this.skills = skills || [];
    this.soul = soul || '';
    this.icon = icon || '🤖';
  }

  /**
   * Agent 核心反应循环
   * @param {Object} eventState - 当前事件状态（Event State 共享状态）
   * @param {string} trigger - 触发原因（如 "new_report", "stage_advance", "timeout"）
   * @param {Object} context - 额外上下文（如用户输入、前序 Agent 输出）
   * @returns {Object} { ok, agentId, action, suggestions, skillResults, session }
   */
  async react(eventState, trigger, context = {}) {
    const startTime = now();
    // Trace: 根 Span（Agent 级）
    const traceId = context.traceId || 'trace_' + uid('');
    const agentSpan = createSpan({
      traceId,
      operation: 'agent.react',
      agentId: this.id,
      input: { trigger, eventId: eventState && eventState.id, mode: context.mode || null }
    });

    // 1. 准备输入
    const prepared = this.prepareInput(eventState, trigger, context);

    // 2. 选择并执行 Skill
    const skillResults = [];
    for (const skillName of this.skills) {
      const skill = registry.get(skillName);
      if (!skill) continue;
      // 检查 Skill 是否需要执行（由子类 decide 或默认全部执行）
      if (this.shouldRunSkill(skillName, prepared) !== false) {
        // Trace: Skill 级 Span
        const skillSpan = createSpan({
          traceId,
          parentSpanId: agentSpan.spanId,
          operation: 'skill.execute',
          agentId: this.id,
          skillName,
          input: prepared.skillInputs[skillName] || {}
        });
        const result = await registry.execute(skillName, prepared.skillInputs[skillName] || {}, {
          eventId: eventState && eventState.id,
          agentId: this.id,
          trigger,
          traceId
        });
        completeSpan(skillSpan, result.ok ? result.data : null, result.error);
        recordTrace(skillSpan);
        skillResults.push({ skillName, result });
      }
    }

    // 3. 综合建议（子类可覆写 reactWith 做更复杂的逻辑）
    const suggestions = this.reactWith(prepared, skillResults);

    // Trace: 完成根 Span
    completeSpan(agentSpan, { suggestions: suggestions.length, skills: skillResults.map(s => s.skillName) }, null);
    recordTrace(agentSpan);

    // 4. 记录会话
    const session = this.logSession(eventState && eventState.id, {
      traceId,
      trigger,
      context,
      prepared,
      skillResults: skillResults.map(sr => ({
        skillName: sr.skillName,
        ok: sr.result.ok,
        data: sr.result.data,
        error: sr.result.error,
        meta: sr.result.meta
      })),
      suggestions
    }, startTime);

    return {
      ok: true,
      agentId: this.id,
      agentName: this.name,
      trigger,
      suggestions,
      skillResults: skillResults.map(sr => ({ skillName: sr.skillName, result: sr.result })),
      session
    };
  }

  /**
   * 准备 Skill 输入（子类可覆写）
   * 默认：从 eventState + trigger + context 提取各 Skill 需要的输入
   */
  prepareInput(eventState, trigger, context) {
    return {
      eventState,
      trigger,
      context,
      skillInputs: {} // 子类覆写时填充 { skillName: { input } }
    };
  }

  /**
   * 判断某个 Skill 是否应执行（默认全部执行，子类可覆写做条件判断）
   */
  shouldRunSkill(skillName, prepared) {
    return true;
  }

  /**
   * 综合 Skill 结果生成建议（子类可覆写）
   */
  reactWith(prepared, skillResults) {
    const suggestions = [];
    for (const sr of skillResults) {
      if (!sr.result.ok) {
        suggestions.push({ type: 'warning', skill: sr.skillName, message: `Skill 执行失败: ${sr.result.error}` });
        continue;
      }
      // 通用建议模板（子类可覆写提供更精确的建议）
      suggestions.push({
        type: 'info',
        skill: sr.skillName,
        data: sr.result.data,
        message: `${sr.skillName} 执行完成`
      });
    }
    return suggestions;
  }

  /**
   * 记录 Agent 交互会话
   */
  logSession(eventId, data, startTime) {
    try {
      const sessions = load('agent_sessions');
      const session = {
        id: uid('as'),
        eventId: eventId || '',
        agentId: this.id,
        agentName: this.name,
        trigger: data.trigger,
        traceId: data.traceId || null,
        input: data.context,
        skillResults: data.skillResults,
        suggestions: data.suggestions,
        startedAt: startTime,
        completedAt: now()
      };
      sessions.push(session);
      save('agent_sessions', sessions);
      return session;
    } catch (e) {
      console.warn(`[Agent ${this.id}] 记录会话失败: ${e.message}`);
      return null;
    }
  }

  /**
   * 获取 Agent 身份信息
   */
  identity() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      icon: this.icon,
      skills: this.skills,
      soul: this.soul
    };
  }
}

module.exports = { AgentBase };
