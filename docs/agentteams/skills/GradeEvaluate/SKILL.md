---
name: grade-evaluate
description: 研判定级。依据《国家突发公共卫生事件应急预案》(国办函〔2006〕39号)分级标准，将量化要素映射为法定建议级别（I/II/III/IV级），含命中规则、法规依据、距上一级差距、L0-L3风险等级。
version: 1.1.0
det_level: D0
agents: [commander]
type: dedicated
guardrail: strict
---

# GradeEvaluate — 研判定级

## 使用场景

指挥员研判事件时，输入量化要素（事件类型、病例人数、死亡人数、波及范围、扩散趋势），输出：
1. **建议级别**（I/II/III/IV级）
2. **命中规则**（含法规条文号）
3. **距上一级差距**（提级条件提示）
4. **风险等级**（L0-L3）

遵循"就高不就低"原则（《国家突发公共卫生事件应急预案》第1.3条）。

## 法规依据

| 条款 | 内容 |
|------|------|
| 国办函〔2006〕39号 第1.3.1条 | 特别重大(I级)判定标准 |
| 国办函〔2006〕39号 第1.3.2条 | 重大(II级)判定标准 |
| 国办函〔2006〕39号 第1.3.3条 | 较大(III级)判定标准 |
| 国办函〔2006〕39号 第1.3.4条 | 一般(IV级)判定标准 |
| 国务院令第376号 第19-20条 | 报告时限与程序 |
| 卫生部令第9号 第5条 | 食物中毒分级 |

## 输入参数

```json
{
  "typeKey": "INF|FOOD|ENV|POISON|UNK",
  "cases": 60,
  "deaths": 0,
  "scope": 2,
  "spread": false,
  "typeTag": ""
}
```

**变量说明**：
- `typeKey`: 事件类型（INF传染病/FOOD食物中毒/ENV环境污染/POISON职业中毒/UNK不明原因）
- `cases`: 病例/中毒人数（整数≥0，缺省按0处理）
- `deaths`: 死亡人数（整数≥0，缺省按0处理）
- `scope`: 波及范围（1=县区内, 2=市内跨区, 3=省内跨市, 4=跨省）
- `spread`: 是否有扩散趋势（true/false）
- `typeTag`: 传染病管理类别（"甲类管理"/"乙类管理"/""）

## 输出结果

```json
{
  "ok": true,
  "data": {
    "suggestedLevel": "III级",
    "riskLevel": "L2",
    "riskLabel": "较大",
    "matchedRules": [
      {
        "id": "GRD-FOOD-003",
        "level": "III级",
        "basis": "《国家突发公共卫生事件应急预案》1.3.3: 一次食物中毒人数超过50人，或出现死亡病例",
        "legal_ref": "国办函〔2006〕39号 1.3.3",
        "expr": "cases > 50 || deaths >= 1"
      }
    ],
    "gapToHigher": [
      {
        "id": "GRD-FOOD-002",
        "level": "II级",
        "expr": "cases > 100 || deaths >= 3",
        "basis": "需中毒人数>100人或死亡≥3人"
      }
    ],
    "factors": {
      "typeKey": "FOOD", "cases": 60, "deaths": 0,
      "scope": 2, "spread": false
    },
    "notice": "本结果为规则建议级别，最终定级由指挥员决定（就高不就低原则）",
    "evidence": {
      "provenance": "grading.json rule_version=2026.2",
      "rule_evaluated": 20,
      "rule_matched": 2,
      "confidence": "high",
      "missing_evidence": [],
      "methodology": "受限表达式求值，白名单变量，无网络无随机"
    }
  },
  "meta": {
    "skillName": "GradeEvaluate",
    "skillVersion": "1.1.0",
    "detLevel": "D0",
    "ruleVersion": "2026.2",
    "llmUsed": false,
    "durationMs": 0
  }
}
```

## Guardrail（约束边界）

### 确定性约束（D0级）
1. **纯函数**：同输入必同输出，无网络调用，无随机性，无副作用
2. **白名单变量**：仅接受 cases/deaths/scope/spread/typeTag 五个变量，拒绝任意标识符
3. **受限表达式**：仅支持比较/逻辑运算，禁止函数调用/成员访问/赋值（语法层拦截）
4. **就高不就低**：命中多条规则时，自动取最高级别

### 数据校验约束
5. **合理范围**：cases/deaths ∈ [0, 999999]，超出范围报错
6. **类型约束**：typeKey 必须为 INF/FOOD/ENV/POISON/UNK 之一
7. **scope约束**：必须为 1/2/3/4 之一，缺省按1处理

### 业务约束
8. **仅建议**：输出为"建议级别"，最终定级由指挥员决定（Skill不可自动执行定级）
9. **规则版本存证**：每次输出携带 ruleVersion，确保审计可追溯
10. **规则未覆盖兜底**：无匹配规则时返回 noMatch + "转人工研判"

## 执行证据链

```
输入要素 → 受限表达式求值 → 规则匹配(按typeKey筛选) → 就高不就低排序 → 建议级别
                                                                    → 差距分析(上一级规则)
                                                                    → 写入rule_results存证
```

**证据要素**：
- `provenance`: 规则表来源（grading.json + 版本号）
- `rule_evaluated`: 本轮评估了多少条规则
- `rule_matched`: 命中了多少条规则
- `confidence`: high（命中规则）/ low（noMatch）
- `missing_evidence`: 空数组（纯确定性，无缺失证据）
- `methodology`: 受限表达式求值器，白名单变量

## 调用条件

Commander Agent 在研判阶段调用。输出为建议级别，最终定级由人决定。

## 依赖工具/系统

- `grading.json` 规则表（纯函数、无网络、无随机）
- 规则引擎 `rules/engine.js` 的受限表达式求值器

## 失败处理

1. **输入校验失败** → 返回具体错误信息（`ok: false, kind: 'validation'`）
2. **规则未覆盖** → 返回 `noMatch: true` + "转人工研判"
3. **规则表达式错误** → 抛出异常（含规则ID和错误详情）
4. **规则表文件缺失** → 系统启动自检告警

## 安全边界

- 纯函数无副作用
- 输出含 `ruleVersion` + `evidence` 确保可审计追溯
- "就高不就低"原则防止低估风险
- 输入范围限制防止异常值注入

## 复用价值

⭐⭐ 极高。任何需要"量化要素→法定/标准分级"的场景均可复用。规则表可替换，引擎逻辑通用。
典型场景：安全生产事故分级、自然灾害应急响应分级、网络安全事件分级。

## references/

- `references/国办函〔2006〕39号_分级标准.md` — 四级分级标准原文摘录
- `references/grading-rules-changelog.md` — 规则版本变更记录
