// 任务工单 —— 队员视角:我的任务 + 待确认通知(强制反馈)
App.modules.tasks = {
  async render(root) {
    App.setTitle('任务工单');
    root.innerHTML = '';
    const page = App.h('div', { class: 'page' });
    root.appendChild(page);

    // 待确认通知（强制反馈入口）
    const notifCard = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '🔔 待确认通知（5分钟未确认将升级上级）']),
      App.h('div', { id: 'tk_notifs' })
    ]);
    page.appendChild(notifCard);
    const notifs = await App.api.get('/dispatch/notifications/my');
    const notifBox = document.getElementById('tk_notifs');
    if (!notifs || !notifs.length) notifBox.appendChild(App.h('div', { class: 'empty', style: 'padding:16px' }, ['暂无待确认通知']));
    else {
      notifs.forEach(n => {
        notifBox.appendChild(App.h('div', { class: 'flex between items', style: 'padding:9px 0;border-bottom:1px dashed var(--line)' }, [
          App.h('div', {}, [
            App.h('b', {}, [n.content.slice(0, 50)]),
            App.h('div', { class: 'muted' }, [`${App.fmt(n.sentAt)} · 截止 ${App.fmt(n.ackDeadline)} · 通道:${(n.channels || []).join('/')}`])
          ]),
          App.h('button', { class: 'success', style: 'padding:4px 12px;font-size:12px', onclick: async () => {
            const r = await App.api.post('/dispatch/notifications/' + n.id + '/ack');
            if (r) { App.toast('已确认,感谢反馈'); this.render(document.getElementById('content')); }
          } }, ['✅ 确认收到'])
        ]));
      });
    }

    const events = await App.api.get('/dispatch/events');
    const active = (events || []).filter(e => e.status !== 'closed');

    // 我的任务
    const myCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '我的任务'])
    ]);
    page.appendChild(myCard);

    if (!active.length) {
      myCard.appendChild(App.h('div', { class: 'empty' }, ['当前无任务,保持待命']));
      return;
    }

    const statMap = { pending: '待执行', doing: '执行中', done: '已完成', blocked: '受阻' };
    const isLeader = ['commander', 'deputy'].includes(App.user.role);
    let has = false;
    for (const e of active) {
      const tasks = await App.api.get('/field/' + e.id + '/tasks');
      const mine = isLeader ? (tasks || []) : (tasks || []).filter(t => t.group === App.user.group);
      if (!mine.length) continue;
      has = true;
      myCard.appendChild(App.h('div', { class: 'muted2', style: 'margin:10px 0 4px;font-weight:600' }, [`${e.typeIcon || ''} ${e.title}`]));
      mine.forEach(t => {
        const kind = t.status === 'done' ? 'ok' : t.status === 'blocked' ? 'bad' : 'info';
        myCard.appendChild(App.h('div', { class: 'flex between items', style: 'padding:9px 0;border-bottom:1px dashed var(--line)' }, [
          App.h('div', {}, [
            App.h('b', {}, [t.title]),
            App.h('div', { class: 'muted' }, [(t.steps || []).join(' → ')])
          ]),
          App.h('div', { class: 'flex gap items' }, [
            App.tag(statMap[t.status] || t.status, kind),
            t.status === 'pending' ? App.h('button', { style: 'padding:3px 10px;font-size:12px', onclick: async () => { await App.api.post('/field/tasks/' + t.id + '/status', { status: 'doing' }); App.go('tasks'); } }, ['开始']) : null,
            t.status === 'doing' ? App.h('button', { class: 'success', style: 'padding:3px 10px;font-size:12px', onclick: async () => { await App.api.post('/field/tasks/' + t.id + '/status', { status: 'done' }); App.go('tasks'); } }, ['完成']) : null
          ].filter(Boolean))
        ]));
      });
    }
    if (!has) myCard.appendChild(App.h('div', { class: 'empty' }, ['暂无分配到您小组的任务']));

    // 我的出动状态
    const events2 = active;
    if (events2.length) {
      const personnel = await App.api.get('/response/personnel?eventId=' + events2[0].id);
      const mine = (personnel || []).filter(p => p.name === App.user.name);
      if (mine.length) {
        const pCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
          App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '我的出动状态'])
        ]);
        mine.forEach(p => {
          pCard.appendChild(App.h('div', { class: 'flex items gap' }, [
            App.h('span', {}, [`当前状态: ${p.status}`]),
            App.h('button', { class: 'primary', onclick: () => App.go('response', { eventId: p.eventId }) }, ['去更新状态'])
          ]));
        });
        page.appendChild(pCard);
      }
    }
  }
};
