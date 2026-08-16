// Skill: SOPGuidance — 岗位 SOP 指引
// Field 专属，结合知识库SOP + CDC 10步法 + LLM生成定制化指导
// v1.1.0: CDC步骤映射 + 证据链 + Guardrail
const { SkillResult } = require('../skill-base');
const llm = require('../llm/provider');
const { load } = require('../../store');
const { resolveEventType } = require('../../eventTypes');

// CDC 10步法与事件阶段的映射
const CDC_STEP_MAP = {
  'response': { step: 1, name: '准备现场工作', desc: '组建团队、准备装备、了解背景' },
  'verify': { step: 2, name: '确认暴发存在', desc: '核实病例数是否超过基线水平' },
  'diagnose': { step: 3, name: '验证诊断', desc: '确认实验室检测结果、排除误诊' },
  'casedef': { step: 4, name: '定义病例并开展搜索', desc: '制定病例定义（疑似/临床诊断/确诊）、主动搜索' },
  'field': { step: 5, name: '描述性流行病学', desc: '绘制流行曲线、制作病例分布地图、描述人群特征（时间/地点/人群）' },
  'hypothesis': { step: 6, name: '形成假设', desc: '基于三间分布提出暴露来源假设' },
  'analyse': { step: 7, name: '评估假设', desc: '病例对照研究/队列研究验证假设' },
  'refine': { step: 8, name: '完善假设并补充研究', desc: '环境采样、实验室验证' },
  'control': { step: 9, name: '实施控制措施', desc: '隔离/消杀/管控/健康教育' },
  'report': { step: 10, name: '沟通调查结果', desc: '撰写调查报告、向相关方通报' }
};

// 各类事件×工作组的核心SOP要点（内置知识库）
const BUILTIN_SOP = {
  INF: {
    '流调组': {
      keySteps: ['制定病例定义（疑似/临床诊断/确诊）', '开展个案调查', '密接排查', '绘制发病时间曲线（流行曲线）', '分析三间分布（时间/地点/人群）', '追踪传播链'],
      precautions: ['注意区分疑似与确诊病例', '密接判定需结合潜伏期', '注意询问旅行史和接触史'],
      mistakes: ['遗漏隐性感染者', '未考虑无症状携带者', '流行病学史询问不完整']
    },
    '采样检测组': {
      keySteps: ['采集患者标本（咽拭子/粪便/血液）', '采集环境标本', '现场快速检测', '规范送检', '结果反馈'],
      precautions: ['标本需冷链运输（2-8°C）', '注意生物安全（BSL-2以上）', '采集双份血清（急性期/恢复期）'],
      mistakes: ['标本保存温度不当', '未及时送检导致病原降解', '采样部位不正确']
    },
    '消杀组': {
      keySteps: ['确定疫点范围', '配制消毒液', '实施疫点消杀', '终末消毒', '消毒效果评价'],
      precautions: ['根据病原体选择消毒剂', '注意消毒剂浓度和作用时间', '做好个人防护'],
      mistakes: ['消毒剂浓度不够', '遗漏重点部位', '消毒时间不足']
    },
    '管控组': {
      keySteps: ['风险点位排查', '实施封控措施', '密切接触者管理', '隔离点巡查', '健康教育'],
      precautions: ['封控范围应适当扩大', '密接管理需登记造册', '隔离期限依据潜伏期'],
      mistakes: ['封控范围过小', '密接追踪遗漏', '隔离措施执行不严']
    },
    '医疗救治组': {
      keySteps: ['分诊筛查', '病例救治', '重症监护', '院感防控', '出院评估'],
      precautions: ['做好分级防护', '注意院内感染防控', '重症病例优先救治'],
      mistakes: ['院感防控措施不到位', '轻症忽视导致加重', '出院标准把握不严']
    }
  },
  FOOD: {
    '流调组': {
      keySteps: ['核实诊断和病例数', '制定病例定义', '开展就餐史调查', '锁定可疑餐次和食物', '绘制发病曲线', '开展病例对照研究/队列研究'],
      precautions: ['注意回忆偏倚', '使用标准化问卷', '询问食物过敏史'],
      mistakes: ['遗漏隐性病例和轻症者', '未记录共同暴露的精确时间', '样本量不足']
    },
    '采样检测组': {
      keySteps: ['采集食品留样', '采集患者生物样本（粪便/呕吐物）', '环境涂抹采样（厨房/餐具）', '快速检测', '送检确认'],
      precautions: ['留样食品需冷藏保存（4°C以下）', '注意无菌操作', '区分食物样本和环境样本'],
      mistakes: ['食品样本未冷藏导致变质', '采样量不足', '未采集对照样本']
    },
    '管控组': {
      keySteps: ['涉事餐饮单位管控', '可疑食品封存', '溯源调查', '从业人员排查', '责令整改'],
      precautions: ['封存应包含原料和成品', '追溯供应链上下游', '注意证据保全'],
      mistakes: ['封存不彻底', '溯源链条不完整', '未及时控制可疑食品流通']
    }
  },
  ENV: {
    '环境采样组': {
      keySteps: ['确定采样点位', '采集环境介质样本（水/气/土壤）', '污染物定性分析', '浓度监测', '绘制污染分布图'],
      precautions: ['采样人员做好个人防护', '区分污染区和清洁区', '注意样本保存条件'],
      mistakes: ['采样点位不具代表性', '样本交叉污染', '未记录气象条件']
    },
    '消杀组': {
      keySteps: ['人员洗消', '污染区域洗消', '阻断扩散通道', '洗消效果评价'],
      precautions: ['根据污染物选择洗消方法', '注意洗消废水处理', '做好洗消人员防护'],
      mistakes: ['洗消不彻底', '废水未收集处理', '防护不当导致二次暴露']
    }
  },
  POISON: {
    '医疗救治组': {
      keySteps: ['现场急救（脱离毒物接触）', '解毒治疗（特异性解毒剂）', '对症支持治疗', '重症监护', '预后评估'],
      precautions: ['明确毒物种类后选择解毒剂', '注意解毒剂使用剂量', '密切监测生命体征'],
      mistakes: ['未明确毒物即盲目用药', '解毒剂过量', '忽视对症支持治疗']
    },
    '采样检测组': {
      keySteps: ['采集空气样本（毒物浓度）', '采集生物样本（血/尿）', '毒物定性定量检测', '作业环境监测'],
      precautions: ['采样人员佩戴适当防护', '注意采样时段代表性', '生物样本及时送检'],
      mistakes: ['采样时未做好防护', '采样时间不当', '样本保存条件不符']
    }
  }
};

