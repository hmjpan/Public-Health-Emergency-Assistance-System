// Dispatch Agent — 资源调度
// 职责：人员出动 + 物资调拨 + 车辆保障（并行）
const { AgentBase } = require('../agent-base');

class DispatchAgent extends AgentBase {
  constructor() {
    super({
      id: 'dispatch',
      name: '调度 Agent',
      role: '资源调度',
      icon: '📦',
      skills: ['StaffAssign', 'TypePackResolve'],
      soul: `你是卫盾Agent系统的调度员（Dispatch），负责资源调度。
你的职责：
1. 根据指挥官的编成方案，匹配具体人员
2. 调拨标准物资包
3. 调度保障车辆
你协调人员/物资/车辆并行出动，确保响应速度。`
    });
  }

  prepareInput(eventState, trigger, context) {
    return {
      eventState, trigger, context,
      skillInputs: {
        StaffAssign: {
          typeKey: context.typeKey || eventState.typeKey,
          level: context.level || eventState.level || 'IV级'
        },
        TypePackResolve: {
          typeKey: context.typeKey || eventState.typeKey
        }
      }
    };
  }

  reactWith(prepared, skillResults) {
    const suggestions = [];
    const staff = skillResults.find(sr => sr.skillName === 'StaffAssign');
    const typePack = skillResults.find(sr => sr.skillName === 'TypePackResolve');

    if (staff && staff.result.ok) {
      const d = staff.result.data;
      suggestions.push({
        type: 'dispatch', skill: 'StaffAssign', data: d,
        message: `编成方案已生成: ${d.groups.length}个小组`,
        details: d.groups.map(g => `${g.group}: ${g.minCount}人，任务: ${g.tasks.join('、')}`)
      });
    }
    if (typePack && typePack.result.ok) {
      const d = typePack.result.data;
      suggestions.push({
        type: 'materials', skill: 'TypePackResolve', data: d,
        message: `物资包: ${d.materialPacks.length}个标准包待调拨`,
        materialPacks: d.materialPacks
      });
    }
    return suggestions;
  }
}

module.exports = DispatchAgent;
