// Skill: NotifyDispatch — 多通道通知+强制反馈闭环
// 包装 notify.js，Communication 专属
// v1.1.0: 增加 evidence chain
const { SkillResult } = require('../skill-base');
const notify = require('../../notify');
const { load } = require('../../store');

module.exports = {
  name: 'NotifyDispatch',
  version: '1.1.0',
  agent: 'communication',
  detLevel: 'D0',
  description: '依据《突发公共卫生事件应急条例》通知要求，按通知组列表并行下发多通道通知（语音/短信/APP），启动强制反馈闭环（5分钟确认+超时自动升级）',
  inputSchema: {
    eventId: 'string',
    targets: 'array[{id, name, phone, role, superiorId}]',
    content: 'string',
    channels: 'array (可选) - 默认 [voice, sms, app]',
    ackMinutes: 'number (可选) - 默认 5',
    kind: 'alert|instruction|test'
  },
  outputSchema: {
    sentCount: 'number',
    notifications: 'array[{id, targetName, channels, status, ackDeadline}]',
    evidence: 'object{provenance, sent_count, channels_used}'
  },
  async execute(input) {
    const { eventId, targets, content, channels, ackMinutes, kind } = input || {};
    if (!targets || !targets.length) {
      return new SkillResult({
        ok: false, error: '无通知目标',
        meta: { skillName: 'NotifyDispatch', skillVersion: '1.1.0', detLevel: 'D0', llmUsed: false, evidence: { provenance: 'notify.js', methodology: '输入校验失败' } }
      });
    }
    const notifications = [];
    const channelsUsed = new Set();
    for (const t of targets) {
      const n = notify.sendNotification(eventId, t, content, { channels, ackMinutes, kind });
      notifications.push({
        id: n.id,
        targetName: n.targetName,
        channels: n.channels,
        status: n.status,
        ackDeadline: n.ackDeadline
      });
      (n.channels || []).forEach(c => channelsUsed.add(c));
    }

    const evidence = {
      provenance: 'notify.js + 通知网关MCP',
      sent_count: notifications.length,
      channels_used: [...channelsUsed],
      methodology: '确定性通知下发（多通道并行），无LLM'
    };

    return new SkillResult({
      ok: true,
      data: { sentCount: notifications.length, notifications, evidence },
      meta: { skillName: 'NotifyDispatch', skillVersion: '1.1.0', detLevel: 'D0', llmUsed: false, evidence }
    });
  }
};
