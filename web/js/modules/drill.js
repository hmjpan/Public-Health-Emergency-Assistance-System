// 演练模式 -- 脚本库 + 启动演练 + 注入点推进 + 评估报告
App.modules.drill = {
  async render(root, params) {
    App.setTitle('演练模式');
    root.innerHTML = '';
    const page = App.h('div', { class: 'page' });
    root.appendChild(page);

    const tab = params.tab || 'scripts';
    page.appendChild(App.h('div', { class: 'flex gap', style: 'margin-bottom:14px' }, [
      App.h('button', { class: tab === 'scripts' ? 'primary' : '', onclick: () => App.go('drill', { tab: 'scripts' }) }, ['📋 演练脚本库']),
      App.h('button', { class: tab === 'sessions' ? 'primary' : '', onclick: () => App.go('drill', { tab: 'sessions' }) }, ['▶ 进行中演练']),
      App.h('button', { class: tab === 'assessments' ? 'primary' : '', onclick: () => App.go('drill', { tab: 'assessments' }) }, ['📊 评估报告'])
    ]));

    const body = App.h('div', { id: 'drill_body' });
    page.appendChild(body);
    if (tab === 'scripts') await this.renderScripts(body);
    else if (tab === 'sessions') await this.renderSessions(body);
    else await this.renderAssessments(body);
  },

  /* ========== 演练脚本库 ========== */
  async renderScripts(body) {
    body.innerHTML = '';
    const canWrite = ['commander', 'drill_mgr', 'admin'].includes(App.user.role);
    const canStart = ['commander', 'drill_mgr', 'admin'].includes(App.user.role);

    body.appendChild(App.h('div', { class: 'card' }, [
      App.h('div', { class: 'flex between items wrap gap' }, [
        App.h('div', { class: 'section-title', style: 'margin:0' }, [App.h('span', { class: 'bar' }), '演练脚本库']),
        canWrite ? App.h('button', { class: 'primary', onclick: () => this.editScript() }, ['+ 新建脚本']) : null
      ].filter(Boolean))
    ]));

    const scripts = await App.api.get('/drill/scripts');
    if (!scripts || !scripts.length) { body.appendChild(App.h('div', { class: 'empty', style: 'margin-top:12px' }, ['暂无演练脚本'])); return; }

    const grid = App.h('div', { class: 'event-cards', style: 'margin-top:12px' });
    const typeNames = { INF: '🦠传染病', FOOD: '🍱食源性', ENV: '☣️环境污染', POISON: '⚗️职业中毒', UNK: '❓不明原因' };
    scripts.forEach(s => {
      const card = App.h('div', { class: 'event-card' }, [
        App.h('div', { class: 'flex between items' }, [
          App.h('div', { class: 't' }, [typeNames[s.typeKey] || s.typeKey, ' ', App.h('b', {}, [s.name])]),
          App.tag(s.status === 'published' ? '已发布' : '草稿', s.status === 'published' ? 'ok' : 'warn')
        ]),
        App.h('div', { class: 'muted', style: 'margin:6px 0' }, [s.scenario.slice(0, 60) + (s.scenario.length > 60 ? '...' : '')]),
        App.h('div', { class: 'flex gap wrap', style: 'font-size:12px' }, [
          App.tag(`注入点 ${s.injects.length}`, 'info'),
          App.tag(`标准时效 启动${s.standardSla.launchH}h/到场${s.standardSla.toFieldH}h/总${s.standardSla.totalH}h`, '')
        ]),
        App.h('div', { class: 'muted', style: 'margin:6px 0' }, ['目标: ' + (s.objective || '-').slice(0, 40)]),
        App.h('div', { class: 'flex gap', style: 'margin-top:8px' }, [
          canStart && s.status === 'published' ? App.h('button', { class: 'primary', style: 'padding:5px 14px;font-size:12px', onclick: () => this.startDrill(s) }, ['▶ 启动演练']) : null,
          canWrite ? App.h('button', { style: 'padding:5px 14px;font-size:12px', onclick: () => this.editScript(s) }, ['编辑']) : null,
          App.h('button', { class: 'ghost', style: 'padding:5px 14px;font-size:12px', onclick: () => this.viewScript(s) }, ['查看详情'])
        ].filter(Boolean))
      ]);
      grid.appendChild(card);
    });
    body.appendChild(grid);
  },

  viewScript(s) {
    const body = App.h('div', {}, []);
    body.appendChild(App.h('div', { class: 'muted', style: 'margin-bottom:8px' }, ['情景: ' + s.scenario]));
    body.appendChild(App.h('div', { class: 'muted', style: 'margin-bottom:8px' }, ['目标: ' + s.objective]));
    body.appendChild(App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), `注入点序列 (${s.injects.length})`]));
    s.injects.forEach((inj, i) => {
      body.appendChild(App.h('div', { style: 'padding:8px 0;border-bottom:1px dashed var(--line)' }, [
        App.h('div', { class: 'flex between items' }, [
          App.h('b', {}, [`${i + 1}. ${inj.name}`]),
          App.tag(`+${inj.atMinutes}min`, 'info')
        ]),
        App.h('div', { class: 'muted', style: 'margin:4px 0' }, [inj.desc]),
        App.h('div', { class: 'muted' }, ['操作: ' + inj.action])
      ]));
    });
    body.appendChild(App.h('div', { class: 'section-title', style: 'margin-top:12px' }, [App.h('span', { class: 'bar' }), '标准时效']));
    body.appendChild(App.h('div', { class: 'flex gap wrap' }, [
      App.tag(`启动 ≤${s.standardSla.launchH}h`, 'info'), App.tag(`到场 ≤${s.standardSla.toFieldH}h`, 'info'), App.tag(`总时长 ≤${s.standardSla.totalH}h`, 'info')
    ]));
    App.modal(s.name, body, () => true, '关闭');
  },

  editScript(s) {
    const isEdit = !!s;
    const name = App.h('input', { id: 'ds_name', value: s ? s.name : '', placeholder: '脚本名称' });
    const typeKey = App.h('select', { id: 'ds_type' }, [['INF', '传染病'], ['FOOD', '食源性'], ['ENV', '环境污染'], ['POISON', '职业中毒'], ['UNK', '不明原因']].map(([v, l]) => App.h('option', { value: v, selected: s && s.typeKey === v ? '' : null }, [l])));
    const scenario = App.h('textarea', { id: 'ds_scn', rows: 2, placeholder: '情景描述' }, [s ? s.scenario : '']);
    const objective = App.h('input', { id: 'ds_obj', value: s ? s.objective : '', placeholder: '演练目标' });
    const launchH = App.h('input', { id: 'ds_lh', type: 'number', step: '0.1', value: s ? s.standardSla.launchH : 0.5 });
    const toFieldH = App.h('input', { id: 'ds_tf', type: 'number', step: '0.1', value: s ? s.standardSla.toFieldH : 2 });
    const totalH = App.h('input', { id: 'ds_th', type: 'number', step: '0.1', value: s ? s.standardSla.totalH : 8 });
    App.modal((isEdit ? '编辑' : '新建') + '演练脚本', App.h('div', {}, [
      App.h('div', { class: 'field' }, [App.h('label', {}, ['名称 *']), name]),
      App.h('div', { class: 'grid g2' }, [
        App.h('div', { class: 'field' }, [App.h('label', {}, ['事件类型']), typeKey]),
        App.h('div', { class: 'field' }, [App.h('label', {}, ['演练目标']), objective])
      ]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['情景描述']), scenario]),
      App.h('div', { class: 'section-title', style: 'font-size:13px' }, ['标准时效(小时)']),
      App.h('div', { class: 'grid g3' }, [
        App.h('div', { class: 'field' }, [App.h('label', {}, ['启动≤']), launchH]),
        App.h('div', { class: 'field' }, [App.h('label', {}, ['到场≤']), toFieldH]),
        App.h('div', { class: 'field' }, [App.h('label', {}, ['总时长≤']), totalH])
      ]),
      App.h('div', { class: 'hint' }, ['注入点可在创建后通过"查看详情"逐步设计，此处先设基础信息'])
    ]), async () => {
      if (!name.value.trim()) { App.toast('请填名称', 'err'); return false; }
      const body = {
        name: name.value.trim(), typeKey: typeKey.value, scenario: scenario.value.trim(), objective: objective.value.trim(),
        standardSla: { launchH: +launchH.value, toFieldH: +toFieldH.value, totalH: +totalH.value },
        injects: s ? s.injects : [], status: 'published'
      };
      const r = isEdit ? await App.api.patch('/drill/scripts/' + s.id, body) : await App.api.post('/drill/scripts', body);
      if (r) { App.toast(isEdit ? '已更新' : '已创建'); App.go('drill', { tab: 'scripts' }); }
    }, '保存');
  },

  startDrill(s) {
    const title = App.h('input', { id: 'sd_title', value: '【演练】' + s.name });
    const location = App.h('input', { id: 'sd_loc', value: '', placeholder: '演练地点' });
    const level = App.h('select', { id: 'sd_lv' }, ['IV级', 'III级', 'II级', 'I级'].map(l => App.h('option', { value: l, selected: l === 'IV级' ? '' : null }, [l])));
    App.modal('启动演练 - ' + s.name, App.h('div', {}, [
      App.h('div', { class: 'field' }, [App.h('label', {}, ['演练事件标题']), title]),
      App.h('div', { class: 'grid g2' }, [
        App.h('div', { class: 'field' }, [App.h('label', {}, ['地点']), location]),
        App.h('div', { class: 'field' }, [App.h('label', {}, ['级别']), level])
      ]),
      App.h('div', { class: 'hint', style: 'color:var(--amber)' }, ['⚠ 演练事件标记 isDrill，不计入正式统计；通知将真实发送给通讯录人员'])
    ]), async () => {
      const r = await App.api.post('/drill/start', { scriptId: s.id, title: title.value.trim(), location: location.value.trim(), level: level.value });
      if (r) { App.toast(`演练已启动!通知${r.data.event ? '' : ''}人,注入点${r.data.session.injectCount}个`); App.go('drill', { tab: 'sessions' }); }
    }, '启动演练');
  },

  /* ========== 进行中演练 ========== */
  async renderSessions(body) {
    body.innerHTML = '';
    const canOperate = ['commander', 'drill_mgr', 'admin'].includes(App.user.role);

    // 找所有演练事件
    const events = await App.api.get('/dispatch/events');
    const drillEvents = (events || []).filter(e => e.isDrill);
    if (!drillEvents.length) { body.appendChild(App.h('div', { class: 'empty' }, ['暂无演练事件'])); return; }

    for (const e of drillEvents) {
      const card = App.h('div', { class: 'card', style: 'margin-bottom:12px' }, [
        App.h('div', { class: 'flex between items' }, [
          App.h('div', {}, [App.tag('演练', 'warn'), ' ', App.h('b', {}, [e.title]), ' ', App.tag(e.stageName, 'info')]),
          canOperate && e.status !== 'closed' ? App.h('button', { class: 'primary', style: 'padding:5px 14px;font-size:12px', onclick: () => this.assess(e) }, ['生成评估报告']) : null
        ].filter(Boolean)),
        App.h('div', { class: 'muted', style: 'margin:6px 0' }, [`${e.location || '-'} · ${App.fmt(e.createdAt)}`])
      ]);
      body.appendChild(card);

      // 注入点进度
      if (e.drillSessionId) {
        const session = await App.api.get('/drill/sessions/' + e.drillSessionId);
        if (session) {
          const injBox = App.h('div', { style: 'margin-top:8px' });
          session.injectProgress.forEach(inj => {
            injBox.appendChild(App.h('div', { class: 'flex between items', style: 'padding:6px 0;border-bottom:1px dashed var(--line)' }, [
              App.h('div', {}, [
                App.h('span', { class: 'dot ' + (inj.triggered ? 'g' : 'gray') }),
                App.h('b', {}, [`${inj.seq}. ${inj.name}`]),
                App.h('span', { class: 'muted', style: 'margin-left:8px' }, [inj.desc])
              ]),
              App.h('div', { class: 'flex gap items' }, [
                inj.triggered ? App.tag('已触发', 'ok') : (canOperate && e.status !== 'closed' ? App.h('button', { style: 'padding:3px 10px;font-size:12px', onclick: () => this.triggerInject(e.drillSessionId, inj.seq) }, ['触发']) : App.tag('待触发', 'warn'))
              ].filter(Boolean))
            ]));
          });
          card.appendChild(injBox);
        }
      }
    }
  },

  async triggerInject(sessionId, seq) {
    const r = await App.api.post('/drill/sessions/' + sessionId + '/inject/' + seq);
    if (r) { App.toast('注入点已触发: ' + r.data.name); App.go('drill', { tab: 'sessions' }); }
  },

  async assess(e) {
    if (!e.drillSessionId) { App.toast('该演练无会话记录', 'err'); return; }
    if (!confirm('确认生成演练评估报告？将结束本次演练。')) return;
    const r = await App.api.post('/drill/sessions/' + e.drillSessionId + '/assess');
    if (r) { App.toast('评估报告已生成'); this.showAssessment(r); }
  },

  /* ========== 评估报告 ========== */
  async renderAssessments(body) {
    body.innerHTML = '';
    const list = await App.api.get('/drill/assessments');
    if (!list || !list.length) { body.appendChild(App.h('div', { class: 'empty' }, ['暂无评估报告'])); return; }
    list.forEach(a => {
      body.appendChild(App.h('div', { class: 'card', style: 'margin-bottom:12px;cursor:pointer', onclick: () => this.showAssessment(a) }, [
        App.h('div', { class: 'flex between items' }, [
          App.h('div', {}, [App.h('b', {}, [a.scriptName]), ' ', App.tag(a.grade, a.grade === '优秀' ? 'ok' : a.grade === '不合格' ? 'bad' : 'info')]),
          App.h('div', { class: 'skpi ' + (a.overall >= 75 ? 'ok' : a.overall >= 60 ? 'warn' : 'danger'), style: 'padding:6px 12px' }, [App.h('div', { class: 'n', style: 'font-size:20px' }, [String(a.overall)]), App.h('div', { class: 'l' }, ['综合评分'])])
        ]),
        App.h('div', { class: 'muted', style: 'margin:6px 0' }, [`${App.fmt(a.startedAt)} - ${App.fmt(a.finishedAt)}`]),
        App.h('div', { class: 'flex gap wrap' }, [
          App.tag(`时效${a.sla.score}%`, 'info'), App.tag(`参与${a.participation.ackRate}%`, 'info'),
          App.tag(`任务${a.tasks.taskRate}%`, 'info'), App.tag(`注入${a.injects.injectRate}%`, 'info')
        ])
      ]));
    });
  },

  showAssessment(a) {
    const body = App.h('div', {}, []);
    // 综合评分
    body.appendChild(App.h('div', { class: 'flex between items', style: 'margin-bottom:12px' }, [
      App.h('div', {}, [App.h('div', { style: 'font-size:36px;font-weight:800;color:' + (a.overall >= 75 ? 'var(--green)' : a.overall >= 60 ? 'var(--amber)' : 'var(--red)') }, [String(a.overall) + '分']), App.h('div', { class: 'l' }, ['综合评分 · ' + a.grade])]),
      App.h('div', { class: 'muted' }, [`${App.fmt(a.startedAt)} - ${App.fmt(a.finishedAt)}`])
    ]));

    // 各项得分环形图
    const rings = App.h('div', { class: 'flex wrap around', style: 'gap:10px;margin:12px 0' });
    [['时效达标', a.sla.score, '#3b82f6'], ['通知确认', a.participation.ackRate, '#22d3ee'], ['人员到位', a.participation.arriveRate, '#34d399'], ['任务完成', a.tasks.taskRate, '#f59e0b'], ['注入完成', a.injects.injectRate, '#a78bfa']].forEach(([l, v, c]) => {
      const box = App.h('div', { style: 'text-align:center;width:80px' });
      rings.appendChild(box);
      setTimeout(() => Charts.ring(box, { value: v, label: l, color: c, width: 72, height: 72 }), 0);
    });
    body.appendChild(rings);

    // 时效明细
    body.appendChild(App.h('div', { class: 'section-title', style: 'margin-top:12px' }, [App.h('span', { class: 'bar' }), '响应时效']));
    const sla = a.sla;
    body.appendChild(App.h('div', { class: 'flex gap wrap' }, [
      App.tag(`实际启动 ${sla.actualLaunchH || 0}h / 标准 ${sla.standard.launchH}h`, sla.actualLaunchH <= sla.standard.launchH ? 'ok' : 'bad'),
      App.tag(`实际到场 ${sla.actualToFieldH || 0}h / 标准 ${sla.standard.toFieldH}h`, sla.actualToFieldH <= sla.standard.toFieldH ? 'ok' : 'bad'),
      App.tag(`实际总时长 ${sla.actualTotalH || 0}h / 标准 ${sla.standard.totalH}h`, sla.actualTotalH <= sla.standard.totalH ? 'ok' : 'bad')
    ]));

    // 参与与任务
    body.appendChild(App.h('div', { class: 'section-title', style: 'margin-top:12px' }, [App.h('span', { class: 'bar' }), '参与与任务']));
    body.appendChild(App.h('div', { class: 'flex gap wrap' }, [
      App.tag(`通知 ${a.participation.acked}/${a.participation.notified}`, 'info'),
      App.tag(`到位 ${a.participation.arrived}/${a.participation.personnelTotal}`, 'info'),
      App.tag(`任务 ${a.tasks.done}/${a.tasks.total}`, 'info'),
      App.tag(`病例 ${a.cases.total}`, 'info')
    ]));

    // 注入点执行
    body.appendChild(App.h('div', { class: 'section-title', style: 'margin-top:12px' }, [App.h('span', { class: 'bar' }), `注入点执行 (${a.injects.triggered}/${a.injects.total})`]));
    a.injects.detail.forEach(inj => {
      body.appendChild(App.h('div', { class: 'flex between items', style: 'padding:5px 0;border-bottom:1px dashed var(--line)' }, [
        App.h('div', {}, [App.h('span', { class: 'dot ' + (inj.triggered ? 'g' : 'gray') }), `${inj.seq}. ${inj.name}`]),
        App.h('span', { class: 'muted' }, [inj.triggered ? App.fmt(inj.triggeredAt) : '未触发'])
      ]));
    });

    // 时间线
    if (a.timeline && a.timeline.length) {
      body.appendChild(App.h('div', { class: 'section-title', style: 'margin-top:12px' }, [App.h('span', { class: 'bar' }), '处置时间线']));
      const tl = App.h('div', { class: 'timeline' });
      a.timeline.forEach(t => tl.appendChild(App.h('div', { class: 'tn' }, [App.h('div', { class: 't' }, [App.fmt(t.at) + ' · ' + t.actor]), App.h('div', { class: 'd' }, [t.action + (t.detail ? '：' + t.detail : '')])])));
      body.appendChild(tl);
    }
    App.modal('演练评估报告 - ' + a.scriptName, body, () => true, '关闭');
  }
};
