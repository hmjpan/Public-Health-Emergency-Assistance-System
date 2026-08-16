// Skill: EventClassify — 自然语言上报→事件类型分类（双证据验证）
// Sentinel 专属，LLM + 规则引擎交叉验证
// v1.1.0: 双证据验证 + 缺失信息检测 + Guardrail
const { SkillResult } = require('../skill-base');
const llm = require('../llm/provider');
const { resolveEventType } = require('../../eventTypes');

const SYSTEM_PROMPT = `你是突发公共卫生事件分类专家。根据上报信息，判断事件类型。

## 分类体系（依据《国家突发公共卫生事件相关信息报告管理工作规范（2006版）》）

### INF — 传染病疫情
- 典型场景：流感暴发、诺如病毒感染、霍乱、新冠、鼠疫等
- 关键特征：发热/咳嗽/腹泻群体发病、有接触史、学校/养老院聚集性

### FOOD — 食源性疾病/食物中毒
- 典型场景：聚餐后腹泻呕吐、学校食堂群体发病、食品污染
- 关键特征：共同就餐史、潜伏期短(2-6h)、恶心呕吐腹泻、同一食物来源

### ENV — 环境污染健康事件
- 典型场景：毒气泄漏、水源污染、化学品泄漏、辐射事件
- 关键特征：异味/异色、环境暴露史、皮肤刺激/呼吸困难

### POISON — 急性职业中毒
- 典型场景：工厂有限空间中毒、农药中毒、化学品泄漏致工人中毒
- 关键特征：职业暴露史、作业场所、特定毒物症状(瞳孔/意识/呼吸)

### UNK — 原因不明群体性疾病
- 典型场景：多人群同现不明症状、无法归因
- 关键特征：症状不典型、无明确暴露史、多系统受累

## 输出要求
输出 JSON 格式（不要输出其他内容）：
{"typeKey": "类型代码", "confidence": 0.0-1.0, "reasoning": "分类理由（不超过50字）", "keywords": ["提取的关键词"]}`;

// 缺失信息检测关键词
const EVIDENCE_CHECKERS = {
  time: {
    patterns: [/\d+月\d+/, /\d+日/, /今天/, /昨天/, /午餐后/, /晚餐后/, /上午/, /下午/, /\d+小时前/],
    label: '发病/暴露时间'
  },
  location: {
    patterns: [/学校/, /食堂/, /工厂/, /社区/, /医院/, /村/, /镇/, /区/, /公司/, /宿舍/],
    label: '发生地点'
  },
  population: {
    patterns: [/\d+人/, /多名/, /数十人/, /群体/, /学生/, /工人/, /员工/],
    label: '受影响人群'
  },
  symptoms: {
    patterns: [/发热/, /呕吐/, /腹泻/, /咳嗽/, /皮疹/, /头晕/, /呼吸困难/, /昏迷/, /腹痛/, /恶心/],
    label: '主要症状'
  },
  exposure: {
    patterns: [/聚餐/, /食用/, /接触/, /泄漏/, /作业/, /水源/, /食物/, /化学品/, /农药/],
    label: '暴露史'
  }
};

// 甲类传染病关键词
const CLASS_A_KEYWORDS = ['鼠疫', '霍乱', '肺炭疽', '传染性非典型肺炎', '甲类'];

function detectMissingEvidence(text) {
  const missing = [];
  const hasEvidence = {};
  for (const [key, checker] of Object.entries(EVIDENCE_CHECKERS)) {
    hasEvidence[key] = checker.patterns.some(p => p.test(text));
    if (!hasEvidence[key]) {
      missing.push(`建议补充：${checker.label}`);
    }
  }
  return { missing, hasEvidence };
}

function detectClassA(text) {
  return CLASS_A_KEYWORDS.some(kw => text.includes(kw));
}

function calibrateConfidence(rawConf, text, llmType, ruleType) {
  let conf = rawConf;
  // 文本长度：过短降低置信度
  if (text.length < 20) conf -= 0.1;
  if (text.length < 10) conf -= 0.1;
  // 双证据一致：加置信度
  if (llmType && ruleType && llmType === ruleType) conf += 0.05;
  // 关键词命中：加置信度
  const { hasEvidence } = detectMissingEvidence(text);
  const keywordHits = Object.values(hasEvidence).filter(Boolean).length;
  if (keywordHits >= 3) conf += 0.05;
  // 限制范围
  return Math.max(0.1, Math.min(0.99, conf));
}

