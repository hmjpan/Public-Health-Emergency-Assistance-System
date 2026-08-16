---
name: type-pack-resolve
description: 事件类型解析与配置加载。依据《国家突发公共卫生事件相关信息报告管理工作规范》五分类体系，精确或模糊匹配事件类型后加载差异化配置（通知组、物资包、任务包、表单集、完成标准）。Sentinel/Field/Medical Agent 使用。
version: 1.1.0
det_level: D0
agents: [sentinel, field, medical]
type: shared
guardrail: strict
---

# TypePackResolve — 事件类型解析与配置加载

## 使用场景

当系统接收到新的事件上报时，需要根据上报信息识别事件类型，并加载该类型对应的差异化配置（通知组、物资包、任务包、表单集、完成标准等）。

支持两种输入方式：
1. **精确匹配**：传入 `typeKey`（如 `FOOD`、`INF`）
2. **模糊匹配**：传入自然语言描述，通过关键词匹配识别类型

## 输入参数

```json
{
  "typeKey": "INF|FOOD|ENV|POISON|UNK (可选)",
  "type": "事件类型关键词 (可选)",
  "disease": "疾病名称 (可选)",
  "title": "事件标题 (可选)",
  "rawText": "自然语言描述 (可选)"
}
```

## 输出结果

```json
{
  "ok": true,
  "data": {
    "typeKey": "FOOD",
    "name": "食源性疾病/食物中毒",
    "icon": "🍱",
    "sceneHint": "食堂/宴席/餐饮单位/外卖",
    "notifyGroups": ["流调组", "采样组", "检验组", "管控组", "医疗救治组"],
    "firstTaskSummary": "核实发病与共同就餐史...",
    "materialPacks": [...],
    "taskPacks": [...],
    "forms": [...],
    "launchCriteria": ["关键小组均已出发或抵达", ...],
    "fieldCriteria": ["可疑餐次与食品溯源完成", ...],
    "medical": {...}
  },
  "meta": {
    "skillName": "TypePackResolve",
    "skillVersion": "1.0.0",
    "detLevel": "D0",
    "ruleVersion": "1.0",
    "llmUsed": false,
    "durationMs": 1
  }
}
```

## 调用条件

- Sentinel Agent 接收到新上报时调用
- Commander Agent 启动响应时调用
- Field Agent 激活任务包时调用

## 依赖工具/系统

- `eventTypes.js` 类型包配置文件（内置 5 种：INF/FOOD/ENV/POISON/UNK）

## 失败处理

1. **模糊匹配无结果** → 返回默认类型（INF 传染病）+ 警告标记 "建议人工确认类型"
2. **类型包配置损坏** → 回退到 DEFAULT_TYPE + 记录错误日志

## 安全边界

只读操作，不修改任何数据；类型包配置需版本化管理。

## 复用价值

⭐ 高。任何需要"事件分类→差异化配置"的场景均可复用：安全生产事故、自然灾害、社会安全事件等。插件化设计（新增类型=添加一个对象）使其极易扩展。

## Guardrail（约束边界）

### 确定性约束（D0级）
1. **纯函数**：同输入必同输出，无网络调用，无随机性
2. **配置驱动**：类型包配置来自 eventTypes.js，不硬编码业务逻辑
3. **五分类穷举**：结果必须为 INF/FOOD/ENV/POISON/UNK 之一

### 业务约束
4. **模糊匹配降级**：模糊匹配无结果时返回默认类型 + "建议人工确认类型"标记
5. **版本存证**：输出含 ruleVersion，确保配置版本可追溯

### 容错约束
6. **配置损坏兜底**：类型包配置损坏时回退到默认类型 + 记录错误日志

## 执行证据链

```
输入(typeKey/rawText/title) → 精确匹配(typeKey) 或 模糊匹配(正则关键词)
                              → 加载 eventTypes.js 对应类型包
                              → 输出完整配置(notifyGroups/materialPacks/taskPacks/forms/criteria)
                              → 写入 rule_results 存证
```

**证据要素**：
- `provenance`: eventTypes.js 配置版本
- `match_method`: exact（精确）/ fuzzy（模糊）
- `confidence`: 精确匹配=1.0，模糊匹配按命中关键词数
- `missing_evidence`: 模糊匹配无结果时提示需补充类型信息

## references/

- `references/五分类体系说明.md` — 法定五分类体系及对应配置

