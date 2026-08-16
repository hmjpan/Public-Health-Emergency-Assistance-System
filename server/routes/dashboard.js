// 决策全景 —— 决策层实时掌握全盘动态（响应状态/物资/任务/时间线/待决策/通知反馈）
const { Router } = require('express');
const { load } = require('../store');
const { requirePerm } = require('../rbac');
const { buildOverview, checkLaunchComplete, checkFieldComplete } = require('../workflow');
const { caseBoard, resourceBoard } = require('../medical');

const router = Router();

// 全景总览
router.get('/overview', requirePerm('dashboard:view'), (req, res) => {
  const events = load('events').filter(e => e.status !== 'closed');
  const allEvents = load('events');
  const reports = load('reports').filter(r => r.status === 'pending');
  const personnel = load('personnel');
  const materials = load('materials');
  const tasks = load('tasks');
  const notifications = load('notifications');
  const requests = load('requests').filter(r => r.status === 'pending');

  const active = events.map(e => {
    const evPersonnel = personnel.filter(p => p.eventId === e.id);
    const evMaterials = materials.filter(m => m.eventId === e.id);
    const evTasks = tasks.filter(t => t.eventId === e.id);
    return {
      ...buildOverview(e),
      personnelTotal: evPersonnel.length,
      personnelArrived: evPersonnel.filter(p => p.status === 'arrived').length,
      personnelDeparted: evPersonnel.filter(p => p.status === 'departed').length,
      materialTotal: evMaterials.length,
      materialShortage: evMaterials.filter(m => m.shortage).length,
      taskTotal: evTasks.length,
      taskDone: evTasks.filter(t => t.status === 'done').length,
      taskBlocked: evTasks.filter(t => t.status === 'blocked').length
    };
  });

  res.json({
    ok: true,
    data: {
      activeEvents: active,
      totalEvents: allEvents.length,
      pendingReports: reports,
      pendingRequests: requests,
      // 通知反馈统计
      notifTotal: notifications.length,
      notifAcked: notifications.filter(n => n.status === 'acked').length,
      notifEscalated: notifications.filter(n => n.status === 'escalated').length,
      // 医疗救治（M08）
      caseBoard: caseBoard(),
      resourceSummary: (() => { const rb = resourceBoard(); return { summary: rb.summary, alertCount: rb.alerts.hospitals.length + rb.alerts.lowMedicines.length + rb.alerts.lowDevices.length, alerts: rb.alerts }; })(),
      // KPI
      kpi: {
        active: events.length,
        totalEvents: allEvents.length,
        closedEvents: allEvents.filter(e => e.status === 'closed').length,
        pendingReports: reports.length,
        onDuty: personnel.filter(p => ['departed', 'arrived'].includes(p.status)).length,
        blockedTasks: tasks.filter(t => t.status === 'blocked').length,
        escalated: notifications.filter(n => n.status === 'escalated').length,
        activeCases: caseBoard().active,
        routineLate: (() => { try { return require('../routine').pendingReports().filter(r => r.status === 'late').length; } catch (e) { return 0; } })(),
        materialShortage: materials.filter(m => m.shortage).length
      }
    }
  });
});

// 单事件指挥看板
router.get('/event/:id', requirePerm('dashboard:view'), (req, res) => {
  const e = load('events').find(x => x.id === req.params.id);
  if (!e) return res.json({ ok: false, error: '事件不存在' });
  const personnel = load('personnel').filter(p => p.eventId === e.id);
  const materials = load('materials').filter(m => m.eventId === e.id);
  const vehicles = load('vehicles').filter(v => v.eventId === e.id);
  const tasks = load('tasks').filter(t => t.eventId === e.id);
  const briefs = load('briefs').filter(b => b.eventId === e.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const instructions = load('instructions').filter(i => i.eventId === e.id).sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
  const timeline = load('timeline').filter(t => t.eventId === e.id).sort((a, b) => new Date(b.at) - new Date(a.at));
  const requests = load('requests').filter(r => r.eventId === e.id);

  res.json({
    ok: true,
    data: {
      event: buildOverview(e),
      personnel, materials, vehicles, tasks,
      latestBrief: briefs[0] || null,
      briefs: briefs.slice(0, 5),
      instructions: instructions.slice(0, 10),
      timeline: timeline.slice(0, 20),
      requests,
      launchCheck: checkLaunchComplete(e.id),
      fieldCheck: checkFieldComplete(e.id)
    }
  });
});

module.exports = router;
