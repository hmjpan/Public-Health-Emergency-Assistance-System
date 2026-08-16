---
name: event-classify
description: 事件分类识别。依据《国家突发公共卫生事件相关信息报告管理工作规范（2006版）》分类体系，采用"LLM语义分析+规则引擎关键词匹配"双证据验证，识别事件类型（传染病/食物中毒/环境污染/职业中毒/不明原因），输出分类结果+置信度+证据链+缺失信息提示。
version: 1.1.0
det_level: D3
agents: [sentinel]
type: dedicated
llm_required: true
guardrail: strict
---

# EventClassify — 事件分类识别

## 使用场景

接收到一线人员的自然语言上报信息时，自动识别事件类型。采用**双证据验证**机制：
1. **LLM语义分析**：理解上下文语义，提取关键特征
2. **规则引擎匹配**：基于关键词正则匹配，确定性兜底

两路结果交叉验证，置信度高时自动确认，低时提示人工复核。

## 分类体系（法定分类）

依据《国家突发公共卫生事件相关信息报告管理工作规范（2006版）》第2条、《突发公共卫生事件应急条例》第19条：

| 代码 | 类型 | 典型场景 | 关键特征 |
|------|------|----------|----------|
| **INF** | 传染病疫情 | 流感暴发、诺如病毒感染、霍乱、新冠、鼠疫等 | 发热/咳嗽/腹泻群体发病、有接触史、学校/养老院聚集性 |
| **FOOD** | 食源性疾病/食物中毒 | 聚餐后腹泻呕吐、学校食堂群体发病、食品污染 | 共同就餐史、潜伏期短(2-6h)、恶心呕吐腹泻、同一食物来源 |
| **ENV** | 环境污染健康事件 | 毒气泄漏、水源污染、化学品泄漏、辐射事件 | 异味/异色、环境暴露史、皮肤刺激/呼吸困难、影响范围广 |
| **POISON** | 急性职业中毒 | 工厂有限空间中毒、农药中毒、化学品泄漏致工人中毒 | 职业暴露史、作业场所、特定毒物症状(瞳孔/意识/呼吸) |
| **UNK** | 原因不明群体性疾病 | 多人群同现不明症状、无法归因 | 症状不典型、无明确暴露史、多系统受累、无法归入前四类 |

## 输入参数

```json
{
  "rawText": "某学校多名学生午餐后出现呕吐腹泻症状，约30人已就诊",
  "title": "学校群体性呕吐腹泻",
  "reporter": "张医生"
}
```

## 输出结果

```json
{
  "ok": true,
  "data": {
    "typeKey": "FOOD",
    "typeName": "食源性疾病/食物中毒",
    "confidence": 0.92,
    "confidence_level": "high",
    "reasoning": "多名学生午餐后出现呕吐腹泻，符合食源性疾病特征：共同就餐史+消化道症状+群体发病",
    "keywords": ["午餐后", "呕吐", "腹泻", "多名学生"],
    "dual_evidence": {
      "llm_result": { "typeKey": "FOOD", "confidence": 0.92, "reasoning": "..." },
      "rule_result": { "typeKey": "FOOD", "matched": true },
      "agreement": true,
      "decision": "llm_high_conf"
    },
    "evidence": {
      "provenance": "LLM(模型:qwen-max) + 规则引擎(eventTypes.js)",
      "llm_used": true,
      "rule_matched": true,
      "confidence": 0.92,
      "missing_evidence": [
        "建议补充：具体就餐时间和地点",
        "建议补充：是否有人发热（排除感染性腹泻）"
      ],
      "methodology": "双证据验证：LLM语义分析 + 规则引擎关键词匹配"
    }
  },
  "meta": {
    "skillName": "EventClassify",
    "skillVersion": "1.1.0",
    "detLevel": "D3",
    "llmUsed": true,
    "model": "qwen-max"
  }
}
```

## 双证据验证机制

### 决策逻辑

