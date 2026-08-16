// Skill: DocDraft — 文档自动起草（简报/终报/发布稿）
// 共享 Skill，模板段确定性填充 + LLM生成评述段
// v1.1.0: 增加 evidence chain + needsReview 标记
const { SkillResult } = require('../skill-base');
const llm = require('../llm/provider');
const { load } = require('../../store');
const { resolveEventType } = require('../../eventTypes');

const TEMPLATES = {
  brief: {
    name: '事件简报',
    sections: ['事件概述', '处置进展', '资源投入', '风险提示', '下一步工作']
  },
  final: {
    name: '事件终报',
    sections: ['事件概况', '响应过程', '处置措施', '成效评估', '经验教训', '改进建议']
  },
  publish: {
    name: '信息发布稿',
    sections: ['事件通报', '已采取措施', '公众注意事项', '后续安排']
  }
};

module.exports = {
  name: 'DocDraft',
  version: '1.1.0',
  agent: null, // 共享
  detLevel: 'D3',
  description: '依据公文规范，根据事件数据自动生成文档初稿（简报/终报/发布稿），模板段自动填充数据，评述段由LLM生成，需人工审核后方可发布',
  inputSchema: {
    eventId: 'string',
    docType: 'brief|final|publish'
  },
  outputSchema: {
    docType: 'string', title: 'string',
    sections: 'array[{title, content, needsReview}]',
    fullText: 'string',
    evidence: 'object{provenance, template_sections, llm_sections, needs_review_count}'
  },
  async execute(input) {
    const { eventId, docType } = input || {};
    if (!eventId) return new SkillResult({
      ok: false, error: '缺少 eventId',
      meta: { skillName: 'DocDraft', skillVersion: '1.1.0', detLevel: 'D3', llmUsed: false, evidence: { methodology: '输入校验失败' } }
    });

    const template = TEMPLATES[docType || 'brief'] || TEMPLATES.brief;
    const events = load('events');
    const event = events.find(e => e.id === eventId);
    const tasks = load('tasks').filter(t => t.eventId === eventId);
    const cases = load('cases').filter(c => c.eventId === eventId);
    const typePack = event ? resolveEventType(event) : null;

    const dataSummary = `事件: ${event ? event.title || event.id : '未知'}
类型: ${typePack ? typePack.name : '未知'}
状态: ${event ? event.stage : '未知'}
任务: ${tasks.length}个（完成${tasks.filter(t => t.status === 'done').length}个）
病例: ${cases.length}例`;

    const llmResult = await llm.chat([
      { role: 'system', content: `你是公文写作专家。请根据以下数据起草${template.name}。
要求：正式、准确、简洁。数据部分自动填充，评述和建议部分标记为needsReview=true。
输出 JSON 格式：{"title": "文档标题", "sections": [{"title": "段标题", "content": "内容", "needsReview": false}]}` },
      { role: 'user', content: dataSummary + '\n\n需包含的段落: ' + template.sections.join('、') }
    ], { temperature: 0.3, maxTokens: 2048 });

    let llmParsed = null;
    if (llmResult.llmUsed && llmResult.content) {
      try {
        const jsonMatch = llmResult.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) llmParsed = JSON.parse(jsonMatch[0]);
      } catch (e) { /* fallback */ }
    }

    // fallback 模板
    const fallbackSections = template.sections.map(s => ({
      title: s,
      content: docType === 'brief' ? `${s}：基于当前数据自动生成` : `${s}：待补充`,
      needsReview: true
    }));

    const sections = llmParsed ? (llmParsed.sections || fallbackSections) : fallbackSections;
    const fullText = sections.map(s => `## ${s.title}\n${s.content}${s.needsReview ? '\n[待人工审核]' : ''}`).join('\n\n');

    // 统计 evidence
    const templateSections = sections.filter(s => !s.needsReview).length;
    const llmSections = sections.filter(s => s.needsReview).length;

    const evidence = {
      provenance: `文档模板(${docType}) + 事件数据 + LLM(${llmResult.llmUsed ? '已调用' : '未调用'})`,
      template_sections: templateSections,
      llm_sections: llmSections,
      needs_review_count: sections.filter(s => s.needsReview).length,
      methodology: '模板段确定性填充 + LLM评述段生成'
    };

    return new SkillResult({
      ok: true,
      data: {
        docType: docType || 'brief',
        title: llmParsed ? llmParsed.title : `${template.name} - ${event ? event.title || eventId : ''}`,
        sections,
        fullText,
        evidence,
        llmUsed: llmResult.llmUsed
      },
      meta: { skillName: 'DocDraft', skillVersion: '1.1.0', detLevel: 'D3', llmUsed: llmResult.llmUsed, model: llmResult.model, evidence }
    });
  }
};
