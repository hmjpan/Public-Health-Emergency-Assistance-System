// Medical Agent — 医疗救治
// 职责：病例全流程 + 密接追踪 + 医疗资源可视
const { AgentBase } = require('../agent-base');

class MedicalAgent extends AgentBase {
  constructor() {
    super({
      id: 'medical',
      name: '医疗 Agent',
      role: '医疗救治',
      icon: '🏥',
      skills: ['CaseTrack', 'TypePackResolve'],
      soul: `你是卫盾Agent系统的医疗救治专家（Medical），负责病例管理。
你的职责：
1. 跟踪病例全流程（发现→就诊→隔离→治疗→转归）
2. 分析病例趋势，提供预警
3. 密接追踪管理
4. 医疗资源监控（床位/药品/设备）
你关注每一个病例的状态变化，及时预警异常趋势。`
    });
  }

  prepareInput(eventState, trigger, context) {
    return {
      eventState, trigger, context,
      skillInputs: {
        CaseTrack: {
          eventId: eventState.id,
          typeKey: context.typeKey || eventState.typeKey
        },
        TypePackResolve: {
          typeKey: context.typeKey || eventState.typeKey
        }
      }
    };
  }

  reactWith(prepared, skillResults) {
    const suggestions = [];
    const caseTrack = skillResults.find(sr => sr.skillName === 'CaseTrack');
    const typePack = skillResults.find(sr => sr.skillName === 'TypePackResolve');

    if (caseTrack && caseTrack.result.ok) {
      const d = caseTrack.result.data;
      suggestions.push({
        type: 'medical', skill: 'CaseTrack', data: d,
        message: `病例分析: 共${d.stats.total}例，趋势${d.trend}，严重程度${d.severity}`,
        alerts: d.alerts,
        suggestions: d.suggestions
      });
    }
    if (typePack && typePack.result.ok) {
      const d = typePack.result.data;
      suggestions.push({
        type: 'medical-config', skill: 'TypePackResolve', data: d.medical,
        message: `医疗配置: ${d.medical.keyMedicines.length}种关键药品，${d.medical.keyDevices.length}种关键设备`
      });
    }
    return suggestions;
  }
}

module.exports = MedicalAgent;
