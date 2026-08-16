// 常态化报告 —— 日报告/零报告/节点报告 + 催报清单 + 报告日历
App.modules.routine = {
  async render(root, params) {
    App.setTitle('常态化报告');
    root.innerHTML = '';
    const page = App.h('div', { class: 'page' });
    root.appendChild(page);

    const events = await App.api.get('/dispatch/events');
    const active = (events || []).filter(e => e.status !== 'closed');
    const eventId = params.eventId || (active[0] && active[0].id) || '';

    // 催报清单
    const pending = await App.api.get('/routine/pending');
    if (pending && pending.length) {
      const pCard = App.h('div', { class: 'card', style: 'border-color:var(--amber)' }, [
        App.h('div', { class: 'section-title', style: 'color:var(--amber)' }, [App.h('span', { class: 'bar', style: 'background:var(--amber)' }), `⏰ 催报提醒 (${pending.length})`])
      ]);
      pending.forEach(p => {
        pCard.appendChild(App.h('div', { class: 'flex between items', style: 'padding:7px 0;border-bottom:1px dashed var(--line)' }, [
          App.h('div', {}, [App.h('b', {}, [p.title]), App.h('span', { class: 'muted', style: 'margin-left:8px' }, [p.reportDate])]),
          App.h('div', { class: 'flex gap items' }, [
            App.tag(p.dueTip, p.status === 'late' ? 'bad' : 'warn'),
            App.h('button', { class: 'primary', style: 'padding:3px 12px;font-size:12px', onclick: () => this.fillReport(p.eventId, p.typeKey) }, ['去填报'])
          ])
        ]));
      });
      page.appendChild(pCard);
    }

    // 填报入口
    const bar = App.h('div', { class: 'card', style: pending && pending.length ? 'margin-top:12px' : '' }, [
      App.h('div', { class: 'flex between items wrap gap' }, [
        App.h('div', { class: 'section-title', style: 'margin:0' }, [App.h('span', { class: 'bar' }), '📅 常态化报告（日报告 / 零报告）']),
        App.h('div', { class: 'flex gap items' }, [
          (() => {
            const sel = App.h('select', { id: 'rt_event', style: 'width:auto' });
            (active || []).forEach(e => sel.appendChild(App.h('option', { value: e.id, 'data-type': e.typeKey, selected: e.id === eventId ? '' : null }, [e.title])));
            return sel;
          })(),
          App.h('button', { class: 'primary', disabled: active.length ? null : '', onclick: () => { const s = document.getElementById('rt_event'); if (!s.value) { App.toast('当前无在办事件,无需填报', 'err'); return; } this.fillReport(s.value, s.options[s.selectedIndex].getAttribute('data-type')); } }, ['+ 填报今日报告'])
        ])
      ])
    ]);
    page.appendChild(bar);

    const grid = App.h('div', { class: 'grid g2', style: 'margin-top:12px' });
    page.appendChild(grid);

    // 报告日历
    const calendar = await App.api.get('/routine/calendar' + (eventId ? '?eventId=' + eventId : ''));
    const calCard = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '近14天报告日历'])
    ]);
    const calRow = App.h('div', { class: 'flex wrap gap', style: 'margin-top:8px' });
    (calendar || []).forEach(d => {
      const day = d.date.slice(5);
      calRow.appendChild(App.h('div', {
        title: d.date + (d.reported ? ' 已报' : ' 缺报'),
        style: `width:44px;text-align:center;padding:6px 0;border-radius:8px;font-size:12px;border:1px solid var(--line);${d.reported ? 'background:rgba(52,211,153,.15);color:var(--green)' : 'background:rgba(248,113,113,.12);color:var(--red)'}`
      }, [day, App.h('div', { style: 'font-size:16px' }, [d.reported ? '✓' : '✗'])]));
    });
    calCard.appendChild(calRow);
    calCard.appendChild(App.h('div', { class: 'hint', style: 'margin-top:8px' }, ['绿=已报 红=缺报;节点报告不计入日/零报告']));
    grid.appendChild(calCard);

    // 报告列表
    const reports = await App.api.get('/routine' + (eventId ? '?eventId=' + eventId : ''));
    const lCard = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), `报告记录 (${(reports || []).length})`])
    ]);
    if (!reports || !reports.length) lCard.appendChild(App.h('div', { class: 'empty' }, ['暂无报告']));
    else {
      const typeMap = { daily: ['日报告', 'info'], zero: ['零报告', 'ok'], milestone: ['节点', 'warn'] };
      reports.slice(0, 12).forEach(r => {
        const t = typeMap[r.reportType] || [r.reportType, ''];
        lCard.appendChild(App.h('div', { style: 'padding:8px 0;border-bottom:1px dashed var(--line)' }, [
          App.h('div', { class: 'flex between items' }, [
            App.h('div', {}, [App.tag(t[0], t[1]), ' ', App.h('b', {}, [r.reportDate]), r.milestone ? App.tag(r.milestone, 'info') : null].filter(Boolean)),
            App.h('span', { class: 'muted' }, [r.submittedBy])
          ]),
          Object.keys(r.metrics || {}).length ? App.h('div', { class: 'muted', style: 'margin-top:4px' }, [Object.entries(r.metrics).map(([k, v]) => `${k}:${v}`).join(' · ')]) : null
        ]));
      });
    }
    grid.appendChild(lCard);
  },

  // 填报报告（按事件类型出指标模板）
  async fillReport(eventId, typeKey) {
    const tpl = await App.api.get('/routine/templates?typeKey=' + (typeKey || ''));
    const metrics = (tpl && tpl.metrics) || [];
    const type = App.h('select', { id: 'rr_type' }, [
      App.h('option', { value: 'daily' }, ['日报告']), App.h('option', { value: 'zero' }, ['零报告'])
    ]);
    const fieldsBox = App.h('div', { id: 'rr_fields' });
    const buildFields = () => {
      fieldsBox.innerHTML = '';
      if (document.getElementById('rr_type').value === 'zero') {
        fieldsBox.appendChild(App.h('div', { class: 'empty' }, ['零报告:今日无新增,各项为0,提交即留痕']));
        return;
      }
      const grid = App.h('div', { class: 'grid g3' });
      metrics.forEach(m => grid.appendChild(App.h('div', { class: 'field' }, [App.h('label', {}, [m]), App.h('input', { 'data-m': m, type: 'number', value: 0 })])));
      fieldsBox.appendChild(grid);
    };
    setTimeout(buildFields, 0);
    type.addEventListener('change', buildFields);

    App.modal('填报常态化报告', App.h('div', {}, [
      App.h('div', { class: 'field' }, [App.h('label', {}, ['报告类型']), type]),
      fieldsBox
    ]), async () => {
      const rt = document.getElementById('rr_type').value;
      const metricsData = {};
      if (rt === 'daily') {
        fieldsBox.querySelectorAll('input[data-m]').forEach(i => metricsData[i.getAttribute('data-m')] = +i.value || 0);
      }
      const r = await App.api.post('/routine', { eventId, typeKey, reportType: rt, metrics: metricsData });
      if (r) { App.toast('已提交'); App.go('routine', { eventId }); }
    }, '提交报告');
  }
};
