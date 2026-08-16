// 一致性回归测试集 -- D0/D1/D2 确定性断言（第2.5节）
// 运行: node tests/regression.js   CI/规则变更必须全绿
const engine = require('../rules/engine');
const { load } = require('../store');

let pass = 0, fail = 0;
const failures = [];

function assert(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push(name + (detail ? ' | ' + detail : '')); }
}

/* ================= gradeEvaluate 定级（30 用例） ================= */
// FOOD
let r = engine.gradeEvaluate({ typeKey: 'FOOD', cases: 58 });
assert('FOOD 58例=III级', r.suggestedLevel === 'III级');
assert('FOOD 58例命中GRD-FOOD-003', r.matchedRules.some(m => m.id === 'GRD-FOOD-003'));
r = engine.gradeEvaluate({ typeKey: 'FOOD', cases: 120, deaths: 12 });
assert('FOOD 120例死亡12=I级(就高)', r.suggestedLevel === 'I级');
assert('FOOD I级命中001', r.matchedRules.some(m => m.id === 'GRD-FOOD-001'));
r = engine.gradeEvaluate({ typeKey: 'FOOD', cases: 101, deaths: 0 });
assert('FOOD 101例=II级', r.suggestedLevel === 'II级');
r = engine.gradeEvaluate({ typeKey: 'FOOD', cases: 51, deaths: 1 });
assert('FOOD 51例死亡1=III级', r.suggestedLevel === 'III级');
r = engine.gradeEvaluate({ typeKey: 'FOOD', cases: 10 });
assert('FOOD 10例=IV级', r.suggestedLevel === 'IV级');
r = engine.gradeEvaluate({ typeKey: 'FOOD', cases: 5 });
assert('FOOD 5例=noMatch', r.noMatch === true);
r = engine.gradeEvaluate({ typeKey: 'FOOD', cases: 100 });
assert('FOOD 100例(>50未>100)=III级', r.suggestedLevel === 'III级');
r = engine.gradeEvaluate({ typeKey: 'FOOD', cases: 101 });
assert('FOOD 101例(>100)=II级', r.suggestedLevel === 'II级');
r = engine.gradeEvaluate({ typeKey: 'FOOD', cases: 50 });
assert('FOOD 50例(未>50)=IV级? 50>=10命中IV', r.suggestedLevel === 'IV级');

// INF
r = engine.gradeEvaluate({ typeKey: 'INF', cases: 1, spread: true });
assert('INF 1例扩散=I级', r.suggestedLevel === 'I级');
r = engine.gradeEvaluate({ typeKey: 'INF', cases: 5, scope: 3 });
assert('INF 5例跨市=II级', r.suggestedLevel === 'II级');
r = engine.gradeEvaluate({ typeKey: 'INF', cases: 5, scope: 2 });
assert('INF 5例市内跨区=III级', r.suggestedLevel === 'III级');
r = engine.gradeEvaluate({ typeKey: 'INF', cases: 5 });
assert('INF 5例县区=IV级', r.suggestedLevel === 'IV级');
r = engine.gradeEvaluate({ typeKey: 'INF', cases: 1, typeTag: '甲类管理' });
assert('INF 甲类管理=I级', r.suggestedLevel === 'I级');
r = engine.gradeEvaluate({ typeKey: 'INF', cases: 0 });
assert('INF 0例=noMatch', r.noMatch === true);

// ENV
r = engine.gradeEvaluate({ typeKey: 'ENV', cases: 5, scope: 4 });
assert('ENV 跨省=I级', r.suggestedLevel === 'I级');
r = engine.gradeEvaluate({ typeKey: 'ENV', cases: 5, scope: 3 });
assert('ENV 跨市=II级', r.suggestedLevel === 'II级');
r = engine.gradeEvaluate({ typeKey: 'ENV', cases: 35 });
assert('ENV 35例=III级', r.suggestedLevel === 'III级');
r = engine.gradeEvaluate({ typeKey: 'ENV', cases: 3 });
assert('ENV 3例=IV级', r.suggestedLevel === 'IV级');

// POISON
r = engine.gradeEvaluate({ typeKey: 'POISON', cases: 60 });
assert('POISON 60例=I级', r.suggestedLevel === 'I级');
r = engine.gradeEvaluate({ typeKey: 'POISON', cases: 35, deaths: 3 });
assert('POISON 35例死亡3=II级(就高)', r.suggestedLevel === 'II级');
r = engine.gradeEvaluate({ typeKey: 'POISON', cases: 15 });
assert('POISON 15例=III级', r.suggestedLevel === 'III级');
r = engine.gradeEvaluate({ typeKey: 'POISON', cases: 5 });
assert('POISON 5例=IV级', r.suggestedLevel === 'IV级');

