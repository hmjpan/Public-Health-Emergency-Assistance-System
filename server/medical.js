// 医疗救治与资源调度 —— 业务逻辑：病例状态机 + 资源聚合 + 预警规则
const { load, save, uid, now } = require('./store');

/* ================= 病例状态机 ================= */
const CASE_STATUS = {
  pending_transfer: '待转运',
  transferring: '转运中',
  received: '已接诊',
  observing: '留观中',
  admitted: '已收治',
  icu: '重症监护',
  discharged: '已出院',
  transferred_out: '已转院',
  dead: '死亡'
};

// 允许的状态流转白名单
const CASE_FLOW = {
  pending_transfer: ['transferring'],
  transferring: ['received'],
  received: ['observing', 'admitted'],
  observing: ['admitted', 'discharged', 'transferred_out'],
  admitted: ['icu', 'discharged', 'transferred_out'],
  icu: ['admitted', 'discharged', 'transferred_out', 'dead'],
  discharged: [], transferred_out: [], dead: []
};

// 节点超时标红阈值（小时）
const NODE_TIMEOUT_H = { pending_transfer: 2, transferring: 1 };

const TERMINAL = ['discharged', 'transferred_out', 'dead'];

function canTransition(from, to) {
  return (CASE_FLOW[from] || []).includes(to);
}

// 生成唯一追踪编号 CASE-YYYYMMDD-####
function genTrackNo() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  const day = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  const cases = load('cases');
  const todayCount = cases.filter(c => (c.trackNo || '').includes(day)).length;
  return `CASE-${day}-${String(todayCount + 1).padStart(4, '0')}`;
}

// 登记病例（流调确认后调用）
function registerCase(data, byUser) {
  const cases = load('cases');
  const ts = now();
  const c = {
    id: uid('case'),
    trackNo: genTrackNo(),
    eventId: data.eventId || '',
    name: data.name || '未命名',
    gender: data.gender || '',
    age: data.age || '',
    idCard: data.idCard || '',
    phone: data.phone || '',
    address: data.address || '',
    onsetAt: data.onsetAt || null,
    confirmAt: data.confirmAt || ts,
    severity: data.severity || 'moderate',
    status: 'pending_transfer',
    statusHistory: [{ status: 'pending_transfer', at: ts, by: byUser || 'system', note: '病例登记' }],
    hospitalId: data.hospitalId || null,
    isolationType: data.isolationType || 'none',
    sourceCaseId: data.sourceCaseId || null,
    outcome: null,
    createdAt: ts,
    updatedAt: ts,
    createdBy: byUser || 'system'
  };
  cases.push(c);
  save('cases', cases);
  return c;
}

// 状态流转（校验白名单 + 留痕）
function transitionCase(caseId, toStatus, note, byUser) {
  const cases = load('cases');
  const c = cases.find(x => x.id === caseId);
  if (!c) return { ok: false, error: '病例不存在' };
  if (TERMINAL.includes(c.status)) return { ok: false, error: '病例已是终态(' + CASE_STATUS[c.status] + ')' };
  if (!canTransition(c.status, toStatus)) {
    return { ok: false, error: `不允许从[${CASE_STATUS[c.status]}]转到[${CASE_STATUS[toStatus] || toStatus}]` };
  }
  const ts = now();
  c.status = toStatus;
  c.statusHistory.push({ status: toStatus, at: ts, by: byUser || 'system', note: note || '' });
  if (TERMINAL.includes(toStatus)) {
    c.outcome = toStatus === 'discharged' ? 'discharged' : toStatus === 'transferred_out' ? 'transferred' : 'dead';
  }
  c.updatedAt = ts;
  save('cases', cases);
  return { ok: true, data: c };
}

// 判断病例是否异常（超时停留 / 病情加重）
function isCaseAbnormal(c) {
  if (TERMINAL.includes(c.status)) return null;
  const timeout = NODE_TIMEOUT_H[c.status];
  if (timeout) {
    // 找当前状态进入时间
    const hist = (c.statusHistory || []).filter(h => h.status === c.status);
    const entered = hist.length ? new Date(hist[hist.length - 1].at) : new Date(c.updatedAt);
    const elapsedH = (Date.now() - entered.getTime()) / 3600000;
    if (elapsedH > timeout) {
      return { kind: 'timeout', msg: `${CASE_STATUS[c.status]}已${elapsedH.toFixed(1)}h,超阈值${timeout}h` };
    }
  }
  if (c.severity === 'severe' || c.severity === 'critical') {
    return { kind: 'severity', msg: c.severity === 'critical' ? '危重病例' : '重症病例' };
  }
  return null;
}

