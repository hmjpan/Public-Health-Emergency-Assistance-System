// Agent 协同面板 -- 架构总览 / AgentTeams 分层协同 / 一键编排 / Skill / MCP / Trace / Metrics
// 逻辑主线：入口上报 -> Sentinel 研判 -> Commander 定级决策 -> 三组协同执行 -> Review 复盘沉淀
App.modules.agent = {
  tab: 'flow',

  async render(root) {
    App.setTitle('Agent 协同');
    root.innerHTML = '';
    const page = App.h('div', { class: 'page' });
    root.appendChild(page);
    this.page = page;

    // ===== 数据加载 =====
    const [agents, skills, stats, metrics, mcpTools, traces, events] = await Promise.all([
      App.api.get('/agent/agents'),
      App.api.get('/agent/skills'),
      App.api.get('/agent/stats'),
      App.api.get('/agent/metrics'),
      App.api.get('/agent/mcp/tools'),
      App.api.get('/agent/traces'),
      App.api.get('/dispatch/events')
    ]);
    this._mcpDefs = mcpTools || [];
    this._agents = agents || [];
    this._skills = skills || [];
    this._metrics = metrics || {};
    this._traces = traces || [];
    this._events = events || [];

    // ===== 页头：标题 + 指标 =====
    const m = this._metrics;
    page.appendChild(App.h('div', { class: 'page-head' }, [
      App.h('div', {}, [
        App.h('div', { class: 'page-title' }, ['🤖 Agent 协同中心']),
        App.h('div', { class: 'page-sub' }, ['AgentTeams 编排 · 7 Agent 三组协同 · 12 Skill · 7 MCP 工具 · 全链路 Trace'])
      ]),
      App.h('div', { class: 'head-stats' }, [
        this.hstat((this._agents.length) + '', 'Agent'),
        this.hstat((this._skills.length) + '', 'Skill'),
        this.hstat(String((m.traces && m.traces.total) || 0), 'Trace'),
        this.hstat(String((m.skills && m.skills.totalCalls) || 0), 'Skill调用'),
        this.hstat((m.notifications && m.notifications.ackRate) || '-', '通知确认率')
      ])
    ]));

    // ===== 运行模式条（全局开关，始终可见）=====
    this.renderModeBar(page);

    // ===== Tab 导航 =====
    const tabs = [
      { k: 'flow', t: '🧭 协同流程', d: '7 Agent 分工与执行链路' },
      { k: 'orch', t: '▶ 一键编排', d: '事件级 AgentTeams 协同执行' },
      { k: 'skill', t: '🧩 Skill 体系', d: '12 Skill · D0/D1/D2 三层' },
      { k: 'mcp', t: '🔌 MCP 工具', d: '7 个工具接口调用' },
      { k: 'trace', t: '🔗 Trace 追踪', d: '全链路执行证据' }
    ];
    const tabBar = App.h('div', { class: 'tab-bar' }, tabs.map(tb =>
      App.h('div', { class: 'tab-item' + (this.tab === tb.k ? ' active' : ''), onclick: () => { this.tab = tb.k; this.render(root); } }, [
        App.h('b', {}, [tb.t]), App.h('span', { class: 'tab-d' }, [tb.d])
      ])
    ));
    page.appendChild(tabBar);

    const body = App.h('div', { id: 'ag_body' });
    page.appendChild(body);
    if (this.tab === 'flow') this.renderFlow(body);
    else if (this.tab === 'orch') this.renderOrch(body);
    else if (this.tab === 'skill') this.renderSkills(body);
    else if (this.tab === 'mcp') this.renderMcp(body);
    else this.renderTrace(body);
  },

  hstat(v, l) { return App.h('div', { class: 'hstat' }, [App.h('div', { class: 'v' }, [v]), App.h('div', { class: 'l' }, [l])]); },

  // 运行模式条：辅助处置 / 模拟演练（对在办事件逐一切换）
  renderModeBar(page) {
    const activeEvents = (this._events || []).filter(e => e.status !== 'closed');
    if (!activeEvents.length) return;
    const bar = App.h('div', { class: 'mode-bar' }, [
      App.h('span', { class: 'mb-label' }, ['⚙ 运行模式']),
      App.h('div', { class: 'mb-events' }, activeEvents.slice(0, 4).map(e => {
        const row = App.h('div', { class: 'mb-ev', 'data-ev': e.id }, ['加载中...']);
        App.api.get('/agent/mode/' + e.id).then(md => {
          const cur = (md && md.mode) || 'assist';
          row.innerHTML = '';
          row.appendChild(App.h('span', { class: 'mb-title' }, [(e.typeIcon || '') + ' ' + e.title.slice(0, 14)]));
          row.appendChild(App.h('span', { class: 'mb-cur ' + cur }, [cur === 'drill' ? '🎬 演练' : '🤝 辅助']));
          row.appendChild(App.h('button', { class: cur === 'assist' ? 'primary' : '', style: 'font-size:11px;padding:2px 8px', onclick: () => this.setMode(e.id, 'assist') }, ['辅助']));
          row.appendChild(App.h('button', { class: cur === 'drill' ? 'primary' : '', style: 'font-size:11px;padding:2px 8px', onclick: () => this.setMode(e.id, 'drill') }, ['演练']));
        });
        return row;
      }))
    ]);
    page.appendChild(bar);
  },

  // ================================================================
  // Tab 1: 协同流程 -- 分层架构 + 阶段执行链 + Agent 卡片
  // ================================================================
  renderFlow(body) {
    // ---- A. AgentTeams 分层协同图（Manager -> 3 组 -> 7 Agent）----
    const byId = {}; this._agents.forEach(a => byId[a.id] = a);
    const teamCard = App.h('div', { class: 'card arch-card' }, [
      App.h('div', { class: 'card-head' }, [
        App.h('div', {}, [
          App.h('div', { class: 'card-title' }, ['AgentTeams 分层协同 · Manager → TeamLeader → Worker']),
          App.h('div', { class: 'card-sub' }, ['编排器拆解任务并传递上下文，三个职能组并行执行，结果与证据统一沉淀'])
        ])
      ])
    ]);
    const arch = App.h('div', { class: 'arch' });

    // Manager 层
    arch.appendChild(App.h('div', { class: 'arch-row' }, [
      App.h('div', { class: 'arch-node manager' }, [
        App.h('div', { class: 'an-ico' }, ['🧠']),
        App.h('div', { class: 'an-b' }, [
          App.h('div', { class: 'an-t' }, ['卫盾编排器 Orbestrator']),
          App.h('div', { class: 'an-d' }, ['任务拆解 · 上下文传递 · 状态追踪 · Trace 汇聚'])
        ])
      ])
    ]));
    // 连接线
    arch.appendChild(App.h('div', { class: 'arch-link-3' }, ['┌──────────────┬──────────────┬──────────────┐']));

    // 三个职能组
    const groups = [
      {
        name: '指挥决策组', leader: 'commander', members: ['sentinel'], theme: 'blue',
        duty: '研判定级 · 决策发布', flow: 'Sentinel 分类研判 → Commander 定级/SLA/编成'
      },
      {
        name: '现场处置组', leader: 'field', members: ['medical'], theme: 'green',
        duty: '现场处置 · 医疗救治', flow: 'Field SOP指导/物资 → Medical 病例/密接'
      },
      {
        name: '保障协调组', leader: 'dispatch', members: ['communication', 'review'], theme: 'violet',
        duty: '资源调度 · 通讯 · 复盘', flow: 'Dispatch 调度编成 → Communication 通知/发布 → Review 复盘'
      }
    ];
    const groupsRow = App.h('div', { class: 'arch-groups' });
    groups.forEach(g => {
      const members = [g.leader, ...g.members].map(id => byId[id]).filter(Boolean);
      const gEl = App.h('div', { class: 'arch-group ' + g.theme }, [
        App.h('div', { class: 'ag-head' }, [
          App.h('b', {}, [g.name]),
          App.h('span', { class: 'ag-duty' }, [g.duty])
        ]),
        App.h('div', { class: 'ag-flow' }, [g.flow]),
        App.h('div', { class: 'ag-members' }, members.map(a => this.agentChip(a)))
      ]);
      groupsRow.appendChild(gEl);
    });
    arch.appendChild(groupsRow);

    // 底层能力
    arch.appendChild(App.h('div', { class: 'arch-link-3' }, ['└──────────────┴──────────────┴──────────────┘']));
    arch.appendChild(App.h('div', { class: 'arch-row' }, [
      App.h('div', { class: 'arch-node foundation' }, [
        App.h('span', {}, ['⚙️ 规则引擎 v2026.2（4张表 · 法规溯源）']),
        App.h('span', {}, ['🧩 12 Skill（D0规则/D1检索/D2 LLM）']),
        App.h('span', {}, ['🔌 7 MCP 工具']),
        App.h('span', {}, ['📊 Trace / Metrics 可观测'])
      ])
    ]));
    teamCard.appendChild(arch);
    body.appendChild(teamCard);

    // ---- B. 四阶段执行链路（点击切到编排页执行）----
    const stages = [
      { k: 'detected', n: '监测预警', ico: '📡', who: ['sentinel'], desc: '上报进入 → Sentinel EventClassify 五分类 + TypePackResolve 定事件包', do: '研判' },
      { k: 'responding', n: '应急响应', ico: '🚨', who: ['commander', 'dispatch', 'communication'], desc: 'GradeEvaluate 定级 → SLA 时限 → StaffAssign 编成 → NotifyDispatch 多通道通知', do: '启动' },
      { k: 'field', n: '现场处置', ico: '🎯', who: ['field', 'medical'], desc: 'SOPGuidance 十步法指导 → 物资匹配 → CaseTrack 病例/密接追踪', do: '处置' },
      { k: 'closed', n: '终止复盘', ico: '🔁', who: ['review', 'communication'], desc: 'CriteriaCheck 阶段标准核验 → ReviewReport 复盘报告 → DocDraft 整改发文', do: '复盘' }
    ];
    const stageCard = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'card-head' }, [
        App.h('div', {}, [
          App.h('div', { class: 'card-title' }, ['事件四阶段 · 每阶段的 Agent 触发与 Skill 链']),
          App.h('div', { class: 'card-sub' }, ['与左侧"事件流程阶段"一一对应：阶段推进即触发对应 Agent 组'])
        ])
      ]),
      App.h('div', { class: 'stage-chain' }, stages.map((s, i) => App.h('div', { class: 'stage-node' + (i < 3 ? ' arrow' : '') }, [
        App.h('div', { class: 'sn-head' }, [App.h('span', { class: 'sn-ico' }, [s.ico]), App.h('b', {}, [s.n])]),
        App.h('div', { class: 'sn-desc' }, [s.desc]),
        App.h('div', { class: 'sn-who' }, s.who.map(w => {
          const a = byId[w]; return a ? App.h('span', { class: 'mini-agent' }, [(a.icon || '') + ' ' + (a.name || '').replace(' Agent', '')]) : null;
        })),
        App.h('button', { class: 'ghost sn-btn', onclick: () => { this.tab = 'orch'; this.render(this.page.parentNode); } }, ['▶ ' + s.do])
      ])))
    ]);
    body.appendChild(stageCard);

    // ---- C. Agent 明细卡 ----
    const agentCard = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'card-head' }, [
        App.h('div', {}, [
          App.h('div', { class: 'card-title' }, ['7 个职能 Agent 明细']),
          App.h('div', { class: 'card-sub' }, ['点击卡片可单独触发该 Agent 测试（沉淀一次交互会话与 Trace）'])
        ])
      ])
    ]);
    const agentGrid = App.h('div', { class: 'agent-grid' });
    const themeMap = { sentinel: 'blue', commander: 'blue', dispatch: 'violet', field: 'green', medical: 'green', communication: 'violet', review: 'violet' };
    this._agents.forEach(a => {
      const count = (this._metrics.agents && this._metrics.agents.byAgent && this._metrics.agents.byAgent[a.id]) || 0;
      const groupMap = { sentinel: '指挥决策组', commander: '指挥决策组', dispatch: '保障协调组', communication: '保障协调组', review: '保障协调组', field: '现场处置组', medical: '现场处置组' };
      agentGrid.appendChild(App.h('div', { class: 'agent-card ' + (themeMap[a.id] || ''), onclick: () => this.testAgent(a.id) }, [
        App.h('div', { class: 'ac-head' }, [
          App.h('span', { class: 'ac-ico' }, [a.icon || '🤖']),
          App.h('div', { class: 'ac-b' }, [
            App.h('b', {}, [a.name]),
            App.h('span', { class: 'ac-role' }, [(groupMap[a.id] || '') + ' · ' + (a.role || '')])
          ]),
          App.h('span', { class: 'ac-count' }, [count + ' 次'])
        ]),
        App.h('div', { class: 'ac-skills' }, (a.skills || []).map(s => App.h('span', { class: 'skill-chip' }, [s]))),
        App.h('div', { class: 'ac-foot' }, ['▸ 点击测试交互'])
      ]));
    });
    agentCard.appendChild(agentGrid);
    body.appendChild(agentCard);
  },

  agentChip(a) {
    return App.h('div', { class: 'member-chip' }, [
      App.h('span', {}, [a.icon || '🤖']),
      App.h('div', {}, [
        App.h('b', {}, [(a.name || '').replace(' Agent', '')]),
        App.h('small', {}, [(a.skills || []).slice(0, 3).join(' · ')])
      ])
    ]);
  },

  // ================================================================
  // Tab 2: 一键编排 -- 选事件+阶段 -> 执行 -> 展示每个Agent的Skill链与建议
  // ================================================================
  renderOrch(body) {
    const card = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'card-head' }, [
        App.h('div', {}, [
          App.h('div', { class: 'card-title' }, ['AgentTeams 一键编排']),
          App.h('div', { class: 'card-sub' }, ['选择事件与阶段 → 编排器按阶段触发 Agent 组 → 展示 Skill 执行链与建议'])
        ]),
        App.h('div', { class: 'orch-ctl' }, [
          (() => {
            const sel = App.h('select', { id: 'ag_ev', style: 'width:auto' });
            const opts = this._events || [];
            (opts.length ? opts : [{ id: '', title: '无事件' }]).forEach(e => sel.appendChild(App.h('option', { value: e.id }, [e.title || e.id])));
            return sel;
          })(),
          (() => {
            const sel = App.h('select', { id: 'ag_stage', style: 'width:auto' });
            [['detected', '📡 监测预警'], ['responding', '🚨 应急响应'], ['field', '🎯 现场处置'], ['closed', '🔁 复盘终止']].forEach(([v, l]) => sel.appendChild(App.h('option', { value: v }, [l])));
            sel.value = 'responding';
            return sel;
          })(),
          App.h('button', { class: 'primary', onclick: () => this.runOrchestrate() }, ['▶ 执行编排'])
        ])
      ]),
      App.h('div', { id: 'ag_orch_result' })
    ]);
    body.appendChild(card);

    // 历史编排记录
    const histWrap = App.h('div', { id: 'ag_hist' });
    body.appendChild(App.h('div', { class: 'card' }, [
      App.h('div', { class: 'card-title' }, ['编排历史（按事件）']), histWrap
    ]));
    this.loadHistory(histWrap);
  },

  async loadHistory(box) {
    const evSel = document.getElementById('ag_ev');
    const evId = evSel && evSel.value;
    if (!evId) { box.appendChild(App.h('div', { class: 'empty' }, ['暂无编排记录'])); return; }
    const logs = await App.api.get('/agent/orchestrate/' + evId);
    box.innerHTML = '';
    if (!logs || !logs.length) { box.appendChild(App.h('div', { class: 'empty' }, ['暂无编排记录，执行一次编排后展示'])); return; }
    logs.slice(0, 6).forEach(l => {
      const okN = (l.agentResults || []).filter(r => r.ok).length;
      box.appendChild(App.h('div', { class: 'orch-log', onclick: () => this.viewTrace(l.traceId) }, [
        App.h('div', { class: 'flex between items' }, [
          App.h('div', { class: 'flex gap items' }, [
            App.tag(l.stage, 'info'),
            App.tag(l.mode === 'drill' ? '演练' : '辅助', l.mode === 'drill' ? 'warn' : ''),
            App.h('b', { style: 'font-size:12px' }, [okN + '/' + (l.agentResults || []).length + ' Agent 成功'])
          ]),
          App.h('span', { class: 'muted', style: 'font-size:11px' }, [App.fmt(l.startedAt) + ' · ' + l.traceId.slice(-8) + ' ▸'])
        ]),
        App.h('div', { class: 'ol-agents' }, (l.agentResults || []).map(r =>
          App.h('span', { class: 'ol-a ' + (r.ok ? 'ok' : 'bad') }, [(r.agentName || r.agentId || '').replace(' Agent', '') + '·' + r.trigger])
        ))
      ]));
    });
  },

  async runOrchestrate() {
    const box = document.getElementById('ag_orch_result');
    const eventId = document.getElementById('ag_ev').value;
    const stage = document.getElementById('ag_stage').value;
    if (!eventId) { App.toast('无事件可选', 'err'); return; }
    box.innerHTML = '';
    box.appendChild(App.h('div', { class: 'orch-running' }, ['⏳ 编排执行中，Agent 组依次触发...']));
    const r = await App.api.post('/agent/orchestrate', { eventId, stage });
    if (!r) { box.innerHTML = ''; return; }
    box.innerHTML = '';
    box.appendChild(App.h('div', { class: 'orch-summary' }, [
      App.h('b', {}, [`编排完成 · ${r.successCount}/${r.agentCount} Agent 成功`]),
      App.tag('Trace ' + r.traceId.slice(-8), 'info'),
      App.h('span', { class: 'muted' }, [r.mode === 'drill' ? '演练模式 · 自动执行' : '辅助模式 · 建议供人工确认'])
    ]));
    // 每个 Agent 一行：Agent -> Skill链 -> 建议数
    (r.agentResults || []).forEach(res => {
      box.appendChild(App.h('div', { class: 'orch-agent' }, [
        App.h('div', { class: 'oa-head' }, [
          App.h('span', { class: 'oa-name' }, ['🤖 ' + res.agentName]),
          App.tag(res.trigger, ''),
          App.tag(res.ok ? '✓ 成功' : '✗ 失败', res.ok ? 'ok' : 'bad')
        ]),
        App.h('div', { class: 'oa-chain' }, (res.skillResults || []).map((s, i) =>
          App.h('span', { class: 'oa-wrap' }, [
            i > 0 ? App.h('i', { class: 'oa-arr' }, ['→']) : null,
            App.h('span', { class: 'oa-skill ' + (s.ok ? '' : 'bad') }, [
              s.skillName, s.llmUsed ? ' 🧠' : ' ⚙', App.h('small', {}, [(s.durationMs || 0) + 'ms'])
            ])
          ])
        )),
        (res.suggestions || []).length ? App.h('div', { class: 'oa-sugg' }, [
          App.h('b', {}, ['建议 ' + res.suggestions.length + ' 条: ']),
          res.suggestions.slice(0, 3).map(s => App.h('span', { class: 'oa-sg' }, [s.message || s.title || s.type || '']))
        ]) : null
      ]));
    });
    // 刷新历史
    const hist = document.getElementById('ag_hist');
    if (hist) this.loadHistory(hist);
  },

  // ================================================================
  // Tab 3: Skill 体系
  // ================================================================
  renderSkills(body) {
    const levels = [
      { k: 'D0', n: 'D0 规则层', d: '确定性规则引擎 · 结果100%可解释', c: 'green' },
      { k: 'D1', n: 'D1 检索层', d: '知识库加权匹配 · 处置方案/物资包', c: 'blue' },
      { k: 'D2', n: 'D2 LLM层', d: 'LLM + 规则交叉校验 · 双证据输出', c: 'amber' }
    ];
    const card = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'card-head' }, [
        App.h('div', {}, [
          App.h('div', { class: 'card-title' }, ['Skill 三层能力体系（' + this._skills.length + ' 个）']),
          App.h('div', { class: 'card-sub' }, ['Guardrail 约束 · 证据链 · 法规溯源 · 可被多 Agent 复用'])
        ])
      ])
    ]);
    const lvRow = App.h('div', { class: 'lv-row' }, levels.map(l => App.h('div', { class: 'lv-box ' + l.c }, [
      App.h('b', {}, [l.n]), App.h('span', {}, [l.d]), App.h('em', {}, [this._skills.filter(s => s.detLevel === l.k).length + ' 个'])
    ])));
    card.appendChild(lvRow);

    const grid = App.h('div', { class: 'skill-grid' });
    this._skills.forEach(s => {
      grid.appendChild(App.h('div', { class: 'skill-card ' + ({ D0: 'green', D1: 'blue', D2: 'amber' }[s.detLevel] || '') }, [
        App.h('div', { class: 'sc-head' }, [
          App.h('b', {}, [s.name]),
          App.h('span', { class: 'sc-lv' }, [s.detLevel])
        ]),
        App.h('div', { class: 'sc-desc' }, [s.description]),
        App.h('div', { class: 'sc-meta' }, [
          App.h('span', {}, [s.agent ? '专属 ' + s.agent : '♻ 多Agent共享']),
          App.h('span', {}, ['v' + s.version])
        ])
      ]));
    });
    card.appendChild(grid);
    body.appendChild(card);
  },

  // ================================================================
  // Tab 4: MCP 工具
  // ================================================================
  renderMcp(body) {
    const mcpCards = (this._mcpDefs || []).map(t =>
      App.h('div', { class: 'mcp-card' }, [
        App.h('div', { class: 'mc-head' }, [
          App.h('span', { class: 'mc-ico' }, ['🔌']),
          App.h('b', {}, [t.name]),
          App.h('span', { class: 'tag info', style: 'margin-left:auto;font-size:10px' }, [t.source])
        ]),
        App.h('div', { class: 'sc-desc' }, [t.description || '']),
        App.h('button', { class: 'ghost', style: 'width:100%;font-size:12px', onclick: () => this.callMcp(t.name) }, ['▶ 调用测试'])
      ])
    );
    const card = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'card-head' }, [
        App.h('div', {}, [
          App.h('div', { class: 'card-title' }, ['MCP 工具集（' + (this._mcpDefs || []).length + ' 个）']),
          App.h('div', { class: 'card-sub' }, ['Agent 不直接访问数据，统一经 MCP 工具层调用，带输入 Schema 与审计'])
        ])
      ]),
      App.h('div', { class: 'mcp-grid' }, mcpCards)
    ]);
    body.appendChild(card);
  },

  // ================================================================
  // Tab 5: Trace 追踪
  // ================================================================
  renderTrace(body) {
    const card = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'card-head' }, [
        App.h('div', {}, [
          App.h('div', { class: 'card-title' }, ['Trace 全链路追踪（' + this._traces.length + '）']),
          App.h('div', { class: 'card-sub' }, ['每次 Agent/Skill 调用生成 Span，点击查看完整链路与证据'])
        ])
      ])
    ]);
    if (!this._traces.length) card.appendChild(App.h('div', { class: 'empty' }, ['暂无 Trace，请先执行一键编排']));
    else this._traces.slice(0, 15).forEach(t => {
      card.appendChild(App.h('div', { class: 'trace-row', onclick: () => this.viewTrace(t.traceId) }, [
        App.h('div', { class: 'flex between items' }, [
          App.h('div', { class: 'flex gap items' }, [
            App.h('b', { style: 'font-size:12px' }, [t.operation]),
            App.h('span', { class: 'muted', style: 'font-size:11px' }, [t.agentId || ''])
          ]),
          App.h('div', { class: 'flex gap items' }, [
            App.tag(t.status === 'ok' ? '成功' : t.status, t.status === 'ok' ? 'ok' : 'bad'),
            App.h('span', { class: 'muted', style: 'font-size:11px' }, [App.fmt(t.startedAt) + ' · ' + t.durationMs + 'ms · ▸'])
          ])
        ])
      ]));
    });
    body.appendChild(card);
  },

  // ===== MCP 调用 =====
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
    App.toast('Agent 执行中...');
    const result = await App.api.post('/agent/react', {
      agentId, eventId: '', trigger: 'default', context: { rawText: '测试', title: '测试事件' }
    });
    if (result && result.ok) {
      const d = result;
      App.modal('🤖 ' + d.agentName + ' 执行成功', App.h('div', {}, [
        App.h('div', { class: 'muted', style: 'margin-bottom:8px' }, ['触发: ' + d.trigger + ' · 会话已沉淀并记录 Trace']),
        App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), 'Skill 执行链 (' + d.skillResults.length + ')']),
        ...d.skillResults.map(s => App.h('div', { class: 'flex between items', style: 'padding:4px 0;font-size:12px' }, [
          App.h('span', {}, [s.skillName + (s.result && s.result.meta && s.result.meta.llmUsed ? ' 🧠' : ' ⚙')]),
          App.tag(s.result && s.result.ok ? '✓' : '✗', s.result && s.result.ok ? 'ok' : 'bad')
        ])),
        App.h('div', { class: 'section-title', style: 'margin-top:10px' }, [App.h('span', { class: 'bar' }), '输出建议 (' + d.suggestions.length + ')']),
        ...d.suggestions.map(s => App.h('div', { style: 'padding:4px 0;font-size:12px;border-bottom:1px dashed var(--line)' }, [s.title || s.type || JSON.stringify(s).slice(0, 60)]))
      ]), () => true, '关闭');
    } else {
      App.toast('执行失败: ' + ((result && result.error) || '未知错误'), 'err');
    }
  },

  async setMode(eventId, mode) {
    const result = await App.api.post('/agent/mode/' + eventId, { mode });
    if (result && result.ok) {
      App.toast('已切换为' + (mode === 'drill' ? '演练' : '辅助') + '模式');
      this.render(document.getElementById('content'));
    }
  }
};
