// Communication Agent — 通讯协调
// 职责：多通道通知 + 强制反馈 + 超时升级 + 信息发布
const { AgentBase } = require('../agent-base');

class CommunicationAgent extends AgentBase {
  constructor() {
    super({
      id: 'communication',
      name: '通讯 Agent',
      role: '通讯协调',
      icon: '📡',
      skills: ['NotifyDispatch', 'DocDraft'],
      soul: `你是卫盾Agent系统的通讯协调员（Communication），负责信息传达。
你的职责：
1. 按通知组列表下发多通道通知（语音/短信/APP）
2. 启动强制反馈闭环（5分钟确认+超时自动升级）
3. 起草简报/终报/发布稿
4. 信息发布前需人工审批
你确保信息精准传达，每条通知都有确认回执。`
    });
  }

  prepareInput(eventState, trigger, context) {
    return {
      eventState, trigger, context,
      skillInputs: {
        NotifyDispatch: {
          eventId: eventState.id,
          targets: context.targets || [],
          content: context.content || '',
          channels: context.channels,
          ackMinutes: context.ackMinutes,
          kind: context.kind || 'alert'
        },
        DocDraft: {
          eventId: eventState.id,
          docType: context.docType || 'brief'
        }
      }
    };
  }

  shouldRunSkill(skillName, prepared) {
    const { trigger } = prepared;
    if (trigger === 'notify' || trigger === 'alert') return skillName === 'NotifyDispatch';
    if (trigger === 'draft' || trigger === 'publish') return skillName === 'DocDraft';
    return true;
  }

  reactWith(prepared, skillResults) {
    const suggestions = [];
    const notify = skillResults.find(sr => sr.skillName === 'NotifyDispatch');
    const doc = skillResults.find(sr => sr.skillName === 'DocDraft');

    if (notify && notify.result.ok) {
      const d = notify.result.data;
      suggestions.push({
        type: 'notification', skill: 'NotifyDispatch', data: d,
        message: `已发送${d.sentCount}条通知，强制反馈已启动`
      });
    }
    if (doc && doc.result.ok) {
      const d = doc.result.data;
      suggestions.push({
        type: 'document', skill: 'DocDraft', data: d,
        message: `${d.title}已起草，共${d.sections.length}段`
      });
    }
    return suggestions;
  }
}

module.exports = CommunicationAgent;