// 病例汇总看板
function caseBoard(eventId) {
  let cases = load('cases');
  if (eventId) cases = cases.filter(c => c.eventId === eventId);
  const byStatus = {};
  Object.keys(CASE_STATUS).forEach(s => byStatus[s] = 0);
  const abnormal = [];
  cases.forEach(c => {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    const ab = isCaseAbnormal(c);
    if (ab) abnormal.push({ id: c.id, trackNo: c.trackNo, name: c.name, status: c.status, statusName: CASE_STATUS[c.status], ...ab });
  });
  return {
    total: cases.length,
    byStatus: Object.keys(byStatus).map(k => ({ status: k, name: CASE_STATUS[k], count: byStatus[k] })).filter(x => x.count > 0 || ['pending_transfer','transferring','received','observing','admitted','icu','discharged'].includes(x.status)),
    active: cases.filter(c => !TERMINAL.includes(c.status)).length,
    discharged: byStatus.discharged,
    dead: byStatus.dead,
    abnormal
  };
}

/* ================= 医疗资源 ================= */
// 计算机构衍生指标 + 预警
function enrichHospital(h) {
  const bedAvail = (h.bedTotal || 0) - (h.bedOccupied || 0);
  const icuAvail = (h.icuTotal || 0) - (h.icuOccupied || 0);
  const bedRate = h.bedTotal ? Math.round((h.bedOccupied || 0) / h.bedTotal * 100) : 0;
  const alerts = [];
  if (h.bedTotal && bedAvail / h.bedTotal < 0.15) alerts.push('床位告急');
  if (h.icuTotal && icuAvail === 0) alerts.push('ICU满负荷');
  return { ...h, bedAvail, icuAvail, bedRate, alerts };
}

// 资源汇总看板（跨机构）
function resourceBoard() {
  const hospitals = load('hospitals').map(enrichHospital);
  const devices = load('devices');
  const medicines = load('medicines');

  const sum = (arr, k) => arr.reduce((a, b) => a + (Number(b[k]) || 0), 0);
  const hosp = {
    count: hospitals.length,
    bedTotal: sum(hospitals, 'bedTotal'),
    bedOccupied: sum(hospitals, 'bedOccupied'),
    bedAvail: sum(hospitals, 'bedAvail'),
    bedReserve: sum(hospitals, 'bedReserve'),
    icuTotal: sum(hospitals, 'icuTotal'),
    icuOccupied: sum(hospitals, 'icuOccupied'),
    icuAvail: sum(hospitals, 'icuAvail'),
    staffOnDuty: sum(hospitals, 'staffOnDuty'),
    staffAvailable: sum(hospitals, 'staffAvailable')
  };

  // 设备按名称聚合
  const devMap = {};
  devices.forEach(d => {
    const g = devMap[d.name] = devMap[d.name] || { name: d.name, total: 0, inUse: 0, available: 0 };
    g.total += d.total || 0; g.inUse += d.inUse || 0; g.available += d.available || 0;
  });

  // 药品预警
  const medList = medicines.map(m => {
    const daysLeft = m.dailyUse ? +( (m.stock || 0) / m.dailyUse ).toFixed(1) : 999;
    const low = m.threshold != null && daysLeft < m.threshold;
    return { ...m, daysLeft, low };
  });
  const lowMedicines = medList.filter(m => m.low);

  // 机构预警
  const hospAlerts = hospitals.filter(h => h.alerts.length).map(h => ({ id: h.id, name: h.name, alerts: h.alerts }));

  return {
    hospitals: hospitals.map(h => ({ id: h.id, name: h.name, level: h.level, bedTotal: h.bedTotal, bedOccupied: h.bedOccupied, bedAvail: h.bedAvail, bedReserve: h.bedReserve, icuTotal: h.icuTotal, icuOccupied: h.icuOccupied, icuAvail: h.icuAvail, staffOnDuty: h.staffOnDuty, staffAvailable: h.staffAvailable, bedRate: h.bedRate, alerts: h.alerts })),
    summary: hosp,
    devices: Object.values(devMap),
    medicines: medList,
    alerts: {
      hospitals: hospAlerts,
      lowMedicines: lowMedicines.map(m => ({ id: m.id, name: m.name, daysLeft: m.daysLeft, threshold: m.threshold })),
      lowDevices: Object.values(devMap).filter(d => d.available === 0).map(d => ({ name: d.name }))
    }
  };
}

// 药品库存更新（自动重算）
function updateMedicine(id, patch) {
  const list = load('medicines');
  const m = list.find(x => x.id === id);
  if (!m) return null;
  ['stock', 'dailyUse', 'threshold', 'name'].forEach(k => { if (patch[k] !== undefined) m[k] = patch[k]; });
  m.updatedAt = now();
  save('medicines', list);
  return m;
}

module.exports = {
  CASE_STATUS, CASE_FLOW, TERMINAL,
  canTransition, registerCase, transitionCase, isCaseAbnormal, caseBoard,
  enrichHospital, resourceBoard, updateMedicine
};
