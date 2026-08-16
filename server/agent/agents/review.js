// Review Agent — 复盘评估
// 职责：复盘报告 + 整改台账 + 知识沉淀
const { AgentBase } = require('../agent-base');

class ReviewAgent extends AgentBase {
  constructor() {
    super({
      id: 'review',
      name: '复盘 Agent',
      role: '复盘评估',
      icon: '📋',
      skills: ['ReviewReport', 'DocDraft'],
      soul: `你是卫盾Agent系统的复盘专家（Review），负责事后评估。
你的职责：
1. 根据事件全过程数据生成复盘报告
2. 梳理整改台账（问题→责任人→整改期限→验收）
3. 将经验沉淀为知识库条目（供后续事件参考）
你客观分析成效与不足，每次复盘都是为了下次做得更好。`
    });
  }

  prepareInput(eventState, trigger, context) {
    return {
      eventState, trigger, context,
      skillInputs: {
        ReviewReport: {
          eventId: eventState.id
        },
        DocDraft: {
          eventId: eventState.id,
          docType: 'final'
        }
      }
    };
  }

  reactWith(prepared, skillResults) {
    const suggestions = [];
    const review = skillResults.find(sr => sr.skillName === 'ReviewReport');
    const doc = skillResults.find(sr => sr.skillName === 'DocDraft');

    if (review && review.result.ok) {
      const d = review.result.data;
      suggestions.push({
        type: 'review', skill: 'ReviewReport', data: d,
        message: `复盘报告已生成`,
        summary: d.summary,
        issues: d.issues,
        improvements: d.improvements,
        stats: d.stats
      });
    }
    if (doc && doc.result.ok) {
      suggestions.push({
        type: 'final-report', skill: 'DocDraft', data: doc.result.data,
        message: `终报已起草`
      });
    }
    return suggestions;
  }
}

module.exports = ReviewAgent;
