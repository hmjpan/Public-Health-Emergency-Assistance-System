// App Shell: 登录态、角色导航、模块路由
const MODULE_META = {
  dashboard: { title: '指挥大屏', ico: '🖥️', tag: '处置协同' },
  statistics: { title: '统计报表', ico: '📊', tag: '运营管理' },
  dispatch: { title: '一键启动', ico: '🚨', tag: '事件入口' },
  response: { title: '出动状态', ico: '🚑', tag: '处置协同' },
  materials: { title: '物资调拨', ico: '📦', tag: '处置协同' },
  medical: { title: '医疗救治', ico: '🏥', tag: '处置协同' },
  routine: { title: '常态报告', ico: '📅', tag: '信息闭环' },
  contacts: { title: '密接追踪', ico: '🔗', tag: '处置协同' },
  publishing: { title: '信息发布', ico: '📢', tag: '信息闭环' },
  review: { title: '复盘整改', ico: '🔁', tag: '信息闭环' },
  drill: { title: '演练模式', ico: '🎬', tag: '运营管理' },
  field: { title: '现场处置', ico: '🎯', tag: '处置协同' },
  tasks: { title: '任务工单', ico: '📋', tag: '信息闭环' },
  report: { title: '极简上报', ico: '📨', tag: '事件入口' },
  admin: { title: '系统管理', ico: '⚙️', tag: '运营管理' },
  agent: { title: 'Agent协同', ico: '🤖', tag: '运营管理' }
};

// 导航分组：按应急工作流组织，让使用者明确"当前在哪一环"
const NAV_GROUPS = [
  { label: '事件入口', ico: '📥', items: ['report', 'dispatch'] },
  { label: '处置协同', ico: '🚨', items: ['dashboard', 'response', 'field', 'materials', 'medical', 'contacts'] },
  { label: '信息闭环', ico: '🔄', items: ['routine', 'tasks', 'publishing', 'review'] },
  { label: '运营管理', ico: '🧭', items: ['drill', 'statistics', 'agent', 'admin'] }
];

// 流程阶段指示器：监测预警 → 应急响应 → 现场处置 → 终止复盘
App.FLOW = ['detected', 'responding', 'field', 'closed'];
App.flowIndex = function (stage) { const i = App.FLOW.indexOf(stage); return i < 0 ? 0 : i; };
App.stepper = function (stage, opts) {
  const i = App.flowIndex(stage);
  const labels = opts && opts.labels || ['监测预警', '应急响应', '现场处置', '终止复盘'];
  return App.h('div', { class: 'flow-steps' }, labels.map((l, idx) =>
    App.h('div', { class: 'flow-step ' + (idx < i ? 'done' : idx === i ? 'cur' : ''), title: idx < i ? '已完成' : idx === i ? '当前阶段' : '待进入' }, [
      App.h('span', { class: 'dot' }),
      App.h('span', { class: 'lb' }, [l])
    ])
  ));
};

App.renderLogin = function () {
  const root = document.getElementById('root');
  root.innerHTML = '';
  const card = App.h('div', { class: 'login-card' }, [
    App.h('div', { class: 'login-brand' }, [
      App.h('div', { class: 'logo' }, ['🛡️']),
      App.h('h1', {}, ['卫盾Agent']),
      App.h('div', { class: 'sub' }, ['突发公共卫生事件多Agent协同应急处置平台'])
    ]),
    App.h('div', { class: 'login-feats' }, [
      App.h('span', { class: 'chip' }, ['🤖 7 Agent']),
      App.h('span', { class: 'chip' }, ['🧩 12 Skill']),
      App.h('span', { class: 'chip' }, ['⚙️ 规则引擎']),
      App.h('span', { class: 'chip' }, ['🔁 强制反馈'])
    ]),
    App.h('div', { class: 'field' }, [
      App.h('label', { htmlFor: 'u' }, ['账号']),
      App.h('input', { id: 'u', placeholder: 'commander / liudiao / wuzi ...' })
    ]),
    App.h('div', { class: 'field' }, [
      App.h('label', { htmlFor: 'p' }, ['密码']),
      App.h('input', { id: 'p', type: 'password', placeholder: '123456' })
    ]),
    App.h('div', { class: 'err', id: 'err' }),
    App.h('button', { class: 'primary', style: 'width:100%', onclick: doLogin }, ['登 录']),
    App.h('div', { class: 'login-tip' }, ['演示账号: commander / liudiao / wuzi / siji / medic ... 密码均 123456'])
  ]);
  root.appendChild(App.h('div', { class: 'login-wrap' }, [card]));
  document.getElementById('u').focus();
};

