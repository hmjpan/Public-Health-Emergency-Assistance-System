// Skill: CriteriaCheck — 阶段完成标准校验
// 包装 workflow.js 的 checkLaunchComplete() + checkFieldComplete()，共享 Skill
// v1.1.0: 增加 evidence chain
const { SkillResult } = require('../skill-base');
const workflow = require('../../workflow');

module.exports = {
  name: 'CriteriaCheck',
  version: '1.1.0',
  agent: null, // 共享 Skill
  detLevel: 'D0',
  description: '依据预案规定的阶段门禁标准，校验当前阶段完成条件是否达成（启动阶段：人员出发+物资装车+车辆就位；现场阶段：关键任务完成+表单回传+零阻塞）',
  inputSchema: {
    eventId: 'string',
    stage: 'responding|field'
  },
  outputSchema: {
    allReady: 'boolean', detail: 'object',
    evidence: 'object{provenance, criteria_total, criteria_passed, missing_evidence}'
  },
  async execute(input) {
    const { eventId, stage } = input || {};
    if (!eventId) {
      return new SkillResult({
        ok: false, error: '缺少 eventId',
        meta: { skillName: 'CriteriaCheck', skillVersion: '1.1.0', detLevel: 'D0', llmUsed: false, evidence: { provenance: 'workflow.js', methodology: '输入校验失败' } }
      });
    }

    let check;
    if (stage === 'field') {
      check = workflow.checkFieldComplete(eventId);
    } else {
      check = workflow.checkLaunchComplete(eventId);
    }

    // 统计校验条目
    const detail = check.detail || {};
    const groups = detail.groups || [];
    const materials = detail.materials || [];
    const vehicles = detail.vehicles || [];
    const totalCriteria = groups.length + materials.length + vehicles.length;
    const passedGroups = groups.filter(g => g.ready >= g.total).length;
    const passedMaterials = materials.filter(m => m.status === 'ready' || m.status === 'loaded').length;
    const passedVehicles = vehicles.filter(v => v.status === 'ready' || v.status === 'departed').length;
    const criteriaPassed = passedGroups + passedMaterials + passedVehicles;

    const evidence = {
      provenance: 'workflow.js + 人员/物资/车辆/任务数据表',
      criteria_total: totalCriteria,
      criteria_passed: criteriaPassed,
      missing_evidence: check.allReady ? [] : ['部分完成标准未达成，详见detail']
    };

    return new SkillResult({
      ok: true,
      data: {
        stage,
        allReady: check.allReady,
        detail: check.detail,
        evidence
      },
      meta: { skillName: 'CriteriaCheck', skillVersion: '1.1.0', detLevel: 'D0', llmUsed: false, evidence }
    });
  }
};
