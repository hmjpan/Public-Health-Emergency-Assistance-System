// 极简上报 —— 一线人员:哪里/什么情况/规模多大/报告人,提交即完成
App.modules.report = {
  async render(root) {
    App.setTitle('极简上报');
    root.innerHTML = '';
    const page = App.h('div', { class: 'page' });
    root.appendChild(page);

    // 上报表单
    const form = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '📨 一键上报（提交即完成）']),
      App.h('div', { class: 'grid g2' }, [
        this.field('事发地点 *', App.h('input', { id: 'rp_loc', placeholder: '如: XX学校食堂' })),
        this.field('规模', App.h('input', { id: 'rp_scale', placeholder: '如: 约30人出现症状' }))
      ]),
      this.field('什么情况 *', App.h('textarea', { id: 'rp_sit', rows: 3, placeholder: '简要描述事件情况' })),
      App.h('div', { class: 'grid g2' }, [
        this.field('报告人', App.h('input', { id: 'rp_name', value: App.user.name })),
        this.field('联系电话', App.h('input', { id: 'rp_phone', value: App.user.phone || '' }))
      ]),
      App.h('button', { class: 'primary', style: 'width:100%;padding:12px', onclick: () => this.submit() }, ['立即上报'])
    ]);
    page.appendChild(form);

    // 我的上报记录
    const listCard = App.h('div', { class: 'card', style: 'margin-top:14px' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '上报记录'])
    ]);
    page.appendChild(listCard);
    const list = await App.api.get('/reports');
    const mine = (list || []).filter(r => r.reporter === App.user.name || App.user.role === 'commander' || App.user.role === 'info');
    if (!mine.length) listCard.appendChild(App.h('div', { class: 'empty' }, ['暂无上报记录']));
    else {
      mine.forEach(r => {
        const stMap = { pending: ['待研判', 'warn'], adopted: ['已采纳', 'ok'], rejected: ['已排除', ''] };
        const s = stMap[r.status] || [r.status, ''];
        listCard.appendChild(App.h('div', { class: 'flex between items', style: 'padding:10px 0;border-bottom:1px dashed var(--line)' }, [
          App.h('div', {}, [
            App.h('div', {}, [App.esc(r.situation), ' ', App.tag(r.typeName || '', 'info')]),
            App.h('div', { class: 'muted' }, [`${r.location} · ${r.scale || '-'} · ${App.fmt(r.createdAt)}`])
          ]),
          App.tag(s[0], s[1])
        ]));
      });
    }
  },

  field(label, el) {
    return App.h('div', { class: 'field' }, [App.h('label', {}, [label]), el]);
  },

  async submit() {
    const location = document.getElementById('rp_loc').value.trim();
    const situation = document.getElementById('rp_sit').value.trim();
    if (!location || !situation) { App.toast('请填写地点与情况', 'err'); return; }
    const r = await App.api.post('/reports', {
      location, situation,
      scale: document.getElementById('rp_scale').value.trim(),
      reporter: document.getElementById('rp_name').value.trim(),
      reporterPhone: document.getElementById('rp_phone').value.trim()
    });
    if (r) { App.toast('上报成功,已送达决策层'); this.render(document.getElementById('content')); }
  }
};
