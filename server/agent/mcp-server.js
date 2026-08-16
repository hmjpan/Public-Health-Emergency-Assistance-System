// MCP Server 适配层 — 将现有工具封装为 MCP 协议接口
// 遵循 Model Context Protocol (MCP) 规范
// 当前为 standalone 模式（本地模拟），后续可无缝切换为真实 MCP Server
//
// MCP 工具清单：
// 1. contacts — 通讯录服务（人员信息、组织架构）
// 2. materials — 物资台账（库存查询、调拨记录）
// 3. vehicles — 车辆调度（位置、状态）
// 4. medical-resources — 医疗资源（药品/设备/床位）
// 5. knowledge — 知识库检索（预案/SOP/措施/案例）
// 6. notification-gateway — 通知网关（语音/短信/APP）
// 7. event-state — 事件状态查询

const { load, save, uid, now } = require('../store');

// MCP 工具定义
const MCP_TOOLS = [
  {
    name: 'contacts',
    description: '通讯录服务：查询人员信息、组织架构、上下级关系',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['search', 'getById', 'getByGroup', 'getOrg'] },
        query: { type: 'string', description: '搜索关键词（姓名/部门/角色）' },
        groupId: { type: 'string', description: '小组ID' },
        userId: { type: 'string', description: '用户ID' }
      },
      required: ['action']
    },
    handler: contactsHandler
  },
  {
    name: 'materials',
    description: '物资台账：库存查询、调拨记录、紧缺预警',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'getByEvent', 'checkStock', 'allocate'] },
        eventId: { type: 'string' },
        packName: { type: 'string', description: '物资包名称' }
      },
      required: ['action']
    },
    handler: materialsHandler
  },
  {
    name: 'vehicles',
    description: '车辆调度：车辆位置、状态跟踪、电子通行证',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'getByEvent', 'getStatus'] },
        eventId: { type: 'string' },
        vehicleId: { type: 'string' }
      },
      required: ['action']
    },
    handler: vehiclesHandler
  },
  {
    name: 'medical-resources',
    description: '医疗资源：药品/设备/床位实时数据',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['summary', 'drugs', 'devices', 'beds'] },
        eventId: { type: 'string' }
      },
      required: ['action']
    },
    handler: medicalHandler
  },
  {
    name: 'knowledge',
    description: '知识库检索：预案/SOP/措施/案例检索',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['search', 'getById', 'listByType'] },
        query: { type: 'string' },
        kind: { type: 'string', enum: ['plan', 'sop', 'measure', 'case'] },
        typeKey: { type: 'string' }
      },
      required: ['action']
    },
    handler: knowledgeHandler
  },
  {
    name: 'notification-gateway',
    description: '通知网关：多通道通知发送（语音/短信/APP推送）',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['send', 'ack', 'status'] },
        targets: { type: 'array', items: { type: 'object' } },
        content: { type: 'string' },
        channels: { type: 'array', items: { type: 'string' } },
        notificationId: { type: 'string' }
      },
      required: ['action']
    },
    handler: notificationHandler
  },
  {
    name: 'event-state',
    description: '事件状态查询：获取事件全景信息',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get', 'list', 'overview'] },
        eventId: { type: 'string' }
      },
      required: ['action']
    },
    handler: eventStateHandler
  }
];

// ---- Handler 实现 ----

function contactsHandler(input) {
  const users = load('users');
  switch (input.action) {
    case 'search': {
      const q = (input.query || '').toLowerCase();
      const results = users.filter(u =>
        u.name.toLowerCase().includes(q) ||
        (u.dept || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q)
      );
      return { ok: true, data: results, total: results.length };
    }
    case 'getById': {
      const u = users.find(x => x.id === input.userId);
      return u ? { ok: true, data: u } : { ok: false, error: '用户不存在' };
    }
    case 'getByGroup': {
      const results = users.filter(u => u.group === input.groupId);
      return { ok: true, data: results, total: results.length };
    }
    case 'getOrg': {
      const groups = [...new Set(users.map(u => u.group))];
      return { ok: true, data: groups.map(g => ({ group: g, members: users.filter(u => u.group === g) })) };
    }
    default: return { ok: false, error: '未知 action: ' + input.action };
  }
}

function materialsHandler(input) {
  const materials = load('materials');
  switch (input.action) {
    case 'list': return { ok: true, data: materials, total: materials.length };
    case 'getByEvent': {
      const r = materials.filter(m => m.eventId === input.eventId);
      return { ok: true, data: r, total: r.length };
    }
    case 'checkStock': {
      const items = load('items') || [];
      const lowStock = items.filter(i => (i.qty || 0) < (i.minQty || 10));
      return { ok: true, data: lowStock, warning: lowStock.length + '项物资低于安全库存' };
    }
    default: return { ok: false, error: '未知 action' };
  }
}

