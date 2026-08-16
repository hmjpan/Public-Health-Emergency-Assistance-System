// 密接/次密接追踪（传染病类型差异化）+ 暴露餐次(食源) + 环境消除(环境污染)
App.modules.contacts = {
  async render(root, params) {
    App.setTitle('密接追踪与流调扩展');
    root.innerHTML = '';
    const page = App.h('div', { class: 'page' });
    root.appendChild(page);

    const events = await App.api.get('/dispatch/events');
    const active = (events || []).filter(e => e.status !== 'closed');
    const eventId = params.eventId || (active[0] && active[0].id) || '';
    const e = (active || []).find(x => x.id === eventId) || {};
    const typeKey = e.typeKey || '';

    // 头部 + 事件选择
    page.appendChild(App.h('div', { class: 'card' }, [
      App.h('div', { class: 'flex between items wrap gap' }, [
        App.h('div', { class: 'section-title', style: 'margin:0' }, [App.h('span', { class: 'bar' }), `密接追踪与流调扩展（${(e.typeName || '')}）`]),
        (() => {
          const sel = App.h('select', { id: 'ct_event', style: 'width:auto', onchange: ev => App.go('contacts', { eventId: ev.target.value }) });
          active.forEach(x => sel.appendChild(App.h('option', { value: x.id, selected: x.id === eventId ? '' : null }, [x.title])));
          return sel;
        })()
      ]),
      App.h('div', { class: 'muted', style: 'margin-top:6px' }, [this.typeHint(typeKey)])
    ]));

    if (!eventId) { page.appendChild(App.h('div', { class: 'empty', style: 'margin-top:12px' }, ['暂无在办事件'])); return; }

    // 按事件类型渲染不同扩展
    if (typeKey === 'INF' || typeKey === 'UNK') {
      await this.renderContacts(page, eventId);
    } else if (typeKey === 'FOOD') {
      await this.renderMeals(page, eventId);
    } else if (typeKey === 'ENV' || typeKey === 'POISON') {
      await this.renderEnv(page, eventId);
    } else {
      // 全部展示（综合）
      await this.renderContacts(page, eventId);
    }
  },

  typeHint(t) {
    const map = { INF: '🦠 传染病 → 启用密接/次密接追踪', FOOD: '🍱 食源性 → 启用暴露餐次调查', ENV: '☣️ 环境污染 → 启用环境消除确认', POISON: '⚗️ 职业中毒 → 启用环境消除/管控', UNK: '❓ 原因不明 → 多路径排查' };
    return map[t] || '通用扩展';
  },

  /* ========== 密接追踪 ========== */
  async renderContacts(page, eventId) {
    const canWrite = ['commander', 'deputy', 'medic', 'group_leader'].includes(App.user.role);
    const d = await App.api.get('/extensions/contacts?eventId=' + eventId);
    const b = d || { total: 0, pending: 0, managing: 0, released: 0, toCase: 0, dueToday: 0, list: [] };

    const bar = App.h('div', { class: 'flex gap wrap', style: 'margin:12px 0' }, [
      canWrite ? App.h('button', { class: 'primary', onclick: () => this.addContact(eventId) }, ['+ 新增密接登记']) : null
    ].filter(Boolean));
    page.appendChild(bar);

    // 看板
    page.appendChild(App.h('div', { class: 'kpi-row' }, [
      this.kpi('密接总数', b.total, 'info'), this.kpi('待转运', b.pending, 'warn'),
      this.kpi('在管', b.managing, 'info'), this.kpi('今日到期解除', b.dueToday, b.dueToday ? 'danger' : 'ok'),
      this.kpi('已解除', b.released, 'ok'), this.kpi('转确诊', b.toCase, b.toCase ? 'danger' : 'ok')
    ]));

    const lCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '密接/次密接列表'])
    ]);
    if (!b.list || !b.list.length) lCard.appendChild(App.h('div', { class: 'empty' }, ['暂无密接登记']));
    else {
      const stMap = { pending: ['待转运', 'warn'], managing: ['在管', 'info'], released: ['已解除', 'ok'], to_case: ['转确诊', 'bad'] };
      b.list.forEach(c => {
        const st = stMap[c.status] || [c.status, ''];
        lCard.appendChild(App.h('div', { style: 'padding:9px 0;border-bottom:1px dashed var(--line)' }, [
          App.h('div', { class: 'flex between items' }, [
            App.h('div', {}, [App.tag(c.contactType, c.contactType === '密接' ? 'bad' : 'warn'), ' ', App.h('b', {}, [c.name]), ' ', App.tag(st[0], st[1])]),
            canWrite ? this.contactActions(c) : null
          ].filter(Boolean)),
          App.h('div', { class: 'muted', style: 'margin:4px 0' }, [`${c.relation || '-'} · ${c.exposureAt || '-'} · ${c.manageType} · 到期${c.releaseDue || '-'}`])
        ]));
      });
    }
    page.appendChild(lCard);
  },

  contactActions(c) {
    const box = App.h('div', { class: 'flex gap' });
    if (c.status === 'pending') box.appendChild(App.h('button', { class: 'primary', style: 'padding:3px 10px;font-size:12px', onclick: () => this.manageContact(c.id, 'managing') }, ['已入管']));
    if (c.status === 'managing') {
      box.appendChild(App.h('button', { class: 'success', style: 'padding:3px 10px;font-size:12px', onclick: () => this.manageContact(c.id, 'released') }, ['解除隔离']));
      box.appendChild(App.h('button', { class: 'danger', style: 'padding:3px 10px;font-size:12px', onclick: () => this.toCase(c.id) }, ['转确诊']));
    }
    return box;
  },

  addContact(eventId) {
    const name = App.h('input', { id: 'ct_name', placeholder: '姓名' });
    const type = App.h('select', { id: 'ct_type' }, [App.h('option', { value: '密接' }, ['密接']), App.h('option', { value: '次密接' }, ['次密接'])]);
    const relation = App.h('input', { id: 'ct_rel', placeholder: '与病例关系' });
    const exposureAt = App.h('input', { id: 'ct_exp', placeholder: '接触日期' });
    const manage = App.h('select', { id: 'ct_manage' }, [App.h('option', { value: '集中隔离' }, ['集中隔离']), App.h('option', { value: '居家隔离' }, ['居家隔离']), App.h('option', { value: '健康监测' }, ['健康监测'])]);
    const release = App.h('input', { id: 'ct_rel_due', type: 'date' });
    App.modal('新增密接登记', App.h('div', {}, [
      App.h('div', { class: 'grid g2' }, [
        App.h('div', { class: 'field' }, [App.h('label', {}, ['姓名 *']), name]),
        App.h('div', { class: 'field' }, [App.h('label', {}, ['接触类型']), type])
      ]),
      App.h('div', { class: 'grid g2' }, [
        App.h('div', { class: 'field' }, [App.h('label', {}, ['与病例关系']), relation]),
        App.h('div', { class: 'field' }, [App.h('label', {}, ['接触日期']), exposureAt])
      ]),
      App.h('div', { class: 'grid g2' }, [
        App.h('div', { class: 'field' }, [App.h('label', {}, ['管理方式']), manage]),
        App.h('div', { class: 'field' }, [App.h('label', {}, ['解除日期']), release])
      ])
    ]), async () => {
      if (!name.value.trim()) { App.toast('请填姓名', 'err'); return false; }
      const r = await App.api.post('/extensions/contacts', { eventId, name: name.value.trim(), contactType: type.value, relation: relation.value.trim(), exposureAt: exposureAt.value.trim(), manageType: manage.value, releaseDue: release.value });
      if (r) { App.toast('已登记'); App.go('contacts', { eventId }); }
    }, '登记');
  },

  async manageContact(id, status) {
    const r = await App.api.post('/extensions/contacts/' + id + '/manage', { status });
    if (r) { App.toast(status === 'managing' ? '已入管' : '已解除'); App.go('contacts', {}); }
  },

  async toCase(id) {
    if (!confirm('确认该密接转确诊？将自动生成新病例。')) return;
    const r = await App.api.post('/extensions/contacts/' + id + '/to-case');
    if (r) { App.toast('已转确诊: ' + (r.case ? r.case.trackNo : '')); App.go('contacts', {}); }
  },

  /* ========== 暴露餐次 ========== */
  async renderMeals(page, eventId) {
    const canWrite = ['commander', 'deputy', 'medic', 'group_leader'].includes(App.user.role);
    page.appendChild(App.h('div', { class: 'flex gap wrap', style: 'margin:12px 0' }, [
      canWrite ? App.h('button', { class: 'primary', onclick: () => this.addMeal(eventId) }, ['+ 登记暴露餐次']) : null
    ].filter(Boolean)));

    const meals = await App.api.get('/extensions/meals?eventId=' + eventId);
    const lCard = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '暴露餐次调查（按罹患率排序）'])
    ]);
    if (!meals || !meals.length) lCard.appendChild(App.h('div', { class: 'empty' }, ['暂无餐次登记']));
    else meals.forEach((m, i) => {
      lCard.appendChild(App.h('div', { style: 'padding:9px 0;border-bottom:1px dashed var(--line)' }, [
        App.h('div', { class: 'flex between items' }, [
          App.h('div', {}, [i === 0 ? App.tag('最可疑', 'bad') + ' ' : '', App.h('b', {}, [m.mealTime + ' ' + (m.place || '')])]),
          App.h('div', { class: 'flex gap items' }, [
            App.tag(`罹患率 ${m.attackRate}%`, m.attackRate > 30 ? 'bad' : 'warn'),
            App.tag(`发病${m.illnessCount}/${m.dinerCount}`, 'info')
          ])
        ]),
        App.h('div', { class: 'muted', style: 'margin:4px 0' }, [(m.foodItems || []).join('、') + (m.suspectedFood.length ? ' · 可疑:' + m.suspectedFood.join(',') : '')])
      ]));
    });
    page.appendChild(lCard);
  },

  addMeal(eventId) {
    const mealTime = App.h('input', { id: 'ml_time', placeholder: '如 2026-07-22 12:00' });
    const place = App.h('input', { id: 'ml_place', placeholder: '就餐地点' });
    const food = App.h('input', { id: 'ml_food', placeholder: '食物品种,逗号分隔' });
    const diner = App.h('input', { id: 'ml_diner', type: 'number', value: 0 });
    const illness = App.h('input', { id: 'ml_ill', type: 'number', value: 0 });
    App.modal('登记暴露餐次', App.h('div', {}, [
      App.h('div', { class: 'grid g2' }, [
        App.h('div', { class: 'field' }, [App.h('label', {}, ['餐次时间 *']), mealTime]),
        App.h('div', { class: 'field' }, [App.h('label', {}, ['地点']), place])
      ]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['食物品种']), food]),
      App.h('div', { class: 'grid g2' }, [
        App.h('div', { class: 'field' }, [App.h('label', {}, ['就餐人数']), diner]),
        App.h('div', { class: 'field' }, [App.h('label', {}, ['发病人数']), illness])
      ])
    ]), async () => {
      const r = await App.api.post('/extensions/meals', { eventId, mealTime: mealTime.value.trim(), place: place.value.trim(), foodItems: food.value.trim().split(/[,，]/).filter(Boolean), dinerCount: +diner.value, illnessCount: +illness.value });
      if (r) { App.toast(`已登记,罹患率${r.attackRate}%`); App.go('contacts', { eventId }); }
    }, '登记');
  },

  /* ========== 环境消除 ========== */
  async renderEnv(page, eventId) {
    const isCmd = ['commander', 'deputy'].includes(App.user.role);
    const canWrite = isCmd || ['medic', 'group_leader'].includes(App.user.role);
    page.appendChild(App.h('div', { class: 'flex gap wrap', style: 'margin:12px 0' }, [
      canWrite ? App.h('button', { class: 'primary', onclick: () => this.addEnv(eventId) }, ['+ 登记消除点位']) : null
    ].filter(Boolean)));

    const envs = await App.api.get('/extensions/env?eventId=' + eventId);
    const lCard = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '环境消除确认'])
    ]);
    if (!envs || !envs.length) lCard.appendChild(App.h('div', { class: 'empty' }, ['暂无消除记录']));
    else {
      const stMap = { treating: ['治理中', 'warn'], retesting: ['复测中', 'info'], eliminated: ['已消除', 'ok'], unqualified: ['未达标', 'bad'] };
      envs.forEach(e => {
        const st = stMap[e.status] || [e.status, ''];
        const qualified = (e.monitorPoints || []).filter(p => p.qualified).length;
        const total = (e.monitorPoints || []).length;
        lCard.appendChild(App.h('div', { style: 'padding:9px 0;border-bottom:1px dashed var(--line)' }, [
          App.h('div', { class: 'flex between items' }, [
            App.h('div', {}, [App.h('b', {}, [e.siteName]), ' ', App.tag(e.mediaType, 'info')]),
            App.tag(st[0], st[1])
          ]),
          App.h('div', { class: 'muted', style: 'margin:4px 0' }, [`治理前:${e.beforeValue} · 标准:${e.standard} · 治理后:${e.afterValue || '待测'}`]),
          total ? App.h('div', { class: 'progress', style: 'margin-top:6px' }, [App.h('div', { class: 'fill', style: 'width:' + (qualified / total * 100) + '%' })]) : null,
          total ? App.h('div', { class: 'muted', style: 'margin-top:4px' }, [`监测点达标 ${qualified}/${total}`]) : null,
          canWrite && e.status !== 'eliminated' ? App.h('div', { class: 'flex gap', style: 'margin-top:6px' }, [
            App.h('button', { style: 'padding:3px 10px;font-size:12px', onclick: () => this.retestEnv(e) }, ['录入复测']),
            isCmd && qualified === total && total > 0 ? App.h('button', { class: 'success', style: 'padding:3px 10px;font-size:12px', onclick: () => this.confirmEnv(e.id) }, ['确认消除']) : null
          ].filter(Boolean)) : null
        ]));
      });
    }
    page.appendChild(lCard);
  },

  addEnv(eventId) {
    const site = App.h('input', { id: 'ev_site', placeholder: '点位名称' });
    const media = App.h('select', { id: 'ev_media' }, [['空气', '空气'], ['水', '水'], ['土壤', '土壤']].map(([v, l]) => App.h('option', { value: v }, [l])));
    const before = App.h('input', { id: 'ev_before', placeholder: '治理前数值' });
    const standard = App.h('input', { id: 'ev_std', placeholder: '限值标准' });
    const measures = App.h('textarea', { id: 'ev_measure', rows: 2, placeholder: '洗消/阻断措施' });
    App.modal('登记消除点位', App.h('div', {}, [
      App.h('div', { class: 'grid g2' }, [
        App.h('div', { class: 'field' }, [App.h('label', {}, ['点位 *']), site]),
        App.h('div', { class: 'field' }, [App.h('label', {}, ['介质类型']), media])
      ]),
      App.h('div', { class: 'grid g2' }, [
        App.h('div', { class: 'field' }, [App.h('label', {}, ['治理前数值']), before]),
        App.h('div', { class: 'field' }, [App.h('label', {}, ['限值标准']), standard])
      ]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['治理措施']), measures])
    ]), async () => {
      if (!site.value.trim()) { App.toast('请填点位', 'err'); return false; }
      const r = await App.api.post('/extensions/env', { eventId, siteName: site.value.trim(), mediaType: media.value, beforeValue: before.value.trim(), standard: standard.value.trim(), eliminateMeasures: measures.value.trim() });
      if (r) { App.toast('已登记'); App.go('contacts', { eventId }); }
    }, '登记');
  },

  retestEnv(e) {
    const box = App.h('div', {}, []);
    const addBtn = App.h('button', { onclick: () => {
      const n = box.querySelectorAll('.mp-row').length;
      const row = App.h('div', { class: 'flex gap items mp-row', style: 'margin-bottom:6px' }, [
        App.h('input', { class: 'mp_point', placeholder: '点位' + (n + 1), style: 'flex:1' }),
        App.h('input', { class: 'mp_value', placeholder: '数值', style: 'flex:1' }),
        App.h('select', { class: 'mp_qual' }, [App.h('option', { value: 'true' }, ['达标']), App.h('option', { value: 'false' }, ['未达标'])])
      ]);
      box.appendChild(row);
    }}, ['+ 添加监测点']);
    const afterVal = App.h('input', { id: 'ev_after', placeholder: '治理后数值' });
    App.modal('录入复测结果 - ' + e.siteName, App.h('div', {}, [
      App.h('div', { class: 'field' }, [App.h('label', {}, ['治理后数值']), afterVal]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['监测点']), box, addBtn])
    ]), async () => {
      const points = [...box.querySelectorAll('.mp-row')].map(r => ({
        point: r.querySelector('.mp_point').value.trim(),
        value: r.querySelector('.mp_value').value.trim(),
        qualified: r.querySelector('.mp_qual').value === 'true'
      })).filter(p => p.point);
      const r = await App.api.post('/extensions/env/' + e.id + '/retest', { afterValue: afterVal.value.trim(), monitorPoints: points });
      if (r) { App.toast(r.allQualified ? '全部达标,可确认消除' : '尚有未达标点'); App.go('contacts', {}); }
    }, '提交复测');
    addBtn.click();
  },

  async confirmEnv(id) {
    const r = await App.api.post('/extensions/env/' + id + '/confirm');
    if (r) { App.toast('已确认消除,已生成节点报告'); App.go('contacts', {}); }
  },

  kpi(l, v, cls) { return App.h('div', { class: 'skpi ' + (cls || '') }, [App.h('div', { class: 'n' }, [String(v)]), App.h('div', { class: 'l' }, [l])]); }
};
