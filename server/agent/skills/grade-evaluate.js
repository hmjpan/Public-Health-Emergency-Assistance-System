// Skill: GradeEvaluate — 研判定级（量化要素→法定级别）
// 包装 rules/engine.js 的 gradeEvaluate()，Commander 专属
// v1.1.0: 增加 evidence chain + risk level + 法规依据输出
const { SkillResult } = require('../skill-base');
const engine = require('../../rules/engine');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'GradeEvaluate',
  version: '1.1.0',
  agent: 'commander',
  detLevel: 'D0',
  description: '依据《国家突发公共卫生事件应急预案》分级标准，将量化要素映射为法定建议级别（I/II/III/IV级），含命中规则、法规依据、L0-L3风险等级、执行证据链',
  inputSchema: {
    typeKey: 'INF|FOOD|ENV|POISON|UNK - 事件类型',
    cases: 'number - 病例/中毒人数（≥0）',
    deaths: 'number - 死亡人数（≥0）',
    scope: '1|2|3|4 - 波及范围(1县区/2市内跨区/3省内跨市/4跨省)',
    spread: 'boolean - 是否有扩散趋势',
    typeTag: 'string (可选) - 传染病管理类别(甲类管理/乙类管理/空)'
  },
  outputSchema: {
    suggestedLevel: 'I级|II级|III级|IV级',
    riskLevel: 'L0|L1|L2|L3',
    riskLabel: '特别重大|重大|较大|一般',
    matchedRules: 'array[{id, level, basis, legal_ref, expr}]',
    gapToHigher: 'array|null',
    factors: 'object',
    notice: 'string',
    evidence: 'object{provenance, rule_evaluated, rule_matched, confidence, missing_evidence, methodology}'
  },
  async execute(input) {
    const result = engine.gradeEvaluate(input || {});

    // 加载 grading.json 获取 risk level 映射
    let riskLevels = {};
    let totalRules = 0;
    try {
      const gradingPath = path.join(__dirname, '../../rules/grading.json');
      const grading = JSON.parse(fs.readFileSync(gradingPath, 'utf8'));
      riskLevels = grading.risk_levels || {};
      totalRules = (grading.rules || []).length;
    } catch (e) {
      // 降级：无 risk level 映射
    }

    if (!result.ok) {
      return new SkillResult({
        ok: false,
        data: null,
        error: result.error,
        meta: {
          skillName: 'GradeEvaluate',
          skillVersion: '1.1.0',
          detLevel: 'D0',
          ruleVersion: result.ruleVersion || '2026.2',
          llmUsed: false,
          evidence: {
            provenance: 'grading.json',
            rule_evaluated: 0,
            rule_matched: 0,
            confidence: 'none',
            missing_evidence: ['输入校验失败: ' + result.error],
            methodology: '受限表达式求值（输入不合法）'
          }
        }
      });
    }

    // 构建 evidence chain
    const ruleMatched = result.matchedRules ? result.matchedRules.length : 0;
    const noMatch = result.noMatch;

    // 获取 risk level
    const riskInfo = riskLevels[result.suggestedLevel] || { riskLevel: 'L3', label: '未知' };

    // 构建 enhanced matchedRules（含 legal_ref）
    const enhancedRules = (result.matchedRules || []).map(r => ({
      id: r.id,
      level: r.level,
      basis: r.basis,
      legal_ref: r.legal_ref || '',
      expr: r.expr || ''
    }));

    const evidence = {
      provenance: `grading.json rule_version=${result.ruleVersion || '2026.2'}`,
      rule_evaluated: totalRules,
      rule_matched: ruleMatched,
      confidence: noMatch ? 'low' : 'high',
      missing_evidence: noMatch ? ['规则表未覆盖该情形，需人工补充研判依据'] : [],
      methodology: '受限表达式求值，白名单变量，纯函数无网络无随机'
    };

    return new SkillResult({
      ok: true,
      data: {
        suggestedLevel: result.suggestedLevel,
        riskLevel: riskInfo.riskLevel,
        riskLabel: riskInfo.label,
        matchedRules: enhancedRules,
        gapToHigher: result.gapToHigher,
        factors: result.factors,
        noMatch: result.noMatch || false,
        notice: result.notice || '本结果为规则建议级别，最终定级由指挥员决定（就高不就低原则）',
        evidence
      },
      meta: {
        skillName: 'GradeEvaluate',
        skillVersion: '1.1.0',
        detLevel: 'D0',
        ruleVersion: result.ruleVersion,
        llmUsed: false,
        evidence
      }
    });
  }
};
