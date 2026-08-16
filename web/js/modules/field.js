// 现场处置 —— 现场指挥/任务包/表单回传/定时简报/紧急上报/指令/资源申请/完成校验
App.modules.field = {
  async render(root, params) {
    App.setTitle('现场处置');
    root.innerHTML = '';
    const page = App.h('div', { class: 'page' });
    root.appendChild(page);

    const events = await App.api.get('/dispatch/events');
    const active = (events || []).filter(e => e.status !== 'closed');
    if (!active.length) { page.appendChild(App.h('div', { class: 'empty' }, ['当前无在办事件'])); return; }
    const e = active.find(x => x.id === params.eventId) || active.find(x => x.stage === 'field') || active[0];

    // 流程定位：当前环节
    page.appendChild(App.stepper(e.stage));

    // 头部
    page.appendChild(App.h('div', { class: 'card' }, [
      App.h('div', { class: 'flex between items wrap gap' }, [
        App.h('div', { class: 'section-title', style: 'margin:0' }, [App.h('span', { class: 'bar' }), `${e.typeIcon || ''} ${e.title} — 现场处置`]),
        (() => {
          const sel = App.h('select', { style: 'width:auto', onchange: ev => App.go('field', { eventId: ev.target.value }) });
          active.forEach(x => sel.appendChild(App.h('option', { value: x.id, selected: x.id === e.id ? '' : null }, [x.title])));
          return sel;
        })()
      ]),
      App.h('div', { class: 'muted', style: 'margin-top:6px' }, [`现场指挥员: ${e.fieldCommanderId ? '已指定' : '未指定'} · 阶段: ${e.stageName}`])
    ]));

    // 操作栏
    const isCmd = ['commander', 'deputy'].includes(App.user.role);
    const bar = App.h('div', { class: 'flex gap wrap', style: 'margin:12px 0' }, [
      isCmd ? App.h('button', { onclick: () => this.assignCommander(e.id) }, ['指定现场指挥员']) : null,
      App.h('button', { class: 'primary', onclick: () => this.activateTasks(e.id) }, ['激活任务包并分发']),
      App.h('button', { onclick: () => this.fillForm(e) }, ['填报表单']),
      App.h('button', { onclick: () => App.go('medical', { tab: 'cases', eventId: e.id }) }, ['🏥 登记/查看病例']),
      App.h('button', { onclick: () => this.submitBrief(e.id) }, ['提交简报']),
      App.h('button', { class: 'danger', onclick: () => this.urgentReport(e.id) }, ['⚠ 紧急上报']),
      isCmd ? App.h('button', { class: 'primary', onclick: () => this.issueInstruction(e.id) }, ['下达指令']) : null,
      App.h('button', { onclick: () => this.requestResource(e.id) }, ['资源申请']),
      isCmd && e.stage === 'field' ? App.h('button', { class: 'success', onclick: () => this.finishField(e.id) }, ['✓ 现场处置完成']) : null
    ].filter(Boolean));
    page.appendChild(bar);

    // 现场完成标准（决策层可见）
    if (isCmd) {
      const fc = await App.api.get('/field/' + e.id + '/field-check');
      if (fc && e.stage === 'field') {
        const c = App.h('div', { class: 'card' }, [
          App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '现场处置完成标准'])
        ]);
        c.appendChild(App.h('div', { class: 'flex gap wrap' }, [
          App.h('div', { class: 'chip' }, [App.h('span', { class: 'dot ' + (fc.tasksDone ? 'g' : 'r') }), `关键任务完成 ${fc.detail.criticalDone}/${fc.detail.criticalTotal}`]),
          App.h('div', { class: 'chip' }, [App.h('span', { class: 'dot ' + (fc.formsBack ? 'g' : 'r') }), `表单回传 ${fc.detail.formsCount}`]),
          App.h('div', { class: 'chip' }, [App.h('span', { class: 'dot ' + (fc.blockedTasks === 0 ? 'g' : 'r') }), `受阻任务 ${fc.blockedTasks}`])
        ]));
        page.appendChild(c);
      }
    }

    const grid = App.h('div', { class: 'grid g2', style: 'margin-top:12px' });
    page.appendChild(grid);

    // 任务看板
    const tasks = await App.api.get('/field/' + e.id + '/tasks');
    const tCard = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), `任务看板 (${(tasks || []).length})`])
    ]);
    const statMap = { pending: '待执行', doing: '执行中', done: '已完成', blocked: '受阻需支援' };
    if (!tasks || !tasks.length) tCard.appendChild(App.h('div', { class: 'empty' }, ['尚未激活任务包']));
    else tasks.forEach(t => {
      const kind = t.status === 'done' ? 'ok' : t.status === 'blocked' ? 'bad' : 'info';
      const mine = t.group === App.user.group || isCmd;
      tCard.appendChild(App.h('div', { style: 'padding:9px 0;border-bottom:1px dashed var(--line)' }, [
        App.h('div', { class: 'flex between items' }, [
          App.h('div', {}, [App.h('b', {}, [t.title]), App.h('span', { class: 'muted', style: 'margin-left:8px' }, [t.group])]),
          App.tag(statMap[t.status] || t.status, kind)
        ]),
        App.h('div', { class: 'muted', style: 'margin:4px 0' }, [(t.steps || []).join(' → ')]),
        mine && t.status !== 'done' ? App.h('div', { class: 'flex gap', style: 'margin-top:4px' }, [
          t.status === 'pending' ? App.h('button', { style: 'padding:3px 10px;font-size:12px', onclick: () => this.taskStatus(t.id, 'doing') }, ['开始执行']) : null,
          t.status === 'doing' ? App.h('button', { class: 'success', style: 'padding:3px 10px;font-size:12px', onclick: () => this.taskStatus(t.id, 'done') }, ['完成']) : null,
          t.status !== 'blocked' ? App.h('button', { class: 'danger', style: 'padding:3px 10px;font-size:12px', onclick: () => this.taskBlock(t.id) }, ['受阻求援']) : null
        ].filter(Boolean)) : null
      ]));
    });
    grid.appendChild(tCard);

    // 右列：简报 + 指令 + 表单
    const right = App.h('div', {}, []);
    // 简报
    const briefs = await App.api.get('/field/' + e.id + '/briefs');
    const bCard = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '现场简报'])
    ]);
    if (!briefs || !briefs.length) bCard.appendChild(App.h('div', { class: 'empty' }, ['暂无简报']));
    else briefs.slice(0, 3).forEach(b => {
      bCard.appendChild(App.h('div', { style: 'padding:8px 0;border-bottom:1px dashed var(--line)' }, [
        App.h('div', { class: 'muted' }, [`${App.fmt(b.createdAt)} · ${b.by}`]),
        App.h('div', {}, [`调查${b.investigated} 采样${b.sampled} 消杀${b.disinfectedArea}㎡`]),
        b.difficulties ? App.h('div', { class: 'muted' }, ['困难: ' + b.difficulties]) : null,
        b.needs ? App.h('div', { class: 'muted' }, ['需求: ' + b.needs]) : null
      ]));
    });
    right.appendChild(bCard);
    // 指令
    const ins = await App.api.get('/field/' + e.id + '/instructions');
    const iCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '指令（强制反馈闭环）'])
    ]);
    if (!ins || !ins.length) iCard.appendChild(App.h('div', { class: 'empty' }, ['暂无指令']));
    else ins.slice(0, 5).forEach(x => {
      const stMap = { issued: '待确认', acked: '已确认', done: '已完成' };
      const kind = x.status === 'done' ? 'ok' : x.status === 'acked' ? 'info' : 'warn';
      const mine = x.targetName === App.user.name;
      iCard.appendChild(App.h('div', { class: 'flex between items', style: 'padding:8px 0;border-bottom:1px dashed var(--line)' }, [
        App.h('div', {}, [
          App.h('div', {}, [App.h('b', {}, [x.targetName]), ': ' + x.task]),
          App.h('div', { class: 'muted' }, [`${x.issuedBy} · ${App.fmt(x.issuedAt)}`])
        ]),
        mine && x.status === 'issued' ? App.h('button', { style: 'padding:3px 10px;font-size:12px', onclick: () => this.ackInstruction(x.id, false) }, ['确认']) :
          mine && x.status === 'acked' ? App.h('button', { class: 'success', style: 'padding:3px 10px;font-size:12px', onclick: () => this.ackInstruction(x.id, true) }, ['完成']) :
            App.tag(stMap[x.status] || x.status, kind)
      ]));
    });
    right.appendChild(iCard);
    // 表单
    const forms = await App.api.get('/field/' + e.id + '/forms');
    const fCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), `已回传表单 (${(forms || []).length})`])
    ]);
    if (!forms || !forms.length) fCard.appendChild(App.h('div', { class: 'empty' }, ['暂无表单']));
    else forms.slice(0, 5).forEach(f => {
      fCard.appendChild(App.h('div', { class: 'flex between items', style: 'padding:6px 0;border-bottom:1px dashed var(--line)' }, [
        App.h('div', {}, [f.formName, f.urgent ? App.tag('紧急', 'bad') : null]),
        App.h('div', { class: 'muted' }, [`${f.filledBy} · ${App.fmt(f.createdAt)}`])
      ]));
    });
    right.appendChild(fCard);
    grid.appendChild(right);
  },

  async assignCommander(eventId) {
    const r = await App.api.post('/field/' + eventId + '/commander/assign', {});
    if (r) { App.toast('已指定现场指挥员: ' + (r.name || '')); this.render(document.getElementById('content'), { eventId }); }
  },

  async activateTasks(eventId) {
    const r = await App.api.post('/field/' + eventId + '/tasks/activate');
    if (r) { App.toast(`已分发${r.length}项任务`); this.render(document.getElementById('content'), { eventId }); }
  },

  async taskStatus(id, status) {
    const r = await App.api.post('/field/tasks/' + id + '/status', { status });
    if (r) { App.toast('已更新'); this.render(document.getElementById('content'), {}); }
  },

  taskBlock(id) {
    const reason = App.h('input', { id: 'tb_reason', placeholder: '受阻原因/所需支援' });
    App.modal('任务受阻求援', App.h('div', { class: 'field' }, [App.h('label', {}, ['受阻原因']), reason]), async () => {
      const r = await App.api.post('/field/tasks/' + id + '/status', { status: 'blocked', blockedReason: reason.value.trim() });
      if (r) { App.toast('已上报求援'); this.render(document.getElementById('content'), {}); }
    }, '提交');
  },

  async fillForm(e) {
    // 从事件类型取表单集（formDefs 由 /dispatch/events/:id 返回）
    const d = await App.api.get('/dispatch/events/' + e.id);
    const formDefs = (d && d.formDefs) || [];
    if (!formDefs.length) { App.toast('该事件类型暂无表单定义', 'err'); return; }
    // 简易动态表单
    const body = App.h('div', {}, []);
    body.appendChild(App.h('div', { class: 'field' }, [
      App.h('label', {}, ['表单类型']),
      (() => {
        const sel = App.h('select', { id: 'ff_key', onchange: () => buildFields() });
        formDefs.forEach(f => sel.appendChild(App.h('option', { value: f.key, 'data-name': f.name }, [f.name])));
        return sel;
      })()
    ]));
    const fieldsBox = App.h('div', { id: 'ff_fields' });
    body.appendChild(fieldsBox);
    const urgent = App.h('label', { class: 'chip', style: 'cursor:pointer' }, [
      App.h('input', { type: 'checkbox', id: 'ff_urgent', style: 'width:auto;margin-right:4px' }), '含关键信息(强提醒指挥部)'
    ]);
    body.appendChild(App.h('div', { class: 'field' }, [urgent]));

    const buildFields = () => {
      fieldsBox.innerHTML = '';
      const key = document.getElementById('ff_key').value;
      const def = formDefs.find(f => f.key === key);
      (def ? def.fields : []).forEach(fn => {
        fieldsBox.appendChild(App.h('div', { class: 'field' }, [
          App.h('label', {}, [fn]),
          App.h('input', { 'data-fn': fn })
        ]));
      });
    };
    setTimeout(buildFields, 0);

    App.modal('填报表单（采集即回传）', body, async () => {
      const sel = document.getElementById('ff_key');
      const data = {};
      fieldsBox.querySelectorAll('input[data-fn]').forEach(i => data[i.getAttribute('data-fn')] = i.value.trim());
      const r = await App.api.post('/field/' + e.id + '/forms', {
        formKey: sel.value,
        formName: sel.options[sel.selectedIndex].text,
        data,
        urgent: document.getElementById('ff_urgent').checked
      });
      if (r) { App.toast('表单已回传'); this.render(document.getElementById('content'), { eventId: e.id }); }
    }, '提交回传');
  },

  submitBrief(eventId) {
    const inv = App.h('input', { id: 'bf_inv', type: 'number', placeholder: '0' });
    const samp = App.h('input', { id: 'bf_samp', type: 'number', placeholder: '0' });
    const area = App.h('input', { id: 'bf_area', type: 'number', placeholder: '0' });
    const diff = App.h('textarea', { id: 'bf_diff', rows: 2, placeholder: '当前困难' });
    const needs = App.h('textarea', { id: 'bf_needs', rows: 2, placeholder: '所需支援' });
    App.modal('提交现场简报', App.h('div', {}, [
      App.h('div', { class: 'grid g3' }, [
        App.h('div', { class: 'field' }, [App.h('label', {}, ['已调查数']), inv]),
        App.h('div', { class: 'field' }, [App.h('label', {}, ['已采样数']), samp]),
        App.h('div', { class: 'field' }, [App.h('label', {}, ['消杀面积㎡']), area])
      ]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['当前困难']), diff]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['所需支援']), needs])
    ]), async () => {
      const r = await App.api.post('/field/' + eventId + '/briefs', {
        investigated: +inv.value || 0, sampled: +samp.value || 0, disinfectedArea: +area.value || 0,
        difficulties: diff.value.trim(), needs: needs.value.trim()
      });
      if (r) { App.toast('简报已推送指挥部'); this.render(document.getElementById('content'), { eventId }); }
    }, '提交');
  },

  urgentReport(eventId) {
    const title = App.h('input', { id: 'ur_title', placeholder: '如: 新发病例/检出高致病病原体/人员安全受威胁' });
    const detail = App.h('textarea', { id: 'ur_detail', rows: 3, placeholder: '详细情况' });
    App.modal('⚠ 紧急上报（直达决策层）', App.h('div', {}, [
      App.h('div', { class: 'field' }, [App.h('label', {}, ['紧急情况']), title]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['详情']), detail])
    ]), async () => {
      const r = await App.api.post('/field/' + eventId + '/urgent', { title: title.value.trim(), detail: detail.value.trim() });
      if (r) App.toast('已直达决策层并强提醒');
    }, '立即上报');
  },

  issueInstruction(eventId) {
    const target = App.h('input', { id: 'ins_target', placeholder: '指令对象(姓名)' });
    const task = App.h('textarea', { id: 'ins_task', rows: 2, placeholder: '任务内容' });
    const deadline = App.h('input', { id: 'ins_dl', placeholder: '时限,如 2026-07-23 18:00' });
    App.modal('下达指令（对象+任务+时限+强制反馈）', App.h('div', {}, [
      App.h('div', { class: 'field' }, [App.h('label', {}, ['对象']), target]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['任务']), task]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['时限']), deadline])
    ]), async () => {
      if (!target.value.trim() || !task.value.trim()) { App.toast('请填写对象与任务', 'err'); return false; }
      const r = await App.api.post('/field/' + eventId + '/instructions', {
        targetName: target.value.trim(), task: task.value.trim(), deadline: deadline.value.trim()
      });
      if (r) { App.toast('指令已下达,等待确认'); this.render(document.getElementById('content'), { eventId }); }
    }, '下达');
  },

  async ackInstruction(id, done) {
    const r = await App.api.post('/field/instructions/' + id + '/ack', { done, feedback: done ? '已完成' : '' });
    if (r) { App.toast(done ? '已完成反馈' : '已确认'); this.render(document.getElementById('content'), {}); }
  },

  requestResource(eventId) {
    const kind = App.h('select', { id: 'rq_kind' }, [
      App.h('option', { value: 'material' }, ['物资增援']),
      App.h('option', { value: 'personnel' }, ['人员增援'])
    ]);
    const detail = App.h('textarea', { id: 'rq_detail', rows: 2, placeholder: '所需资源明细' });
    App.modal('资源动态申请', App.h('div', {}, [
      App.h('div', { class: 'field' }, [App.h('label', {}, ['类型']), kind]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['明细']), detail])
    ]), async () => {
      const r = await App.api.post('/field/' + eventId + '/requests', { kind: kind.value, detail: detail.value.trim() });
      if (r) App.toast('申请已提交');
    }, '提交申请');
  },

  async finishField(eventId) {
    const r = await App.api.req('POST', '/dispatch/events/' + eventId + '/advance');
    if (r === null) return; // 错误已 toast
    App.toast('现场处置完成,事件进入终止评估');
    App.go('dashboard');
  }
};
