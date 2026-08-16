// 统计报表 -- 多维度数据聚合，供统计模块与指挥大屏消费
const { Router } = require('express');
const { load } = require('../store');
const { requirePerm } = require('../rbac');
const { caseBoard } = require('../medical');

const router = Router();

// 演练过滤：默认排除演练事件，?includeDrill=1 包含
function filterDrill(req, name, idField) {
  const includeDrill = req.query.includeDrill === '1';
  let list = load(name);
  if (includeDrill) return list;
  const drillEventIds = new Set(load('events').filter(e => e.isDrill).map(e => e.id));
  if (name === 'events') return list.filter(e => !e.isDrill);
  if (name === 'cases' || name === 'personnel' || name === 'tasks' || name === 'reports') {
    return list.filter(x => !x.eventId || !drillEventIds.has(x.eventId));
  }
  return list;
}

function range(start, end) {
  return new Date(start).getTime() <= Date.now() && new Date(end || start).getTime() >= new Date('2000-01-01').getTime();
}

// 总览KPI + 趋势
router.get('/overview', requirePerm('dashboard:view'), (req, res) => {
  const events = filterDrill(req, 'events');
  const cases = filterDrill(req, 'cases');
  const reports = filterDrill(req, 'reports');
  const personnel = filterDrill(req, 'personnel');
  const tasks = filterDrill(req, 'tasks');
  const notifications = load('notifications');
  const pendingReports = require('../routine').pendingReports();

  // 近7天事件趋势
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const p = n => String(n).padStart(2, '0');
    const ds = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    const dayEvents = events.filter(e => e.createdAt.slice(0, 10) === ds).length;
    const dayCases = cases.filter(c => c.createdAt.slice(0, 10) === ds).length;
    trend.push({ date: ds.slice(5), events: dayEvents, cases: dayCases });
  }

  res.json({
    ok: true,
    data: {
      kpi: {
        totalEvents: events.length,
        activeEvents: events.filter(e => e.status !== 'closed').length,
        closedEvents: events.filter(e => e.status === 'closed').length,
        totalCases: cases.length,
        activeCases: cases.filter(c => !['discharged', 'transferred_out', 'dead'].includes(c.status)).length,
        totalReports: reports.length,
        pendingReports: reports.filter(r => r.status === 'pending').length,
        onDuty: personnel.filter(p => ['departed', 'arrived'].includes(p.status)).length,
        blockedTasks: tasks.filter(t => t.status === 'blocked').length,
        escalated: notifications.filter(n => n.status === 'escalated').length,
        routineLate: pendingReports.length
      },
      trend
    }
  });
});

// 事件类型分布（饼图）
router.get('/event-types', requirePerm('dashboard:view'), (req, res) => {
  const events = filterDrill(req, 'events');
  const typeMap = {};
  events.forEach(e => {
    const k = e.typeKey || 'UNK';
    typeMap[k] = (typeMap[k] || 0) + 1;
  });
  const typeNames = { INF: '传染病', FOOD: '食源性', ENV: '环境污染', POISON: '职业中毒', UNK: '原因不明' };
  res.json({
    ok: true,
    data: Object.keys(typeMap).map(k => ({ name: typeNames[k] || k, value: typeMap[k] }))
  });
});

// 病例状态分布 + 严重程度
router.get('/cases', requirePerm('case:read'), (req, res) => {
  const cases = filterDrill(req, 'cases');
  const statusNames = { pending_transfer: '待转运', transferring: '转运中', received: '已接诊', observing: '留观', admitted: '已收治', icu: '重症监护', discharged: '已出院', transferred_out: '已转院', dead: '死亡' };
  const byStatus = {};
  cases.forEach(c => byStatus[c.status] = (byStatus[c.status] || 0) + 1);
  const sevMap = { mild: '轻症', moderate: '普通', severe: '重症', critical: '危重' };
  const bySeverity = {};
  cases.forEach(c => bySeverity[c.severity] = (bySeverity[c.severity] || 0) + 1);
  res.json({
    ok: true,
    data: {
      byStatus: Object.keys(byStatus).map(k => ({ name: statusNames[k] || k, value: byStatus[k] })),
      bySeverity: Object.keys(bySeverity).map(k => ({ name: sevMap[k] || k, value: bySeverity[k] }))
    }
  });
});

