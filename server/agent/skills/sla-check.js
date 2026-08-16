// Skill: SlaCheck — 法定时限校验
// 包装 rules/engine.js 的 slaCheck()，Commander 专属
// v1.1.0: 增加 evidence chain + summary + legal_ref 输出
const { SkillResult } = require('../skill-base');
const engine = require('../../rules/engine');

module.exports = {
  name: 'SlaCheck',
  version: '1.1.0',
  agent: 'commander',
  detLevel: 'D0',
  description: '依据《突发公共卫生事件应急条例》《传染病信息报告管理规范（2016版）》等法规，校验事件各环节是否满足法定时限（区分甲类2h/其他24h），输出各环节时限状态+预警动作+法规依据',
  inputSchema: {
    stages: 'array[{stage, startAt, doneAt?}] — 各阶段信息'
  },
  outputSchema: {
    checks: 'array[{stage, ruleId, limitMinutes, elapsedMin, status, action, action_detail, basis, legal_ref, ruleVersion}]',
    summary: 'object{total, ok, near, over, pending}',
    evidence: 'object{provenance, methodology}'
  },
  async execute(input) {
    const { stages } = input || {};
    if (!stages || !Array.isArray(stages)) {
      return new SkillResult({
        ok: false,
        data: null,
        error: 'stages 须为数组',
        meta: {
          skillName: 'SlaCheck',
          skillVersion: '1.1.0',
          detLevel: 'D0',
          llmUsed: false,
          evidence: { provenance: 'sla.json', methodology: '输入校验失败' }
        }
      });
    }

    const results = engine.slaCheck(stages);

    // 构建 summary
    const summary = { total: results.length, ok: 0, near: 0, over: 0, pending: 0, unknown: 0 };
    results.forEach(r => { if (summary[r.status] !== undefined) summary[r.status]++; });

    // 构建 evidence
    const evidence = {
      provenance: `sla.json rule_version=${results.length > 0 ? results[0].ruleVersion : '2026.2'}`,
      methodology: '确定性时间计算（当前时间戳 - 起始时间戳），无LLM',
      total_stages_checked: results.length,
      stages_with_rules: results.filter(r => r.status !== 'unknown').length,
      stages_unknown: results.filter(r => r.status === 'unknown').length
    };

    return new SkillResult({
      ok: true,
      data: {
        checks: results,
        summary,
        evidence
      },
      meta: {
        skillName: 'SlaCheck',
        skillVersion: '1.1.0',
        detLevel: 'D0',
        ruleVersion: results.length > 0 ? results[0].ruleVersion : null,
        llmUsed: false,
        evidence
      }
    });
  }
};
