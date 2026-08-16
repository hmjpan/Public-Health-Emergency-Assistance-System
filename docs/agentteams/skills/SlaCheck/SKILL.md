---
name: sla-check
description: 法定时限校验。依据《突发公共卫生事件应急条例》第19条、《传染病信息报告管理规范（2016版）》第2.3条等，校验事件各环节是否满足法定时限，区分甲类(2h)/其他(24h)报告时限，输出状态(pending/ok/near/over)+预警动作。
version: 1.1.0
det_level: D0
agents: [commander]
type: dedicated
guardrail: strict
---

# SlaCheck — 法定时限校验

## 使用场景

校验事件各环节是否满足法定时限要求。支持按疾病类别区分报告时限：
- **甲类管理传染病**（鼠疫、霍乱、传染性非典型肺炎、肺炭疽等）：**2小时内**网络直报
- **其他乙类/丙类传染病**：**24小时内**网络直报
- **突发公共卫生事件**：**2小时内**报告

输出各环节时限状态，超时自动触发预警/升级。

## 法规依据

| 条款 | 时限要求 |
|------|----------|
| 《突发公共卫生事件应急条例》第19条 | 接到报告后2小时内向所在地县级卫生行政部门报告 |
| 《突发公共卫生事件应急条例》第20条 | 2小时内进行网络直报 |
| 《传染病信息报告管理规范（2016版）》第2.3条 | 甲类2h，其他乙类/丙类24h |
| 《国家突发公共卫生事件应急预案》第3.2条 | 监测预警报告时限 |
| 《国家卫生应急队伍管理办法》第15条 | 接到指令后30分钟内集结出动 |
| 《国家卫生应急队伍管理办法》第16条 | 城区2小时内抵达 |

## 输入参数

```json
{
  "stages": [
    {"stage": "初报-甲类", "startAt": "2026-08-16T10:00:00Z", "doneAt": null},
    {"stage": "响应启动", "startAt": "2026-08-16T10:30:00Z", "doneAt": null},
    {"stage": "人员出动", "startAt": "2026-08-16T11:00:00Z", "doneAt": null}
  ]
}
```

**支持的 stage 名称**：
| stage 名称 | 法定时限 | 预警阈值 | 预警动作 |
|------------|----------|----------|----------|
| `初报` | 120分钟 | 30分钟 | remind（催报提醒） |
| `初报-甲类` | 120分钟 | 30分钟 | escalate（自动升级） |
| `初报-其他` | 1440分钟(24h) | 120分钟 | remind（催报提醒） |
| `响应启动` | 60分钟 | 15分钟 | remind |
| `人员出动` | 30分钟 | 10分钟 | escalate（自动升级） |
| `抵达现场` | 120分钟 | 30分钟 | escalate |
| `日报告` | 960分钟(16h) | 60分钟 | urge |
| `进程报告` | 1440分钟(24h) | 120分钟 | urge |
| `病例转运` | 120分钟 | 30分钟 | escalate |
| `结案报告` | 4320分钟(72h) | 1440分钟(24h) | urge |

## 输出结果

```json
{
  "ok": true,
  "data": {
    "checks": [
      {
        "stage": "初报-甲类",
        "ruleId": "SLA-INIT-REPORT-A",
        "limitMinutes": 120,
        "elapsedMin": 30.0,
        "status": "pending",
        "action": "escalate",
        "action_detail": "甲类传染病2小时内网络直报，超时自动升级",
        "basis": "《传染病信息报告管理规范（2016版）》第2.3条：甲类传染病2小时内网络直报",
        "legal_ref": "国卫办疾控发〔2016〕8号 第2.3条",
        "ruleVersion": "2026.2"
      }
    ],
    "summary": {
      "total": 3,
      "ok": 1,
      "near": 0,
      "over": 0,
      "pending": 2
    },
    "evidence": {
      "provenance": "sla.json rule_version=2026.2",
      "methodology": "确定性时间计算，无LLM"
    }
  },
  "meta": {
    "skillName": "SlaCheck",
    "skillVersion": "1.1.0",
    "detLevel": "D0",
    "ruleVersion": "2026.2",
    "llmUsed": false
  }
}
```

**status 状态说明**：
| 状态 | 含义 | 系统动作 |
|------|------|----------|
| `pending` | 未到时，仍在时限内 | 无 |
| `ok` | 已完成且在时限内 | 标记完成 |
| `near` | 即将超时（进入提醒阈值） | 发送催报提醒 |
| `over` | 已超时且未完成 | 发送升级告警 |
| `over_done` | 已完成但已超时 | 记录违规 |
| `unknown` | 无对应阶段规则 | 提示检查 stage 名称 |

## Guardrail（约束边界）

### 确定性约束（D0级）
1. **纯时间计算**：基于 Date 对象计算经过时间，无网络调用，无随机性
2. **规则表驱动**：所有时限值来自 sla.json，Skill 不硬编码任何时限
3. **状态机严格**：状态值严格限定为 pending/ok/near/over/over_done/unknown 六种

### 业务约束
4. **不自动执行动作**：Skill 仅返回 status + action 建议，不自动发送通知（由 Commander Agent 决策后调用 NotifyDispatch）
5. **规则版本存证**：每次输出携带 ruleVersion，确保审计可追溯

### 容错约束
6. **时间格式容错**：自动处理 ISO 8601 格式的时间戳
7. **缺失阶段处理**：无对应规则时返回 status='unknown'，不抛异常

## 执行证据链

```
输入 stages[] → 遍历每个 stage → 查找 sla.json 匹配规则
                                  → 计算 elapsed = (doneAt || now) - startAt
                                  → 比对 limitMinutes / remindBefore
                                  → 输出 status + action + basis + legal_ref
                                  → 写入 rule_results 存证
```

**证据要素**：
- `provenance`: 规则表来源（sla.json + 版本号）
- `methodology`: 确定性时间计算（当前时间戳 - 起始时间戳）

## 调用条件

Commander Agent 随时可调用查询当前时限状态。推荐触发时机：
- 事件创建后立即检查"初报"时限
- 每个阶段开始/结束时检查
- 定期轮询（如每10分钟）

## 依赖工具/系统

- `sla.json` 规则表（含 report_time_matrix 按疾病类别的时限矩阵）
- 系统时间（Date.now()）

## 失败处理

1. **stages 不是数组** → 返回 `ok: false, error: 'stages 须为数组'`
2. **startAt 格式错误** → 该 stage 返回 status='unknown'
3. **无对应阶段规则** → 该 stage 返回 status='unknown'

## 安全边界

- 只读校验操作，不修改任何数据
- 结果含 `ruleVersion` + `evidence` 存证
- 超时状态仅作为建议，最终由指挥员决策

## 复用价值

⭐⭐ 极高。任何有法定/约定时限的场景均可复用：工单SLA、合同履约时限、审批时限等。规则表可替换。

## references/

- `references/时限法规对照表.md` — 各环节时限与法规条文对应关系
