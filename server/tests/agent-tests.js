// Agent/Skill 层测试
// 运行: node server/tests/agent-tests.js
const path = require('path');
process.chdir(path.join(__dirname, '..'));

let pass = 0, fail = 0, total = 0;
function assert(cond, msg) {
  total++;
  if (cond) { pass++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.error(`  ❌ ${msg}`); }
}
function section(name) { console.log(`\n=== ${name} ===`); }

async function run() {
  // 初始化 Agent 模块（注册 Skill + 创建 Agent）
  const { registry, agents, getAgent, listAgents } = require('../agent');
  const modeSwitch = require('../agent/mode-switch');

  // ---- Skill 注册测试 ----
  section('Skill 注册');
  const skills = registry.list();
  assert(skills.length === 12, `注册了 ${skills.length} 个 Skill (期望 12)`);

  const expectedSkills = [
    'TypePackResolve', 'GradeEvaluate', 'SlaCheck', 'StaffAssign',
    'PlanMatch', 'CriteriaCheck', 'NotifyDispatch',
    'EventClassify', 'CaseTrack', 'SOPGuidance', 'ReviewReport', 'DocDraft'
  ];
  expectedSkills.forEach(name => {
    const s = registry.get(name);
    assert(s !== null, `Skill ${name} 已注册`);
  });

  // ---- Agent 创建测试 ----
  section('Agent 创建');
  const agentList = listAgents();
  assert(agentList.length === 7, `创建了 ${agentList.length} 个 Agent (期望 7)`);
  const expectedAgents = ['sentinel', 'commander', 'dispatch', 'field', 'medical', 'communication', 'review'];
  expectedAgents.forEach(id => {
    const a = getAgent(id);
    assert(a !== null, `Agent ${id} 已创建`);
  });

  // ---- TypePackResolve Skill 测试 ----
  section('Skill: TypePackResolve');
  let r = await registry.execute('TypePackResolve', { typeKey: 'FOOD' });
  assert(r.ok && r.data.typeKey === 'FOOD', '精确匹配 FOOD');
  assert(r.data.name === '食源性疾病/食物中毒', '类型名称正确');
  assert(r.data.notifyGroups.length > 0, '通知组不为空');
  assert(r.data.materialPacks.length > 0, '物资包不为空');

  r = await registry.execute('TypePackResolve', { rawText: '聚餐后多人腹泻呕吐' });
  assert(r.ok && r.data.typeKey === 'FOOD', '模糊匹配食物中毒');

  r = await registry.execute('TypePackResolve', { rawText: '化工厂毒气泄漏' });
  assert(r.ok && r.data.typeKey === 'ENV', '模糊匹配环境污染');

  r = await registry.execute('TypePackResolve', { rawText: '诺如病毒感染' });
  assert(r.ok && r.data.typeKey === 'INF', '模糊匹配传染病');

  // ---- GradeEvaluate Skill 测试 ----
  section('Skill: GradeEvaluate');
  r = await registry.execute('GradeEvaluate', { typeKey: 'FOOD', cases: 60, deaths: 0, scope: 2, spread: false });
  assert(r.ok && r.data.suggestedLevel === 'III级', 'FOOD 60例 → III级');
  assert(r.meta.detLevel === 'D0', '确定性等级 D0');
  assert(r.meta.llmUsed === false, '未使用 LLM');

  r = await registry.execute('GradeEvaluate', { typeKey: 'INF', cases: 100, deaths: 5, scope: 3, spread: true });
  assert(r.ok && r.data.suggestedLevel === 'I级', 'INF 100例5死 → I级');

  r = await registry.execute('GradeEvaluate', { typeKey: 'INVALID' });
  assert(!r.ok, '非法 typeKey 返回错误');

  // ---- SlaCheck Skill 测试 ----
  section('Skill: SlaCheck');
  const stages = [
    { stage: '初报', startAt: new Date(Date.now() - 30 * 60000).toISOString() },
    { stage: '进程报告', startAt: new Date(Date.now() - 25 * 60 * 60000).toISOString() }
  ];
  r = await registry.execute('SlaCheck', { stages });
  assert(r.ok && r.data.checks.length === 2, '返回 2 条时限校验');
  assert(r.data.checks[0].status === 'pending' || r.data.checks[0].status === 'near' || r.data.checks[0].status === 'ok', '初报 30 分钟 → pending/near/ok');

  // ---- StaffAssign Skill 测试 ----
  section('Skill: StaffAssign');
  r = await registry.execute('StaffAssign', { typeKey: 'INF', level: 'III级' });
  assert(r.ok && r.data.groups.length > 0, 'INF III级编成有小组');
  assert(r.meta.detLevel === 'D1', '确定性等级 D1');

  r = await registry.execute('StaffAssign', { typeKey: 'INVALID', level: 'III级' });
  assert(!r.ok, '非法 typeKey 返回错误');

  // ---- PlanMatch Skill 测试 ----
  section('Skill: PlanMatch');
  r = await registry.execute('PlanMatch', { typeKey: 'INF', level: 'III级', stage: 'responding' });
  assert(r.ok && r.data.results.length > 0, 'INF III级匹配到知识');
  assert(r.meta.detLevel === 'D2', '确定性等级 D2');

  // ---- CriteriaCheck Skill 测试 ----
  section('Skill: CriteriaCheck');
  r = await registry.execute('CriteriaCheck', { eventId: 'nonexistent', stage: 'responding' });
  assert(r.ok, '不存在的事件返回 ok（标准未达成）');
  assert(r.data.allReady === false, '无数据 → allReady=false');

  // ---- EventClassify Skill 测试（LLM降级模式）----
  section('Skill: EventClassify (LLM降级)');
  r = await registry.execute('EventClassify', { rawText: '某学校20名学生腹泻呕吐', title: '学校食物中毒' });
  assert(r.ok && r.data.typeKey, '返回了分类结果');
  assert(r.data.typeKey === 'FOOD', '降级模式仍走规则匹配 → FOOD');

  // ---- Agent react 测试 ----
  section('Agent: Sentinel react');
  const sentinel = getAgent('sentinel');
  const result = await sentinel.react(
    { id: 'test-001', typeKey: 'FOOD', title: '学校食物中毒', rawReport: '某学校20名学生腹泻呕吐' },
    'new_report',
    { rawText: '某学校20名学生腹泻呕吐', title: '学校食物中毒' }
  );
  assert(result.ok, 'Sentinel react 成功');
  assert(result.agentId === 'sentinel', 'agentId = sentinel');
  assert(result.suggestions.length > 0, '有建议输出');
  assert(result.skillResults.length > 0, '有 Skill 执行结果');

  section('Agent: Commander react');
  const commander = getAgent('commander');
  const cmdResult = await commander.react(
    { id: 'test-001', typeKey: 'FOOD', level: 'III级', stage: 'detected', caseCount: 60 },
    'grade',
    { typeKey: 'FOOD', cases: 60, deaths: 0, scope: 2, spread: false }
  );
  assert(cmdResult.ok, 'Commander react 成功');
  assert(cmdResult.suggestions.length > 0, '有建议输出');
  const gradeSug = cmdResult.suggestions.find(s => s.type === 'grade');
  assert(gradeSug && gradeSug.data.suggestedLevel === 'III级', 'Grade 建议 III级');

  section('Agent: Dispatch react');
  const dispatch = getAgent('dispatch');
  const dispResult = await dispatch.react(
    { id: 'test-001', typeKey: 'INF', level: 'IV级' },
    'launch',
    { typeKey: 'INF', level: 'IV级' }
  );
  assert(dispResult.ok, 'Dispatch react 成功');

  section('Agent: Field react');
  const field = getAgent('field');
  const fieldResult = await field.react(
    { id: 'test-001', typeKey: 'FOOD', stage: 'field' },
    'guidance',
    { typeKey: 'FOOD', stage: 'field', group: '流调组' }
  );
  assert(fieldResult.ok, 'Field react 成功');

  section('Agent: Medical react');
  const medical = getAgent('medical');
  const medResult = await medical.react(
    { id: 'test-001', typeKey: 'INF' },
    'update',
    { typeKey: 'INF' }
  );
  assert(medResult.ok, 'Medical react 成功');

  section('Agent: Communication react');
  const comm = getAgent('communication');
  const commResult = await comm.react(
    { id: 'test-001' },
    'draft',
    { docType: 'brief' }
  );
  assert(commResult.ok, 'Communication react 成功');

  section('Agent: Review react');
  const review = getAgent('review');
  const revResult = await review.react(
    { id: 'nonexistent' },
    'review',
    {}
  );
  assert(revResult.ok, 'Review react 成功');

  // ---- 双模式测试 ----
  section('双模式切换');
  assert(modeSwitch.getEventMode('test-mode-001') === 'assist', '默认模式 = assist');
  modeSwitch.setEventMode('test-mode-001', 'drill');
  assert(modeSwitch.getEventMode('test-mode-001') === 'drill', '切换为 drill');
  assert(modeSwitch.canAgentWrite('commander', 'test-mode-001') === true, 'drill 模式 Agent 可写');
  modeSwitch.setEventMode('test-mode-001', 'assist');
  assert(modeSwitch.canAgentWrite('commander', 'test-mode-001') === false, 'assist 模式 Agent 不可写');
  const drillRoles = modeSwitch.assignDrillRoles('test-mode-001');
  assert(Object.keys(drillRoles).length === 7, '7 个 Agent 角色分配');

  // ---- Skill 规格完整性测试 ----
  section('Skill 规格完整性');
  skills.forEach(s => {
    assert(s.name && s.version && s.detLevel, `${s.name} 有 name/version/detLevel`);
    assert(typeof s.description === 'string' && s.description.length > 0, `${s.name} 有描述`);
  });

  // ---- Agent 身份完整性测试 ----
  section('Agent 身份完整性');
  agentList.forEach(a => {
    assert(a.id && a.name && a.role, `${a.name} 有 id/name/role`);
    assert(a.skills.length > 0, `${a.name} 有 ${a.skills.length} 个 Skill`);
    assert(typeof a.soul === 'string' && a.soul.length > 0, `${a.name} 有 soul`);
    assert(a.icon, `${a.name} 有 icon`);
  });

  // ---- 汇总 ----
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Agent/Skill 测试完成: ${pass}/${total} 通过, ${fail} 失败`);
  if (fail > 0) process.exit(1);
  else console.log('✅ 全部通过！');
}

run().catch(e => { console.error('测试运行失败:', e); process.exit(1); });
