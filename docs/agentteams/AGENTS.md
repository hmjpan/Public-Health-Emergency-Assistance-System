---
team: 卫盾Agent
description: 突发公共卫生事件多部门协同应急处置智能平台
framework: AgentTeams
version: 1.0.0
---

# 卫盾Agent — AgentTeams 团队定义

## 团队架构

```
                    ┌──────────────────────┐
                    │   Manager (编排层)     │
                    │  卫盾应急处置总指挥     │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼─────┐ ┌───────▼───────┐ ┌──────▼──────┐
    │  Team Leader  │ │ Team Leader   │ │ Team Leader │
    │  指挥决策组    │ │  现场处置组    │ │  保障协调组  │
    └───────┬───────┘ └───────┬───────┘ └──────┬──────┘
            │                 │                 │
     ┌──────┴──────┐   ┌─────┴─────┐    ┌──────┴──────┐
     │             │   │     │     │    │      │      │
  Commander  Sentinel  Field  Medical  Dispatch Comm  Review
  (Leader)   (Worker) (Worker)(Worker) (Worker)(Worker)(Worker)
```

## Agent 清单（7 个）

| Agent | 角色 | 层级 | Skills | 阶段 |
|-------|------|------|--------|------|
| sentinel | 哨兵 | Worker | EventClassify, TypePackResolve | detected |
| commander | 指挥决策 | Team Leader | GradeEvaluate, SlaCheck, StaffAssign, PlanMatch, CriteriaCheck | all |
| dispatch | 资源调度 | Worker | StaffAssign, TypePackResolve | responding |
| field | 现场处置 | Worker | SOPGuidance, TypePackResolve, PlanMatch | field |
| medical | 医疗救治 | Worker | CaseTrack, TypePackResolve | responding, field |
| communication | 通讯协调 | Worker | NotifyDispatch, DocDraft | responding, field, closed |
| review | 复盘评估 | Worker | ReviewReport, DocDraft | closed |

## 协同流程（端到端闭环）

```
上报接收 → 类型识别 → 研判定级 → 一键启动 → 并行调度 → 现场处置 → 终止评估 → 复盘沉淀
Sentinel  Sentinel  Commander  Commander  Dispatch   Field     Commander  Review
                  + SlaCheck            + Medical              + Review
                  + PlanMatch           + Communication
```

## 共享状态（Event State）

所有 Agent 读写同一个 Event State，通过 Trace ID 串联全链路。

```json
{
  "traceId": "trace_xxx",
  "eventId": "EVT-001",
  "typeKey": "FOOD",
  "level": "III级",
  "stage": "responding",
  "agentActions": [
    {"agent": "sentinel", "skill": "EventClassify", "at": "...", "traceId": "..."},
    {"agent": "commander", "skill": "GradeEvaluate", "at": "...", "traceId": "..."}
  ]
}
```

## 升级策略

| 异常 | 处理 |
|------|------|
| 通知超时（5分钟未确认） | Communication → 自动升级通知上级 |
| 任务阻塞 | Field → 升级给 Commander 介入 |
| SLA 超时限 | Commander 收到预警 |
| 启动标准未达成 | Commander 阻塞 + Dispatch 催办 |

## 双模式

| 模式 | 说明 |
|------|------|
| 辅助处置 | Agent 提供建议，真人操作，用于实际事件处置 |
| 模拟演练 | Agent 充当固定角色，一人走完全流程，用于培训 |