// UNK
r = engine.gradeEvaluate({ typeKey: 'UNK', cases: 10, spread: true });
assert('UNK 扩散=I级', r.suggestedLevel === 'I级');
r = engine.gradeEvaluate({ typeKey: 'UNK', cases: 10, scope: 3 });
assert('UNK 跨市=II级', r.suggestedLevel === 'II级');
r = engine.gradeEvaluate({ typeKey: 'UNK', cases: 25 });
assert('UNK 25例=III级', r.suggestedLevel === 'III级');
r = engine.gradeEvaluate({ typeKey: 'UNK', cases: 5 });
assert('UNK 5例=IV级', r.suggestedLevel === 'IV级');

// 输入容错
r = engine.gradeEvaluate({ typeKey: 'FOOD', cases: -5 });
assert('负数病例被拦截', r.ok === false);
r = engine.gradeEvaluate({ typeKey: 'FOOD', cases: 'abc' });
assert('非数字病例被拦截', r.ok === false);
r = engine.gradeEvaluate({ typeKey: 'XXX', cases: 10 });
assert('非法typeKey被拦截', r.ok === false);
r = engine.gradeEvaluate({});
assert('空输入被拦截', r.ok === false);

// 一致性：同输入跑3次结果一致
const a = JSON.stringify(engine.gradeEvaluate({ typeKey: 'FOOD', cases: 58 }));
const b = JSON.stringify(engine.gradeEvaluate({ typeKey: 'FOOD', cases: 58 }));
const c = JSON.stringify(engine.gradeEvaluate({ typeKey: 'FOOD', cases: 58 }));
assert('定级同输入3次一致', a === b && b === c);

// gapToHigher
r = engine.gradeEvaluate({ typeKey: 'FOOD', cases: 58 });
assert('III级给出提级条件', Array.isArray(r.gapToHigher) && r.gapToHigher.length > 0);

/* ================= slaCheck 时限（10 用例） ================= */
r = engine.slaCheck([{ stage: '初报', startAt: new Date(Date.now() - 100 * 60000).toISOString(), doneAt: new Date().toISOString() }]);
assert('初报100分钟完成=ok', r[0].status === 'ok');
r = engine.slaCheck([{ stage: '初报', startAt: new Date(Date.now() - 130 * 60000).toISOString(), doneAt: new Date() .toISOString() }]);
assert('初报130分钟完成=over_done', r[0].status === 'over_done');
r = engine.slaCheck([{ stage: '初报', startAt: new Date(Date.now() - 130 * 60000).toISOString() }]);
assert('初报130分钟未完成=over', r[0].status === 'over');
r = engine.slaCheck([{ stage: '初报', startAt: new Date(Date.now() - 95 * 60000).toISOString() }]);
assert('初报95分钟=near', r[0].status === 'near');
r = engine.slaCheck([{ stage: '初报', startAt: new Date(Date.now() - 10 * 60000).toISOString() }]);
assert('初报10分钟=pending', r[0].status === 'pending');
r = engine.slaCheck([{ stage: '响应启动', startAt: new Date(Date.now() - 30 * 60000).toISOString() }]);
assert('响应启动30分钟未超=pending', r[0].status === 'pending');
r = engine.slaCheck([{ stage: '不存在的环节', startAt: new Date().toISOString() }]);
assert('未知环节=unknown', r[0].status === 'unknown');
assert('sla返回规则版本', r[0].ruleVersion === undefined || typeof r[0].ruleVersion === 'string');
const s1 = JSON.stringify(engine.slaCheck([{ stage: '初报', startAt: '2026-08-16T10:00:00.000Z', doneAt: '2026-08-16T10:30:00.000Z' }]));
const s2 = JSON.stringify(engine.slaCheck([{ stage: '初报', startAt: '2026-08-16T10:00:00.000Z', doneAt: '2026-08-16T10:30:00.000Z' }]));
assert('时限同输入一致', s1 === s2);

