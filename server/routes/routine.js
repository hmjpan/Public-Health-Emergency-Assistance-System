// 常态化报告 —— 接口
const { Router } = require('express');
const { load } = require('../store');
const { requirePerm } = require('../rbac');
const { REPORT_TYPES, metricTemplate, submitReport, pendingReports, reportCalendar } = require('../routine');

const router = Router();

// 报告指标模板（按事件类型）
router.get('/templates', (req, res) => {
  res.json({ ok: true, data: { types: REPORT_TYPES, metrics: metricTemplate(req.query.typeKey) } });
});

// 提交报告
router.post('/', (req, res) => {
  if (!req.user) return res.json({ ok: false, error: '未登录' });
  const b = req.body || {};
  if (!b.reportType) return res.json({ ok: false, error: '缺少reportType' });
  const r = submitReport(b, req.user.name);
  res.json({ ok: true, data: r });
});

// 报告列表
router.get('/', (req, res) => {
  const { eventId, reportType, date } = req.query;
  let list = load('routine_reports');
  if (eventId) list = list.filter(r => r.eventId === eventId);
  if (reportType) list = list.filter(r => r.reportType === reportType);
  if (date) list = list.filter(r => r.reportDate === date);
  list = list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ ok: true, data: list });
});

// 催报清单（今日待报/逾期）
router.get('/pending', (req, res) => {
  res.json({ ok: true, data: pendingReports() });
});

// 报告日历
router.get('/calendar', (req, res) => {
  res.json({ ok: true, data: reportCalendar(req.query.eventId, +(req.query.days) || 14) });
});

module.exports = router;
