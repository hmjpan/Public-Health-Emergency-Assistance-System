// Skill: PlanMatch — 预案/SOP/措施知识库匹配
// 包装 rules/engine.js 的 planMatch()，共享 Skill
// v1.1.0: 增加 evidence chain
const { SkillResult } = require('../skill-base');
const engine = require('../../rules/engine');
const { load } = require('../../store');

module.exports = {
  name: 'PlanMatch',
  version: '1.1.0',
  agent: null, // 共享 Skill
  detLevel: 'D2',
  description: '依据《国家突发公共卫生事件应急预案》体系，按事件类型×级别×阶段从知识库中加权评分匹配最相关处置方案',
  inputSchema: {
    typeKey: 'string', level: 'string', stage: 'string (可选)'
  },
  outputSchema: {
    results: 'array[{id, kind, title, typeKey, stage, score, summary}]',
    total: 'number', ruleVersion: 'string',
    evidence: 'object{provenance, total_candidates, returned_count, methodology}'
  },
  async execute(input) {
    const knowledge = load('knowledge');
    const result = engine.planMatch(input || {}, knowledge);

    const evidence = {
      provenance: `matching.json + knowledge.json rule_version=${result.ruleVersion}`,
      total_candidates: result.total,
      returned_count: result.results.length,
      methodology: '确定性加权评分（类型0.6 + 级别0.2 + 阶段0.2），kind基础权重，降序排序'
    };

    return new SkillResult({
      ok: result.ok,
      data: {
        results: result.results,
        total: result.total,
        evidence
      },
      meta: {
        skillName: 'PlanMatch',
        skillVersion: '1.1.0',
        detLevel: 'D2',
        ruleVersion: result.ruleVersion,
        llmUsed: false,
        evidence
      }
    });
  }
};