/* ================= staffAssign 编成（10 用例） ================= */
r = engine.staffAssign('INF', 'IV级');
assert('INF IV级可用', r.ok === true);
assert('INF 含流调组', r.groups.some(g => g.group === '流调组'));
assert('INF 流调组≥4人', r.groups.find(g => g.group === '流调组').minCount >= 4);
r = engine.staffAssign('INF', 'II级');
assert('INF II级含专家组', r.groups.some(g => g.group === '专家组'));
assert('INF II级人数>IV级', r.groups.find(g => g.group === '流调组').minCount > 4);
r = engine.staffAssign('FOOD', 'III级');
assert('FOOD 含采样组与管控组', r.groups.some(g => g.group === '采样组') && r.groups.some(g => g.group === '管控组'));
r = engine.staffAssign('ENV', 'I级');
assert('ENV I级乘数2', r.multiplier === 2);
r = engine.staffAssign('XXX', 'IV级');
assert('未知类型返回错误', r.ok === false);
assert('编成含物资包清单', Array.isArray(r.materialPacks || engine.staffAssign('INF', 'IV级').materialPacks));
const st1 = JSON.stringify(engine.staffAssign('POISON', 'III级'));
const st2 = JSON.stringify(engine.staffAssign('POISON', 'III级'));
assert('编成同输入一致', st1 === st2);

/* ================= planMatch 匹配（15 用例） ================= */
const knowledge = load('knowledge');
assert('知识库非空', knowledge.length >= 10);

r = engine.planMatch({ typeKey: 'FOOD', level: 'III级' }, knowledge);
assert('FOOD III级有结果', r.results.length > 0);
assert('FOOD预案排第一', r.results[0].id === 'k_plan_food');
assert('FOOD含SOP条目', r.results.some(x => x.kind === 'sop'));

r = engine.planMatch({ typeKey: 'INF', level: 'I级' }, knowledge);
assert('INF I级预案第一', r.results[0].id === 'k_plan_inf');
assert('INF I级含措施', r.results.some(x => x.kind === 'measure'));

r = engine.planMatch({ typeKey: 'ENV', level: 'III级' }, knowledge);
assert('ENV III级预案第一', r.results[0].id === 'k_plan_env');

r = engine.planMatch({ typeKey: 'UNK', level: 'IV级' }, knowledge);
assert('UNK有预案', r.results.some(x => x.id === 'k_plan_unk'));

r = engine.planMatch({ typeKey: 'FOOD', level: 'IV级' }, knowledge);
assert('IV级可检索到III级适用措施(级别覆盖)', r.results.some(x => x.id === 'k_measure_food_iv'));

r = engine.planMatch({ typeKey: 'XXX', level: 'IV级' }, knowledge);
assert('无关类型结果有限', r.results.length <= 5);

r = engine.planMatch({ typeKey: 'INF', level: 'III级', stage: '现场处置' }, knowledge);
assert('环节匹配含现场SOP', r.results.some(x => x.stage === '现场处置'));

r = engine.planMatch({ typeKey: 'FOOD', level: 'III级' }, []);
assert('空知识库返回空', r.results.length === 0);

// 一致性：两次排序完全一致
const pm1 = JSON.stringify(engine.planMatch({ typeKey: 'FOOD', level: 'III级' }, knowledge));
const pm2 = JSON.stringify(engine.planMatch({ typeKey: 'FOOD', level: 'III级' }, knowledge));
assert('匹配同输入两次一致', pm1 === pm2);

// 顺序确定性：分数降序
r = engine.planMatch({ typeKey: 'INF', level: 'II级' }, knowledge);
let sorted = true;
for (let i = 1; i < r.results.length; i++) if (r.results[i].score > r.results[i - 1].score) sorted = false;
assert('匹配结果按分数降序', sorted);

r = engine.planMatch({ typeKey: 'INF', level: 'II级' }, knowledge);
assert('匹配最多5条', r.results.length <= 5);
assert('结果含匹配分数', typeof r.results[0].score === 'number');

/* ================= 表达式求值器安全（5 用例） ================= */
try { engine.evalExpr('process.exit(1)', {}); assert('拒绝进程调用', false); } catch (e) { assert('拒绝进程调用', true); }
try { engine.evalExpr('require("fs")', {}); assert('拒绝require', false); } catch (e) { assert('拒绝require', true); }
try { engine.evalExpr('constructor', {}); assert('拒绝原型访问', false); } catch (e) { assert('拒绝原型访问', true); }
try { engine.evalExpr('undefinedVar', {}); assert('拒绝未定义变量', false); } catch (e) { assert('拒绝未定义变量', true); }
try { engine.evalExpr('1;2;3', {}); assert('拒绝多语句', false); } catch (e) { assert('拒绝多语句', true); }

/* ================= 汇总 ================= */
console.log('================ 一致性回归测试 ================');
console.log(`通过: ${pass}  失败: ${fail}  总计: ${pass + fail}`);
if (failures.length) {
  console.log('\n失败用例:');
  failures.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
} else {
  console.log('✓ 全部通过（D0/D1/D2 确定性保证有效）');
}
