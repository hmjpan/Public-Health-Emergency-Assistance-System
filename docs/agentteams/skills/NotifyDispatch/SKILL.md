---
name: notify-dispatch
description: 多通道通知+强制反馈闭环。依据《突发公共卫生事件应急条例》通知要求，按通知组列表并行下发多通道通知（语音/短信/APP），启动强制反馈闭环（5分钟确认+超时自动升级）。Communication Agent 专属。
version: 1.1.0
det_level: D0
agents: [communication]
type: dedicated
guardrail: strict
---

# NotifyDispatch — 多通道通知+强制反馈闭环

## 使用场景

按通知组列表+通道配置，并行下发多通道通知（语音/短信/APP），启动强制反馈闭环（5分钟确认+超时自动升级）。

## 输入参数

```json
{
  "eventId": "EVT-001",
  "targets": [
    {"id": "u_liudiao", "name": "张流调", "phone": "138xxx", "role": "流调组长", "superiorId": "u_commander"}
  ],
  "content": "请立即出发前往XX学校处置食物中毒事件",
  "channels": ["voice", "sms", "app"],
  "ackMinutes": 5,
  "kind": "alert"
}
```

## 输出结果

```json
{
  "ok": true,
  "data": {
    "sentCount": 1,
    "notifications": [
      {
        "id": "ntf_xxx",
        "targetName": "张流调",
        "channels": ["voice", "sms", "app"],
        "status": "sent",
        "ackDeadline": "2026-08-16T10:05:00Z"
      }
    ]
  }
}
```

## 调用条件

Commander Agent 启动响应时批量调用；Field Agent 下发任务指令时调用。

## 依赖工具/系统

- 通知网关 MCP（语音/短信/APP推送）— 当前为模拟通道，已预留真实网关接口

## 失败处理

1. **通道发送失败** → 记录到 channelLogs + 尝试备用通道
2. **持续超时** → 升级引擎自动升频通知上级

## 安全边界

通知内容不得包含敏感明文（手机号脱敏存储）；升级记录不可删除（审计要求）。

## Guardrail（约束边界）

### 确定性约束（D0级）
1. **通道可配**：通知通道（voice/sms/app）由配置决定，Skill不硬编码通道逻辑
2. **幂等性**：同一通知ID重复发送不产生重复通知
3. **手机号脱敏**：存储和传输中手机号脱敏处理

### 业务约束
4. **确认时限**：默认5分钟确认，超时可配置
5. **升级记录不可删**：升级记录写入后不可删除（审计要求）
6. **不含敏感明文**：通知内容中不含患者个人隐私信息

## 执行证据链

```
输入(targets, content, channels) → 遍历通知目标
  → 按通道并行下发(voice/sms/app)
  → 记录发送状态(sent/failed)
  → 启动确认倒计时(ackMinutes)
  → 超时未确认 → 自动升级至上级
  → 写入 notifications 表 + rule_results 存证
```

**证据要素**：
- `provenance`: 通知引擎(notify.js) + 通知网关MCP
- `sent_count`: 成功发送数
- `ack_pending`: 待确认数
- `escalated_count`: 已升级数

## 复用价值

⭐⭐ 极高。"多通道通知+强制反馈+超时升级"模式可迁移至：运维告警、工单催办、审批催办等。

## references/

- `references/通知法规要求.md` — 通知时限和升级要求的法规依据