async function doLogin() {
  const err = document.getElementById('err');
  err.textContent = '';
  const username = document.getElementById('u').value.trim();
  const password = document.getElementById('p').value.trim();
  if (!username) { err.textContent = '请输入账号'; return; }
  const d = await App.api.req('POST', '/auth/login', { username, password });
  if (!d) { err.textContent = '账号或密码错误'; return; }
  App.token = d.token; App.user = d.user;
  localStorage.setItem('yj_token', d.token);
  localStorage.setItem('yj_user', JSON.stringify(d.user));
  App.boot();
}

App.logout = function () {
  localStorage.removeItem('yj_token');
  localStorage.removeItem('yj_user');
  App.token = ''; App.user = null;
  location.reload();
};

App.boot = function () {
  if (!App.user) { App.renderLogin(); return; }
  const root = document.getElementById('root');
  root.innerHTML = '';
  const sidebar = App.h('div', { class: 'sidebar' }, [
    App.h('div', { class: 'brand' }, ['🛡️ 卫盾Agent', App.h('small', {}, ['多Agent协同应急处置平台'])]),
    App.h('div', { class: 'nav', id: 'nav' }),
    App.h('div', { class: 'me' }, [
      App.h('div', {}, [App.h('b', {}, [App.esc(App.user.name)]), ' · ' + (App.user.roleName || '')]),
      App.h('div', { class: 'muted', style: 'margin-top:2px' }, [App.esc(App.user.group || App.user.dept || '')]),
      App.h('button', { class: 'ghost', style: 'margin-top:8px;width:100%', onclick: App.logout }, ['退出'])
    ])
  ]);
  const main = App.h('div', { class: 'main' }, [
    App.h('div', { class: 'topbar' }, [
      App.h('div', { class: 't' }, ['卫盾Agent · 突发公共卫生事件应急处置平台']),
      App.h('div', { class: 'spacer' }),
      App.h('div', { class: 'chip' }, ['角色: ' + (App.user.roleName || '')]),
      App.h('div', { class: 'chip' }, [new Date().toLocaleDateString('zh-CN')])
    ]),
    App.h('div', { class: 'content', id: 'content' })
  ]);
  root.appendChild(App.h('div', { class: 'app-shell' }, [sidebar, main]));

  const nav = document.getElementById('nav');
  const myNav = App.user.nav || [];
  NAV_GROUPS.forEach(g => {
    const list = g.items.filter(k => myNav.includes(k));
    if (!list.length) return;
    nav.appendChild(App.h('div', { class: 'nav-group' }, [g.ico + ' ' + g.label]));
    list.forEach(key => {
      const meta = MODULE_META[key] || { title: key, ico: '' };
      const a = App.h('a', { onclick: () => App.go(key) }, [App.h('span', { class: 'ico' }, [meta.ico]), meta.title]);
      a.dataset.key = key;
      nav.appendChild(a);
    });
  });

  App.go(App.user.home || (App.user.nav || [])[0] || 'dashboard');
};

App.go = function (key, params) {
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('active', a.dataset.key === key));
  const content = document.getElementById('content');
  content.innerHTML = '';
  const mod = App.modules[key];
  if (!mod || !mod.render) {
    content.appendChild(App.h('div', { class: 'empty' }, ['模块开发中: ' + key]));
    return;
  }
  try { mod.render(content, params || {}); }
  catch (e) { content.appendChild(App.h('div', { class: 'empty' }, ['模块渲染异常: ' + e.message])); }
};

App.setTitle = function (t) { document.title = t + ' · 应急处置平台'; };

document.addEventListener('DOMContentLoaded', function () {
  if (App.user && App.token) {
    App.api.get('/auth/me').then(d => {
      if (d) { App.user = d; localStorage.setItem('yj_user', JSON.stringify(d)); App.boot(); }
      else App.renderLogin();
    });
  } else App.renderLogin();
});