| LLM结果 | 规则结果 | 置信度 | 决策 | 系统行为 |
|---------|---------|--------|------|----------|
| ✅ 一致 | ✅ 一致 | > 0.8 | `llm_high_conf` | 自动确认，记录双证据 |
| ✅ 一致 | ✅ 一致 | 0.7-0.8 | `llm_medium_conf` | 建议确认，标记待复核 |
| ✅ | ✅ | < 0.7 | `rule_fallback` | 使用规则结果，标记LLM低置信 |
| ✅ | ❌ 不一致 | - | `conflict` | **标记冲突，强制人工确认** |
| ❌ 不可用 | ✅ | - | `rule_only` | 降级为规则匹配 |
| ❌ | ❌ | - | `no_evidence` | 返回 UNK + "需人工分类" |

### 置信度校准

LLM 输出的 confidence 需结合以下因素校准：
- **文本长度**：< 20字 → confidence 降 0.1（信息不足）
- **关键词命中**：命中分类关键词 ≥ 3个 → confidence 加 0.05
- **双证据一致**：LLM + 规则一致 → confidence 加 0.05
- **历史相似事件**：知识库有同类事件 → confidence 加 0.05

## Guardrail（约束边界）

### 分类约束
1. **五分类穷举**：结果必须为 INF/FOOD/ENV/POISON/UNK 之一，不允许其他值
2. **甲类优先**：如识别到鼠疫、霍乱等甲类传染病关键词，无论置信度如何，标记 risk_level=L0
3. **不自动定级**：分类结果仅建议，最终事件类型由人工确认

### 双证据约束
4. **冲突检测**：LLM与规则结果不一致时，强制标记 conflict，不可自动选择
5. **降级透明**：LLM不可用时降级为规则匹配，输出中标记 llm_used=false
6. **置信度阈值**：< 0.7 时标记"建议人工确认类型"

### 缺失证据约束（OpsPilot Zero 经验）
7. **缺失信息提示**：分类结果必须包含 missing_evidence 字段，列出需要补充的信息
8. **关键信息检查**：
   - 时间信息（发病时间、暴露时间）
   - 地点信息（发生场所）
   - 人群信息（受影响人数、人群特征）
   - 症状信息（主要症状）
   - 暴露史（共同食物/环境/职业接触）

### 安全约束
9. **隐私保护**：不上报患者个人信息（姓名、身份证等），仅上报统计信息
10. **不修改原始数据**：分类结果写入 agent_sessions，不修改原始上报文本

## 执行证据链

```
输入(rawText, title)
  ├── LLM路径: system prompt(五分类+特征) → LLM推理 → {typeKey, confidence, reasoning}
  ├── 规则路径: resolveEventType({rawText, title}) → {typeKey, matched}
  ├── 交叉验证: LLM.typeKey === Rule.typeKey ?
  ├── 置信度校准: 文本长度/关键词/一致性调整
  └── 输出: typeKey + dual_evidence + evidence(missing_evidence)
```

**证据要素**：
- `provenance`: LLM模型 + 规则引擎版本
- `llm_used`: 是否实际调用LLM
- `rule_matched`: 规则是否命中
- `confidence`: 校准后置信度
- `missing_evidence`: 缺失的关键信息列表
- `methodology`: 双证据验证流程描述

## 调用条件

Sentinel Agent 接收到新上报时**首先调用**。分类结果驱动后续所有Agent的行为。

## 依赖工具/系统

- LLM（DashScope/OpenAI）用于语义分类
- `eventTypes.js` 规则引擎用于兜底匹配（正则关键词匹配）
- `knowledge.json` 知识库（可选，用于历史相似事件匹配）

## 失败处理

1. **LLM 不可用** → 降级为规则引擎匹配（llm_used: false）
2. **LLM 输出解析失败** → 使用规则引擎结果
3. **置信度低于 0.7** → 标记"建议人工确认类型"
4. **输入为空** → 返回 ok: false + "缺少上报文本"
5. **双证据冲突** → 返回 conflict 状态，强制人工确认

## 安全边界

- 分类结果仅建议，最终由人工确认
- 不上报患者个人隐私信息
- LLM调用记录含 model/prompt/response 写入 rule_results 存证
- 冲突状态不可自动消解

## references/

- `references/分类标准法规摘录.md` — 《报告管理工作规范》分类条目
- `references/关键词匹配规则表.md` — eventTypes.js 正则规则说明
