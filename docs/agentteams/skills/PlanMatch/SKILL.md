---
name: plan-match
description: 预案/SOP/措施知识库匹配。依据《国家突发公共卫生事件应急预案》体系，按事件类型×级别×阶段从知识库中加权评分匹配最相关处置方案。Commander/Field Agent 使用。
version: 1.1.0
det_level: D2
agents: [commander, field]
type: shared
guardrail: strict
---

# PlanMatch — 预案/SOP/措施知识库匹配

## 使用场景

根据事件类型、级别、当前阶段，从知识库（预案/SOP/措施/案例）中匹配最相关的处置方案，按权重评分排序。

## 输入参数

```json
{
  "typeKey": "INF",
  "level": "III级",
  "stage": "responding"
}
```

## 输出结果

```json
{
  "ok": true,
  "data": {
    "results": [
      {"id": "SOP001", "kind": "sop", "title": "传染病疫情现场处置SOP", "score": 0.92, "summary": "..."},
      {"id": "PLAN003", "kind": "plan", "title": "突发传染病应急预案", "score": 0.85, "summary": "..."}
    ],
    "total": 5
  }
}
```

**评分机制**：
- 类型匹配权重 0.6（精确1.0/通用0.3/不匹配0）
- 级别覆盖权重 0.2
- 阶段匹配权重 0.2
- 按 kind 基础权重加权（plan: 0.4, sop: 0.3, measure: 0.2, case: 0.1）

## 调用条件

Commander Agent 研判时参考；Field Agent 执行时参考 SOP。

## 依赖工具/系统

- `matching.json` 规则表（权重配置）
- `knowledge.json` 知识库（预案5/SOP8/措施3/案例2/参数1）

## 失败处理

1. **知识库为空** → 返回空结果 + 警告
2. **无匹配** → 返回空列表 + 建议人工检索

## 安全边界

知识库条目需版本化管理；匹配结果可审计。

## Guardrail（约束边界）

### 确定性约束（D2级）
1. **确定性评分**：评分公式固定（类型匹配0.6 + 级别覆盖0.2 + 阶段匹配0.2），无随机性
2. **确定性排序**：同分时按 ID 字典序排序，保证输出可重现
3. **零分排除**：类型不匹配（mt1=0）的条目直接排除，不返回

### 业务约束
4. **知识库依赖**：匹配质量取决于知识库条目质量，需定期维护
5. **版本存证**：输出含 ruleVersion，确保匹配算法版本可追溯

## 执行证据链

```
输入(typeKey, level, stage) → 遍历 knowledge.json 每条记录
  → 类型匹配评分(mt1: 精确1.0/通用0.3/不匹配0排除)
  → 级别覆盖评分(mt2: 覆盖1.0/不覆盖0.2)
  → 阶段匹配评分(mt3: 匹配1.0/不匹配0.2)
  → 加权总分 = kindWeight × (0.6×mt1 + 0.2×mt2 + 0.2×mt3)
  → 降序排序 + ID字典序 → 取前 maxResults 条
  → 写入 rule_results 存证
```

**证据要素**：
- `provenance`: matching.json + knowledge.json
- `total_candidates`: 候选条目总数
- `returned_count`: 返回条目数
- `methodology`: 确定性加权评分排序

## 复用价值

⭐⭐ 极高。本质是"结构化知识检索+加权评分"，可迁移至运维Runbook匹配、合规条款检索等。

## references/

- `references/知识库分类体系.md` — plan/sop/measure/case四类知识条目说明

