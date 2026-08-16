// Skill 基座 —— 注册表 + 统一执行 + SkillResult 标准化
// 设计：所有 Skill 通过 register() 注册，execute() 统一调度
// 每次执行自动计时、自动写入 rule_results 存证
const { load, save, uid, now } = require('../store');

class SkillResult {
  constructor({ ok, data, error, meta }) {
    this.ok = ok;
    this.data = data || null;
    this.error = error || null;
    this.meta = meta || {};
  }
}

class SkillRegistry {
  constructor() {
    this._skills = new Map();
  }

  /**
   * 注册一个 Skill
   * @param {Object} skill - { name, version, agent, detLevel, description, inputSchema, outputSchema, execute(input): SkillResult }
   */
  register(skill) {
    if (!skill.name) throw new Error('Skill must have a name');
    if (typeof skill.execute !== 'function') throw new Error(`Skill ${skill.name} must have execute()`);
    this._skills.set(skill.name, {
      name: skill.name,
      version: skill.version || '1.0.0',
      agent: skill.agent || null,
      detLevel: skill.detLevel || 'D0',
      description: skill.description || '',
      inputSchema: skill.inputSchema || {},
      outputSchema: skill.outputSchema || {},
      execute: skill.execute,
      _registeredAt: now()
    });
  }

  /**
   * 执行 Skill，返回标准化 SkillResult + 自动存证
   */
  async execute(skillName, input, context = {}) {
    const skill = this._skills.get(skillName);
    if (!skill) {
      return new SkillResult({ ok: false, error: `Skill not found: ${skillName}` });
    }
    const start = Date.now();
    try {
      const result = await skill.execute(input, context);
      const durationMs = Date.now() - start;
      // 自动存证到 rule_results
      this._logResult(skillName, skill, input, result, durationMs, null, context);
      return result;
    } catch (e) {
      const durationMs = Date.now() - start;
      this._logResult(skillName, skill, input, null, durationMs, e.message, context);
      return new SkillResult({
        ok: false,
        error: e.message,
        meta: { skillName, skillVersion: skill.version, detLevel: skill.detLevel, durationMs, llmUsed: false }
      });
    }
  }

  /**
   * 列出所有已注册 Skill
   */
  list() {
    return Array.from(this._skills.values()).map(s => ({
      name: s.name,
      version: s.version,
      agent: s.agent,
      detLevel: s.detLevel,
      description: s.description,
      inputSchema: s.inputSchema,
      outputSchema: s.outputSchema
    }));
  }

  /**
   * 获取单个 Skill 详情
   */
  get(name) {
    const s = this._skills.get(name);
    if (!s) return null;
    return {
      name: s.name, version: s.version, agent: s.agent,
      detLevel: s.detLevel, description: s.description,
      inputSchema: s.inputSchema, outputSchema: s.outputSchema
    };
  }

  /**
   * 存证到 rule_results
   */
  _logResult(skillName, skill, input, result, durationMs, errorMsg, context) {
    try {
      const results = load('rule_results');
      results.push({
        id: uid('rr'),
        skillName,
        skillVersion: skill.version,
        detLevel: skill.detLevel,
        input: JSON.parse(JSON.stringify(input)),
        output: result ? { ok: result.ok, data: result.data, error: result.error } : null,
        ruleVersion: result && result.meta && result.meta.ruleVersion || null,
        llmUsed: result && result.meta && result.meta.llmUsed || false,
        durationMs,
        error: errorMsg,
        traceId: (context && context.traceId) || null,
        at: now()
      });
      save('rule_results', results);
    } catch (e) {
      console.warn(`[SkillRegistry] 存证失败: ${e.message}`);
    }
  }
}

// 全局单例
const registry = new SkillRegistry();

module.exports = { SkillRegistry, SkillResult, registry };
