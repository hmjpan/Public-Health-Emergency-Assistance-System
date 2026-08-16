// 一键启动 —— 决策层:研判上报 → 选择事件类型/通知组 → 一键发布 → 系统自动执行
App.modules.dispatch = {
  async render(root, params) {
    App.setTitle('一键启动');
    root.innerHTML = '';
    const page = App.h('div', { class: 'page' });
    root.appendChild(page);

    // 流程定位：监测研判(当前) → 应急响应 → 现场处置 → 终止复盘
    page.appendChild(App.stepper('detected', { labels: ['📥 监测研判', '🚨 应急响应', '🎯 现场处置', '🔁 终止复盘'] }));

    const types = await App.api.get('/dispatch/meta/types');
    const reports = await App.api.get('/reports?status=pending');
    const directory = await App.api.get('/directory');
    const groups = [...new Set((directory || []).map(d => d.group))];
    let selectedReport = params.reportId ? (reports || []).find(r => r.id === params.reportId) : null;

    // ===== 研判材料包（规则引擎 · 第15.3节场景2）=====
    // 从选中上报预填要素；指挥员确认要素->规则定级->采纳预填级别
    const advWrap = App.h('div', { id: 'adv_wrap' });
    page.appendChild(advWrap);
    if (App.modules.advisor) {
      App.modules.advisor.renderGradePanel(advWrap, {
        factors: selectedReport ? { typeKey: selectedReport.typeGuess } : {},
        onAdopt: ({ level }) => {
          const lvSel = document.getElementById('dp_level');
          if (lvSel) lvSel.value = level;
          const tySel = document.getElementById('dp_type');
          if (tySel) tySel.value = document.getElementById('adv_typeKey').value;
          App.toast('已预填建议级别 ' + level + '，请指挥员确认发布');
        }
      });
    }

    // 左侧:发起启动
    const left = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '🚨 发起应急响应'])
    ]);

    // 上报选择（如有）
    left.appendChild(App.h('div', { class: 'field' }, [
      App.h('label', {}, ['关联上报（可空）']),
      (() => {
        const sel = App.h('select', { id: 'dp_report' }, [App.h('option', { value: '' }, ['— 手动新建 —'])]);
        (reports || []).forEach(r => sel.appendChild(App.h('option', { value: r.id, selected: selectedReport && selectedReport.id === r.id ? '' : null }, [`${r.location} · ${r.situation.slice(0, 20)}`])) || null);
        return sel;
      })()
    ]));

    left.appendChild(App.h('div', { class: 'field' }, [
      App.h('label', {}, ['事件类型']),
      (() => {
        const sel = App.h('select', { id: 'dp_type' });
        (types || []).forEach(t => sel.appendChild(App.h('option', { value: t.typeKey }, [`${t.icon} ${t.name}`])));
        if (selectedReport) sel.value = selectedReport.typeGuess;
        return sel;
      })()
    ]));

    left.appendChild(App.h('div', { class: 'field' }, [App.h('label', {}, ['事件标题 *']), App.h('input', { id: 'dp_title', value: selectedReport ? selectedReport.situation.slice(0, 30) : '', placeholder: '事件标题' })]));
    left.appendChild(App.h('div', { class: 'grid g2' }, [
      App.h('div', { class: 'field' }, [App.h('label', {}, ['地点']), App.h('input', { id: 'dp_loc', value: selectedReport ? selectedReport.location : '' })]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['规模']), App.h('input', { id: 'dp_scale', value: selectedReport ? selectedReport.scale : '' })])
    ]));
    left.appendChild(App.h('div', { class: 'field' }, [
      App.h('label', {}, ['响应级别']),
      (() => {
        const sel = App.h('select', { id: 'dp_level' });
        ['I级', 'II级', 'III级', 'IV级'].forEach(l => sel.appendChild(App.h('option', { value: l, selected: l === 'IV级' ? '' : null }, [l])));
        return sel;
      })()
    ]));

    // 通知组选择（可临时增删）
    left.appendChild(App.h('div', { class: 'field' }, [
      App.h('label', {}, ['通知小组（可临时增删）']),
      (() => {
        const box = App.h('div', { class: 'flex wrap gap', id: 'dp_groups', style: 'margin-top:6px' });
        groups.forEach(g => {
          const id = 'dp_g_' + g;
          box.appendChild(App.h('label', { class: 'chip', style: 'cursor:pointer' }, [
            App.h('input', { type: 'checkbox', value: g, checked: '', style: 'width:auto;margin-right:4px' }), g
          ]));
        });
        return box;
      })()
    ]));

    left.appendChild(App.h('button', {
      class: 'danger', style: 'width:100%;padding:14px;font-size:16px;font-weight:700',
      onclick: () => this.launch(types)
    }, ['🚨 确认发布 · 一键启动']));

    // 右侧:类型说明与在办事件
    const right = App.h('div', {}, []);
    const typeInfo = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '事件类型处置要点'])
    ]);
    (types || []).forEach(t => {
      typeInfo.appendChild(App.h('div', { style: 'padding:8px 0;border-bottom:1px dashed var(--line)' }, [
        App.h('div', {}, [`${t.icon} `, App.h('b', {}, [t.name])]),
        App.h('div', { class: 'muted' }, ['首批任务: ' + t.firstTaskSummary]),
        App.h('div', { class: 'muted' }, ['通知组: ' + t.notifyGroups.join('、')])
      ]));
    });
    right.appendChild(typeInfo);

    // 在办事件
    const events = await App.api.get('/dispatch/events');
    const activeCard = App.h('div', { class: 'card', style: 'margin-top:14px' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '在办事件'])
    ]);
    const active = (events || []).filter(e => e.status !== 'closed');
    if (!active.length) activeCard.appendChild(App.h('div', { class: 'empty' }, ['无在办事件']));
    else active.forEach(e => {
      activeCard.appendChild(App.h('div', { class: 'flex between items', style: 'padding:8px 0;border-bottom:1px dashed var(--line)' }, [
        App.h('div', {}, [
          App.h('div', {}, [(e.typeIcon || '') + ' ' + e.title]),
          App.h('div', { class: 'muted' }, [e.location + ' · ' + App.fmt(e.createdAt)])
        ]),
        App.tag(e.stageName, 'info')
      ]));
    });
    right.appendChild(activeCard);

    page.appendChild(App.h('div', { class: 'grid g2' }, [left, right]));
  },

  async launch() {
    const title = document.getElementById('dp_title').value.trim();
    if (!title) { App.toast('请填写事件标题', 'err'); return; }
    const groups = [...document.querySelectorAll('#dp_groups input:checked')].map(i => i.value);
    if (!groups.length) { App.toast('请至少选择一个通知小组', 'err'); return; }
    const body = {
      reportId: document.getElementById('dp_report').value || null,
      typeKey: document.getElementById('dp_type').value,
      title,
      location: document.getElementById('dp_loc').value.trim(),
      scale: document.getElementById('dp_scale').value.trim(),
      level: document.getElementById('dp_level').value,
      notifyGroups: groups
    };
    const r = await App.api.post('/dispatch/launch', body);
    if (r) {
      App.toast(`已启动!通知${r.notified}人,生成${r.materialPacks}个物资包`);
      App.go('response', { eventId: r.event.id });
    }
  }
};
