// 规则引擎 -- D0/D1/D2 确定性内核
// 设计（见 docs/智能辅助系统架构设计方案.md 第4章）：
// - 纯函数、无网络、无随机：同输入必同输出
// - 四张规则表：grading(定级D0) / sla(时限D0) / composition(编成D1) / matching(知识匹配D2)
// - 每次调用可落 rule_results 存证（由路由层负责，引擎本身无副作用）
// - 受限表达式求值：白名单变量+比较/逻辑运算，禁止任意代码执行

const fs = require('fs');
const path = require('path');

const RULES_DIR = __dirname; // 规则表与本文件同目录（server/rules/）

function loadRuleTable(name) {
  const fp = path.join(RULES_DIR, name + '.json');
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

// 缓存规则表（规则表为静态资产，进程内缓存；测试可 require 后清缓存重载）
let _grading = null, _sla = null, _composition = null, _matching = null;
function grading() { return _grading || (_grading = loadRuleTable('grading')); }
function sla() { return _sla || (_sla = loadRuleTable('sla')); }
function composition() { return _composition || (_composition = loadRuleTable('composition')); }
function matching() { return _matching || (_matching = loadRuleTable('matching')); }
function reloadRules() { _grading = _sla = _composition = _matching = null; }

/* ============ 受限表达式求值器 ============ */
// 支持: 变量 数字 字符串 true/false 比较(== != > >= < <=) 逻辑(&& ||) 括号
// 拒绝: 任何标识符函数调用/成员访问/赋值 -- 语法层面拦截

const TOKEN_RE = /(\s+|&&|\|\||==|!=|>=|<=|>|<|\(|\)|[A-Za-z_][A-Za-z0-9_]*|'[^']*'|"[^"]*"|-?\d+\.?\d*)/y;

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    TOKEN_RE.lastIndex = i;
    const m = TOKEN_RE.exec(expr);
    if (!m || m[0] === '') throw new Error('表达式含非法字符: ' + expr.slice(i, i + 10));
    const t = m[0].trim();
    if (t) tokens.push(t);
    i = TOKEN_RE.lastIndex;
  }
  return tokens;
}

