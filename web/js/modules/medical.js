// 医疗救治与资源调度 —— 病例全流程跟踪 + 医疗资源实时可视
App.modules.medical = {
  async render(root, params) {
    App.setTitle('医疗救治与资源调度');
    root.innerHTML = '';
    const page = App.h('div', { class: 'page' });
    root.appendChild(page);

    const tab = params.tab || 'cases';
    // 页签
    const tabs = App.h('div', { class: 'flex gap', style: 'margin-bottom:14px' }, [
      this.tabBtn('cases', '🏥 病例跟踪', tab),
      this.tabBtn('resources', '🛏️ 医疗资源', tab)
    ]);
    page.appendChild(tabs);

    const body = App.h('div', { id: 'med_body' });
    page.appendChild(body);
    if (tab === 'cases') await this.renderCases(body, params);
    else await this.renderResources(body);
  },

  tabBtn(key, label, cur) {
    return App.h('button', {
      class: key === cur ? 'primary' : '',
      onclick: () => App.go('medical', { tab: key })
    }, [label]);
  },

  /* ==================== 病例跟踪 ==================== */
  async renderCases(body, params) {
    body.innerHTML = '';
    this._sm = await App.api.get('/medical/cases/meta/status') || {};
    const events = await App.api.get('/dispatch/events');
    const active = (events || []).filter(e => e.status !== 'closed');
    const eventId = params.eventId || (active[0] && active[0].id) || '';

    // 工具条
    const canWrite = ['commander', 'deputy', 'medic', 'group_leader'].includes(App.user.role);
    const bar = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'flex between items wrap gap' }, [
        App.h('div', { class: 'section-title', style: 'margin:0' }, [App.h('span', { class: 'bar' }), '病例全流程跟踪']),
        App.h('div', { class: 'flex gap items' }, [
          (() => {
            const sel = App.h('select', { id: 'mc_event', style: 'width:auto', onchange: () => App.go('medical', { tab: 'cases', eventId: document.getElementById('mc_event').value }) });
            sel.appendChild(App.h('option', { value: '' }, ['全部事件']));
            (events || []).forEach(e => sel.appendChild(App.h('option', { value: e.id, selected: e.id === eventId ? '' : null }, [e.title])));
            return sel;
          })(),
          canWrite && eventId ? App.h('button', { class: 'primary', onclick: () => this.registerCase(eventId) }, ['+ 病例登记']) : null
        ].filter(Boolean))
      ])
    ]);
    body.appendChild(bar);

    // 汇总看板
    const board = await App.api.get('/medical/cases/board' + (eventId ? '?eventId=' + eventId : ''));
    if (board) {
      const bCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
        App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), `病例汇总 (在治 ${board.active} / 累计 ${board.total})`])
      ]);
      // 状态分布
      const statusRow = App.h('div', { class: 'kpi-row' }, board.byStatus.map(s =>
        App.h('div', {
          class: 'skpi ' + (['icu'].includes(s.status) && s.count ? 'danger' : s.count ? 'info' : ''),
          style: 'cursor:pointer',
          onclick: () => this.filterStatus(s.status)
        }, [App.h('div', { class: 'n' }, [String(s.count)]), App.h('div', { class: 'l' }, [s.name])])
      ));
      bCard.appendChild(statusRow);
      // 异常标红
      if (board.abnormal.length) {
        bCard.appendChild(App.h('div', { class: 'section-title', style: 'margin-top:14px;color:var(--red)' }, [App.h('span', { class: 'bar', style: 'background:var(--red)' }), `⚠ 异常病例 (${board.abnormal.length})`]));
        board.abnormal.forEach(a => {
          bCard.appendChild(App.h('div', {
            class: 'flex between items', style: 'padding:7px 0;border-bottom:1px dashed var(--line);cursor:pointer',
            onclick: () => this.caseDetail(a.id)
          }, [
            App.h('div', {}, [App.tag(a.trackNo, 'info'), ' ' + a.name + ' ', App.tag(a.statusName, 'bad')]),
            App.h('span', { class: 'tag bad' }, [a.msg])
          ]));
        });
      }
      body.appendChild(bCard);
    }

    // 病例列表
    const cases = await App.api.get('/medical/cases' + (eventId ? '?eventId=' + eventId : ''));
    const lCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), `病例列表 (${(cases || []).length})`])
    ]);
    if (!cases || !cases.length) lCard.appendChild(App.h('div', { class: 'empty' }, ['暂无病例,流调确认后在此登记']));
    else {
      const sevMap = { mild: ['轻症', 'ok'], moderate: ['普通', 'info'], severe: ['重症', 'warn'], critical: ['危重', 'bad'] };
      cases.forEach(c => {
        const sev = sevMap[c.severity] || [c.severity, ''];
        lCard.appendChild(App.h('div', {
          class: 'flex between items', style: 'padding:9px 0;border-bottom:1px dashed var(--line);cursor:pointer',
          onclick: () => this.caseDetail(c.id)
        }, [
          App.h('div', {}, [
            App.tag(c.trackNo, 'info'), ' ', App.h('b', {}, [c.name]), ' ', App.tag(sev[0], sev[1]),
            App.h('div', { class: 'muted' }, [`${c.address || '-'} · ${App.fmt(c.createdAt)}`])
          ]),
          App.tag(this.statusName(c.status), this.statusKind(c.status))
        ]));
      });
    }
    body.appendChild(lCard);
  },

  statusName(s) { return (this._sm = this._sm || {})[s] || s; },
  statusKind(s) { return s === 'icu' ? 'bad' : ['discharged'].includes(s) ? 'ok' : ['dead'].includes(s) ? '' : 'info'; },

  async filterStatus(status) {
    const cases = await App.api.get('/medical/cases?status=' + status);
    const body = App.h('div', {}, []);
    if (!cases || !cases.length) body.appendChild(App.h('div', { class: 'empty' }, ['该状态暂无病例']));
    else cases.forEach(c => {
      body.appendChild(App.h('div', { class: 'flex between items', style: 'padding:8px 0;border-bottom:1px dashed var(--line);cursor:pointer', onclick: () => this.caseDetail(c.id) }, [
        App.h('div', {}, [App.tag(c.trackNo, 'info'), ' ' + c.name]),
        App.h('span', { class: 'muted' }, [App.fmt(c.createdAt)])
      ]));
    });
    App.modal('病例列表', body, () => true, '关闭');
  },

  // 病例登记
  async registerCase(eventId) {
    const name = App.h('input', { id: 'rc_name', placeholder: '姓名' });
    const age = App.h('input', { id: 'rc_age', placeholder: '年龄' });
    const addr = App.h('input', { id: 'rc_addr', placeholder: '住址' });
    const sev = App.h('select', { id: 'rc_sev' }, [
      App.h('option', { value: 'mild' }, ['轻症']), App.h('option', { value: 'moderate', selected: '' }, ['普通']),
      App.h('option', { value: 'severe' }, ['重症']), App.h('option', { value: 'critical' }, ['危重'])
    ]);
    App.modal('病例登记（自动生成追踪编号）', App.h('div', {}, [
      App.h('div', { class: 'grid g2' }, [
        App.h('div', { class: 'field' }, [App.h('label', {}, ['姓名 *']), name]),
        App.h('div', { class: 'field' }, [App.h('label', {}, ['年龄']), age])
      ]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['住址']), addr]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['病情分级']), sev])
    ]), async () => {
      if (!name.value.trim()) { App.toast('请填姓名', 'err'); return false; }
      const r = await App.api.post('/medical/cases', { eventId, name: name.value.trim(), age: age.value.trim(), address: addr.value.trim(), severity: sev.value });
      if (r) { App.toast('已登记: ' + r.trackNo); App.go('medical', { tab: 'cases', eventId }); }
    }, '登记');
  },

  // 病例详情（含状态时间轴 + 流转操作）
  async caseDetail(id) {
    const c = await App.api.get('/medical/cases/' + id);
    if (!c) return;
    this._sm = await App.api.get('/medical/cases/meta/status') || {};
    const canUpdate = ['commander', 'deputy', 'medic'].includes(App.user.role);
    const body = App.h('div', {}, []);

    body.appendChild(App.h('div', { class: 'flex gap wrap' }, [
      App.tag(c.trackNo, 'info'), App.tag(this.statusName(c.status), this.statusKind(c.status)),
      App.tag('病情: ' + ({ mild: '轻症', moderate: '普通', severe: '重症', critical: '危重' }[c.severity] || c.severity), c.severity === 'critical' ? 'bad' : c.severity === 'severe' ? 'warn' : '')
    ]));
    body.appendChild(App.h('div', { class: 'muted', style: 'margin:8px 0' }, [
      `${c.name} · ${c.gender || '-'} · ${c.age || '-'}岁 · ${c.address || '-'}`, App.h('br'),
      c.hospitalName ? '所在机构: ' + c.hospitalName : '未入院'
    ]));

    // 状态时间轴
    body.appendChild(App.h('div', { class: 'section-title', style: 'margin-top:10px' }, [App.h('span', { class: 'bar' }), '全流程轨迹']));
    const tl = App.h('div', { class: 'timeline' });
    (c.statusHistory || []).forEach(h => {
      tl.appendChild(App.h('div', { class: 'tn' }, [
        App.h('div', { class: 't' }, [`${App.fmt(h.at)} · ${h.by}`]),
        App.h('div', { class: 'd' }, [`${this.statusName(h.status)}${h.note ? ' · ' + h.note : ''}`])
      ]));
    });
    body.appendChild(tl);

    // 流转操作
    if (canUpdate) {
      body.appendChild(App.h('div', { class: 'section-title', style: 'margin-top:12px' }, [App.h('span', { class: 'bar' }), '状态流转']));
      const flowMap = {
        pending_transfer: ['transferring'], transferring: ['received'], received: ['observing', 'admitted'],
        observing: ['admitted', 'discharged', 'transferred_out'], admitted: ['icu', 'discharged', 'transferred_out'],
        icu: ['admitted', 'discharged', 'transferred_out']
      };
      const nexts = flowMap[c.status] || [];
      const btnRow = App.h('div', { class: 'flex gap wrap' }, nexts.map(ns =>
        App.h('button', {
          class: ['discharged'].includes(ns) ? 'success' : ns === 'icu' ? 'danger' : 'primary',
          onclick: () => this.transition(c.id, ns)
        }, ['→ ' + this.statusName(ns)])
      ));
      if (!nexts.length) btnRow.appendChild(App.h('span', { class: 'muted' }, ['已是终态']));
      body.appendChild(btnRow);
    }

    App.modal('病例详情 ' + c.trackNo, body, () => true, '关闭');
  },

  async transition(id, toStatus) {
    const r = await App.api.post('/medical/cases/' + id + '/transition', { toStatus, note: '' });
    if (r) {
      App.toast('已流转: ' + this.statusName(toStatus));
      document.querySelector('.modal-mask') && document.querySelector('.modal-mask').remove();
      App.go('medical', { tab: 'cases' });
    }
  },

  /* ==================== 医疗资源 ==================== */
  async renderResources(body) {
    body.innerHTML = '';
    const d = await App.api.get('/medical/resources/board');
    if (!d) { body.appendChild(App.h('div', { class: 'empty' }, ['暂无资源数据'])); return; }
    const canUpdate = ['commander', 'material_mgr', 'medic'].includes(App.user.role);
    const s = d.summary;

    // 汇总 KPI
    body.appendChild(App.h('div', { class: 'kpi-row' }, [
      this.kpi('定点机构', s.count, '', '🏥'),
      this.kpi('床位 可用/总', `${s.bedAvail}/${s.bedTotal}`, s.bedAvail / s.bedTotal < 0.15 ? 'danger' : 'ok', '🛏️'),
      this.kpi('ICU 可用/总', `${s.icuAvail}/${s.icuTotal}`, s.icuAvail === 0 ? 'danger' : 'warn', '💓'),
      this.kpi('在岗医护', s.staffOnDuty, 'info', '👨‍⚕️'),
      this.kpi('可支援医护', s.staffAvailable, 'ok', '🚑'),
      this.kpi('备用床位', s.bedReserve, '', '📦')
    ]));

    // 预警区
    const hasAlert = d.alerts.hospitals.length || d.alerts.lowMedicines.length || d.alerts.lowDevices.length;
    if (hasAlert) {
      const aCard = App.h('div', { class: 'card', style: 'margin-top:12px;border-color:var(--red)' }, [
        App.h('div', { class: 'section-title', style: 'color:var(--red)' }, [App.h('span', { class: 'bar', style: 'background:var(--red)' }), '⚠ 资源预警'])
      ]);
      d.alerts.hospitals.forEach(h => aCard.appendChild(App.h('div', { style: 'padding:5px 0' }, [App.tag('机构', 'bad'), ` ${h.name}: ${h.alerts.join('、')}`])));
      d.alerts.lowMedicines.forEach(m => aCard.appendChild(App.h('div', { style: 'padding:5px 0' }, [App.tag('药品', 'warn'), ` ${m.name}: 仅剩 ${m.daysLeft} 天(阈值${m.threshold})`])));
      d.alerts.lowDevices.forEach(x => aCard.appendChild(App.h('div', { style: 'padding:5px 0' }, [App.tag('设备', 'bad'), ` ${x.name}: 已无可用`])));
      body.appendChild(aCard);
    }

    const grid = App.h('div', { class: 'grid g2', style: 'margin-top:12px' });
    body.appendChild(grid);

    // 各机构床位/ICU
    const hCard = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '定点医院床位 / ICU'])
    ]);
    d.hospitals.forEach(h => {
      hCard.appendChild(App.h('div', { style: 'padding:10px 0;border-bottom:1px dashed var(--line)' }, [
        App.h('div', { class: 'flex between items' }, [
          App.h('b', {}, [h.name]), h.alerts.length ? App.tag(h.alerts.join(''), 'bad') : App.tag('正常', 'ok')
        ]),
        this.bar('床位', h.bedOccupied, h.bedTotal, `已用${h.bedOccupied}/总${h.bedTotal} 可用${h.bedAvail} 备用${h.bedReserve}`),
        this.bar('ICU', h.icuOccupied, h.icuTotal, `已用${h.icuOccupied}/总${h.icuTotal} 可用${h.icuAvail}`),
        App.h('div', { class: 'muted', style: 'margin-top:4px' }, [`在岗${h.staffOnDuty} · 可支援${h.staffAvailable}`]),
        canUpdate ? App.h('button', { style: 'margin-top:6px;padding:3px 10px;font-size:12px', onclick: () => this.updateHospital(h) }, ['更新数据']) : null
      ].filter(Boolean)));
    });
    grid.appendChild(hCard);

    // 设备 + 药品
    const right = App.h('div', {}, []);
    const dCard = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '关键设备（跨机构）'])
    ]);
    d.devices.forEach(dev => {
      dCard.appendChild(App.h('div', { class: 'flex between items', style: 'padding:7px 0;border-bottom:1px dashed var(--line)' }, [
        App.h('span', {}, [dev.name]),
        App.h('span', {}, [`在用${dev.inUse} / 可用`, App.h('b', { style: dev.available === 0 ? 'color:var(--red)' : 'color:var(--green)' }, [String(dev.available)])])
      ]));
    });
    right.appendChild(dCard);

    const mCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '关键药品库存'])
    ]);
    d.medicines.forEach(m => {
      mCard.appendChild(App.h('div', { class: 'flex between items', style: 'padding:7px 0;border-bottom:1px dashed var(--line)' }, [
        App.h('span', {}, [m.name]),
        App.h('span', {}, [`库存${m.stock} · 可用`, App.h('b', { style: m.low ? 'color:var(--red)' : 'color:var(--green)' }, [`${m.daysLeft}天`])])
      ]));
    });
    right.appendChild(mCard);
    grid.appendChild(right);

    // 调度单
    const dispatches = await App.api.get('/medical/dispatches');
    const dpCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
      App.h('div', { class: 'flex between items' }, [
        App.h('div', { class: 'section-title', style: 'margin:0' }, [App.h('span', { class: 'bar' }), '资源调度单']),
        canUpdate ? App.h('button', { class: 'primary', onclick: () => this.newDispatch() }, ['+ 发起调度']) : null
      ].filter(Boolean))
    ]);
    if (!dispatches || !dispatches.length) dpCard.appendChild(App.h('div', { class: 'empty' }, ['暂无调度单']));
    else {
      const flowMap = { pending: '待调配', dispatched: '已调配', arrived: '已到达', signed: '已签收' };
      dispatches.slice(0, 8).forEach(x => {
        dpCard.appendChild(App.h('div', { class: 'flex between items', style: 'padding:8px 0;border-bottom:1px dashed var(--line)' }, [
          App.h('div', {}, [App.tag(x.kind, 'info'), ` ${x.itemName} ×${x.qty}`, App.h('div', { class: 'muted' }, [`${x.requestedBy} · ${App.fmt(x.createdAt)}`])]),
          App.h('div', { class: 'flex gap items' }, [
            App.tag(flowMap[x.status] || x.status, x.status === 'signed' ? 'ok' : 'info'),
            canUpdate && x.status !== 'signed' ? App.h('button', { style: 'padding:3px 10px;font-size:12px', onclick: () => this.advanceDispatch(x.id) }, ['推进']) : null
          ].filter(Boolean))
        ]));
      });
    }
    body.appendChild(dpCard);
  },

  kpi(label, val, cls, ico) {
    return App.h('div', { class: 'skpi ' + (cls || '') }, [App.h('div', { class: 'n' }, [(ico ? ico + ' ' : '') + val]), App.h('div', { class: 'l' }, [label])]);
  },

  bar(label, used, total, text) {
    const pct = total ? Math.round(used / total * 100) : 0;
    return App.h('div', { style: 'margin-top:6px' }, [
      App.h('div', { class: 'flex between', style: 'font-size:12px;color:var(--txt2)' }, [App.h('span', {}, [`${label} ${pct}%`]), App.h('span', {}, [text])]),
      App.h('div', { class: 'progress' }, [App.h('div', { class: 'fill', style: `width:${pct}%;${pct > 85 ? 'background:linear-gradient(90deg,var(--red),var(--amber))' : ''}` })])
    ]);
  },

  updateHospital(h) {
    const bed = App.h('input', { id: 'uh_bed', type: 'number', value: h.bedOccupied });
    const icu = App.h('input', { id: 'uh_icu', type: 'number', value: h.icuOccupied });
    const duty = App.h('input', { id: 'uh_duty', type: 'number', value: h.staffOnDuty });
    const avail = App.h('input', { id: 'uh_avail', type: 'number', value: h.staffAvailable });
    App.modal('更新 ' + h.name, App.h('div', {}, [
      App.h('div', { class: 'grid g2' }, [
        App.h('div', { class: 'field' }, [App.h('label', {}, ['已占用床位']), bed]),
        App.h('div', { class: 'field' }, [App.h('label', {}, ['已占用ICU']), icu]),
        App.h('div', { class: 'field' }, [App.h('label', {}, ['在岗医护']), duty]),
        App.h('div', { class: 'field' }, [App.h('label', {}, ['可支援医护']), avail])
      ])
    ]), async () => {
      const r = await App.api.patch('/medical/hospitals/' + h.id, {
        bedOccupied: +bed.value, icuOccupied: +icu.value, staffOnDuty: +duty.value, staffAvailable: +avail.value
      });
      if (r) { App.toast('已更新'); App.go('medical', { tab: 'resources' }); }
    }, '保存');
  },

  newDispatch() {
    const kind = App.h('select', { id: 'nd_kind' }, [['bed', '床位'], ['icu', 'ICU'], ['device', '设备'], ['staff', '医护'], ['medicine', '药品']].map(([v, l]) => App.h('option', { value: v }, [l])));
    const item = App.h('input', { id: 'nd_item', placeholder: '资源名称,如 呼吸机' });
    const qty = App.h('input', { id: 'nd_qty', type: 'number', value: 1 });
    App.modal('发起资源调度', App.h('div', {}, [
      App.h('div', { class: 'field' }, [App.h('label', {}, ['类型']), kind]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['资源名称']), item]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['数量']), qty])
    ]), async () => {
      const r = await App.api.post('/medical/dispatches', { kind: kind.value, itemName: item.value.trim(), qty: +qty.value });
      if (r) { App.toast('已发起'); App.go('medical', { tab: 'resources' }); }
    }, '发起');
  },

  async advanceDispatch(id) {
    const r = await App.api.post('/medical/dispatches/' + id + '/advance');
    if (r) { App.toast('已推进'); App.go('medical', { tab: 'resources' }); }
  }
};
