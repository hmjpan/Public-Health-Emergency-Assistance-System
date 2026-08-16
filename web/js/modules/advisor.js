// AI 参谋面板 -- 规则结论直显（模式A零依赖可用）+ 依据跳转 + 编成建议单
// 确定性分层落地（第15.2节）：AI 在线时后续在此追加"AI材料包"区块；规则结论区永远可用
App.modules.advisor = {
  // 研判材料包：要素表 -> 规则定级 -> 预案措施 -> （采纳后）编成建议
  async renderGradePanel(container, opts) {
    const box = App.h('div', { class: 'card', id: 'adv_panel' }, [
      App.h('div', { class: 'flex between items' }, [
        App.h('div', { class: 'section-title', style: 'margin:0' }, [App.h('span', { class: 'bar' }), '🧭 研判材料包（规则引擎 · 结论固定）']),
        App.h('span', { class: 'chip', title: '模式A：规则引擎结论，零AI依赖，同输入必同输出' }, ['⚙ 规则引擎'])
      ])
    ]);
    container.appendChild(box);

    // 要素表单（人工确认要素，人工这一关拦住错误输入）
    const f = opts.factors || {};
    const form = App.h('div', { class: 'grid g3', style: 'margin:10px 0' }, [
      this.field('事件类型', this.select('adv_typeKey', [['INF', '传染病'], ['FOOD', '食源性'], ['ENV', '环境污染'], ['POISON', '职业中毒'], ['UNK', '不明原因']], f.typeKey || 'FOOD')),
      this.field('病例/中毒人数', App.h('input', { id: 'adv_cases', type: 'number', min: 0, value: f.cases != null ? f.cases : '' })),
      this.field('死亡人数', App.h('input', { id: 'adv_deaths', type: 'number', min: 0, value: f.deaths || 0 })),
      this.field('波及范围', this.select('adv_scope', [['1', '县区内'], ['2', '市内跨区'], ['3', '省内跨市'], ['4', '跨省']], String(f.scope || 1))),
      this.field('扩散趋势', this.select('adv_spread', [['false', '无'], ['true', '有']], String(f.spread || false))),
      this.field('备注标签', App.h('input', { id: 'adv_typeTag', value: f.typeTag || '', placeholder: '如:甲类管理' }))
    ]);
    box.appendChild(form);

    const btnRow = App.h('div', { class: 'flex gap', style: 'margin:8px 0' }, [
      App.h('button', { class: 'primary', onclick: () => this.doGrade(opts) }, ['⚖ 生成定级建议']),
      App.h('button', { onclick: () => this.showQuickRef() }, ['📋 分级标准速查'])
    ]);
    box.appendChild(btnRow);

    const resultBox = App.h('div', { id: 'adv_result' });
    box.appendChild(resultBox);
    return box;
  },

  field(label, el) {
    return App.h('div', { class: 'field', style: 'margin:0' }, [App.h('label', { style: 'font-size:12px' }, [label]), el]);
  },

  select(id, options, val) {
    const s = App.h('select', { id });
    options.forEach(([v, l]) => s.appendChild(App.h('option', { value: v, selected: String(v) === String(val) ? '' : null }, [l])));
    return s;
  },

  async doGrade(opts) {
    const body = {
      typeKey: document.getElementById('adv_typeKey').value,
      cases: +document.getElementById('adv_cases').value || 0,
      deaths: +document.getElementById('adv_deaths').value || 0,
      scope: +document.getElementById('adv_scope').value,
      spread: document.getElementById('adv_spread').value === 'true',
      typeTag: document.getElementById('adv_typeTag').value.trim()
    };
    const r = await App.api.post('/rules/grade-evaluate', body);
    const box = document.getElementById('adv_result');
    if (!box) return;
    box.innerHTML = '';
    if (!r) return; // 错误已toast

    if (r.noMatch) {
      box.appendChild(App.h('div', { class: 'tag warn', style: 'display:block;padding:10px' }, [r.message]));
      return;
    }

    // 结论区（D0 原样呈现）
    const levelKind = { 'I级': 'bad', 'II级': 'lv2', 'III级': 'warn', 'IV级': 'info' }[r.suggestedLevel] || '';
    const concl = App.h('div', { class: 'card', style: 'margin-top:8px;border-color:var(--cyan)' }, [
      App.h('div', { class: 'flex between items' }, [
        App.h('div', {}, [App.h('span', { style: 'font-size:13px;color:var(--txt2)' }, ['规则建议级别 ']), App.h('b', { style: 'font-size:26px;color:var(--cyan)' }, [r.suggestedLevel])]),
        App.h('div', { class: 'flex gap' }, [
          App.tag('就高不就低', 'info'),
          App.tag('规则v' + r.ruleVersion, '')
        ])
      ]),
      App.h('div', { class: 'hint' }, [r.notice])
    ]);
    box.appendChild(concl);

    // 依据区（可溯源：命中规则逐条）
    const basis = App.h('div', { class: 'card', style: 'margin-top:8px' }, [
      App.h('div', { class: 'section-title', style: 'font-size:13px' }, [App.h('span', { class: 'bar' }), '判定依据（命中规则）'])
    ]);
    r.matchedRules.forEach(m => {
      basis.appendChild(App.h('div', { style: 'padding:6px 0;border-bottom:1px dashed var(--line);font-size:12px' }, [
        App.tag(m.id, 'info'), ' ', App.h('b', {}, [m.level]), App.h('div', { class: 'muted', style: 'margin-top:3px' }, [m.basis])
      ]));
    });
    box.appendChild(basis);

    // 不确定性（提级条件）
    if (r.gapToHigher && r.gapToHigher.length) {
      const gap = App.h('div', { class: 'card', style: 'margin-top:8px;border-color:var(--amber)' }, [
        App.h('div', { class: 'section-title', style: 'font-size:13px;color:var(--amber)' }, [App.h('span', { class: 'bar', style: 'background:var(--amber)' }), '提级条件（若满足将升级）'])
      ]);
      r.gapToHigher.forEach(g => {
        gap.appendChild(App.h('div', { class: 'muted', style: 'padding:4px 0;font-size:12px' }, [App.tag(g.level, 'warn'), ' ' + g.basis]));
      });
      box.appendChild(gap);
    }

    // 预案/措施/SOP（D2）
    const pm = await App.api.get('/rules/plan-match?typeKey=' + body.typeKey + '&level=' + r.suggestedLevel);
    if (pm && pm.results && pm.results.length) {
      const pmBox = App.h('div', { class: 'card', style: 'margin-top:8px' }, [
        App.h('div', { class: 'section-title', style: 'font-size:13px' }, [App.h('span', { class: 'bar' }), '匹配预案/措施/SOP（D2 检索）'])
      ]);
      pm.results.forEach(k => {
        const kindMap = { plan: ['预案', 'bad'], sop: ['SOP', 'info'], measure: ['措施', 'warn'], case: ['案例', 'ok'] };
        const km = kindMap[k.kind] || [k.kind, ''];
        pmBox.appendChild(App.h('div', { style: 'padding:6px 0;border-bottom:1px dashed var(--line);cursor:pointer;font-size:12px', onclick: () => this.showKnowledge(k.id) }, [
          App.tag(km[0], km[1]), ' ', App.h('b', {}, [k.title]),
          App.h('div', { class: 'muted', style: 'margin-top:2px' }, [(k.summary || '').slice(0, 50) + ' · 匹配度' + k.score])
        ]));
      });
      box.appendChild(pmBox);
    }

    // 采纳操作（人类主权：采纳仅预填，不代为执行）
    if (opts && opts.onAdopt) {
      box.appendChild(App.h('div', { class: 'flex gap', style: 'margin-top:10px' }, [
        App.h('button', { class: 'primary', onclick: () => opts.onAdopt({ level: r.suggestedLevel, factors: body, ruleResultId: r.ruleResultId }) }, ['✓ 采纳建议级别，去启动']),
        App.h('button', { class: 'ghost', onclick: () => App.toast('已记录：未采纳（最终定级权在指挥员）') }, ['不采纳'])
      ]));
    }
  },

  async showKnowledge(id) {
    const list = await App.api.get('/review/knowledge/list');
    const k = (list || []).find(x => x.id === id);
    if (!k) { App.toast('未找到该知识条目'); return; }
    App.modal(k.title, App.h('div', {}, [
      App.h('div', { class: 'flex gap wrap', style: 'margin-bottom:8px' }, [
        App.tag({ plan: '预案', sop: 'SOP', measure: '措施', case: '案例' }[k.type] || k.type, 'info'),
        k.typeKey ? App.tag('适用: ' + k.typeKey, 'warn') : null
      ].filter(Boolean)),
      App.h('div', { style: 'white-space:pre-wrap;font-size:13px;line-height:1.8;color:var(--txt2)' }, [k.content || k.title])
    ]), () => true, '关闭');
  },

  async showQuickRef() {
    const r = await App.api.get('/rules/grading-quickref');
    if (!r) return;
    const body = App.h('div', { style: 'max-height:60vh;overflow:auto' });
    const byType = {};
    r.rules.forEach(x => { (byType[x.typeKey] = byType[x.typeKey] || []).push(x); });
    Object.keys(byType).forEach(t => {
      body.appendChild(App.h('div', { class: 'muted2', style: 'margin:8px 0 4px;font-weight:600' }, ['【' + ({ INF: '传染病', FOOD: '食源性', ENV: '环境污染', POISON: '职业中毒', UNK: '不明原因' }[t] || t) + '】']));
      byType[t].forEach(x => {
        body.appendChild(App.h('div', { style: 'padding:4px 0;border-bottom:1px dashed var(--line);font-size:12px' }, [
          App.tag(x.level, x.level === 'I级' ? 'bad' : x.level === 'II级' ? 'lv2' : 'info'),
          ' ', App.h('code', { style: 'color:var(--cyan)' }, [x.expr]),
          App.h('div', { class: 'muted' }, [x.basis])
        ]));
      });
    });
    App.modal('分级标准速查（规则v' + r.ruleVersion + '）', body, () => true, '关闭');
  },

  // 编成建议单（staff-plan 一键预填）
  async renderStaffPanel(container, typeKey, level, onApply) {
    const box = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'flex between items' }, [
        App.h('div', { class: 'section-title', style: 'margin:0' }, [App.h('span', { class: 'bar' }), '👥 标准编成建议单（预案既定 D1）']),
        App.h('span', { class: 'chip' }, ['⚙ 规则引擎'])
      ])
    ]);
    container.appendChild(box);
    const r = await App.api.get('/rules/staff-assign?typeKey=' + typeKey + '&level=' + level);
    if (!r) return box;

    box.appendChild(App.h('div', { class: 'muted', style: 'margin:6px 0' }, [`${r.name} · 级别系数×${r.multiplier} · 物资包: ${r.materialPacks.join('、')}`]));
    r.groups.forEach(g => {
      box.appendChild(App.h('div', { style: 'padding:7px 0;border-bottom:1px dashed var(--line)' }, [
        App.h('div', { class: 'flex between items' }, [
          App.h('div', {}, [App.h('b', {}, [g.group]), App.h('span', { class: 'muted', style: 'margin-left:6px' }, [`≥${g.minCount}人 · ${g.skillTags.join('/')}`])]),
          g.shortage ? App.tag(`缺${g.minCount - g.availableCount}人`, 'bad') : App.tag(`可派${g.availableCount}人`, 'ok')
        ]),
        g.suggested.length ? App.h('div', { class: 'muted', style: 'margin-top:3px;font-size:12px' }, ['建议: ' + g.suggested.map(m => m.name).join('、')]) : null,
        App.h('div', { class: 'muted', style: 'font-size:11px' }, ['任务: ' + g.tasks.join('、')])
      ].filter(Boolean)));
    });
    if (onApply) {
      box.appendChild(App.h('div', { class: 'flex gap', style: 'margin-top:10px' }, [
        App.h('button', { class: 'primary', onclick: () => onApply(r) }, ['✓ 按建议单预填启动表单']),
        App.h('span', { class: 'hint', style: 'align-self:center' }, ['预填后仍由指挥员确认发布'])
      ]));
    }
    return box;
  }
};
