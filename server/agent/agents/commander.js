// Commander Agent — 指挥决策
// 职责：研判定级 → 一键启动 → 阶段推进 → 终止评估
const { AgentBase } = require('../agent-base');

class CommanderAgent extends AgentBase {
  constructor() {
    super({
      id: 'commander',
      name: '指挥官 Agent',
      role: '指挥决策',
      icon: '🎯',
      skills: ['GradeEvaluate', 'SlaCheck', 'StaffAssign', 'PlanMatch', 'CriteriaCheck'],
      soul: `你是卫盾Agent系统的指挥官（Commander），负责事件处置的核心决策。
你的职责：
1. 研判事件级别（I/II/III/IV级），遵循"就高不就低"原则
2. 校验法定时限，防止超时
3. 制定标准编成方案
4. 匹配预案/SOP知识库
5. 校验阶段完成标准后决定是否推进
你提供决策建议，最终决定由人确认（高风险动作保留人工确认）。`
    });
  }

  prepareInput(eventState, trigger, context) {
    return {
      eventState, trigger, context,
      skillInputs: {
        GradeEvaluate: {
          typeKey: context.typeKey || eventState.typeKey,
          cases: context.cases || eventState.caseCount || 0,
          deaths: context.deaths || eventState.deathCount || 0,
          scope: context.scope || eventState.scope || 1,
          spread: context.spread || eventState.spread || false
        },
        SlaCheck: {
          stages: context.stages || eventState.timeline || []
        },
        StaffAssign: {
          typeKey: context.typeKey || eventState.typeKey,
          level: context.level || eventState.level
        },
        PlanMatch: {
          typeKey: context.typeKey || eventState.typeKey,
          level: context.level || eventState.level,
          stage: context.stage || eventState.stage
        },
        CriteriaCheck: {
          eventId: eventState.id,
          stage: eventState.stage
        }
      }
    };
  }

  shouldRunSkill(skillName, prepared) {
    const { trigger } = prepared;
    // 根据触发场景选择 Skill
    switch (trigger) {
      case 'grade': return skillName === 'GradeEvaluate' || skillName === 'SlaCheck' || skillName === 'PlanMatch';
      case 'launch': return skillName === 'StaffAssign' || skillName === 'CriteriaCheck';
      case 'advance': return skillName === 'CriteriaCheck' || skillName === 'SlaCheck';
      case 'terminate': return skillName === 'CriteriaCheck';
      default: return true; // 全量执行
    }
  }

  reactWith(prepared, skillResults) {
    const suggestions = [];
    for (const sr of skillResults) {
      if (!sr.result.ok) {
        suggestions.push({ type: 'warning', skill: sr.skillName, message: `执行失败: ${sr.result.error}` });
        continue;
      }
      const d = sr.result.data;
      switch (sr.skillName) {
        case 'GradeEvaluate':
          suggestions.push({
            type: 'grade', skill: sr.skillName, data: d,
            message: d.suggestedLevel
              ? `建议定级: ${d.suggestedLevel}（命中${d.matchedRules.length}条规则）`
              : '规则未覆盖，建议人工研判'
          });
          break;
        case 'SlaCheck':
          const over = d.checks.filter(c => c.status === 'over' || c.status === 'over_done');
          const near = d.checks.filter(c => c.status === 'near');
          suggestions.push({
            type: 'sla', skill: sr.skillName, data: d,
            message: over.length > 0 ? `⚠️ ${over.length}项已超时！` : near.length > 0 ? `⏰ ${near.length}项即将超时` : '✅ 时限正常'
          });
          break;
        case 'StaffAssign':
          suggestions.push({
            type: 'staff', skill: sr.skillName, data: d,
            message: `编成方案: ${d.groups.length}个小组，系数${d.multiplier}`
          });
          break;
        case 'PlanMatch':
          suggestions.push({
            type: 'plan', skill: sr.skillName, data: d,
            message: `匹配到${d.total}条相关知识`
          });
          break;
        case 'CriteriaCheck':
          suggestions.push({
            type: 'criteria', skill: sr.skillName, data: d,
            message: d.allReady ? '✅ 阶段完成标准已达成' : '❌ 阶段完成标准未达成'
          });
          break;
      }
    }
    return suggestions;
  }
}

module.exports = CommanderAgent;
