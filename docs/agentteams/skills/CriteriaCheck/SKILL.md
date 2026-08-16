---
name: criteria-check
description: 阶段完成标准校验。依据预案规定的阶段门禁标准，校验当前阶段完成条件是否达成（启动阶段：人员出发+物资装车+车辆就位；现场阶段：关键任务完成+表单回传+零阻塞）。Commander Agent 阶段推进前必须调用。
version: 1.1.0
det_level: D0
agents: [commander]
type: shared
guardrail: strict
---

# CriteriaCheck — 阶段完成标准校验

## 使用场景

校验当前阶段完成标准是否达成，作为阶段推进的门禁条件。

**启动阶段标准**：
- 关键小组均已出发或抵达
- 标准物资包均已装车
- 保障车辆均已到位

**现场处置标准**：
- 关键任务全部完成
- 表单已回传归档
- 零阻塞任务

## 输入参数

```json
{
  "eventId": "EVT-001",
  "stage": "responding"
}
```

## 输出结果

```json
{
  "ok": true,
  "data": {
    "stage": "responding",
    "allReady": false,
    "detail": {
      "groups": [{"group": "流调组", "total": 4, "ready": 3}],
      "materials": [{"id": "mat_001", "pack": "个人防护包", "status": "pending"}],
      "vehicles": [{"id": "veh_001", "plate": "京A001", "status": "ready"}]
    }
  }
}
```

## 调用条件

Commander Agent 尝试推进阶段前**必须调用**；Dashboard 自动轮询展示。

## 依赖工具/系统

人员表、物资表、车辆表、任务表、表单表（JSON存储/MCP）

## 失败处理

1. **标准未达成** → 返回 `allReady: false` + 详细未达标项
2. **数据缺失** → 标记对应项为"数据待补"

## 安全边界

只读校验；阶段推进决策权在 Commander Agent（Skill 仅输出判断）。

## Guardrail（约束边界）

### 确定性约束（D0级）
1. **纯校验**：只读操作，不修改任何数据
2. **标准固定**：完成标准来自 eventTypes.js 中各类型的 launchCriteria/fieldCriteria，不动态生成
3. **结果二元**：allReady 仅 true/false，不含模糊判断

### 业务约束
4. **仅建议**：校验结果为建议，阶段推进决策权在 Commander Agent
5. **数据缺失容错**：数据缺失时标记对应项为"数据待补"，不抛异常

## 执行证据链

```
输入(eventId, stage) → 加载类型包完成标准(launchCriteria/fieldCriteria)
                       → 逐项校验(人员就绪/物资就绪/车辆就绪/任务完成/表单回传)
                       → 输出 allReady + 各项明细
                       → 写入 rule_results 存证
```

**证据要素**：
- `provenance`: eventTypes.js 标准 + 人员/物资/车辆/任务数据表
- `criteria_total`: 校验条目总数
- `criteria_passed`: 通过条目数
- `missing_evidence`: 数据缺失项列表

## 复用价值

⭐ 高。任何需要"阶段门/完成标准校验"的流程均可复用：研发发布门禁、项目里程碑验收等。

## references/

- `references/阶段完成标准说明.md` — 各阶段完成标准的法规依据

