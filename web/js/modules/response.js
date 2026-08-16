// 出动状态 —— 人员出动强制状态更新 + 决策层实时视图 + 启动完成校验
App.modules.response = {
  async render(root, params) {
    App.setTitle('出动状态');
    root.innerHTML = '';
    const page = App.h('div', { class: 'page' });
    root.appendChild(page);

    const events = await App.api.get('/dispatch/events');
    const active = (events || []).filter(e => e.status !== 'closed');
    if (!active.length) {
      page.appendChild(App.h('div', { class: 'empty' }, ['当前无在办事件']));
      page.appendChild(App.h('div', { class: 'empty-cta' }, [
        ['commander', 'deputy'].includes(App.user.role) ? App.h('button', { class: 'primary', onclick: () => App.go('dispatch') }, ['🚨 去一键启动']) : null,
        App.h('button', { onclick: () => App.go('drill') }, ['🎬 或进入演练模式'])
      ].filter(Boolean)));
      return;
    }

    const eventId = params.eventId || active[0].id;
    const e = active.find(x => x.id === eventId) || active[0];
    this._ev = e.id; // 记录当前事件，操作后刷新保持在原事件

    // 流程定位：当前环节（响应启动/现场处置/终止复盘）
    page.appendChild(App.stepper(e.stage));

    // 事件选择
    page.appendChild(App.h('div', { class: 'card' }, [
      App.h('div', { class: 'flex between items wrap gap' }, [
        App.h('div', { class: 'section-title', style: 'margin:0' }, [App.h('span', { class: 'bar' }), `${e.typeIcon || ''} ${e.title} — 应急响应启动阶段`]),
        (() => {
          const sel = App.h('select', { style: 'width:auto', onchange: ev => App.go('response', { eventId: ev.target.value }) });
          active.forEach(x => sel.appendChild(App.h('option', { value: x.id, selected: x.id === e.id ? '' : null }, [x.title])));
          return sel;
        })()
      ])
    ]));

    // 启动完成标准
    const chk = await App.api.get('/response/launch-check/' + e.id);
    if (chk) {
      const c = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
        App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '启动阶段完成标准'])
      ]);
      const items = [
        { ok: chk.groupsReady, t: '各关键小组均已出发或抵达' },
        { ok: chk.materialsReady, t: '标准物资包均已装车' },
        { ok: chk.vehiclesReady, t: '保障车辆均已到位' }
      ];
      c.appendChild(App.h('div', { class: 'flex gap wrap' }, items.map(i =>
        App.h('div', { class: 'chip' }, [App.h('span', { class: 'dot ' + (i.ok ? 'g' : 'r') }), i.t])
      )));
      if (['commander', 'deputy'].includes(App.user.role)) {
        const blocked = [];
        if (!chk.groupsReady) blocked.push('小组未全部出动');
        if (!chk.materialsReady) blocked.push('物资未全部装车');
        if (!chk.vehiclesReady) blocked.push('车辆未全部到位');
        c.appendChild(App.h('button', {
          class: chk.allReady ? 'success' : '', disabled: chk.allReady ? null : '',
          style: 'margin-top:10px',
          onclick: () => this.finishLaunch(e.id)
        }, [chk.allReady ? '✓ 确认启动阶段完成 → 进入现场处置' : '未达成: ' + (blocked.join('、') || '待各小组确认')]));
      }
      page.appendChild(c);
    }

    const grid = App.h('div', { class: 'grid g2', style: 'margin-top:12px' });
    page.appendChild(grid);

    // 人员出动
    const personnel = await App.api.get('/response/personnel?eventId=' + e.id);
    const pCard = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '人员出动（强制状态更新）'])
    ]);
    const statMap = { notified: ['已通知', 'b'], confirmed: ['已确认', 'b'], departed: ['已出发', 'a'], arrived: ['已抵达', 'g'], remote: ['远程支持', 'b'], unable: ['无法响应', 'r'] };
    if (!personnel || !personnel.length) pCard.appendChild(App.h('div', { class: 'empty' }, ['暂无出动人员']));
    else {
      // 按组聚合
      const byGroup = {};
      personnel.forEach(p => { (byGroup[p.group] = byGroup[p.group] || []).push(p); });
      Object.keys(byGroup).forEach(g => {
        pCard.appendChild(App.h('div', { class: 'muted2', style: 'margin:10px 0 4px;font-weight:600' }, [`【${g}】`]));
        byGroup[g].forEach(p => {
          const s = statMap[p.status] || [p.status, 'gray'];
          const mine = p.name === App.user.name;
          const row = App.h('div', { class: 'flex between items', style: 'padding:7px 0;border-bottom:1px dashed var(--line)' }, [
            App.h('div', {}, [
              App.h('span', { class: 'dot ' + s[1] }), App.h('b', {}, [p.name]),
              App.h('span', { class: 'muted', style: 'margin-left:8px' }, [s[0] + (p.eta ? ' · ETA ' + p.eta : '')])
            ]),
            mine ? this.personActions(p) : App.h('span', { class: 'muted' }, [mine ? '' : ''])
          ]);
          pCard.appendChild(row);
        });
      });
    }
    grid.appendChild(pCard);

    // 车辆状态
    const vehicles = await App.api.get('/response/vehicles?eventId=' + e.id);
    const vCard = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '车辆保障'])
    ]);
    if (!vehicles || !vehicles.length) vCard.appendChild(App.h('div', { class: 'empty' }, ['暂无车辆']));
    else {
      const vMap = { notified: '已通知', ready: '已就位', arrived: '已到达' };
      vehicles.forEach(v => {
        const mine = v.driverName === App.user.name;
        vCard.appendChild(App.h('div', { class: 'flex between items', style: 'padding:8px 0;border-bottom:1px dashed var(--line)' }, [
          App.h('div', {}, [
            App.h('b', {}, [v.driverName]),
            App.h('span', { class: 'muted', style: 'margin-left:8px' }, [`${v.plate || '-'} · ${vMap[v.status] || v.status}`]),
            v.passCode ? App.h('div', {}, [App.tag('通行证 ' + v.passCode, 'info')]) : null
          ]),
          mine && v.status === 'notified' ? App.h('button', { onclick: () => this.vehicleReady(v.id) }, ['就位报备']) : null
        ]));
      });
    }
    grid.appendChild(vCard);
  },

  // 本人出动操作（确认响应→出发报备→抵达确认）
  personActions(p) {
    const box = App.h('div', { class: 'flex gap' });
    if (p.status === 'notified') {
      box.appendChild(App.h('button', { class: 'primary', onclick: () => this.confirm(p.id, 'dispatch') }, ['立即出动']));
      box.appendChild(App.h('button', { onclick: () => this.confirm(p.id, 'remote') }, ['远程支持']));
      box.appendChild(App.h('button', { class: 'danger', onclick: () => this.confirm(p.id, 'unable') }, ['无法响应']));
    } else if (p.status === 'confirmed') {
      box.appendChild(App.h('button', { class: 'primary', onclick: () => this.depart(p) }, ['出发报备']));
    } else if (p.status === 'departed') {
      box.appendChild(App.h('button', { class: 'success', onclick: () => this.arrive(p.id) }, ['已抵达']));
    }
    return box;
  },

  async confirm(id, mode) {
    const r = await App.api.post('/response/personnel/' + id + '/confirm', { mode });
    if (r) { App.toast('已更新'); this.render(document.getElementById('content'), { eventId: this._ev }); }
  },

  depart(p) {
    const eta = App.h('input', { id: 'dp_eta', placeholder: '如 30分钟' });
    const members = App.h('input', { id: 'dp_members', placeholder: '同行人员名单' });
    const vehicle = App.h('input', { id: 'dp_vehicle', placeholder: '交通工具/车牌' });
    const equip = App.h('label', { class: 'chip', style: 'cursor:pointer' }, [
      App.h('input', { type: 'checkbox', id: 'dp_equip', style: 'width:auto;margin-right:4px' }), '装备已携带齐全'
    ]);
    App.modal('出发报备', App.h('div', {}, [
      App.h('div', { class: 'field' }, [App.h('label', {}, ['预计到达时间']), eta]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['同行人员']), members]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['交通工具']), vehicle]),
      App.h('div', { class: 'field' }, [equip])
    ]), async () => {
      const r = await App.api.post('/response/personnel/' + p.id + '/depart', {
        eta: eta.value.trim(), members: members.value.trim(), vehicle: vehicle.value.trim(),
        equipmentOk: document.getElementById('dp_equip').checked
      });
      if (!r) return false;
      App.toast('已出发'); this.render(document.getElementById('content'), { eventId: this._ev });
    }, '确认出发');
  },

  async arrive(id) {
    const r = await App.api.post('/response/personnel/' + id + '/arrive');
    if (r) { App.toast('已抵达'); this.render(document.getElementById('content'), { eventId: this._ev }); }
  },

  vehicleReady(id) {
    const plate = App.h('input', { id: 'vh_plate', placeholder: '车牌号' });
    const place = App.h('input', { id: 'vh_place', placeholder: '等候地点' });
    const pass = App.h('label', { class: 'chip', style: 'cursor:pointer' }, [
      App.h('input', { type: 'checkbox', id: 'vh_pass', style: 'width:auto;margin-right:4px' }), '需进入管控区域(生成电子通行证)'
    ]);
    App.modal('车辆就位报备', App.h('div', {}, [
      App.h('div', { class: 'field' }, [App.h('label', {}, ['车牌号']), plate]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['等候地点']), place]),
      App.h('div', { class: 'field' }, [pass])
    ]), async () => {
      const r = await App.api.post('/response/vehicles/' + id + '/ready', {
        plate: plate.value.trim(), standbyPlace: place.value.trim(),
        needPass: document.getElementById('vh_pass').checked
      });
      if (!r) return false;
      App.toast('已就位'); this.render(document.getElementById('content'), { eventId: this._ev });
    }, '确认就位');
  },

  async finishLaunch(eventId) {
    const r = await App.api.post('/dispatch/events/' + eventId + '/advance');
    if (r === null) return;
    App.toast('已进入现场处置阶段');
    App.go('field', { eventId });
  }
};
