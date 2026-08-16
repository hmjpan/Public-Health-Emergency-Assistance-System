const express = require('express');
const cors = require('cors');
const path = require('path');
const { authMiddleware } = require('./rbac');
const notify = require('./notify');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 静态托管前端
app.use(express.static(path.join(__dirname, '..', 'web')));

// 会话解析
const api = express.Router();
api.use(authMiddleware);

// 业务域路由
api.use('/auth', require('./routes/auth'));
api.use('/directory', require('./routes/directory'));
api.use('/reports', require('./routes/reports'));
api.use('/dispatch', require('./routes/dispatch'));
api.use('/response', require('./routes/response'));
api.use('/field', require('./routes/field'));
api.use('/medical', require('./routes/medical'));
api.use('/routine', require('./routes/routine'));
api.use('/extensions', require('./routes/extensions'));
api.use('/review', require('./routes/review'));
api.use('/publishing', require('./routes/publishing'));
api.use('/statistics', require('./routes/statistics'));
api.use('/drill', require('./routes/drill'));
api.use('/rules', require('./routes/ruleengine'));
api.use('/docdraft', require('./routes/docdraft'));
api.use('/dashboard', require('./routes/dashboard'));
api.use('/admin', require('./routes/admin'));

// Agent 层（容错：Agent 模块加载失败不影响核心系统）
try {
  require('./agent'); // 初始化 Skill 注册 + Agent 创建
  api.use('/agent', require('./routes/agent'));
  console.log('[Agent] Agent 层加载成功');
} catch (e) {
  console.warn('[Agent] Agent 层加载失败（核心系统不受影响）:', e.message);
}

app.use('/api', api);

app.get('/api/health', (req, res) => res.json({ ok: true, data: { status: 'running' } }));

// 单页回退
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'web', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('突发公共卫生事件应急处置平台已启动: http://localhost:' + PORT);
  notify.startEngine(); // 启动强制反馈升级引擎
  // 数据硬化：启动自检 + 每日快照（第16.4节）
  const { startupCheck, dailySnapshot } = require('./store');
  const check = startupCheck();
  if (check.quarantined.length) console.warn(`[自检] ${check.total}表中${check.quarantined.length}表损坏已隔离:`, check.quarantined.join(','));
  else console.log(`[自检] 数据表全部正常(${check.ok}/${check.total})`);
  const snap = dailySnapshot();
  if (snap.ok && !snap.skipped) console.log(`[快照] 每日快照完成(${snap.files}文件)`);
  // AI 辅助层状态（模式A/B/C标识，规则引擎不依赖AI）
  try {
    const probe = require('./rules/engine').gradeEvaluate({ typeKey: 'FOOD', cases: 60 });
    console.log(`[规则引擎] 自检${probe.ok && probe.suggestedLevel === 'III级' ? '通过' : '异常'} (规则版本${probe.ruleVersion || '?'})`);
  } catch (e) { console.error('[规则引擎] 自检失败:', e.message); }
});
