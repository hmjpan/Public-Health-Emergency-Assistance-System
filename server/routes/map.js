// 态势地图 API -- 事件/病例/重点人群/医院/人员 空间分布聚合
// 坐标策略：数据源无GPS字段，采用"确定性伪地理映射"：
//   按名称哈希落到城区网格(街道/乡镇分区)，同一实体坐标稳定可复现，适合演练与演示
const { Router } = require('express');
const { load } = require('../store');
const { requirePerm } = require('../rbac');

const router = Router();

// ---- 城区分区定义（演示城区：16个街道/乡镇网格，坐标系 0-1000 x 0-700）----
const DISTRICTS = [
  { key: 'cly', name: '春柳街道', x: 140, y: 130, type: 'urban', pop: 8.2 },
  { key: 'gxq', name: '高新区街道', x: 360, y: 110, type: 'urban', pop: 12.5 },
  { key: 'hty', name: '海天园街道', x: 600, y: 100, type: 'urban', pop: 9.8 },
  { key: 'xhk', name: '新华口街道', x: 850, y: 140, type: 'urban', pop: 10.4 },
  { key: 'mlh', name: '梅岭湖街道', x: 150, y: 300, type: 'urban', pop: 7.6 },
  { key: 'cqx', name: '城区西街道', x: 380, y: 290, type: 'urban', pop: 11.2 },
  { key: 'zwz', name: '中卫州街道', x: 620, y: 310, type: 'urban', pop: 13.1 },
  { key: 'dlt', name: '东联塘街道', x: 870, y: 300, type: 'urban', pop: 8.9 },
  { key: 'nmy', name: '南码头街道', x: 170, y: 490, type: 'urban', pop: 6.7 },
  { key: 'lxz', name: '老巷镇', x: 400, y: 480, type: 'town', pop: 4.3 },
  { key: 'qgy', name: '青果园镇', x: 640, y: 500, type: 'town', pop: 3.8 },
  { key: 'hbx', name: '河泊乡', x: 880, y: 490, type: 'rural', pop: 2.1 },
  { key: 'smt', name: '双庙屯乡', x: 220, y: 620, type: 'rural', pop: 1.8 },
  { key: 'xaj', name: '西安康乡', x: 470, y: 620, type: 'rural', pop: 1.5 },
  { key: 'jls', name: '九龙山乡', x: 700, y: 630, type: 'rural', pop: 1.2 },
  { key: 'bwd', name: '北外渡街道', x: 900, y: 640, type: 'rural', pop: 0.9 }
];

// 名称 -> 稳定哈希
function hash(s) {
  s = String(s || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}

// 实体 -> 分区内偏移坐标（确定性）
function geoOf(name, salt) {
  const h = hash(String(salt || '') + String(name || ''));
  const d = DISTRICTS[h % DISTRICTS.length];
  const dx = ((h >>> 8) % 90) - 45;   // 分区内 ±45
  const dy = ((h >>> 16) % 60) - 30;  // 分区内 ±30
  return {
    x: Math.max(20, Math.min(980, d.x + dx)),
    y: Math.max(20, Math.min(680, d.y + dy)),
    district: d.name, districtKey: d.key, districtType: d.type
  };
}

const TYPE_ICON = { INF: '🦠', FOOD: '🍱', ENV: '☣️', POISON: '⚗️', UNK: '❓' };

// GET /map/overview -- 态势地图聚合数据
router.get('/overview', requirePerm('dashboard:view'), (req, res) => {
  try {
    const events = (load('events') || []).filter(e => e.status !== 'closed');
    const cases = load('cases') || [];
    const contacts = load('contacts') || [];
    const personnel = load('personnel') || [];
    const hospitals = load('hospitals') || [];

    // ---- 事件点（含演练标记）----
    const eventPoints = events.map(e => ({
      id: e.id, title: e.title, typeKey: e.typeKey, typeName: e.typeName || '未分类',
      icon: TYPE_ICON[e.typeKey] || '❓', level: e.level, stage: e.stage,
      isDrill: !!e.isDrill, location: e.location || '', createdAt: e.createdAt,
      ...geoOf(e.id + e.title, 'ev')
    }));

    // ---- 病例点（按地址哈希；颜色按severity，尺寸按状态）----
    const SEV = { critical: '危重', severe: '重型', moderate: '普通型', mild: '轻型' };
    const casePoints = cases.map(c => ({
      id: c.id, trackNo: c.trackNo, name: c.name, eventId: c.eventId,
      severity: c.severity, severityName: SEV[c.severity] || c.severity,
      status: c.status, address: c.address || '', hospitalId: c.hospitalId || null,
      ...geoOf(c.address || c.id, 'case')
    }));

    // ---- 重点人群（密接/次密接，按隔离点与住址哈希）----
    const contactPoints = contacts.map(c => ({
      id: c.id, name: c.name, contactType: c.contactType, status: c.status,
      manageType: c.manageType, quarantineSite: c.quarantineSite || '',
      eventId: c.eventId,
      ...geoOf(c.quarantineSite || c.name, 'ct')
    }));

    // ---- 定点医院（床位占用率热度）----
    const hospitalPoints = hospitals.map(h => {
      const bedRate = h.bedTotal ? Math.round(h.bedOccupied / h.bedTotal * 100) : 0;
      return {
        id: h.id, name: h.name, level: h.level, designated: !!h.designated,
        bedTotal: h.bedTotal, bedOccupied: h.bedOccupied, bedRate,
        icuTotal: h.icuTotal, icuOccupied: h.icuOccupied,
        ...geoOf(h.name, 'hos')
      };
    });

    // ---- 出动人员（按组别聚类）----
    const groupPoints = [];
    const byGroup = {};
    personnel.forEach(p => {
      const g = p.group || '其他';
      if (!byGroup[g]) byGroup[g] = { total: 0, arrived: 0 };
      byGroup[g].total++;
      if (p.status === 'arrived') byGroup[g].arrived++;
    });
    Object.entries(byGroup).forEach(([g, v], i) => {
      const d = DISTRICTS[(hash('grp' + g) % (DISTRICTS.length - 4)) + 2]; // 避开边缘分区
      groupPoints.push({
        group: g, total: v.total, arrived: v.arrived,
        x: Math.max(30, Math.min(970, d.x + ((hash(g) >>> 6) % 60) - 30)),
        y: Math.max(30, Math.min(670, d.y + ((hash(g) >>> 12) % 40) - 20))
      });
    });

    // ---- 分区态势（每个街道的事件/病例/密接计数 -> 风险等级）----
    const districtStats = DISTRICTS.map(d => {
      const ev = eventPoints.filter(p => p.districtKey === d.key).length;
      const cs = casePoints.filter(p => p.districtKey === d.key).length;
      const ct = contactPoints.filter(p => p.districtKey === d.key).length;
      const score = ev * 3 + cs * 2 + ct;
      const risk = score >= 8 ? 'high' : score >= 3 ? 'mid' : score > 0 ? 'low' : 'none';
      return { ...d, events: ev, cases: cs, contacts: ct, risk, score };
    });

    res.json({
      ok: true,
      data: {
        districts: districtStats,
        events: eventPoints,
        cases: casePoints,
        contacts: contactPoints,
        hospitals: hospitalPoints,
        groups: groupPoints,
        summary: {
          events: eventPoints.length, cases: casePoints.length,
          contacts: contactPoints.length, highRiskDistricts: districtStats.filter(d => d.risk === 'high').length,
          criticalCases: cases.filter(c => c.severity === 'critical').length,
          pendingContacts: contacts.filter(c => c.status === 'pending').length
        }
      }
    });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

module.exports = router;
