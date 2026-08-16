// 信息发布与舆情 —— 发布三段式(起草→审批→发布) + 舆情监测 + 口径模板
App.modules.publishing = {
  async render(root, params) {
    App.setTitle('信息发布');
    root.innerHTML = '';
    const page = App.h('div', { class: 'page' });
    root.appendChild(page);

    const tab = params.tab || 'publish';
    page.appendChild(App.h('div', { class: 'flex gap', style: 'margin-bottom:14px' }, [
      App.h('button', { class: tab === 'publish' ? 'primary' : '', onclick: () => App.go('publishing', { tab: 'publish' }) }, ['📢 信息发布']),
      App.h('button', { class: tab === 'sentiment' ? 'primary' : '', onclick: () => App.go('publishing', { tab: 'sentiment' }) }, ['🌐 舆情监测'])
    ]));

    const body = App.h('div', { id: 'pub_body' });
    page.appendChild(body);
    if (tab === 'publish') await this.renderPublish(body);
    else await this.renderSentiment(body);
  },

  /* ========== 信息发布 ========== */
  async renderPublish(body) {
    body.innerHTML = '';
    const canWrite = ['spokesman', 'commander', 'deputy'].includes(App.user.role);
    const isCmd = ['commander'].includes(App.user.role);

    const bar = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'flex between items wrap gap' }, [
        App.h('div', { class: 'section-title', style: 'margin:0' }, [App.h('span', { class: 'bar' }), '发布管理（起草 → 决策层审批 → 发布）']),
        canWrite ? App.h('button', { class: 'primary', onclick: () => this.draft() }, ['+ 起草发布稿']) : null
      ].filter(Boolean))
    ]);
    body.appendChild(bar);

    const pub = await App.api.get('/publishing');
    const lCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), `发布稿列表 (${(pub || []).length})`])
    ]);
    if (!pub || !pub.length) lCard.appendChild(App.h('div', { class: 'empty' }, ['暂无发布稿']));
    else {
      const stMap = { draft: ['草稿', ''], pending: ['待审批', 'warn'], approved: ['已审批', 'info'], published: ['已发布', 'ok'] };
      pub.forEach(p => {
        const st = stMap[p.status] || [p.status, ''];
        lCard.appendChild(App.h('div', { style: 'padding:9px 0;border-bottom:1px dashed var(--line)' }, [
          App.h('div', { class: 'flex between items' }, [
            App.h('div', {}, [App.tag(p.channel, 'info'), ' ', App.h('b', {}, [p.title]), ' ', App.tag(st[0], st[1])]),
            App.h('div', { class: 'flex gap' }, [
              canWrite && p.status === 'draft' ? App.h('button', { class: 'primary', style: 'padding:3px 10px;font-size:12px', onclick: () => this.submit(p.id) }, ['提交审批']) : null,
              isCmd && p.status === 'pending' ? App.h('button', { class: 'success', style: 'padding:3px 10px;font-size:12px', onclick: () => this.approve(p.id) }, ['批准']) : null,
              isCmd && p.status === 'pending' ? App.h('button', { class: 'danger', style: 'padding:3px 10px;font-size:12px', onclick: () => this.approve(p.id, true) }, ['退回']) : null,
              canWrite && p.status === 'approved' ? App.h('button', { class: 'primary', style: 'padding:3px 10px;font-size:12px', onclick: () => this.publish(p.id) }, ['发布']) : null
            ].filter(Boolean))
          ]),
          App.h('div', { class: 'muted', style: 'margin:4px 0' }, [p.content.slice(0, 60) + (p.content.length > 60 ? '...' : '')]),
          App.h('div', { class: 'muted' }, [`${p.by} · ${App.fmt(p.createdAt)}${p.publishedAt ? ' · 已发布 ' + App.fmt(p.publishedAt) : ''}`])
        ]));
      });
    }
    body.appendChild(lCard);
  },

  async draft() {
    // 按当前在办事件类型取口径模板（无事件则通用模板）
    const events = await App.api.get('/dispatch/events');
    const active = (events || []).find(e => e.status !== 'closed');
    const tpl = await App.api.get('/publishing/templates?typeKey=' + (active ? active.typeKey : ''));
    const title = App.h('input', { id: 'pb_t', placeholder: '标题' });
    const channel = App.h('select', { id: 'pb_ch' }, [['官网', '官网'], ['微信公众号', '微信公众号'], ['新闻发布会', '新闻发布会']].map(([v, l]) => App.h('option', { value: v }, [l])));
    const content = App.h('textarea', { id: 'pb_c', rows: 6, value: tpl || '' });
    App.modal('起草发布稿', App.h('div', {}, [
      App.h('div', { class: 'field' }, [App.h('label', {}, ['标题 *']), title]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['发布渠道']), channel]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['正文（已按类型预填口径模板）']), content])
    ]), async () => {
      if (!title.value.trim()) { App.toast('请填标题', 'err'); return false; }
      const r = await App.api.post('/publishing', { title: title.value.trim(), channel: channel.value, content: content.value.trim() });
      if (r) { App.toast('已起草为草稿'); App.go('publishing', { tab: 'publish' }); }
    }, '保存草稿');
  },

  async submit(id) { const r = await App.api.post('/publishing/' + id + '/submit'); if (r) { App.toast('已提交审批'); App.go('publishing', { tab: 'publish' }); } },
  async approve(id, reject) { const r = await App.api.post('/publishing/' + id + '/approve', { reject: !!reject }); if (r) { App.toast(reject ? '已退回' : '已批准'); App.go('publishing', { tab: 'publish' }); } },
  async publish(id) { const r = await App.api.post('/publishing/' + id + '/publish'); if (r) { App.toast('已发布'); App.go('publishing', { tab: 'publish' }); } },

  /* ========== 舆情监测 ========== */
  async renderSentiment(body) {
    body.innerHTML = '';
    const canWrite = ['spokesman', 'commander', 'deputy', 'info'].includes(App.user.role);

    const bar = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'flex between items wrap gap' }, [
        App.h('div', { class: 'section-title', style: 'margin:0' }, [App.h('span', { class: 'bar' }), '舆情监测（负面/谣言标红）']),
        canWrite ? App.h('button', { class: 'primary', onclick: () => this.addSentiment() }, ['+ 录入舆情']) : null
      ].filter(Boolean))
    ]);
    body.appendChild(bar);

    const list = await App.api.get('/publishing/sentiment/list');
    const lCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), `舆情列表 (${(list || []).length})`])
    ]);
    if (!list || !list.length) lCard.appendChild(App.h('div', { class: 'empty' }, ['暂无舆情']));
    else list.forEach(s => {
      const emoKind = s.emotion === '负' ? 'bad' : s.emotion === '正' ? 'ok' : 'info';
      lCard.appendChild(App.h('div', { style: 'padding:9px 0;border-bottom:1px dashed var(--line)' }, [
        App.h('div', { class: 'flex between items' }, [
          App.h('div', {}, [App.tag(s.source, 'info'), ' ', App.tag(s.emotion + '面', emoKind), s.isRumor ? App.tag('谣言', 'bad') : null].filter(Boolean)),
          !s.handled && canWrite ? App.h('button', { class: 'success', style: 'padding:3px 10px;font-size:12px', onclick: () => this.handleSentiment(s.id) }, ['处置']) : null
        ].filter(Boolean)),
        App.h('div', { class: s.isRumor ? 'muted' : '', style: 'margin:4px 0' }, [s.content]),
        App.h('div', { class: 'muted' }, [s.handled ? `✓ 已处置(${s.handledBy})` : '未处置', ' · ', App.fmt(s.at)])
      ]));
    });
    body.appendChild(lCard);
  },

  addSentiment() {
    const source = App.h('select', { id: 'st_src' }, [['微博', '微博'], ['微信', '微信'], ['新闻', '新闻'], ['其他', '其他']].map(([v, l]) => App.h('option', { value: v }, [l])));
    const emotion = App.h('select', { id: 'st_emo' }, [['正', '正面'], ['中', '中性'], ['负', '负面']].map(([v, l]) => App.h('option', { value: v }, [l])));
    const content = App.h('textarea', { id: 'st_c', rows: 3, placeholder: '舆情内容' });
    const rumor = App.h('label', { class: 'chip', style: 'cursor:pointer' }, [App.h('input', { type: 'checkbox', id: 'st_rumor', style: 'width:auto;margin-right:4px' }), '标记为谣言']);
    App.modal('录入舆情', App.h('div', {}, [
      App.h('div', { class: 'grid g2' }, [
        App.h('div', { class: 'field' }, [App.h('label', {}, ['来源']), source]),
        App.h('div', { class: 'field' }, [App.h('label', {}, ['情感']), emotion])
      ]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['内容']), content]),
      App.h('div', { class: 'field' }, [rumor])
    ]), async () => {
      const r = await App.api.post('/publishing/sentiment', { source: source.value, emotion: emotion.value, content: content.value.trim(), isRumor: document.getElementById('st_rumor').checked });
      if (r) { App.toast('已录入'); App.go('publishing', { tab: 'sentiment' }); }
    }, '录入');
  },

  async handleSentiment(id) { const r = await App.api.post('/publishing/sentiment/' + id + '/handle'); if (r) { App.toast('已处置'); App.go('publishing', { tab: 'sentiment' }); } }
};
