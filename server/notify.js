// 多通道通知 + 强制反馈升级引擎
// 设计：通知带 ackDeadline(默认5分钟)，巡检器每30s扫描，超时未确认自动升频通知其上级
// 通道：voice(语音) / sms(短信) / app(APP强提醒) —— 当前为模拟通道，写通道日志
//
// ==== 真实网关接入点（预留接口） ====
// 将下列 sendViaChannel 内部实现替换为真实服务商 SDK 即可，引擎逻辑不变：
//   语音: 阿里云语音服务 / 运营商语音通知API
//   短信: 阿里云短信 / 腾讯云短信
//   APP : 个推 / 极光推送 / 企业微信应用消息
// 配置读取: process.env.SMS_KEY / VOICE_KEY / PUSH_KEY
// =====================================

const { load, save, uid, now } = require('./store');

const ACK_MINUTES = 5;           // 确认时限（分钟）
const SCAN_INTERVAL = 30 * 1000; // 巡检间隔

let timer = null;

// 模拟通道发送（真实接入时替换此函数体）
function sendViaChannel(channel, target, content) {
  // target: {name, phone}; content: 文本
  const log = {
    id: uid('chn'),
    channel,
    target: target.name,
    phone: target.phone || '',
    content: (content || '').slice(0, 200),
    at: now(),
    ok: true
  };
  const logs = load('channellogs');
  logs.push(log);
  save('channellogs', logs);
  console.log(`[通知-${channel}] -> ${target.name}(${target.phone || '-'}): ${(content || '').slice(0, 40)}`);
  return log;
}

// 发送多通道通知，返回通知记录
function sendNotification(eventId, target, content, opts = {}) {
  const channels = opts.channels || ['voice', 'sms', 'app'];
  const notifications = load('notifications');
  const deadline = new Date(Date.now() + (opts.ackMinutes || ACK_MINUTES) * 60000).toISOString();
  const n = {
    id: uid('ntf'),
    eventId: eventId || '',
    targetId: target.id,
    targetName: target.name,
    phone: target.phone || '',
    role: target.role || '',
    superiorId: target.superiorId || null,   // 上级，用于升级
    content: content || '',
    channels,
    channelLogs: [],
    status: 'sent',        // sent / acked / escalated
    ackAt: null,
    ackDeadline: deadline,
    escalateLevel: 0,
    kind: opts.kind || 'alert',  // alert(启动通知) / instruction(指令) / test(测试)
    refId: opts.refId || null,   // 关联指令/任务id
    sentAt: now()
  };
  channels.forEach(ch => {
    const lg = sendViaChannel(ch, target, content);
    n.channelLogs.push(lg.id);
  });
  notifications.push(n);
  save('notifications', notifications);
  return n;
}

// 确认反馈
function ackNotification(notifId, userId) {
  const notifications = load('notifications');
  const n = notifications.find(x => x.id === notifId);
  if (!n) return { ok: false, error: '通知不存在' };
  if (n.status === 'acked') return { ok: true, data: n };
  n.status = 'acked';
  n.ackAt = now();
  save('notifications', notifications);
  return { ok: true, data: n };
}

// 巡检升级：超时未确认 → 升频并通知上级
function sweepEscalations() {
  const notifications = load('notifications');
  const users = load('users');
  const nowTs = Date.now();
  let dirty = false;
  notifications.forEach(n => {
    if (n.status !== 'sent') return;
    if (new Date(n.ackDeadline).getTime() > nowTs) return;
    // 超时未确认
    n.status = 'escalated';
    n.escalateLevel += 1;
    dirty = true;
    const target = users.find(u => u.id === n.targetId) || {};
    // 重新升频通知本人
    sendViaChannel('voice', target, '【升级提醒】' + n.content);
    // 通知上级
    if (n.superiorId) {
      const sup = users.find(u => u.id === n.superiorId);
      if (sup) {
        sendViaChannel('voice', sup, `【超时升级】${n.targetName} 未及时确认:${n.content.slice(0, 60)}`);
        sendViaChannel('sms', sup, `【超时升级】${n.targetName} 未及时确认:${n.content.slice(0, 60)}`);
      }
    }
  });
  if (dirty) save('notifications', notifications);
}

function startEngine() {
  if (timer) return;
  timer = setInterval(sweepEscalations, SCAN_INTERVAL);
  console.log(`通知升级引擎已启动: 每${SCAN_INTERVAL / 1000}s巡检, 确认时限${ACK_MINUTES}分钟`);
}

function stopEngine() { if (timer) { clearInterval(timer); timer = null; } }

module.exports = { sendNotification, ackNotification, sendViaChannel, startEngine, stopEngine, sweepEscalations, ACK_MINUTES };
