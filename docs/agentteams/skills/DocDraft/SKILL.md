---
name: doc-draft
description: 文档自动起草。依据公文规范，根据事件数据自动生成文档初稿（简报/终报/发布稿），模板段自动填充数据，评述段由LLM生成，需人工审核后方可发布。Communication/Review Agent 使用。
version: 1.1.0
det_level: D3
agents: [communication, review]
type: shared
llm_required: true
guardrail: strict
---

# DocDraft — 文档自动起草

## 使用场景

根据事件数据自动生成文档初稿，支持三种文档类型：
- **简报（brief）**: 定时生成的事件进展简报
- **终报（final）**: 事件终止时的总结报告
- **发布稿（publish）**: 对外信息发布稿

## 输入参数

```json
{
  "eventId": "EVT-001",
  "docType": "brief"
}
```

## 输出结果

```json
{
  "ok": true,
  "data": {
    "docType": "brief",
    "title": "事件简报 - XX学校食物中毒",
    "sections": [
      {"title": "事件概述", "content": "...", "needsReview": false},
      {"title": "处置进展", "content": "...", "needsReview": false},
      {"title": "风险提示", "content": "...", "needsReview": true}
    ],
    "fullText": "## 事件概述\n...\n\n## 处置进展\n..."
  }
}
```

## 调用条件

Commander Agent 需要简报/终报时调用；Communication Agent 起草发布稿时调用。

## 依赖工具/系统

- 事件全链路数据
- 文档模板库
- LLM 用于文本生成

## 失败处理

1. **数据不足** → 对应段落标记"[数据待补]"
2. **模板缺失** → 回退到通用模板
3. **LLM 不可用** → 使用纯模板填充

## 安全边界

生成内容需**人工审核后方可发布**；文档含版本号可追溯。

## Guardrail（约束边界）

### 内容约束
1. **模板段确定性**：模板段（事件概述、基本数据）由系统填充，不经LLM
2. **评述段LLM**：分析评述段（风险提示、改进建议）由LLM生成
3. **审核标记**：每个段落标注 needsReview（模板段=false，LLM段=true）
4. **不含敏感信息**：文档中不含患者个人隐私信息

### LLM约束
5. **降级透明**：LLM不可用时使用纯模板填充，所有段标记 needsReview=true
6. **版本存证**：文档含生成时间和版本号

### 业务约束
7. **发布需审核**：所有生成文档需人工审核后方可对外发布
8. **不自动发布**：Skill仅生成初稿，不触发发布动作

## 执行证据链

```
输入(eventId, docType) → 加载文档模板(brief/final/publish)
  → 模板段自动填充(事件数据/统计数据/时间线)
  → LLM生成评述段(风险提示/分析建议)
  → 合并全文 + 标记needsReview
  → 写入 rule_results 存证
```

**证据要素**：
- `provenance`: 文档模板 + 事件数据 + LLM
- `template_sections`: 模板段数量
- `llm_sections`: LLM段数量
- `needs_review_count`: 需人工审核段落数

## references/

- `references/文档模板规范.md` — 简报/终报/发布稿的标准格式规范

