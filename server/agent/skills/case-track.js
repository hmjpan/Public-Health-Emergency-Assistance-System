// Skill: CaseTrack — 病例全流程分析
// Medical 专属，确定性统计 + LLM趋势分析
// v1.1.0: 流行病学指标 + 预警阈值 + 证据链 + Guardrail
const { SkillResult } = require('../skill-base');
const llm = require('../llm/provider');
const { load } = require('../../store');

// 预警阈值
const ALERT_THRESHOLDS = {
  severe_ratio: 0.10,      // 重症比例 > 10% 预警
  case_fatality_rate: 0.01, // 病死率 > 1% 预警
  daily_increase_days: 3    // 连续3日增长预警
};

// 病例严重程度映射（兼容多种输入）
function normalizeSeverity(sev) {
  if (!sev) return '未知';
  const s = String(sev).trim();
  if (['轻症', '轻', 'mild', 'MILD'].includes(s)) return '轻症';
  if (['普通型', '普通', 'moderate', 'MODERATE', '中等'].includes(s)) return '普通型';
  if (['重症', '重', 'severe', 'SEVERE'].includes(s)) return '重症';
  if (['危重症', '危重', 'critical', 'CRITICAL'].includes(s)) return '危重症';
  return s; // 保持原值
}

// 计算流行病学指标（确定性计算）
function calcEpiIndicators(cases) {
  const total = cases.length;
  const deaths = cases.filter(c => c.outcome === '死亡' || c.status === '死亡').length;
  const severeCount = cases.filter(c => {
    const sev = normalizeSeverity(c.severity);
    return sev === '重症' || sev === '危重症';
  }).length;

  return {
    total_cases: total,
    deaths,
    severe_count: severeCount,
    attack_rate: '暂无暴露人口数据（需提供暴露人口总数）',
    case_fatality_rate: total > 0 ? `${(deaths / total * 100).toFixed(1)}% (${deaths}/${total})` : 'N/A',
    case_fatality_rate_value: total > 0 ? deaths / total : null,
    severe_ratio: total > 0 ? `${(severeCount / total * 100).toFixed(1)}% (${severeCount}/${total})` : 'N/A',
    severe_ratio_value: total > 0 ? severeCount / total : null
  };
}

// 分析时间趋势
function analyzeTrend(cases) {
  // 按发病日期统计
  const byDate = {};
  cases.forEach(c => {
    const date = c.onsetDate || c.startDate;
    if (date) {
      const d = date.slice(0, 10); // YYYY-MM-DD
      byDate[d] = (byDate[d] || 0) + 1;
    }
  });

  const dates = Object.keys(byDate).sort();
  if (dates.length < 2) return { trend: '数据不足', trend_analysis: '病例数据不足2日，无法判断趋势' };

  // 最近3日趋势
  const recentDates = dates.slice(-ALERT_THRESHOLDS.daily_increase_days);
  let increasing = true;
  let decreasing = true;
  for (let i = 1; i < recentDates.length; i++) {
    const prev = byDate[recentDates[i - 1]] || 0;
    const curr = byDate[recentDates[i]] || 0;
    if (curr <= prev) increasing = false;
    if (curr >= prev) decreasing = false;
  }

  let trend, trend_analysis;
  if (increasing) {
    trend = '上升';
    trend_analysis = `近${recentDates.length}日新增病例持续增长，提示传播链未阻断`;
  } else if (decreasing) {
    trend = '下降';
    trend_analysis = `近${recentDates.length}日新增病例持续减少，控制措施可能有效`;
  } else {
    trend = '平稳';
    trend_analysis = '新增病例数波动，建议持续监测';
  }

  return { trend, trend_analysis, daily_counts: byDate, recent_dates: recentDates };
}

// 生成预警
function generateAlerts(indicators, trendInfo) {
  const alerts = [];

  if (indicators.severe_ratio_value !== null && indicators.severe_ratio_value > ALERT_THRESHOLDS.severe_ratio) {
    alerts.push(`重症比例达${(indicators.severe_ratio_value * 100).toFixed(1)}%，超过${ALERT_THRESHOLDS.severe_ratio * 100}%预警阈值`);
  }
  if (indicators.case_fatality_rate_value !== null && indicators.case_fatality_rate_value > ALERT_THRESHOLDS.case_fatality_rate) {
    alerts.push(`病死率达${(indicators.case_fatality_rate_value * 100).toFixed(1)}%，超过${ALERT_THRESHOLDS.case_fatality_rate * 100}%预警阈值`);
  }
  if (trendInfo.trend === '上升') {
    alerts.push('新增病例持续' + trendInfo.trend + '，建议关注');
  }
  if (indicators.deaths > 0) {
    alerts.push(`已有${indicators.deaths}例死亡`);
  }

  return alerts;
}

const SYSTEM_PROMPT = `你是公共卫生医疗救治专家。根据病例统计数据，分析趋势并给出建议。

分析要点：
1. 病例趋势（上升/平稳/下降）的原因分析
2. 严重程度评估（轻症/普通型/重症/危重症分布）
3. 风险因素识别（高风险人群、场所、行为）
4. 预警信息（指标异常、趋势异常）
5. 防控建议（针对性措施）

输出 JSON 格式（不要输出其他内容）：
{"trend_analysis": "趋势深度分析", "severity": "轻|中|重", "alerts": ["预警信息"], "suggestions": ["建议措施"], "risk_factors": ["风险因素"]}`;

