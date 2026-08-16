// 常态化报告制度 —— 日报告/零报告/节点报告 + 催报（机制通用，指标按类型差异化）
const { load, save, uid, now } = require('./store');
const { resolveEventType } = require('./eventTypes');

// 报告三类
const REPORT_TYPES = { daily: '日报告', zero: '零报告', milestone: '节点报告' };

// 指标模板（按事件类型差异化）
const METRIC_TEMPLATES = {
  INF: ['新增病例', '累计病例', '新增密接', '在管密接', '解除密接', '核酸检测数', '阳性数'],
  FOOD: ['新增病例', '累计病例', '暴露餐次排查数', '留样检测数', '涉事单位处置数'],
  ENV: ['暴露人群新增', '在监护人数', '环境监测点数', '超标点数', '环境消除进度%'],
  POISON: ['新增中毒', '累计中毒', '危害因素检测数', '场所管控数'],
  UNK: ['新增病例', '累计病例', '多路径排查数', '样本送检数', '会商次数'],
  COMMON: ['出动人数', '在办任务', '物资消耗', '床位占用']
};

function metricTemplate(typeKey) {
  return [...(METRIC_TEMPLATES[typeKey] || METRIC_TEMPLATES.COMMON), ...METRIC_TEMPLATES.COMMON];
}

// 今日日期串
function todayStr() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 提交报告（日/零）
function submitReport(data, byUser) {
  const list = load('routine_reports');
  const ts = now();
  const r = {
    id: uid('rr'),
    eventId: data.eventId || '',
    typeKey: data.typeKey || '',
    reportType: data.reportType || 'daily',
    reportDate: data.reportDate || todayStr(),
    metrics: data.metrics || {},
    milestone: data.milestone || null,
    status: 'submitted',
    dueAt: data.dueAt || null,
    submittedAt: ts,
    submittedBy: byUser,
    createdAt: ts
  };
  list.push(r);
  save('routine_reports', list);
  return r;
}

// 节点报告自动生成（被其他模块调用）
function autoMilestone(eventId, milestone, detail, byUser) {
  const events = load('events');
  const e = events.find(x => x.id === eventId) || {};
  return submitReport({
    eventId,
    typeKey: e.typeKey || '',
    reportType: 'milestone',
    milestone,
    metrics: { 节点: milestone, 详情: detail || '' }
  }, byUser || 'system');
}

// 今日待报/逾期未报（催报清单）
// 规则：每个在办事件每日应有1条日报告或零报告；到16:00未报为待报，跨天为逾期
function pendingReports() {
  const events = load('events').filter(e => e.status !== 'closed');
  const reports = load('routine_reports');
  const today = todayStr();
  const nowDate = new Date();
  const hour = nowDate.getHours();

  const pending = [];
  events.forEach(e => {
    const hasToday = reports.some(r => r.eventId === e.id && r.reportDate === today && (r.reportType === 'daily' || r.reportType === 'zero'));
    if (!hasToday) {
      const isLate = hour >= 16; // 16点后算逾期
      pending.push({
        eventId: e.id,
        title: e.title,
        typeKey: e.typeKey,
        reportDate: today,
        status: isLate ? 'late' : 'pending',
        dueTip: isLate ? '已逾期未报' : '今日待报(16:00截止)'
      });
    }
  });
  return pending;
}

// 报告日历（近N天，某天是否已报）
function reportCalendar(eventId, days = 14) {
  const reports = load('routine_reports').filter(r => !eventId || r.eventId === eventId);
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const p = n => String(n).padStart(2, '0');
    const ds = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    const dayReports = reports.filter(r => r.reportDate === ds && (r.reportType === 'daily' || r.reportType === 'zero'));
    result.push({
      date: ds,
      reported: dayReports.length > 0,
      count: dayReports.length,
      type: dayReports[0] ? dayReports[0].reportType : null
    });
  }
  return result;
}

module.exports = { REPORT_TYPES, METRIC_TEMPLATES, metricTemplate, submitReport, autoMilestone, pendingReports, reportCalendar, todayStr };