const SYSTEM_PROMPT = `你是公共卫生应急处置专家。根据事件类型、当前阶段和任务信息，给出具体岗位操作SOP指引。

要求：
1. 实用、具体、可操作（每步要具体到动作）
2. 包含注意事项和常见错误
3. 按工作组分组
4. 参考CDC现场调查标准步骤

输出 JSON 格式（不要输出其他内容）：
{"sop": ["操作步骤列表，每步要具体"], "precautions": ["注意事项列表"], "commonMistakes": ["常见错误列表"], "keyPoints": "关键要点总结（一句话）"}`;

module.exports = {
  name: 'SOPGuidance',
  version: '1.1.0',
  agent: 'field',
  detLevel: 'D3',
  description: '依据CDC现场调查10步法和中国各类事件处置技术方案，匹配标准SOP并生成定制化操作指导，含注意事项、常见错误、关键要点',
  inputSchema: {
    typeKey: 'INF|FOOD|ENV|POISON|UNK',
    stage: 'string - 阶段(response/verify/diagnose/casedef/field/hypothesis/analyse/refine/control/report)',
    group: 'string (可选) - 工作组名称',
    taskTitle: 'string (可选) - 任务标题',
    context: 'string (可选) - 额外上下文'
  },
  outputSchema: {
    cdc_step: 'string - CDC 10步法对应步骤',
    sop: 'array - 操作步骤',
    precautions: 'array - 注意事项',
    commonMistakes: 'array - 常见错误',
    keyPoints: 'string - 关键要点',
    matchedKnowledge: 'array',
    relevantTasks: 'array',
    evidence: 'object'
  },
  async execute(input) {
    const { typeKey, stage, group, taskTitle, context } = input || {};

    // 1. CDC步骤映射
    const cdcStepInfo = CDC_STEP_MAP[stage] || CDC_STEP_MAP['field'];
    const cdcStepStr = `步骤${cdcStepInfo.step}：${cdcStepInfo.name} — ${cdcStepInfo.desc}`;

    // 2. 知识库SOP匹配
    const knowledge = load('knowledge');
    const matchedSOPs = knowledge.filter(k =>
      k.kind === 'sop' &&
      (k.typeKey === typeKey || !k.typeKey) &&
      (k.stage === stage || !k.stage)
    );

    // 3. 任务包解析
    const typePack = resolveEventType({ typeKey });
    const relevantTasks = typePack ? typePack.taskPacks.filter(t => !group || t.group === group) : [];

    // 4. 内置SOP要点
    const builtinSOP = (BUILTIN_SOP[typeKey] && group && BUILTIN_SOP[typeKey][group]) || null;

    // 5. 构建LLM prompt（综合所有信息）
    const promptParts = [
      `事件类型: ${typeKey || '未知'}（${{ INF: '传染病疫情', FOOD: '食物中毒', ENV: '环境污染', POISON: '职业中毒', UNK: '不明原因' }[typeKey] || '未知'}）`,
      `当前阶段: ${stage || '未知'}（CDC步骤: ${cdcStepStr}）`,
      `工作组: ${group || '全部'}`,
      `任务: ${taskTitle || '综合'}`,
      builtinSOP ? `\n内置SOP要点:\n- 关键步骤: ${builtinSOP.keySteps.join('; ')}\n- 注意事项: ${builtinSOP.precautions.join('; ')}\n- 常见错误: ${builtinSOP.mistakes.join('; ')}` : '',
      matchedSOPs.length > 0 ? `\n知识库SOP: ${matchedSOPs.map(s => s.title).join(', ')}` : '',
      relevantTasks.length > 0 ? `\n任务包: ${relevantTasks.map(t => `${t.group}-${t.title}: ${t.steps.join('→')}`).join('; ')}` : '',
      context ? `\n上下文: ${context}` : ''
    ].filter(Boolean);

    const prompt = promptParts.join('\n');

    const llmResult = await llm.chat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ], { temperature: 0.3 });

    let llmParsed = null;
    if (llmResult.llmUsed && llmResult.content) {
      try {
        const jsonMatch = llmResult.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) llmParsed = JSON.parse(jsonMatch[0]);
      } catch (e) { /* fallback */ }
    }

    // 6. 构建SOP（优先LLM，降级到内置SOP，再降级到任务包）
    let sop, precautions, commonMistakes, keyPoints;

    if (llmParsed) {
      sop = llmParsed.sop || [];
      precautions = llmParsed.precautions || [];
      commonMistakes = llmParsed.commonMistakes || [];
      keyPoints = llmParsed.keyPoints || '';
    } else if (builtinSOP) {
      sop = builtinSOP.keySteps.map((s, i) => `${i + 1}. ${s}`);
      precautions = builtinSOP.precautions;
      commonMistakes = builtinSOP.mistakes;
      keyPoints = `当前阶段（${cdcStepInfo.name}）关键要点：请参照标准流程执行`;
    } else if (relevantTasks.length > 0) {
      sop = relevantTasks.flatMap(t => t.steps.map(s => `[${t.group}] ${s}`));
      precautions = ['注意个人防护', '做好记录'];
      commonMistakes = [];
      keyPoints = '';
    } else {
      sop = ['请参照标准预案和CDC现场调查10步法执行'];
      precautions = ['注意个人防护', '做好记录', '及时报告'];
      commonMistakes = [];
      keyPoints = '';
    }

    // 7. 构建证据链
    const evidence = {
      provenance: `知识库SOP(${matchedSOPs.length}条) + 内置SOP(${builtinSOP ? '有' : '无'}) + LLM(${llmResult.llmUsed ? '已调用' : '未调用'})`,
      sop_count: matchedSOPs.length,
      task_count: relevantTasks.length,
      builtin_sop: !!builtinSOP,
      llm_used: llmResult.llmUsed,
      cdc_step_ref: `CDC 10步法 步骤${cdcStepInfo.step}`,
      missing_evidence: matchedSOPs.length === 0 && !builtinSOP ? ['知识库中无该类型SOP，建议补充'] : [],
      methodology: '知识库匹配 + 内置SOP要点 + 任务包标准步骤 + LLM定制化生成'
    };

    return new SkillResult({
      ok: true,
      data: {
        cdc_step: cdcStepStr,
        sop,
        precautions,
        commonMistakes,
        keyPoints,
        matchedKnowledge: matchedSOPs.map(s => ({ id: s.id, title: s.title, summary: s.summary || '' })),
        relevantTasks: relevantTasks.map(t => ({ group: t.group, title: t.title, steps: t.steps })),
        evidence
      },
      meta: {
        skillName: 'SOPGuidance',
        skillVersion: '1.1.0',
        detLevel: 'D3',
        llmUsed: llmResult.llmUsed,
        model: llmResult.model,
        evidence
      }
    });
  }
};