module.exports = {
  name: 'CaseTrack',
  version: '1.1.0',
  agent: 'medical',
  detLevel: 'D3',
  description: '依据流行病学分析框架，对病例全流程数据进行确定性统计（罹患率/病死率/重症比例）+ LLM趋势分析，输出预警建议和风险因素',
  inputSchema: {
    eventId: 'string',
    cases: 'array (可选) - 病例列表',
    typeKey: 'string (可选) - 事件类型'
  },
  outputSchema: {
    trend: 'string',
    trend_analysis: 'string',
    severity: 'string',
    severity_distribution: 'object',
    epi_indicators: 'object',
    alerts: 'array',
    suggestions: 'array',
    risk_factors: 'array',
    stats: 'object',
    evidence: 'object'
  },
  async execute(input) {
    const { eventId, cases: inputCases, typeKey } = input || {};

    // 加载病例数据
    let cases = inputCases;
    if (!cases && eventId) {
      cases = load('cases').filter(c => c.eventId === eventId);
    }
    cases = cases || [];

    // ---- 确定性统计 ----
    const stats = {
      total: cases.length,
      byStatus: {},
      bySeverity: {}
    };
    cases.forEach(c => {
      stats.byStatus[c.status] = (stats.byStatus[c.status] || 0) + 1;
      const sev = normalizeSeverity(c.severity);
      stats.bySeverity[sev] = (stats.bySeverity[sev] || 0) + 1;
    });

    // 流行病学指标
    const epiIndicators = calcEpiIndicators(cases);

    // 趋势分析
    const trendInfo = analyzeTrend(cases);

    // 预警生成
    const autoAlerts = generateAlerts(epiIndicators, trendInfo);

    // 严重程度整体评估
    const severeRatio = epiIndicators.severe_ratio_value || 0;
    const cfrValue = epiIndicators.case_fatality_rate_value || 0;
    let overallSeverity;
    if (cfrValue > 0.05 || severeRatio > 0.3) overallSeverity = '重';
    else if (cfrValue > 0.01 || severeRatio > 0.1) overallSeverity = '中';
    else overallSeverity = '轻';

    // ---- LLM分析 ----
    const summary = `事件${eventId || '未知'}，类型${typeKey || '未知'}，共${stats.total}例。
状态分布: ${JSON.stringify(stats.byStatus)}。
严重程度: ${JSON.stringify(stats.bySeverity)}。
流行病学指标: 病死率=${epiIndicators.case_fatality_rate}，重症比例=${epiIndicators.severe_ratio}。
趋势: ${trendInfo.trend}（${trendInfo.trend_analysis}）。
自动预警: ${autoAlerts.length > 0 ? autoAlerts.join('; ') : '无'}。`;

    const llmResult = await llm.chat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: summary }
    ], { temperature: 0.2 });

    let llmParsed = null;
    if (llmResult.llmUsed && llmResult.content) {
      try {
        const jsonMatch = llmResult.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) llmParsed = JSON.parse(jsonMatch[0]);
      } catch (e) { /* fallback */ }
    }

    // 合并预警（自动预警 + LLM预警）
    const allAlerts = [...autoAlerts];
    if (llmParsed && llmParsed.alerts) {
      llmParsed.alerts.forEach(a => { if (!allAlerts.includes(a)) allAlerts.push(a); });
    }

    // 构建证据链
    const evidence = {
      provenance: `cases数据表(${stats.total}例) + LLM(${llmResult.llmUsed ? '已调用' : '未调用'})`,
      total_cases: stats.total,
      indicators_calculated: ['attack_rate', 'case_fatality_rate', 'severe_ratio'].length,
      auto_alerts_count: autoAlerts.length,
      llm_used: llmResult.llmUsed,
      missing_evidence: cases.length === 0 ? ['无病例数据'] : (stats.total < 5 ? ['病例数<5，统计指标参考意义有限'] : []),
      methodology: '描述性流行病学统计（确定性）+ LLM趋势分析（辅助）'
    };

    return new SkillResult({
      ok: true,
      data: {
        trend: trendInfo.trend,
        trend_analysis: (llmParsed && llmParsed.trend_analysis) || trendInfo.trend_analysis,
        severity: (llmParsed && llmParsed.severity) || overallSeverity,
        severity_distribution: stats.bySeverity,
        epi_indicators: epiIndicators,
        alerts: allAlerts,
        suggestions: llmParsed ? (llmParsed.suggestions || ['建议持续监测病例变化']) : ['建议持续监测病例变化'],
        risk_factors: llmParsed ? (llmParsed.risk_factors || []) : [],
        stats,
        evidence
      },
      meta: {
        skillName: 'CaseTrack',
        skillVersion: '1.1.0',
        detLevel: 'D3',
        llmUsed: llmResult.llmUsed,
        model: llmResult.model,
        evidence
      }
    });
  }
};
