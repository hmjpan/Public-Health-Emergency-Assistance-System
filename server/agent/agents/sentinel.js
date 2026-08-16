// Sentinel Agent — 哨兵
// 职责：接收上报 → 事件类型识别 → 结构化 → 推送研判
const { AgentBase } = require('../agent-base');
const { registry } = require('../skill-base');
const { createSpan, completeSpan, recordTrace } = require('../observability');

class SentinelAgent extends AgentBase {
  constructor() {
    super({
      id: 'sentinel',
      name: '哨兵 Agent',
      role: '哨兵',
      icon: '🛰️',
      skills: ['EventClassify', 'TypePackResolve'],
      soul: `你是卫盾Agent系统的哨兵（Sentinel），负责接收一线上报信息。
你的职责：
1. 识别事件类型（传染病/食物中毒/环境污染/职业中毒/不明原因）
2. 将自然语言上报结构化为标准事件信息
3. 加载对应类型包配置
4. 推送给指挥官Agent进行研判
你只做识别和结构化，不做决策。`
    });
  }

  // 覆写：EventClassify 先执行，分类结果作为 TypePackResolve 输入（串联依赖）
  async react(eventState, trigger, context = {}) {
    const rawText = context.rawText || context.text || (eventState && eventState.rawReport) || '';
    const title = context.title || (eventState && eventState.title) || '';

    // 1. EventClassify
    const classifyRes = await registry.execute('EventClassify', { rawText, title, reporter: context.reporter }, {
      eventId: eventState && eventState.id,
      agentId: this.id,
      trigger,
      traceId: context.traceId || null
    });

    // 2. TypePackResolve：使用分类结果的 typeKey
    const typeKey = classifyRes.ok && classifyRes.data && classifyRes.data.typeKey;
    const typeRes = await registry.execute('TypePackResolve', { typeKey, title, rawText }, {
      eventId: eventState && eventState.id,
      agentId: this.id,
      trigger,
      traceId: context.traceId || null
    });

    const skillResults = [
      { skillName: 'EventClassify', result: classifyRes },
      { skillName: 'TypePackResolve', result: typeRes }
    ];
    const suggestions = this.reactWith({ eventState, trigger, context }, skillResults);

    const session = this.logSession(eventState && eventState.id, {
      traceId: context.traceId || null,
      trigger,
      context,
      skillResults: skillResults.map(sr => ({ skillName: sr.skillName, ok: sr.result.ok, data: sr.result.data, error: sr.result.error, meta: sr.result.meta })),
      suggestions
    }, new Date().toISOString());

    return {
      ok: true,
      agentId: this.id,
      agentName: this.name,
      trigger,
      suggestions,
      skillResults: skillResults.map(sr => ({ skillName: sr.skillName, result: sr.result })),
      session
    };
  }

  shouldRunSkill(skillName, prepared) {
    return true;
  }

  reactWith(prepared, skillResults) {
    const suggestions = [];
    const classify = skillResults.find(sr => sr.skillName === 'EventClassify');
    const typePack = skillResults.find(sr => sr.skillName === 'TypePackResolve');

    if (classify && classify.result.ok) {
      suggestions.push({
        type: 'classification',
        skill: 'EventClassify',
        data: classify.result.data,
        message: `识别为${classify.result.data.typeName}（置信度${(classify.result.data.confidence * 100).toFixed(0)}%）`,
        action: '建议推送给指挥官研判'
      });
    }
    if (typePack && typePack.result.ok) {
      suggestions.push({
        type: 'typepack',
        skill: 'TypePackResolve',
        data: {
          typeKey: typePack.result.data.typeKey,
          name: typePack.result.data.name,
          notifyGroups: typePack.result.data.notifyGroups,
          materialPacks: typePack.result.data.materialPacks.length + '个物资包',
          taskPacks: typePack.result.data.taskPacks.length + '个任务包'
        },
        message: `类型包已加载：${typePack.result.data.name}`
      });
    }
    return suggestions;
  }
}

module.exports = SentinelAgent;