function vehiclesHandler(input) {
  const vehicles = load('vehicles');
  switch (input.action) {
    case 'list': return { ok: true, data: vehicles, total: vehicles.length };
    case 'getByEvent': {
      const r = vehicles.filter(v => v.eventId === input.eventId);
      return { ok: true, data: r };
    }
    case 'getStatus': {
      const v = vehicles.find(x => x.id === input.vehicleId);
      return v ? { ok: true, data: v } : { ok: false, error: '车辆不存在' };
    }
    default: return { ok: false, error: '未知 action' };
  }
}

function medicalHandler(input) {
  const cases = load('cases');
  switch (input.action) {
    case 'summary': {
      const byEvent = input.eventId ? cases.filter(c => c.eventId === input.eventId) : cases;
      return { ok: true, data: { total: byEvent.length, byStatus: countBy(byEvent, 'status') } };
    }
    case 'drugs': {
      const drugs = load('drugs') || [];
      return { ok: true, data: drugs };
    }
    case 'devices': {
      const devices = load('devices') || [];
      return { ok: true, data: devices };
    }
    case 'beds': {
      const beds = load('beds') || [];
      return { ok: true, data: beds };
    }
    default: return { ok: false, error: '未知 action' };
  }
}

function knowledgeHandler(input) {
  const knowledge = load('knowledge');
  switch (input.action) {
    case 'search': {
      const q = (input.query || '').toLowerCase();
      const r = knowledge.filter(k =>
        (k.title || '').toLowerCase().includes(q) ||
        (k.summary || '').toLowerCase().includes(q)
      );
      return { ok: true, data: r, total: r.length };
    }
    case 'getById': {
      const k = knowledge.find(x => x.id === input.knowledgeId);
      return k ? { ok: true, data: k } : { ok: false, error: '知识条目不存在' };
    }
    case 'listByType': {
      let r = knowledge;
      if (input.kind) r = r.filter(k => k.kind === input.kind);
      if (input.typeKey) r = r.filter(k => k.typeKey === input.typeKey || !k.typeKey);
      return { ok: true, data: r, total: r.length };
    }
    default: return { ok: false, error: '未知 action' };
  }
}

function notificationHandler(input) {
  const notify = require('../notify');
  switch (input.action) {
    case 'send': {
      const results = [];
      for (const t of (input.targets || [])) {
        const n = notify.sendNotification(input.eventId || '', t, input.content || '', { channels: input.channels });
        results.push({ id: n.id, targetName: n.targetName, status: n.status });
      }
      return { ok: true, data: { sentCount: results.length, notifications: results } };
    }
    case 'ack': {
      const r = notify.ackNotification(input.notificationId, input.userId);
      return r;
    }
    case 'status': {
      const notifications = load('notifications');
      const n = notifications.find(x => x.id === input.notificationId);
      return n ? { ok: true, data: n } : { ok: false, error: '通知不存在' };
    }
    default: return { ok: false, error: '未知 action' };
  }
}

function eventStateHandler(input) {
  const events = load('events');
  switch (input.action) {
    case 'get': {
      const e = events.find(x => x.id === input.eventId);
      return e ? { ok: true, data: e } : { ok: false, error: '事件不存在' };
    }
    case 'list': {
      return { ok: true, data: events, total: events.length };
    }
    case 'overview': {
      const workflow = require('../workflow');
      const e = events.find(x => x.id === input.eventId);
      return e ? { ok: true, data: workflow.buildOverview(e) } : { ok: false, error: '事件不存在' };
    }
    default: return { ok: false, error: '未知 action' };
  }
}

function countBy(arr, key) {
  const map = {};
  arr.forEach(item => { map[item[key]] = (map[item[key]] || 0) + 1; });
  return map;
}

// ---- MCP 协议接口 ----

/**
 * MCP tools/list — 列出所有 MCP 工具
 */
function listTools() {
  return MCP_TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    source: t.source || 'mcp-server',
    inputSchema: t.inputSchema
  }));
}

/**
 * MCP tools/call — 调用 MCP 工具
 */
async function callTool(toolName, input) {
  const tool = MCP_TOOLS.find(t => t.name === toolName);
  if (!tool) return { ok: false, error: 'MCP 工具不存在: ' + toolName };
  try {
    const result = await tool.handler(input || {});
    return result;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { MCP_TOOLS, listTools, callTool };
