// Field Agent — 现场处置
// 职责：任务分发 + 表单采集 + 简报生成 + 指令传达
const { AgentBase } = require('../agent-base');

class FieldAgent extends AgentBase {
  constructor() {
    super({
      id: 'field',
      name: '现场 Agent',
      role: '现场处置',
      icon: '🏕️',
      skills: ['SOPGuidance', 'TypePackResolve', 'PlanMatch'],
      soul: `你是卫盾Agent系统的现场指挥（Field），负责现场处置。
你的职责：
1. 根据事件类型和阶段，获取岗位SOP指引
2. 分发任务给各小组
3. 采集现场表单数据
4. 生成现场简报
你关注现场执行细节，确保每个步骤符合SOP。`
    });
  }

  prepareInput(eventState, trigger, context) {
    return {
      eventState, trigger, context,
      skillInputs: {
        SOPGuidance: {
          typeKey: context.typeKey || eventState.typeKey,
          stage: context.stage || eventState.stage,
          group: context.group,
          taskTitle: context.taskTitle,
          context: context.fieldContext
        },
        TypePackResolve: {
          typeKey: context.typeKey || eventState.typeKey
        },
        PlanMatch: {
          typeKey: context.typeKey || eventState.typeKey,
          level: eventState.level,
          stage: context.stage || eventState.stage
        }
      }
    };
  }

  shouldRunSkill(skillName, prepared) {
    if (skillName === 'SOPGuidance') return true;
    if (skillName === 'TypePackResolve') return true;
    if (skillName === 'PlanMatch') return prepared.trigger === 'task' || prepared.trigger === 'guidance';
    return true;
  }

  reactWith(prepared, skillResults) {
    const suggestions = [];
    const sop = skillResults.find(sr => sr.skillName === 'SOPGuidance');
    const typePack = skillResults.find(sr => sr.skillName === 'TypePackResolve');
    const plan = skillResults.find(sr => sr.skillName === 'PlanMatch');

    if (sop && sop.result.ok) {
      const d = sop.result.data;
      suggestions.push({
        type: 'sop', skill: 'SOPGuidance', data: d,
        message: `SOP指引已生成: ${d.sop.length}个步骤`,
        sop: d.sop,
        precautions: d.precautions,
        commonMistakes: d.commonMistakes
      });
    }
    if (typePack && typePack.result.ok) {
      const d = typePack.result.data;
      suggestions.push({
        type: 'tasks', skill: 'TypePackResolve', data: d,
        message: `任务包: ${d.taskPacks.length}个任务组`,
        taskPacks: d.taskPacks,
        forms: d.forms
      });
    }
    if (plan && plan.result.ok) {
      suggestions.push({
        type: 'knowledge', skill: 'PlanMatch', data: plan.result.data,
        message: `匹配到${plan.result.data.total}条相关知识`
      });
    }
    return suggestions;
  }
}

module.exports = FieldAgent;
