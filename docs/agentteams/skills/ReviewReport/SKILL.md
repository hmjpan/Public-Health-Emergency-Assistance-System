---
name: review-report
description: 复盘报告生成。基于事件处置全过程数据（时间线、任务完成度、通知确认率、SLA合规率等），生成结构化复盘报告（成效亮点、不足分析、改进建议、经验教训），沉淀入知识库形成持续改进闭环。Review Agent 专属。
version: 1.1.0
det_level: D3
agents: [review]
type: dedicated
llm_required: true
guardrail: strict
---

# ReviewReport — 复盘报告生成

## 使用场景

事件终止后，自动收集全过程数据，生成结构化复盘报告，包含成效亮点、不足分析、改进建议和经验教训。

## 输入参数

```json
{
  "eventId": "EVT-001"
}
```

## 输出结果

```json
{
  "ok": true,
  "data": {
    "summary": "事件概述...",
    "timeline": ["时间线摘要"],
    "highlights": ["成效亮点"],
    "issues": ["不足与问题"],
    "improvements": ["改进建议"],
    "lessons": ["经验教训"],
    "stats": {
      "totalTasks": 15, "tasksDone": 14, "tasksBlocked": 1,
      "totalNotifications": 28, "ackedNotifications": 26,
      "ackRate": "92.9%", "taskCompleteRate": "93.3%"
    }
  }
}
```

## 调用条件

事件终止（stage=closed）后由 Review Agent 调用。

## 依赖工具/系统

- `events`, `tasks`, `notifications`, `personnel`, `cases` 数据表
- LLM 用于总结分析和改进建议

## 失败处理

1. **LLM 不可用** → 返回统计数据摘要
2. **事件数据不完整** → 对应段落标记"[数据待补]"

## 安全边界

复盘报告需经管理层审核后发布；经验沉淀入知识库需人工确认。

## Guardrail（约束边界）

### 统计约束
1. **确定性统计**：任务完成率、通知确认率、SLA合规率由系统确定性计算
2. **数据缺失标注**：数据不完整时对应段落标记"[数据待补]"
3. **不含个人隐私**：复盘报告中不含患者个人信息

### LLM约束
4. **分析辅助**：LLM用于趋势分析、不足分析和改进建议，不用于统计计算
5. **降级透明**：LLM不可用时返回统计数据摘要
6. **经验沉淀需审核**：LLM生成的经验教训需人工确认后方可入知识库

### 业务约束
7. **报告需审核**：复盘报告需经管理层审核后发布
8. **版本存证**：报告含版本号，可追溯生成时间

## 执行证据链

```
输入(eventId) → 收集全过程数据(events/tasks/notifications/cases/agent_sessions)
  → 确定性统计(任务完成率/通知确认率/SLA合规率/病例转归)
  → 构建时间线
  → LLM分析(成效亮点/不足分析/改进建议/经验教训)
  → 生成结构化报告
  → 写入 rule_results 存证
```

**证据要素**：
- `provenance`: 全过程数据表 + LLM
- `data_sources`: 使用了哪些数据表
- `stats_computed`: 计算了哪些统计指标
- `missing_evidence`: 缺失数据列表

## 复用价值

每次复盘→知识库→Skill 迭代，形成持续改进闭环。

## references/

- `references/复盘报告模板.md` — 标准复盘报告结构