// 响应时效分析（事件从上报/创建到各阶段时长）
router.get('/sla', requirePerm('dashboard:view'), (req, res) => {
  const events = filterDrill(req, 'events');
  const timeline = load('timeline');
  const result = events.map(e => {
    const tl = timeline.filter(t => t.eventId === e.id).sort((a, b) => new Date(a.at) - new Date(b.at));
    const start = tl[0] ? new Date(tl[0].at) : new Date(e.createdAt);
    const launch = tl.find(t => t.action === '一键启动');
    const advance = tl.filter(t => t.action === '阶段推进');
    const toField = advance.length ? new Date(advance[0].at) : null;
    const close = e.closedAt ? new Date(e.closedAt) : null;
    const h = (a, b) => b && a ? +((b - a) / 3600000).toFixed(1) : null;
    return {
      id: e.id, title: e.title, typeKey: e.typeKey, level: e.level, status: e.status,
      launchH: h(start, launch ? new Date(launch.at) : start),
      toFieldH: h(start, toField),
      totalH: h(start, close || new Date()),
      isClosed: e.status === 'closed'
    };
  });
  const avg = arr => { const v = arr.filter(x => x != null); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : 0; };
  res.json({
    ok: true,
    data: {
      events: result,
      summary: {
        avgLaunchH: avg(result.map(r => r.launchH)),
        avgToFieldH: avg(result.map(r => r.toFieldH)),
        avgTotalH: avg(result.map(r => r.totalH))
      }
    }
  });
});

// 资源占用看板（跨机构聚合）
router.get('/resources', requirePerm('resource:read'), (req, res) => {
  const hospitals = load('hospitals');
  const devices = load('devices');
  const medicines = load('medicines');
  const sum = (arr, k) => arr.reduce((a, b) => a + (Number(b[k]) || 0), 0);
  // 各机构床位占用率
  const hospRate = hospitals.map(h => ({
    name: h.name,
    bedRate: h.bedTotal ? Math.round(h.bedOccupied / h.bedTotal * 100) : 0,
    icuRate: h.icuTotal ? Math.round(h.icuOccupied / h.icuTotal * 100) : 0
  }));
  // 设备按名称聚合
  const devMap = {};
  devices.forEach(d => {
    const g = devMap[d.name] = devMap[d.name] || { name: d.name, total: 0, inUse: 0, available: 0 };
    g.total += d.total || 0; g.inUse += d.inUse || 0; g.available += d.available || 0;
  });
  // 药品可用天数
  const medDays = medicines.map(m => ({
    name: m.name,
    daysLeft: m.dailyUse ? +((m.stock || 0) / m.dailyUse).toFixed(1) : 999
  }));
  res.json({
    ok: true,
    data: {
      hospRate,
      devices: Object.values(devMap),
      medDays,
      summary: {
        bedTotal: sum(hospitals, 'bedTotal'), bedOccupied: sum(hospitals, 'bedOccupied'),
        icuTotal: sum(hospitals, 'icuTotal'), icuOccupied: sum(hospitals, 'icuOccupied'),
        staffOnDuty: sum(hospitals, 'staffOnDuty'), staffAvailable: sum(hospitals, 'staffAvailable')
      }
    }
  });
});

// 报告合规率（按事件统计日/零报告完成情况）
router.get('/routine-compliance', requirePerm('dashboard:view'), (req, res) => {
  const events = filterDrill(req, 'events').filter(e => e.status !== 'closed');
  const routineReports = load('routine_reports');
  const { reportCalendar } = require('../routine');
  const result = events.map(e => {
    const cal = reportCalendar(e.id, 7);
    const reported = cal.filter(d => d.reported).length;
    return { id: e.id, title: e.title, typeKey: e.typeKey, reported, total: 7, rate: Math.round(reported / 7 * 100) };
  });
  res.json({ ok: true, data: result });
});

module.exports = router;