// 递归下降解析求值
function evalExpr(expr, vars) {
  const tokens = tokenize(expr);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseOr() {
    let v = parseAnd();
    while (peek() === '||') { next(); const r = parseAnd(); v = v || r; }
    return !!v;
  }
  function parseAnd() {
    let v = parseCmp();
    while (peek() === '&&') { next(); const r = parseCmp(); v = v && r; }
    return !!v;
  }
  function parseCmp() {
    const l = parseOperand();
    const op = peek();
    if (['==', '!=', '>', '>=', '<', '<='].includes(op)) {
      next();
      const r = parseOperand();
      switch (op) {
        case '==': return l == r; case '!=': return l != r;
        case '>': return l > r; case '>=': return l >= r;
        case '<': return l < r; case '<=': return l <= r;
      }
    }
    return l; // 裸操作数按真值
  }
  function parseOperand() {
    const t = peek();
    if (t === '(') { next(); const v = parseOr(); if (next() !== ')') throw new Error('括号不匹配'); return v; }
    if (t === 'true') { next(); return true; }
    if (t === 'false') { next(); return false; }
    if (/^-?\d+\.?\d*$/.test(t)) { next(); return parseFloat(t); }
    if (/^['"]/.test(t)) { next(); return t.slice(1, -1); }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) {
      next();
      // 安全：仅白名单变量可解析（hasOwnProperty 防 in 的原型链穿透，如 constructor）
      if (!Object.prototype.hasOwnProperty.call(vars, t)) throw new Error('未定义或禁止的标识符: ' + t);
      return vars[t];
    }
    throw new Error('非法操作数: ' + t);
  }

  const result = parseOr();
  if (pos !== tokens.length) throw new Error('表达式尾部存在多余内容');
  return result;
}

/* ============ 输入校验（容错：乱输入拦截） ============ */
function validateFactors(f) {
  const errs = [];
  const num = (v, name, min, max) => {
    if (v === undefined || v === null || v === '') return 0; // 缺省按0（保守）
    const n = Number(v);
    if (isNaN(n)) errs.push(`${name}须为数字`);
    else if (n < min || n > max) errs.push(`${name}超出合理范围(${min}-${max})`);
    return isNaN(n) ? 0 : Math.floor(n);
  };
  const factors = {
    typeKey: ['INF', 'FOOD', 'ENV', 'POISON', 'UNK'].includes(f.typeKey) ? f.typeKey : null,
    cases: num(f.cases, '病例人数', 0, 999999),
    deaths: num(f.deaths, '死亡人数', 0, 999999),
    scope: [1, 2, 3, 4].includes(Number(f.scope)) ? Number(f.scope) : 1,
    spread: f.spread === true || f.spread === 'true' || f.spread === 1 ? true : false,
    typeTag: String(f.typeTag || '').trim()
  };
  if (!factors.typeKey) errs.push('typeKey须为 INF/FOOD/ENV/POISON/UNK 之一');
  return { factors, errs };
}

/* ============ ① 分级判定 gradeEvaluate（D0） ============ */
// 输入要素 -> 建议级别 + 命中规则 + 依据 + 距上一级差距
function gradeEvaluate(input) {
  const { factors, errs } = validateFactors(input || {});
  if (errs.length) return { ok: false, error: errs.join('；'), kind: 'validation' };

  const table = grading();
  const vars = { cases: factors.cases, deaths: factors.deaths, scope: factors.scope, spread: factors.spread, typeTag: factors.typeTag };
  const levelRank = { 'I级': 1, 'II级': 2, 'III级': 3, 'IV级': 4 };

  const matched = [];
  for (const rule of table.rules) {
    if (rule.typeKey !== factors.typeKey) continue;
    let hit = false;
    try { hit = evalExpr(rule.expr, vars); }
    catch (e) { throw new Error(`规则${rule.id}表达式错误: ${e.message}`); }
    if (hit) matched.push({ id: rule.id, level: rule.level, basis: rule.basis, expr: rule.expr, legal_ref: rule.legal_ref || '' });
  }

  if (!matched.length) {
    return {
      ok: true, kind: 'grade',
      suggestedLevel: null, noMatch: true,
      message: '规则未覆盖该情形，转人工研判（可查阅分级标准速查）',
      matchedRules: [], ruleVersion: table.rule_version
    };
  }

  // 就高不就低
  matched.sort((a, b) => levelRank[a.level] - levelRank[b.level]);
  const suggestedLevel = matched[0].level;

  // 距上一级的差距分析（命中最高级规则的上一级规则未满足原因）
  const higher = levelRank[suggestedLevel] - 1;
  let gapToHigher = null;
  if (higher >= 1) {
    const higherLevel = Object.keys(levelRank).find(k => levelRank[k] === higher);
    const higherRules = table.rules.filter(r => r.typeKey === factors.typeKey && r.level === higherLevel);
    // 找出未命中的上一级规则（作为"提级条件"提示）
    gapToHigher = higherRules.filter(r => !matched.find(m => m.id === r.id)).map(r => ({
      id: r.id, level: r.level, expr: r.expr, basis: r.basis, legal_ref: r.legal_ref || ''
    }));
  }

  return {
    ok: true, kind: 'grade',
    suggestedLevel,
    noMatch: false,
    matchedRules: matched.map(m => ({ id: m.id, level: m.level, basis: m.basis, legal_ref: m.legal_ref, expr: m.expr })),
    gapToHigher,
    factors,
    ruleVersion: table.rule_version,
    notice: '本结果为规则建议级别，最终定级由指挥员决定（就高不就低原则）'
  };
}

/* ============ ② 时限校验 slaCheck（D0） ============ */
// 事件时间线 -> 各环节时限状态
function slaCheck(stages) {
  // stages: [{stage:'初报', startAt, doneAt}] -> [{stage, limitMinutes, status(pending/ok/near/over), basis}]
  const table = sla();
  const nowTs = Date.now();
  return (stages || []).map(s => {
    const rule = table.rules.find(r => r.stage === s.stage);
    if (!rule) return { stage: s.stage, status: 'unknown' };
    const start = new Date(s.startAt).getTime();
    const elapsedMin = ((s.doneAt ? new Date(s.doneAt).getTime() : nowTs) - start) / 60000;
    let status;
    if (s.doneAt) status = elapsedMin <= rule.limitMinutes ? 'ok' : 'over_done';
    else if (elapsedMin >= rule.limitMinutes) status = 'over';
    else if (elapsedMin >= rule.limitMinutes - rule.remindBefore) status = 'near';
    else status = 'pending';
    return {
      stage: s.stage, ruleId: rule.id,
      limitMinutes: rule.limitMinutes, elapsedMin: +elapsedMin.toFixed(1),
      status, action: rule.action, action_detail: rule.action_detail || '', basis: rule.basis, legal_ref: rule.legal_ref || '', ruleVersion: table.rule_version
    };
  });
}

/* ============ ③ 标准编成 staffAssign（D1） ============ */
function staffAssign(typeKey, level) {
  const table = composition();
  const comp = table.compositions[typeKey];
  if (!comp) return { ok: false, error: '无该类型标准编成: ' + typeKey };
  const adj = comp.levelAdj[level] || { multiplier: 1, addGroups: [] };
  const groups = comp.groups.map(g => ({
    group: g.group,
    minCount: Math.max(g.minCount, Math.ceil(g.minCount * adj.multiplier)),
    baseCount: g.minCount,
    skillTags: g.skillTags,
    tasks: g.tasks,
    role_ref: g.role_ref || '',
    basis: comp.basis || ''
  }));
  // 附加组（如专家组）
  const extras = [];
  adj.addGroups.forEach(gn => {
    const base = comp.groups.find(g => g.group === gn);
    if (base) extras.push({ ...base, minCount: Math.max(base.minCount, Math.ceil(base.minCount * adj.multiplier)) });
    else extras.push({ group: gn, minCount: 2, skillTags: [gn.replace('组', '')], tasks: ['会商研判'] });
  });
  return {
    ok: true, kind: 'staff',
    name: comp.name, typeKey, level,
    multiplier: adj.multiplier,
    groups: groups.concat(extras),
    materialPacks: comp.materialPacks,
    basis: comp.basis || '',
    ruleVersion: table.rule_version,
    notice: '标准编成为预案既定，人员指派由指挥员确认'
  };
}

/* ============ ④ 知识匹配 planMatch（D2） ============ */
// 知识条目须含: id, kind(plan/sop/measure/case), title, typeKey, levels[], stage?
function planMatch(factors, knowledge) {
  const table = matching();
  const { kindWeights, levelCoverage, retrieval } = table;
  const cover = levelCoverage[factors.level] || ['IV级'];
  const scored = [];
  for (const k of knowledge || []) {
    if (!kindWeights[k.kind] && k.kind !== 'case') continue;
    // MT001 typeKey 精确
    const mt1 = k.typeKey === factors.typeKey ? 1 : (k.typeKey === '' || !k.typeKey ? 0.3 : 0);
    if (mt1 === 0) continue;
    // MT002 级别覆盖
    const mt2 = (k.levels || []).some(l => cover.includes(l)) ? 1 : 0.2;
    // MT003 环节
    const mt3 = !factors.stage || !k.stage || k.stage === factors.stage ? 1 : 0.2;
    const score = (kindWeights[k.kind] || 0.1) * (0.6 * mt1 + 0.2 * mt2 + 0.2 * mt3);
    scored.push({ ...k, score: +score.toFixed(4) });
  }
  // 确定性排序：分数降序，同分按id字典序
  scored.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  return {
    ok: true, kind: 'plan',
    results: scored.slice(0, retrieval.maxResults).map(k => ({ id: k.id, kind: k.kind, title: k.title, typeKey: k.typeKey, stage: k.stage || '', score: k.score, summary: k.summary || '' })),
    total: scored.length, ruleVersion: table.rule_version
  };
}

module.exports = { gradeEvaluate, slaCheck, staffAssign, planMatch, evalExpr, reloadRules, RULES_DIR };
