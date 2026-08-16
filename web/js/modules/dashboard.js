// 指挥大屏 -- 投屏级可视化：KPI灯带+多图表+实时滚动，支持全屏投屏模式
App.modules.dashboard = {
  timer: null,
  screenMode: false,

  async render(root, params) {
    App.setTitle('指挥大屏');
    this.stop();
    this.screenMode = params && params.screen;
    root.innerHTML = '';

    if (this.screenMode) {
      document.body.classList.add('screen-mode');
      root.appendChild(this.buildScreen());
    } else {
      document.body.classList.remove('screen-mode');
      root.appendChild(this.buildNormal());
    }

    const load = async () => { await this.refresh(); };
    await load();
    this.timer = setInterval(load, 8000);
  },

  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } if (this.clockTimer) { clearInterval(this.clockTimer); this.clockTimer = null; } },

  // 普通模式：保留原业务视图 + 大屏入口
  buildNormal() {
    const page = App.h('div', { class: 'page' });
    page.appendChild(App.h('div', { class: 'flex between items', style: 'margin-bottom:12px' }, [
      App.h('button', { class: 'primary', onclick: () => App.go('dashboard', { screen: true }) }, ['🖥️ 进入投屏大屏']),
      App.h('a', { style: 'cursor:pointer', onclick: () => App.go('statistics') }, ['查看统计报表 ->'])
    ]));
    page.appendChild(App.h('div', { id: 'dash_normal' }));
    return page;
  },

  // 投屏大屏骨架 -- 层次化大屏：KPI灯带(带图标) + 主体网格(英雄图+仪表+列表) + 底部滚动动态
  buildScreen() {
    const s = App.h('div', { class: 'screen' });
    // 背景装饰
    s.appendChild(App.h('div', { class: 'screen-bg' }));

    // ===== 顶部栏 =====
    s.appendChild(App.h('div', { class: 'screen-header' }, [
      App.h('div', { class: 'st-l' }, [
        App.h('div', { class: 'screen-title' }, ['突发公共卫生事件应急处置 · 指挥大屏']),
        App.h('div', { class: 'screen-sub', id: 'scr_sub' }, ['实时态势 · 全要素监控']),
        App.h('div', { class: 'chips', id: 'scr_meta' }, [])
      ]),
      App.h('div', { class: 'st-r' }, [
        App.h('div', { class: 'screen-clock', id: 'scr_clock' }, [this.clock()]),
        App.h('div', { class: 'screen-date', id: 'scr_date' }, ['']),
        App.h('button', { class: 'ghost', onclick: () => App.go('dashboard', { screen: false }) }, ['退出大屏'])
      ])
    ]));
    // 顶点角标
    s.appendChild(App.h('i', { class: 'corner tl' }));
    s.appendChild(App.h('i', { class: 'corner tr' }));
    s.appendChild(App.h('i', { class: 'corner bl' }));
    s.appendChild(App.h('i', { class: 'corner br' }));

    // ===== KPI 灯带（图标药丸 + 数值 + sparkline）=====
    s.appendChild(App.h('div', { class: 'screen-kpis', id: 'scr_kpis' }));

    // ===== 主体网格 =====
    s.appendChild(App.h('div', { class: 'screen-grid' }, [
      // 左栏：资源运行 + 事件类型
      App.h('div', { class: 'screen-col' }, [
        App.h('div', { class: 'screen-card' }, [
          App.h('div', { class: 'hd' }, [App.h('span', { class: 'bar' }), '医疗资源运行'], App.h('span', { class: 'hd-tag' }, ['床/ICU 占用率'])),
          App.h('div', { class: 'gauges' }, [App.h('div', { class: 'g' }, [App.h('div', { id: 'ct_gauge_bed' }), App.h('div', { class: 'g-lb' }, ['床位占用']) ]), App.h('div', { class: 'g' }, [App.h('div', { id: 'ct_gauge_icu' }), App.h('div', { class: 'g-lb' }, ['ICU 占用']) ])]),
          App.h('div', { class: 'chart-body', id: 'ct_hosprate', style: 'height:96px;margin-top:6px' })
        ]),
        App.h('div', { class: 'screen-card' }, [
          App.h('div', { class: 'hd' }, [App.h('span', { class: 'bar' }), '事件类型分布'], App.h('span', { class: 'hd-tag' }, ['五分类'])),
          App.h('div', { class: 'chart-body', id: 'ct_types' })
        ])
      ]),
      // 中栏：英雄趋势 + 病例 + 时效
      App.h('div', { class: 'screen-col hero' }, [
        App.h('div', { class: 'screen-card hero-card' }, [
          App.h('div', { class: 'hd' }, [App.h('span', { class: 'bar' }), '近7天事件 / 病例趋势'], App.h('span', { class: 'hd-tag' }, ['事件·病例'])),
          App.h('div', { class: 'chart-body', id: 'ct_trend', style: 'min-height:150px' })
        ]),
        App.h('div', { class: 'screen-card' }, [
          App.h('div', { class: 'hd' }, [App.h('span', { class: 'bar' }), '病例状态分布'], App.h('span', { class: 'hd-tag' }, ['在治/转归'])),
          App.h('div', { class: 'chart-body', id: 'ct_cases' })
        ]),
        App.h('div', { class: 'screen-card' }, [
          App.h('div', { class: 'hd' }, [App.h('span', { class: 'bar' }), '响应时效'], App.h('span', { class: 'hd-tag' }, ['小时'])),
          App.h('div', { class: 'chart-body', id: 'ct_sla' })
        ])
      ]),
      // 右栏：指标环 + 严重程度 + 资源
      App.h('div', { class: 'screen-col' }, [
        App.h('div', { class: 'screen-card' }, [
          App.h('div', { class: 'hd' }, [App.h('span', { class: 'bar' }), '关键指标达成'], App.h('span', { class: 'hd-tag' }, ['健康度'])),
          App.h('div', { class: 'rings', id: 'ct_rings' })
        ]),
        App.h('div', { class: 'screen-card' }, [
          App.h('div', { class: 'hd' }, [App.h('span', { class: 'bar' }), '病例严重程度'], App.h('span', { class: 'hd-tag' }, ['轻重危'])),
          App.h('div', { class: 'chart-body', id: 'ct_sev' })
        ]),
        App.h('div', { class: 'screen-card' }, [
          App.h('div', { class: 'hd' }, [App.h('span', { class: 'bar' }), '设备 / 药品资源'], App.h('span', { class: 'hd-tag' }, ['实时'])),
          App.h('div', { class: 'screen-scroll', id: 'ct_res' })
        ])
      ])
    ]));

    // ===== 底部信息区 =====
    s.appendChild(App.h('div', { class: 'screen-bottom' }, [
      App.h('div', { class: 'screen-card' }, [
        App.h('div', { class: 'hd' }, [App.h('span', { class: 'bar' }), '在办事件'], App.h('span', { class: 'hd-tag', id: 'ct_events_cnt' }, [''])),
        App.h('div', { class: 'screen-scroll', id: 'ct_events' })
      ]),
      App.h('div', { class: 'screen-card' }, [
        App.h('div', { class: 'hd' }, [App.h('span', { class: 'bar' }), '处置阶段漏斗'], App.h('span', { class: 'hd-tag' }, ['转化率'])),
        App.h('div', { class: 'chart-body', id: 'ct_funnel' })
      ]),
      App.h('div', { class: 'screen-card' }, [
        App.h('div', { class: 'hd' }, [App.h('span', { class: 'bar' }), '预警与待办'], App.h('span', { class: 'hd-tag', id: 'ct_alerts_cnt' }, [''])),
        App.h('div', { class: 'screen-scroll', id: 'ct_alerts' })
      ]),
      App.h('div', { class: 'screen-card' }, [
        App.h('div', { class: 'hd' }, [App.h('span', { class: 'bar' }), '处置时间线'], App.h('span', { class: 'hd-tag' }, ['最近动态'])),
        App.h('div', { class: 'screen-scroll', id: 'ct_timeline' })
      ])
    ]));

    // ===== 底部滚动动态条 =====
    s.appendChild(App.h('div', { class: 'screen-ticker' }, [
      App.h('div', { class: 'tk-label' }, ['◈ 最新动态']),
      App.h('div', { class: 'tk-wrap' }, [App.h('div', { class: 'tk-track', id: 'ct_ticker' }, ['加载中...'])])
    ]));

    this.clockTimer = setInterval(() => { const c = document.getElementById('scr_clock'); if (c) c.textContent = this.clock(); }, 1000);
    return s;
  },

  clock() {
    const d = new Date(); const p = n => String(n).padStart(2, '0');
    const wd = '日一二三四五六'[d.getDay()];
    const date = document.getElementById('scr_date');
    if (date) date.textContent = `${d.getFullYear()}年${p(d.getMonth() + 1)}月${p(d.getDate())}日 星期${wd}`;
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  },

  async refresh() {
    if (this.screenMode) await this.refreshScreen();
    else await this.refreshNormal();
  },

  async refreshNormal() {
    const d = await App.api.get('/dashboard/overview');
    const box = document.getElementById('dash_normal');
    if (!d || !box) return;
    box.innerHTML = '';
    // 在办焦点：当前处置中的事件 + 流程定位
    const focus = d.activeEvents[0];
    if (focus) {
      const focusCard = App.h('div', { class: 'card', style: 'margin-bottom:12px' }, [
        App.h('div', { class: 'flex between items wrap gap', style: 'margin-bottom:10px' }, [
          App.h('div', { class: 'section-title', style: 'margin:0' }, [App.h('span', { class: 'bar' }), `在办焦点：${focus.typeIcon || ''} ${focus.title}`]),
          App.h('div', { class: 'flex gap items' }, [
            App.tag(focus.level, focus.level === 'I级' || focus.level === 'II级' ? 'bad' : 'warn'),
            App.h('a', { style: 'cursor:pointer', onclick: () => App.go('response', { eventId: focus.id }) }, ['前往处置 ->'])
          ])
        ]),
        App.stepper(focus.stage)
      ]);
      box.appendChild(focusCard);
    }
    // KPI
    const k = d.kpi;
    box.appendChild(App.h('div', { class: 'kpi-row' }, [
      this.kpi('在办事件', k.active, 'info'), this.kpi('累计事件', k.totalEvents, ''),
      this.kpi('在治病例', k.activeCases, 'warn'), this.kpi('待研判', k.pendingReports, k.pendingReports ? 'danger' : 'ok'),
      this.kpi('出动人员', k.onDuty, 'ok'), this.kpi('受阻任务', k.blockedTasks, k.blockedTasks ? 'danger' : 'ok'),
      this.kpi('超时升级', k.escalated, k.escalated ? 'danger' : 'ok'), this.kpi('报告逾期', k.routineLate, k.routineLate ? 'danger' : 'ok')
    ]));
    // 趋势 + 类型
    const ov = await App.api.get('/statistics/overview');
    const types = await App.api.get('/statistics/event-types');
    const grid = App.h('div', { class: 'grid g2', style: 'margin-top:12px' });
    const tCard = App.h('div', { class: 'card chart-card' }, [App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '近7天趋势']), App.h('div', { id: 'n_trend', style: 'height:200px' })]);
    const tyCard = App.h('div', { class: 'card chart-card' }, [App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '事件类型分布']), App.h('div', { id: 'n_types', style: 'height:200px;display:flex;align-items:center;justify-content:center' })]);
    grid.appendChild(tCard); grid.appendChild(tyCard);
    box.appendChild(grid);
    if (ov) Charts.line(document.getElementById('n_trend'), { labels: ov.trend.map(t => t.date), series: [{ name: '事件', data: ov.trend.map(t => t.events) }, { name: '病例', data: ov.trend.map(t => t.cases) }], showValues: true });
    if (types) Charts.pie(document.getElementById('n_types'), { data: types });
    // 在办事件列表
    const active = d.activeEvents || [];
    const eCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), `在办事件 (${active.length})`])]);
    if (!active.length) eCard.appendChild(App.h('div', { class: 'empty' }, ['当前无在办事件，系统处于常态监测']));
    else active.forEach(e => eCard.appendChild(App.h('div', { class: 'flex between items', style: 'padding:8px 0;border-bottom:1px dashed var(--line);cursor:pointer', onclick: () => this.eventDetail(e.id) }, [
      App.h('div', {}, [App.h('b', {}, [(e.typeIcon || '') + ' ' + e.title]), App.h('div', { class: 'muted' }, [e.location + ' · ' + App.fmt(e.createdAt)])]),
      App.tag(e.stageName, 'info')
    ])));
    box.appendChild(eCard);
  },

  async refreshScreen() {
    const d = await App.api.get('/dashboard/overview');
    if (!d) return;
    const k = d.kpi;

    // KPI 灯带（图标药丸 + 数值 + sparkline）
    const kpis = document.getElementById('scr_kpis');
    if (kpis) {
      kpis.innerHTML = '';
      const ov = await App.api.get('/statistics/overview');
      const sparkData = ov ? ov.trend : [];
      const items = [
        { n: k.active, l: '在办事件', cls: 'info', ico: '🔔', spark: sparkData.map(t => t.events), c: '#3b82f6' },
        { n: k.pendingReports, l: '待研判', cls: k.pendingReports ? 'warn' : 'ok', ico: '📨', spark: null },
        { n: k.onDuty, l: '出动人员', cls: 'ok', ico: '🚑', spark: null },
        { n: k.activeCases, l: '在治病例', cls: 'warn', ico: '🏥', spark: sparkData.map(t => t.cases), c: '#f59e0b' },
        { n: k.blockedTasks, l: '受阻任务', cls: k.blockedTasks ? 'danger' : 'ok', ico: '⛔', spark: null },
        { n: k.escalated, l: '超时升级', cls: k.escalated ? 'danger' : 'ok', ico: '⏰', spark: null },
        { n: k.routineLate, l: '报告逾期', cls: k.routineLate ? 'danger' : 'ok', ico: '📅', spark: null },
        { n: k.closedEvents, l: '已终止', cls: '', ico: '✓', spark: null }
      ];
      items.forEach(i => {
        const pill = App.h('div', { class: 'ico ' + (i.cls || '') }, [i.ico]);
        const b = App.h('div', { class: 'b' }, [
          App.h('div', { class: 'n', 'data-v': i.n }, [String(i.n)]),
          App.h('div', { class: 'l' }, [i.l])
        ]);
        const card = App.h('div', { class: 'skpi ' + (i.cls || '') }, [pill, b]);
        if (i.spark) {
          const sp = App.h('div', { class: 'sp' });
          card.appendChild(sp);
          setTimeout(() => Charts.sparkline(sp, i.spark, i.c), 0);
        }
        kpis.appendChild(card);
      });
    }

    // 顶部：模式/阶段徽章
    const metaBox = document.getElementById('scr_meta');
    if (metaBox) {
      metaBox.innerHTML = '';
      const mode = await (async () => {
        const ev = d.activeEvents && d.activeEvents[0];
        if (ev) { const m = await App.api.get('/agent/mode/' + ev.id); return m && m.mode; }
        return null;
      })();
      metaBox.appendChild(App.h('span', { class: 'meta-chip mode' }, [mode === 'drill' ? '🎬 模拟演练' : '🤝 辅助处置']));
      metaBox.appendChild(App.h('span', { class: 'meta-chip' }, ['事件 ' + k.totalEvents]));
      metaBox.appendChild(App.h('span', { class: 'meta-chip alert' }, ['在治病例 ' + k.activeCases]));
    }

    // 并行拉取所有统计
    const [types, cases, res, sla] = await Promise.all([
      App.api.get('/statistics/event-types'),
      App.api.get('/statistics/cases'),
      App.api.get('/statistics/resources'),
      App.api.get('/statistics/sla')
    ]);

    // 左栏：资源仪表盘
    if (res) {
      const bedPct = res.summary.bedTotal ? Math.round(res.summary.bedOccupied / res.summary.bedTotal * 100) : 0;
      const icuPct = res.summary.icuTotal ? Math.round(res.summary.icuOccupied / res.summary.icuTotal * 100) : 0;
      Charts.gauge(document.getElementById('ct_gauge_bed'), { value: bedPct, color: '#34d399', width: 104, height: 78 });
      Charts.gauge(document.getElementById('ct_gauge_icu'), { value: icuPct, color: '#22d3ee', width: 104, height: 78 });
      Charts.hbar(document.getElementById('ct_hosprate'), { data: res.hospRate.slice(0, 3).map(h => ({ name: h.name, value: h.bedRate })), max: 100, height: 3 * 26 + 10 });
    }
    if (types) Charts.pie(document.getElementById('ct_types'), { data: types });

    // 中栏
    const ov = await App.api.get('/statistics/overview');
    if (ov) Charts.line(document.getElementById('ct_trend'), { labels: ov.trend.map(t => t.date), series: [{ name: '事件', data: ov.trend.map(t => t.events) }, { name: '病例', data: ov.trend.map(t => t.cases) }], showValues: true });
    if (cases) Charts.bar(document.getElementById('ct_cases'), { data: cases.byStatus });
    if (sla) {
      const s = sla.summary;
      Charts.bar(document.getElementById('ct_sla'), { data: [{ name: '启动', value: s.avgLaunchH }, { name: '到场', value: s.avgToFieldH }, { name: '处置', value: s.avgTotalH }] });
    }

    // 右栏：环形组（关键指标达成）
    const rings = document.getElementById('ct_rings');
    if (rings) {
      rings.innerHTML = '';
      const taskDoneRate = k.blockedTasks === 0 && d.activeEvents.length ? 100 : (d.activeEvents.length ? 70 : 100);
      const reportRate = k.routineLate === 0 ? 100 : 60;
      const ackRate = k.escalated === 0 ? 100 : 80;
      const items = [
        { v: taskDoneRate, l: '任务顺畅', c: '#34d399' },
        { v: reportRate, l: '报告合规', c: '#3b82f6' },
        { v: ackRate, l: '反馈及时', c: '#22d3ee' },
        { v: res ? (res.summary.bedTotal ? 100 - Math.round(res.summary.bedOccupied / res.summary.bedTotal * 100) : 100) : 100, l: '床位余量', c: '#a78bfa' }
      ];
      items.forEach(it => {
        const box = App.h('div', { class: 'ring-it' });
        rings.appendChild(box);
        setTimeout(() => Charts.ring(box, { value: it.v, label: it.l, color: it.c, width: 78, height: 78 }), 0);
      });
    }
    if (cases) Charts.pie(document.getElementById('ct_sev'), { data: cases.bySeverity });

    // 右栏：设备/药品资源
    const resBox = document.getElementById('ct_res');
    if (resBox && res) {
      resBox.innerHTML = '';
      res.devices.forEach(dev => {
        const rate = dev.total ? Math.round(dev.inUse / dev.total * 100) : 0;
        resBox.appendChild(App.h('div', { style: 'padding:5px 0;border-bottom:1px dashed rgba(59,130,246,.15)' }, [
          App.h('div', { class: 'flex between', style: 'font-size:11px' }, [App.h('span', { style: 'color:#93c5fd' }, [dev.name]), App.h('span', {}, [`${dev.inUse}/${dev.total}`])]),
          App.h('div', { class: 'progress', style: 'margin-top:3px;height:4px' }, [App.h('div', { class: 'fill', style: 'width:' + rate + '%' })])
        ]));
      });
      res.medDays.filter(m => m.daysLeft < 999).slice(0, 4).forEach(m => {
        resBox.appendChild(App.h('div', { class: 'flex between', style: 'padding:4px 0;font-size:11px' }, [
          App.h('span', { style: 'color:#93c5fd' }, ['💊 ' + m.name]),
          App.h('span', { style: m.daysLeft < 5 ? 'color:var(--red)' : 'color:var(--green)' }, [m.daysLeft + '天'])
        ]));
      });
    }

    // 底部：在办事件
    const evBox = document.getElementById('ct_events');
    if (evBox) {
      evBox.innerHTML = '';
      const active = d.activeEvents || [];
      const cnt = document.getElementById('ct_events_cnt');
      if (cnt) cnt.textContent = active.length + ' 起';
      if (!active.length) evBox.appendChild(App.h('div', { class: 'empty' }, ['当前无在办事件']));
      else active.slice(0, 8).forEach(e => {
        evBox.appendChild(App.h('div', { class: 'event-item', onclick: () => this.eventDetail(e.id) }, [
          App.h('div', { class: 't' }, [(e.typeIcon || '') + ' ' + e.title]),
          App.h('div', { class: 'm' }, [
            App.tag(e.stageName, e.stage === 'field' ? 'ok' : 'info'),
            App.tag(e.level, e.level === 'I级' || e.level === 'II级' ? 'bad' : 'warn'),
            App.h('span', { class: 'muted', style: 'margin-left:6px' }, [e.location])
          ])
        ]));
      });
    }

    // 底部：处置阶段漏斗（按事件状态聚合）
    const funnelBox = document.getElementById('ct_funnel');
    if (funnelBox) {
      const allEvents = d.totalEvents || 0;
      const active = d.activeEvents.length;
      const pending = d.pendingReports.length;
      // 阶段：上报->启动->处置->终止
      Charts.funnel(funnelBox, {
        data: [
          { name: '上报', value: pending + allEvents },
          { name: '已启动', value: allEvents },
          { name: '处置中', value: active },
          { name: '已终止', value: d.kpi.closedEvents || 0 }
        ]
      });
    }

    // 底部：预警与待办
    const alBox = document.getElementById('ct_alerts');
    if (alBox) {
      alBox.innerHTML = '';
      const alerts = [];
      (d.caseBoard && d.caseBoard.abnormal || []).forEach(a => alerts.push({ t: `病例异常 ${a.trackNo}`, d: a.msg, kind: 'risk' }));
      if (d.resourceSummary && d.resourceSummary.alerts) {
        (d.resourceSummary.alerts.hospitals || []).forEach(h => alerts.push({ t: h.name, d: h.alerts.join(','), kind: 'risk' }));
        (d.resourceSummary.alerts.lowMedicines || []).forEach(m => alerts.push({ t: `药品 ${m.name}`, d: `仅剩${m.daysLeft}天`, kind: 'warn' }));
      }
      d.pendingReports.forEach(r => alerts.push({ t: `待研判 ${r.situation.slice(0, 12)}`, d: r.location, kind: 'info' }));
      d.pendingRequests.forEach(r => alerts.push({ t: `待批申请 ${r.kind}`, d: r.detail, kind: 'info' }));
      const cnt = document.getElementById('ct_alerts_cnt');
      if (cnt) cnt.textContent = alerts.length + ' 条';
      if (!alerts.length) alBox.appendChild(App.h('div', { class: 'empty' }, ['无预警']));
      else alerts.slice(0, 10).forEach(a => alBox.appendChild(App.h('div', { class: 'decision-item ' + a.kind }, [App.h('div', { class: 'tt', style: 'font-size:12px' }, [a.t]), App.h('div', { class: 'mm' }, [a.d])])));
    }

    // 底部：时间线 + 滚动动态条
    const tlBox = document.getElementById('ct_timeline');
    let tickerItems = [];
    if (tlBox) {
      const events = await App.api.get('/dispatch/events');
      let recent = [];
      for (const e of (events || []).slice(0, 3)) {
        const d2 = await App.api.get('/dashboard/event/' + e.id);
        if (d2 && d2.timeline) recent = recent.concat(d2.timeline.slice(0, 5).map(t => ({ ...t, title: e.title })));
      }
      recent = recent.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 10);
      tickerItems = recent;
      tlBox.innerHTML = '';
      if (!recent.length) tlBox.appendChild(App.h('div', { class: 'empty' }, ['暂无动态']));
      else recent.forEach(t => tlBox.appendChild(App.h('div', { class: 'mini-item' }, [
        App.h('div', { class: 'tt' }, [t.action]),
        App.h('div', { class: 'mm' }, [App.fmt(t.at) + ' · ' + (t.detail || '').slice(0, 22)])
      ])));
    }
    // 滚动条
    const tkTrack = document.getElementById('ct_ticker');
    if (tkTrack) {
      tkTrack.innerHTML = '';
      if (!tickerItems.length) tkTrack.textContent = '暂无动态';
      else {
        const seg = App.h('span', { class: 'tk-item' });
        tickerItems.forEach(t => {
          seg.appendChild(App.h('span', {}, [`【${t.title || '事件'}】${t.action} · ${(t.detail || '').slice(0, 30)} · ${t.actor || ''}　　`]));
        });
        tkTrack.appendChild(seg);
      }
    }
  },

  kpi(l, v, cls) { return App.h('div', { class: 'skpi ' + (cls || '') }, [App.h('div', { class: 'b' }, [App.h('div', { class: 'n' }, [String(v)]), App.h('div', { class: 'l' }, [l])])]); },

  // 事件详情弹层（简化版，复用原逻辑）
  async eventDetail(eventId) {
    const d = await App.api.get('/dashboard/event/' + eventId);
    if (!d) return;
    const e = d.event;
    const body = App.h('div', {}, []);
    body.appendChild(App.h('div', { class: 'flex gap wrap', style: 'margin-bottom:10px' }, [
      App.tag(e.typeIcon + ' ' + e.typeName, 'info'), App.tag(e.stageName, 'warn'), App.tag(e.level, 'bad')
    ]));
    if (d.personnel && d.personnel.length) {
      body.appendChild(App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), `人员出动 ${d.personnel.filter(p => p.status === 'arrived').length}/${d.personnel.length}`]));
    }
    if (d.timeline && d.timeline.length) {
      const tl = App.h('div', { class: 'timeline' });
      d.timeline.slice(0, 10).forEach(t => tl.appendChild(App.h('div', { class: 'tn' }, [App.h('div', { class: 't' }, [App.fmt(t.at) + ' · ' + t.actor]), App.h('div', { class: 'd' }, [t.action + (t.detail ? '：' + t.detail : '')])])));
      body.appendChild(tl);
    }
    App.modal(e.title, body, () => true, '关闭');
  }
};
