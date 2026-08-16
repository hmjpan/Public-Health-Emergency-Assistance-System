// 终止评估与复盘整改 —— 复盘发起 + 整改台账闭环 + 知识沉淀
App.modules.review = {
  async render(root) {
    App.setTitle('复盘整改');
    root.innerHTML = '';
    const page = App.h('div', { class: 'page' });
    root.appendChild(page);

    const events = await App.api.get('/dispatch/events');
    const closed = (events || []).filter(e => e.status === 'closed');
    const active = (events || []).filter(e => e.status !== 'closed');
    const canReview = ['commander', 'deputy', 'reviewer'].includes(App.user.role);

    // 待复盘事件（已终止但未复盘）
    const todoCard = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '待复盘事件（已终止）'])
    ]);
    if (!closed.length) {
      todoCard.appendChild(App.h('div', { class: 'empty' }, ['暂无已终止事件']));
      todoCard.appendChild(App.h('div', { class: 'empty-cta' }, [
        active.length ? App.h('button', { class: 'primary', onclick: () => App.go('response', { eventId: active[0].id }) }, ['🚨 当前有处置中的事件']) : null,
        App.h('button', { onclick: () => App.go('drill') }, ['🎬 或进入演练模式'])
      ].filter(Boolean)));
    }
    else {
      closed.forEach(e => {
        todoCard.appendChild(App.h('div', { class: 'flex between items', style: 'padding:9px 0;border-bottom:1px dashed var(--line)' }, [
          App.h('div', {}, [App.h('b', {}, [(e.typeIcon || '') + ' ' + e.title]), App.h('div', { class: 'muted' }, [`${e.location} · 终止 ${App.fmt(e.closedAt)}`])]),
          e.reviewed ? App.tag('已复盘', 'ok') : canReview ? App.h('button', { class: 'primary', onclick: () => this.initReview(e.id, e.title) }, ['发起复盘']) : App.tag('待复盘', 'warn')
        ]));
      });
    }
    page.appendChild(todoCard);

    // 整改台账
    const rectCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '整改台账（闭环管理）'])
    ]);
    const allRects = await App.api.get('/review/rectifications/all');
    const rectsLoaded = allRects || [];
    if (!rectsLoaded.length) rectCard.appendChild(App.h('div', { class: 'empty' }, ['暂无整改项']));
    else {
      const stMap = { open: ['待整改', 'warn'], doing: ['整改中', 'info'], done: ['已完成', 'ok'], verified: ['已验证关闭', 'ok'] };
      rectsLoaded.forEach(r => {
        const st = stMap[r.status] || [r.status, ''];
        rectCard.appendChild(App.h('div', { style: 'padding:9px 0;border-bottom:1px dashed var(--line)' }, [
          App.h('div', { class: 'flex between items' }, [
            App.h('div', {}, [App.h('b', {}, [r.problem]), ' ', App.tag(st[0], st[1])]),
            App.h('div', { class: 'flex gap' }, [
              r.status !== 'verified' ? App.h('button', { style: 'padding:3px 10px;font-size:12px', onclick: () => this.progressRect(r.id, r.status) }, ['推进']) : null,
              ['commander', 'deputy', 'reviewer'].includes(App.user.role) && r.status === 'done' ? App.h('button', { class: 'success', style: 'padding:3px 10px;font-size:12px', onclick: () => this.verifyRect(r.id) }, ['验证关闭']) : null
            ].filter(Boolean))
          ]),
          App.h('div', { class: 'muted', style: 'margin:4px 0' }, [`${r.eventTitle || ''} · 责任人:${r.owner || '-'} · 措施:${r.measure || '-'} · 时限:${r.deadline || '-'}`])
        ]));
      });
    }
    page.appendChild(rectCard);

    // 知识库
    const kCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
      App.h('div', { class: 'flex between items' }, [
        App.h('div', { class: 'section-title', style: 'margin:0' }, [App.h('span', { class: 'bar' }), '知识库（复盘结论回流）']),
        ['reviewer', 'admin'].includes(App.user.role) ? App.h('button', { onclick: () => this.addKnowledge() }, ['+ 沉淀知识']) : null
      ].filter(Boolean))
    ]);
    const knowledge = await App.api.get('/review/knowledge/list');
    if (!knowledge || !knowledge.length) kCard.appendChild(App.h('div', { class: 'empty' }, ['暂无知识沉淀']));
    else knowledge.forEach(k => {
      kCard.appendChild(App.h('div', { class: 'flex between items', style: 'padding:8px 0;border-bottom:1px dashed var(--line)' }, [
        App.h('div', {}, [App.tag(k.type, 'info'), ' ', App.h('b', {}, [k.title]), k.typeKey ? App.h('span', { class: 'muted', style: 'margin-left:8px' }, ['适用:' + k.typeKey]) : null]),
        App.h('span', { class: 'muted' }, [k.by])
      ]));
    });
    page.appendChild(kCard);
  },

  initReview(eventId, title) {
    const summary = App.h('textarea', { id: 'rv_sum', rows: 3, placeholder: '处置经过概述' });
    const problems = App.h('textarea', { id: 'rv_prob', rows: 3, placeholder: '问题清单,每行一条' });
    const lessons = App.h('textarea', { id: 'rv_lesson', rows: 2, placeholder: '经验教训' });
    App.modal('发起复盘 - ' + title, App.h('div', {}, [
      App.h('div', { class: 'field' }, [App.h('label', {}, ['处置经过']), summary]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['问题清单（每行一条）']), problems]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['经验教训']), lessons])
    ]), async () => {
      const r = await App.api.post('/review/' + eventId, {
        summary: summary.value.trim(),
        problems: problems.value.trim().split('\n').filter(Boolean),
        lessons: lessons.value.trim()
      });
      if (r) { App.toast('复盘已发起,请登记整改项'); this.addRect(eventId, title); }
    }, '发起复盘');
  },

  addRect(eventId, title) {
    const problem = App.h('input', { id: 'rt_prob', placeholder: '问题 *' });
    const measure = App.h('input', { id: 'rt_meas', placeholder: '整改措施' });
    const owner = App.h('input', { id: 'rt_own', placeholder: '责任人' });
    const deadline = App.h('input', { id: 'rt_dl', type: 'date' });
    App.modal('登记整改项 - ' + title, App.h('div', {}, [
      App.h('div', { class: 'field' }, [App.h('label', {}, ['问题描述 *']), problem]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['整改措施']), measure]),
      App.h('div', { class: 'grid g2' }, [
        App.h('div', { class: 'field' }, [App.h('label', {}, ['责任人']), owner]),
        App.h('div', { class: 'field' }, [App.h('label', {}, ['完成时限']), deadline])
      ])
    ]), async () => {
      if (!problem.value.trim()) { App.toast('请填问题', 'err'); return false; }
      const r = await App.api.post('/review/' + eventId + '/rectifications', { problem: problem.value.trim(), measure: measure.value.trim(), owner: owner.value.trim(), deadline: deadline.value });
      if (r) { App.toast('整改项已登记'); this.render(document.getElementById('content')); }
    }, '登记');
  },

  async progressRect(id, curStatus) {
    const next = { open: 'doing', doing: 'done' }[curStatus];
    const r = await App.api.post('/review/rectifications/' + id + '/progress', { status: next, note: '推进至' + next });
    if (r) { App.toast('已推进至 ' + next); this.render(document.getElementById('content')); }
  },

  async verifyRect(id) {
    const r = await App.api.post('/review/rectifications/' + id + '/verify');
    if (r) { App.toast('已验证关闭'); this.render(document.getElementById('content')); }
  },

  addKnowledge() {
    const title = App.h('input', { id: 'kn_t', placeholder: '标题' });
    const type = App.h('select', { id: 'kn_type' }, [['SOP', 'SOP'], ['预案', '预案'], ['案例', '案例'], ['法规', '法规']].map(([v, l]) => App.h('option', { value: v }, [l])));
    const typeKey = App.h('select', { id: 'kn_tk' }, [['', '通用'], ['INF', '传染病'], ['FOOD', '食源'], ['ENV', '环境'], ['POISON', '职业中毒']].map(([v, l]) => App.h('option', { value: v }, [l])));
    const content = App.h('textarea', { id: 'kn_c', rows: 4, placeholder: '内容' });
    App.modal('沉淀知识', App.h('div', {}, [
      App.h('div', { class: 'field' }, [App.h('label', {}, ['标题 *']), title]),
      App.h('div', { class: 'grid g2' }, [
        App.h('div', { class: 'field' }, [App.h('label', {}, ['类型']), type]),
        App.h('div', { class: 'field' }, [App.h('label', {}, ['适用事件']), typeKey])
      ]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['内容']), content])
    ]), async () => {
      if (!title.value.trim()) { App.toast('请填标题', 'err'); return false; }
      const r = await App.api.post('/review/knowledge', { title: title.value.trim(), type: type.value, typeKey: typeKey.value, content: content.value.trim() });
      if (r) { App.toast('已沉淀'); this.render(document.getElementById('content')); }
    }, '沉淀');
  }
};
