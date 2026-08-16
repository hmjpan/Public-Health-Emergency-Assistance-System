// Skill: TypePackResolve — 事件类型解析与配置加载
// 包装 eventTypes.resolveEventType()，共享 Skill
// v1.1.0: 增加 evidence chain
const { SkillResult } = require('../skill-base');
const { resolveEventType, listEventTypes } = require('../../eventTypes');

module.exports = {
  name: 'TypePackResolve',
  version: '1.1.0',
  agent: null, // 共享 Skill
  detLevel: 'D0',
  description: '依据《国家突发公共卫生事件相关信息报告管理工作规范》五分类体系，精确或模糊匹配事件类型后加载差异化配置（通知组、物资包、任务包、表单集、完成标准等）',
  inputSchema: {
    typeKey: 'string (可选) - INF|FOOD|ENV|POISON|UNK',
    type: 'string (可选) - 事件类型关键词',
    disease: 'string (可选) - 疾病名称',
    title: 'string (可选) - 事件标题',
    rawText: 'string (可选) - 自然语言描述'
  },
  outputSchema: {
    typeKey: 'string', name: 'string', icon: 'string',
    notifyGroups: 'array', materialPacks: 'array',
    taskPacks: 'array', forms: 'array',
    launchCriteria: 'array', fieldCriteria: 'array',
    medical: 'object',
    evidence: 'object{provenance, match_method, confidence, missing_evidence}'
  },
  async execute(input) {
    // resolveEventType 用 title 做关键词匹配，将 rawText 映射到 title
    const resolved = input ? { ...input, title: input.title || input.rawText || '' } : {};
    const hasTypeKey = input && input.typeKey;
    const pack = resolveEventType(resolved);

    if (!pack) {
      return new SkillResult({
        ok: false,
        error: '无法解析事件类型',
        meta: {
          skillName: 'TypePackResolve', skillVersion: '1.1.0', detLevel: 'D0', llmUsed: false,
          evidence: { provenance: 'eventTypes.js', match_method: hasTypeKey ? 'exact' : 'fuzzy', confidence: 0, missing_evidence: ['未匹配到事件类型，建议补充typeKey或更详细的描述'] }
        }
      });
    }

    const matchMethod = hasTypeKey ? 'exact' : 'fuzzy';
    const evidence = {
      provenance: 'eventTypes.js',
      match_method: matchMethod,
      confidence: matchMethod === 'exact' ? 1.0 : 0.8,
      missing_evidence: matchMethod === 'fuzzy' ? ['模糊匹配，建议人工确认事件类型'] : []
    };

    return new SkillResult({
      ok: true,
      data: {
        typeKey: pack.typeKey,
        name: pack.name,
        icon: pack.icon,
        sceneHint: pack.sceneHint,
        notifyGroups: pack.notifyGroups,
        firstTaskSummary: pack.firstTaskSummary,
        materialPacks: pack.materialPacks,
        taskPacks: pack.taskPacks,
        forms: pack.forms,
        launchCriteria: pack.launchCriteria,
        fieldCriteria: pack.fieldCriteria,
        medical: pack.medical,
        evidence
      },
      meta: { skillName: 'TypePackResolve', skillVersion: '1.1.0', detLevel: 'D0', ruleVersion: '1.0', llmUsed: false, evidence }
    });
  },
  listTypes() {
    return listEventTypes();
  }
};
