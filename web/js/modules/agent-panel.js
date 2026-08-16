// Agent 面板 —— 7 Agent 状态 / Skill 能力 / 编排 / MCP / Trace / Metrics / AgentTeams
App.modules.agent = {
  async render(root) {
    App.setTitle('Agent 协同面板');
    root.innerHTML = '';
    const page = App.h('div', { class: 'page' });
    root.appendChild(page);

    // 加载数据
    const [agents, skills, stats, metrics, mcpTools, traces] = await Promise.all([
      App.api.get('/agent/agents'),
      App.api.get('/agent/skills'),
      App.api.get('/agent/stats'),
      App.api.get('/agent/metrics'),
      App.api.get('/agent/mcp/tools'),
      App.api.get('/agent/traces')
    ]);
    this._mcpDefs = mcpTools || [];

    // ===== 顶部统计 =====
    const m = metrics || {};
    page.appendChild(App.h('div', { class: 'card' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), 'Agent 基座运行指标']),
      App.h('div', { class: 'row', style: 'gap:12px;flex-wrap:wrap' }, [
        this.statBox('Agent', (agents || []).length + ' 个', '🤖'),
        this.statBox('Skill', (skills || []).length + ' 个', '🧩'),
        this.statBox('交互会话', (m.agents && m.agents.totalSessions) || (stats && stats.totalSessions) || 0, '💬'),
        this.statBox('Trace', (m.traces && m.traces.total) || (traces || []).length, '🔗'),
        this.statBox('Skill调用', (m.skills && m.skills.totalCalls) || 0, '⚡'),
        this.statBox('LLM调用', (m.skills && m.skills.llmCalls) || 0, '🧠'),
        this.statBox('通知确认率', (m.notifications && m.notifications.ackRate) || 'N/A', '✅')
      ])
    ]));

    // ===== 一键编排 =====
    const events = await App.api.get('/dispatch/events');
    const activeEvents = (events || []).filter(e => e.status !== 'closed');
    const orchCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
      App.h('div', { class: 'flex between items wrap gap' }, [
        App.h('div', { class: 'section-title', style: 'margin:0' }, [App.h('span', { class: 'bar' }), '⚙️ AgentTeams 一键编排（7 Agent 协同）']),
        App.h('div', { class: 'flex gap items' }, [
          (() => {
            const sel = App.h('select', { id: 'ag_ev', style: 'width:auto' });
            (activeEvents.length ? activeEvents : events || []).forEach(e => sel.appendChild(App.h('option', { value: e.id }, [e.title])));
            return sel;
          })(),
          (() => {
            const sel = App.h('select', { id: 'ag_stage', style: 'width:auto' });
            [['detected', '📡 监测研判'], ['responding', '🚨 应急响应'], ['field', '🎯 现场处置'], ['closed', '🔁 复盘终止']].forEach(([v, l]) => sel.appendChild(App.h('option', { value: v }, [l])));
            return sel;
          })(),
          App.h('button', { class: 'primary', onclick: () => this.runOrchestrate() }, ['▶ 执行编排'])
        ])
      ]),
      App.h('div', { id: 'ag_orch_result', style: 'margin-top:10px' })
    ]);
    page.appendChild(orchCard);

    // ===== Agent 列表 =====
    const agentCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '7 个职能 Agent（点击测试交互）'])
    ]);
    const agentGrid = App.h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px' });
    (agents || []).forEach(a => {
      const count = (stats && stats.byAgent && stats.byAgent[a.id]) || 0;
      agentGrid.appendChild(App.h('div', { class: 'card', style: 'background:var(--bg2);margin:0' }, [
        App.h('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:8px' }, [
          App.h('span', { style: 'font-size:26px' }, [a.icon || '🤖']),
          App.h('div', {}, [
            App.h('b', {}, [a.name]),
            App.h('div', { class: 'muted', style: 'font-size:12px' }, [a.role])
          ]),
          App.h('span', { class: 'tag info', style: 'margin-left:auto' }, ['交互 ' + count])
        ]),
        App.h('div', { class: 'muted', style: 'font-size:11px;margin-bottom:6px' }, [
          'Skills: ' + (a.skills || []).join(', ')
        ]),
        App.h('button', {
          class: 'primary', style: 'width:100%;font-size:12px;padding:4px',
          onclick: () => this.testAgent(a.id)
        }, ['🎯 测试 Agent'])
      ]));
    });
    agentCard.appendChild(agentGrid);
    page.appendChild(agentCard);

    // ===== MCP 工具 =====
    const mcpCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), `🔌 MCP 工具集 (${(mcpTools || []).length})`])
    ]);
    const mcpGrid = App.h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px' });
    (mcpTools || []).forEach(t => {
      mcpGrid.appendChild(App.h('div', { class: 'card', style: 'background:var(--bg2);margin:0;padding:10px' }, [
        App.h('div', { style: 'display:flex;align-items:center;gap:6px' }, [
          App.h('b', { style: 'font-size:13px' }, [t.name]),
          App.h('span', { class: 'tag info', style: 'margin-left:auto;font-size:10px' }, [t.source])
        ]),
        App.h('div', { class: 'muted', style: 'font-size:11px;margin:4px 0' }, [t.description || '']),
        App.h('button', {
          style: 'font-size:11px;padding:2px 10px',
          onclick: () => this.callMcp(t.name)
        }, ['▶ 调用测试'])
      ]));
    });
    mcpCard.appendChild(mcpGrid);
    page.appendChild(mcpCard);

    // ===== Skill 列表 =====
    const skillCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), 'Skill 能力清单（' + (skills || []).length + ' 个 · D0规则/D1检索/D2 LLM增强）'])
    ]);
    const skillGrid = App.h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px' });
    (skills || []).forEach(s => {
      const levelColor = { D0: '#4caf50', D1: '#2196f3', D2: '#ff9800', D3: '#9c27b0' };
      skillGrid.appendChild(App.h('div', { class: 'card', style: 'background:var(--bg2);margin:0;padding:8px' }, [
        App.h('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, [
          App.h('b', { style: 'font-size:13px' }, [s.name]),
          App.h('span', { style: 'font-size:10px;padding:1px 6px;border-radius:8px;background:' + (levelColor[s.detLevel] || '#999') + ';color:#fff' }, [s.detLevel])
        ]),
        App.h('div', { class: 'muted', style: 'font-size:11px;margin-top:4px' }, [s.description.slice(0, 60) + (s.description.length > 60 ? '...' : '')]),
        App.h('div', { class: 'muted', style: 'font-size:11px;margin-top:2px' }, [
          s.agent ? '专属: ' + s.agent : '共享 Skill', ' · v' + s.version
        ])
      ]));
    });
    skillCard.appendChild(skillGrid);
    page.appendChild(skillCard);

    // ===== Trace 全链路 =====
    const traceCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), `🔗 Trace 全链路追踪 (${(traces || []).length})`])
    ]);
    if (!traces || !traces.length) traceCard.appendChild(App.h('div', { class: 'empty' }, ['暂无 Trace，请先执行一键编排']));
    else traces.slice(0, 10).forEach(t => {
      traceCard.appendChild(App.h('div', { class: 'flex between items', style: 'padding:7px 0;border-bottom:1px dashed var(--line);cursor:pointer', onclick: () => this.viewTrace(t.traceId) }, [
        App.h('div', {}, [
          App.h('b', { style: 'font-size:12px' }, [t.operation]), App.h('span', { class: 'muted', style: 'margin-left:8px;font-size:11px' }, [t.agentId || ''])
        ]),
        App.h('div', { class: 'flex gap items' }, [
          App.tag(t.status === 'ok' ? '成功' : t.status, t.status === 'ok' ? 'ok' : 'bad'),
          App.h('span', { class: 'muted', style: 'font-size:11px' }, [App.fmt(t.startedAt) + ' · ' + t.durationMs + 'ms'])
        ])
      ]));
    });
    page.appendChild(traceCard);

    // ===== 模式切换 =====
    if (activeEvents.length > 0) {
      const modeCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
        App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '模式切换（辅助处置 / 模拟演练）'])
      ]);
      for (const e of activeEvents) {
        const modeData = await App.api.get('/agent/mode/' + e.id);
        const curMode = (modeData && modeData.mode) || 'assist';
        modeCard.appendChild(App.h('div', { style: 'display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--line)' }, [
          App.h('div', {}, [
            App.h('b', {}, [e.title || e.id]),
            App.h('div', { class: 'muted', style: 'font-size:12px' }, ['当前模式: ' + (curMode === 'drill' ? '🎬 模拟演练' : '🤝 辅助处置')])
          ]),
          App.h('div', { style: 'display:flex;gap:4px' }, [
            App.h('button', { class: curMode === 'assist' ? 'primary' : '', style: 'font-size:12px;padding:4px 8px', onclick: () => this.setMode(e.id, 'assist') }, ['🤝 辅助']),
            App.h('button', { class: curMode === 'drill' ? 'primary' : '', style: 'font-size:12px;padding:4px 8px', onclick: () => this.setMode(e.id, 'drill') }, ['🎬 演练'])
          ])
        ]));
      }
      page.appendChild(modeCard);
    }

    // ===== Agent 交互日志 =====
    const logCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
      App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '最近 Agent 交互日志']),
      App.h('div', { id: 'agent-log', class: 'muted' }, ['选择事件查看交互日志...'])
    ]);
    if ((events || []).length > 0) {
      const select = App.h('select', {
        style: 'margin-bottom:8px',
        onchange: (ev) => this.loadSessions(ev.target.value)
      }, [App.h('option', { value: '' }, ['-- 选择事件 --'])]);
      (events || []).forEach(e => {
        select.appendChild(App.h('option', { value: e.id }, [e.title || e.id]));
      });
      logCard.insertBefore(select, logCard.querySelector('#agent-log'));
    }
    page.appendChild(logCard);
  },

  statBox(label, value, ico) {
    return App.h('div', { style: 'flex:1;min-width:110px;text-align:center;padding:12px;background:var(--bg2);border-radius:8px' }, [
      App.h('div', { style: 'font-size:22px;font-weight:bold;color:var(--accent)' }, [ico + ' ' + String(value)]),
      App.h('div', { class: 'muted', style: 'font-size:12px;margin-top:4px' }, [label])
    ]);
  },

  // ===== 一键编排 =====
  async runOrchestrate() {
    const box = document.getElementById('ag_orch_result');
    const eventId = document.getElementById('ag_ev').value;
    const stage = document.getElementById('ag_stage').value;
    if (!eventId) { App.toast('无事件可选', 'err'); return; }
    box.innerHTML = '编排执行中...';
    const r = await App.api.post('/agent/orchestrate', { eventId, stage });
    if (!r) { box.innerHTML = ''; return; }
    box.innerHTML = '';
    const head = App.h('div', { class: 'flex gap wrap items' }, [
      App.h('b', {}, [`编排完成: ${r.successCount}/${r.agentCount} Agent 成功`]),
      App.tag('Trace: ' + r.traceId, 'info'),
      App.h('span', { class: 'muted', style: 'font-size:11px' }, [r.mode === 'drill' ? '🎬 演练模式(自动执行)' : '🤝 辅助模式(建议供人工确认)'])
    ]);
    box.appendChild(head);
    (r.agentResults || []).forEach(res => {
      box.appendChild(App.h('div', { style: 'padding:6px 0;border-bottom:1px dashed var(--line)' }, [
        App.h('div', { class: 'flex between items' }, [
          App.h('b', { style: 'font-size:12px' }, [res.agentName + ' · ' + res.trigger]),
          App.tag(res.ok ? '✓ 成功' : '✗ 失败', res.ok ? 'ok' : 'bad')
        ]),
        App.h('div', { class: 'muted', style: 'font-size:11px;margin-top:2px' }, [
          'Skills: ' + (res.skillResults || []).map(s => `${s.skillName}(${s.ok ? '✓' : '✗'}${s.llmUsed ? '🧠' : '⚙'})`).join(' · '),
          ' | 建议 ' + (res.suggestions || []).length + ' 条'
        ])
      ]));
    });
    this.render(document.getElementById('content'));
  },

  // ===== MCP 工具调用 =====
  async callMcp(tool) {
    const def = (this._mcpDefs || []).find(t => t.name === tool);
    const action = (def && def.inputSchema && def.inputSchema.properties && def.inputSchema.properties.action && def.inputSchema.properties.action.enum) || [];
    const r = await App.api.post('/agent/mcp/call', { tool, input: { action: action[0] || 'list' } });
    if (r) App.modal('MCP 调用结果: ' + tool, App.h('pre', { style: 'max-height:60vh;overflow:auto;font-size:11px;white-space:pre-wrap' }, [JSON.stringify(r, null, 2)]), () => true, '关闭');
  },

  // ===== Trace 详情 =====
  async viewTrace(traceId) {
    const d = await App.api.get('/agent/trace/' + traceId);
    if (!d) return;
    const body = App.h('div', {}, []);
    if (d.orchestration) {
      body.appendChild(App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), `编排链 (${d.orchestration.stage} · ${d.orchestration.mode})`]));
      (d.orchestration.agents || []).forEach(a => {
        body.appendChild(App.h('div', { class: 'flex between items', style: 'padding:4px 0;font-size:12px' }, [
          App.h('span', {}, [a.agentName || a.agentId, ' · ', a.trigger]),
          App.tag(a.ok ? '✓' : '✗', a.ok ? 'ok' : 'bad')
        ]));
      });
    }
    if (d.spans && d.spans.spans && d.spans.spans.length) {
      body.appendChild(App.h('div', { class: 'section-title', style: 'margin-top:10px' }, [App.h('span', { class: 'bar' }), `全链路 Span (${d.spans.totalSpans})`]));
      d.spans.spans.forEach(s => {
        body.appendChild(App.h('div', { style: 'padding:4px 0;border-bottom:1px dashed var(--line);font-size:11px' }, [
          App.h('div', {}, [
            (s.parentSpanId ? '  └─ ' : '● ') + s.operation + (s.skillName ? ' · ' + s.skillName : '') + (s.agentId ? ' · ' + s.agentId : ''),
            App.h('span', { class: 'muted', style: 'margin-left:6px' }, [s.status + ' · ' + s.durationMs + 'ms'])
          ])
        ]));
      });
    }
    App.modal('Trace 详情', body, () => true, '关闭');
  },

  async testAgent(agentId) {
    const result = await App.api.post('/agent/react', {
      agentId,
      eventId: '',
      trigger: 'default',
      context: { rawText: '测试', title: '测试事件' }
    });
    if (result && result.ok) {
      const d = result.data;
      alert(`✅ ${d.agentName} 执行成功\n触发: ${d.trigger}\n建议数: ${d.suggestions.length}\nSkill 执行数: ${d.skillResults.length}`);
    } else {
      alert('❌ 执行失败: ' + (result && result.error || '未知错误'));
    }
  },

  async setMode(eventId, mode) {
    const result = await App.api.post('/agent/mode/' + eventId, { mode });
    if (result && result.ok) {
      const root = document.getElementById('root');
      this.render(root);
    }
  },

  async loadSessions(eventId) {
    const logDiv = document.getElementById('agent-log');
    if (!logDiv || !eventId) return;
    logDiv.innerHTML = '加载中...';
    const sessions = await App.api.get('/agent/sessions/' + eventId);
    if (!sessions || !sessions.length) {
      logDiv.innerHTML = '<div class="empty">暂无交互记录</div>';
      return;
    }
    logDiv.innerHTML = '';
    sessions.slice(0, 20).forEach(s => {
      logDiv.appendChild(App.h('div', { style: 'padding:6px 0;border-bottom:1px dashed var(--line);font-size:12px' }, [
        App.h('div', { style: 'display:flex;justify-content:space-between' }, [
          App.h('b', {}, [(s.agentName || s.agentId) + ' · ' + (s.trigger || '')]),
          App.h('span', { class: 'muted' }, [App.fmt(s.startedAt)])
        ]),
        App.h('div', { class: 'muted' }, [
          'Skills: ' + (s.skillResults || []).map(sr => sr.skillName).join(', '),
          ' | 建议: ' + (s.suggestions || []).length + '条',
          s.traceId ? ' | Trace: ' + s.traceId.slice(-8) : ''
        ])
      ]));
    });
  }
};
