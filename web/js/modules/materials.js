// 物资调拨 —— 备货/装车/发出/送达/签收闭环,不足标红
App.modules.materials = {
  async render(root, params) {
    App.setTitle('物资调拨');
    root.innerHTML = '';
    const page = App.h('div', { class: 'page' });
    root.appendChild(page);

    const events = await App.api.get('/dispatch/events');
    const active = (events || []).filter(e => e.status !== 'closed');
    if (!active.length) { page.appendChild(App.h('div', { class: 'empty' }, ['当前无在办事件'])); return; }
    const e = active.find(x => x.id === params.eventId) || active[0];

    page.appendChild(App.h('div', { class: 'card' }, [
      App.h('div', { class: 'flex between items wrap gap' }, [
        App.h('div', { class: 'section-title', style: 'margin:0' }, [App.h('span', { class: 'bar' }), `${e.typeIcon || ''} ${e.title} — 物资调拨`]),
        (() => {
          const sel = App.h('select', { style: 'width:auto', onchange: ev => App.go('materials', { eventId: ev.target.value }) });
          active.forEach(x => sel.appendChild(App.h('option', { value: x.id, selected: x.id === e.id ? '' : null }, [x.title])));
          return sel;
        })()
      ])
    ]));

    const materials = await App.api.get('/response/materials?eventId=' + e.id);
    const isMgr = App.user.role === 'material_mgr' || App.user.role === 'commander' || App.user.role === 'deputy';
    const canSigner = ['member', 'group_leader', 'commander', 'deputy', 'info'].includes(App.user.role);
    const flowMap = { preparing: '备货中', loaded: '已装车', sent: '已发出', delivered: '已送达', signed: '已签收' };
    const nextMap = { preparing: '装车', loaded: '发出', sent: '送达', delivered: '待签收' };

    const grid = App.h('div', { class: 'grid g2', style: 'margin-top:12px' });
    page.appendChild(grid);

    if (!materials || !materials.length) {
      grid.appendChild(App.h('div', { class: 'empty' }, ['暂无物资包']));
      return;
    }
    materials.forEach(m => {
      const itemsText = (m.items || []).map(i => `${i.name}×${i.qty}`).join('、');
      const canAdvance = isMgr && m.status !== 'signed' && m.status !== 'delivered';
      const canSign = m.status === 'delivered' && canSigner;
      const card = App.h('div', { class: 'card' }, [
        App.h('div', { class: 'flex between items' }, [
          App.h('b', {}, [m.pack]),
          App.h('div', { class: 'flex gap items' }, [
            m.shortage ? App.tag('库存不足', 'bad') : App.tag('库存充足', 'ok'),
            App.tag(flowMap[m.status] || m.status, m.status === 'signed' ? 'ok' : 'info')
          ])
        ]),
        App.h('div', { class: 'muted', style: 'margin:8px 0' }, [itemsText]),
        // 进度条
        (() => {
          const steps = ['preparing', 'loaded', 'sent', 'delivered', 'signed'];
          const idx = steps.indexOf(m.status);
          return App.h('div', { class: 'steps', style: 'margin:6px 0' }, steps.map((s, i) =>
            App.h('div', { class: 'step ' + (i < idx ? 'done' : i === idx ? 'cur' : ''), style: 'font-size:11px' }, [flowMap[s]])
          ));
        })(),
        App.h('div', { class: 'flex gap', style: 'margin-top:8px' }, [
          isMgr ? App.h('button', { class: m.shortage ? '' : 'ghost', onclick: () => this.toggleShortage(m) }, [m.shortage ? '取消紧缺' : '标记紧缺']) : null,
          canAdvance ? App.h('button', { class: 'primary', onclick: () => this.advance(m) }, ['推进: ' + (nextMap[m.status] || '下一步')]) : null,
          canSign ? App.h('button', { class: 'success', onclick: () => this.sign(m) }, ['✓ 现场签收']) : null,
          m.status === 'signed' ? App.h('span', { class: 'muted' }, [`${m.signedBy || ''} 已签收`]) : null
        ])
      ]);
      grid.appendChild(card);
    });
  },

  async toggleShortage(m) {
    const r = await App.api.post('/response/materials/' + m.id + '/advance', { shortage: !m.shortage });
    if (r) { this.render(document.getElementById('content'), {}); }
  },
  async advance(m) {
    const r = await App.api.post('/response/materials/' + m.id + '/advance', {});
    if (r) { App.toast('已推进'); this.render(document.getElementById('content'), {}); }
  },
  async sign(m) {
    const r = await App.api.post('/response/materials/' + m.id + '/sign');
    if (r) { App.toast('已签收'); this.render(document.getElementById('content'), {}); }
  }
};