module.exports = {
  name: 'EventClassify',
  version: '1.1.0',
  agent: 'sentinel',
  detLevel: 'D3',
  description: '依据《国家突发公共卫生事件相关信息报告管理工作规范》，采用"LLM语义分析+规则引擎关键词匹配"双证据验证，识别事件类型，含缺失信息检测',
  inputSchema: {
    rawText: 'string - 上报原始文本',
    title: 'string (可选) - 事件标题',
    reporter: 'string (可选) - 报告人'
  },
  outputSchema: {
    typeKey: 'INF|FOOD|ENV|POISON|UNK',
    typeName: 'string',
    confidence: 'number(0-1)',
    confidence_level: 'high|medium|low',
    reasoning: 'string',
    keywords: 'array',
    dual_evidence: 'object{llm_result, rule_result, agreement, decision}',
    evidence: 'object{provenance, llm_used, rule_matched, confidence, missing_evidence, methodology}'
  },
  async execute(input) {
    const { rawText, title } = input || {};
    const fullText = (title || '') + ' ' + (rawText || '');

    if (!rawText && !title) {
      return new SkillResult({
        ok: false, data: null, error: '缺少上报文本（rawText 或 title）',
        meta: { skillName: 'EventClassify', llmUsed: false, evidence: { methodology: '输入校验失败' } }
      });
    }

    // ---- 路径1：规则引擎匹配 ----
    const ruleResult = resolveEventType({ rawText, title }, true);
    const ruleType = ruleResult && ruleResult.typeKey;
    const ruleMatched = !!ruleType;

    // ---- 路径2：LLM语义分析 ----
    const userMsg = title ? `标题: ${title}\n描述: ${rawText || ''}` : (rawText || '');
    const llmResult = await llm.chat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMsg }
    ], { temperature: 0.1 });

    let llmParsed = null;
    if (llmResult.llmUsed && llmResult.content) {
      try {
        const jsonMatch = llmResult.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) llmParsed = JSON.parse(jsonMatch[0]);
      } catch (e) { /* LLM 输出解析失败 */ }
    }
    const llmType = llmParsed ? llmParsed.typeKey : null;
    const llmConf = llmParsed ? (llmParsed.confidence || 0.5) : 0;

    // ---- 双证据交叉验证 ----
    const agreement = llmType && ruleType && llmType === ruleType;
    let finalType, confidence, decision;

    if (llmParsed && llmConf > 0.7 && llmType) {
      if (agreement) {
        decision = 'llm_high_conf';
      } else if (ruleMatched) {
        decision = 'conflict';
      } else {
        decision = 'llm_only';
      }
      finalType = llmType;
      confidence = llmConf;
    } else if (ruleMatched) {
      decision = 'rule_fallback';
      finalType = ruleType;
      confidence = 0.8; // 规则匹配给一个较高基线
    } else {
      decision = 'no_evidence';
      finalType = 'UNK';
      confidence = 0.3;
    }

    // 置信度校准
    confidence = calibrateConfidence(confidence, fullText, llmType, ruleType);

    // 甲类传染病检测 → 强制标记
    const isClassA = detectClassA(fullText);

    // 缺失信息检测
    const { missing: missingEvidence } = detectMissingEvidence(fullText);

    // 置信度等级
    const confidenceLevel = confidence > 0.8 ? 'high' : confidence > 0.6 ? 'medium' : 'low';

    const typeName = { INF: '传染病疫情', FOOD: '食源性疾病/食物中毒', ENV: '环境污染健康事件', POISON: '急性职业中毒', UNK: '原因不明群体性疾病' };
    const typePack = resolveEventType({ typeKey: finalType });

    // 构建证据链
    const evidence = {
      provenance: `LLM(${llmResult.model || 'unknown'}) + 规则引擎(eventTypes.js)`,
      llm_used: llmResult.llmUsed,
      rule_matched: ruleMatched,
      confidence,
      missing_evidence: missingEvidence,
      methodology: '双证据验证：LLM语义分析 + 规则引擎关键词匹配，交叉校验'
    };

    const dualEvidence = {
      llm_result: llmParsed ? { typeKey: llmType, confidence: llmConf, reasoning: llmParsed.reasoning || '' } : { typeKey: null, confidence: 0, reasoning: 'LLM不可用或解析失败' },
      rule_result: { typeKey: ruleType || null, matched: ruleMatched },
      agreement,
      decision
    };

    return new SkillResult({
      ok: true,
      data: {
        typeKey: finalType || 'UNK',
        typeName: typePack ? typePack.name : (typeName[finalType] || '未知'),
        confidence: Math.round(confidence * 100) / 100,
        confidence_level: confidenceLevel,
        reasoning: llmParsed ? llmParsed.reasoning : '基于规则引擎关键词匹配',
        keywords: llmParsed ? (llmParsed.keywords || []) : [],
        is_class_a: isClassA,
        dual_evidence: dualEvidence,
        evidence,
        llmUsed: llmResult.llmUsed,
        ruleMatched: ruleMatched
      },
      meta: {
        skillName: 'EventClassify',
        skillVersion: '1.1.0',
        detLevel: 'D3',
        llmUsed: llmResult.llmUsed,
        model: llmResult.model,
        evidence
      }
    });
  }
};
