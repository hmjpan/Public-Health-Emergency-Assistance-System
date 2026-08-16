// Skill: StaffAssign — 标准编成建议（按类型×级别）
// 包装 rules/engine.js 的 staffAssign()，Commander/Dispatch 使用
// v1.1.0: 增加 evidence chain + 法规依据输出
const { SkillResult } = require('../skill-base');
const engine = require('../../rules/engine');

module.exports = {
  name: 'StaffAssign',
  version: '1.1.0',
  agent: 'dispatch',
  detLevel: 'D1',
  description: '依据《国家卫生应急队伍管理办法》等国家标准，根据事件类型和级别输出标准编成建议（工作组、最低人数、技能标签、任务清单、法规依据）',
  inputSchema: {
    typeKey: 'INF|FOOD|ENV|POISON|UNK - 事件类型',
    level: 'I级|II级|III级|IV级 - 事件级别'
  },
  outputSchema: {
    name: 'string', typeKey: 'string', level: 'string',
    multiplier: 'number', groups: 'array[{group, minCount, baseCount, skillTags, tasks, role_ref}]',
    materialPacks: 'array', basis: 'string',
    evidence: 'object{provenance, groups_count, total_min_count, methodology}'
  },
  async execute(input) {
    const { typeKey, level } = input || {};
    const result = engine.staffAssign(typeKey, level);

    if (!result.ok) {
      return new SkillResult({
        ok: false,
        data: null,
        error: result.error,
        meta: {
          skillName: 'StaffAssign',
          skillVersion: '1.1.0',
          detLevel: 'D1',
          llmUsed: false,
          evidence: { provenance: 'composition.json', methodology: '输入校验失败' }
        }
      });
    }

    // 计算总最低人数
    const totalMinCount = result.groups.reduce((sum, g) => sum + (g.minCount || 0), 0);

    const evidence = {
      provenance: `composition.json rule_version=${result.ruleVersion || '2026.2'}`,
      groups_count: result.groups.length,
      total_min_count: totalMinCount,
      multiplier_applied: result.multiplier,
      methodology: '规则表查询 + 级别倍率调整（确定性）'
    };

    return new SkillResult({
      ok: true,
      data: {
        name: result.name,
        typeKey: result.typeKey,
        level: result.level,
        multiplier: result.multiplier,
        groups: result.groups,
        materialPacks: result.materialPacks,
        basis: result.basis || '',
        notice: result.notice,
        evidence
      },
      meta: {
        skillName: 'StaffAssign',
        skillVersion: '1.1.0',
        detLevel: 'D1',
        ruleVersion: result.ruleVersion,
        llmUsed: false,
        evidence
      }
    });
  }
};
