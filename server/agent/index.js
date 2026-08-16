// Agent 模块入口 —— 注册所有 Skill + 创建所有 Agent
// 在 server/index.js 启动时 require 一次
const { registry } = require('./skill-base');

// ---- 注册所有 Skill ----
const skillDefs = [
  require('./skills/type-pack-resolve'),
  require('./skills/grade-evaluate'),
  require('./skills/sla-check'),
  require('./skills/staff-assign'),
  require('./skills/plan-match'),
  require('./skills/criteria-check'),
  require('./skills/notify-dispatch'),
  require('./skills/event-classify'),
  require('./skills/case-track'),
  require('./skills/sop-guidance'),
  require('./skills/review-report'),
  require('./skills/doc-draft')
];

skillDefs.forEach(skill => {
  try {
    registry.register(skill);
  } catch (e) {
    console.error(`[Agent] Skill ${skill.name} 注册失败:`, e.message);
  }
});
console.log(`[Agent] ${registry.list().length} 个 Skill 已注册`);

// ---- 创建所有 Agent ----
const SentinelAgent = require('./agents/sentinel');
const CommanderAgent = require('./agents/commander');
const DispatchAgent = require('./agents/dispatch');
const FieldAgent = require('./agents/field');
const MedicalAgent = require('./agents/medical');
const CommunicationAgent = require('./agents/communication');
const ReviewAgent = require('./agents/review');

const agents = {
  sentinel: new SentinelAgent(),
  commander: new CommanderAgent(),
  dispatch: new DispatchAgent(),
  field: new FieldAgent(),
  medical: new MedicalAgent(),
  communication: new CommunicationAgent(),
  review: new ReviewAgent()
};

console.log(`[Agent] ${Object.keys(agents).length} 个 Agent 已创建`);

// ---- 导出 ----
function getAgent(id) { return agents[id] || null; }
function listAgents() { return Object.values(agents).map(a => a.identity()); }

module.exports = { registry, agents, getAgent, listAgents };
