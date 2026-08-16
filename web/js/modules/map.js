// 态势地图 -- 事件/病例/重点人群/医院/人员 空间分布（自绘SVG城区底图，离线可用）
App.modules.map = {
  layer: 'all', // all|events|cases|contacts|hospitals|groups
  W: 1000, H: 700,
  data: null,

  async render(root) {
    App.setTitle('态势地图');
    root.innerHTML = '';
    const page = App.h('div', { class: 'page' });
    root.appendChild(page);
    this.page = page;

    // 数据缓存：首次进入拉取，之后（图层切换等）直接用缓存，避免整页重拉
    if (!this.data) {
      const d = await App.api.get('/map/overview');
      if (!d) { page.appendChild(App.h('div', { class: 'empty' }, ['地图数据加载失败'])); return; }
      this.data = d;
    }
    const d = this.data;

    // ===== 页头 KPI =====
    const s = d.summary;
    page.appendChild(App.h('div', { class: 'page-head' }, [
      App.h('div', {}, [
        App.h('div', { class: 'page-title' }, ['🗺️ 态势地图 · 空间分布']),
        App.h('div', { class: 'page-sub' }, ['事件热点 / 病例分布 / 重点人群管控 / 定点医院 / 队伍出动 一图统览'])
      ]),
      App.h('div', { class: 'head-stats' }, [
        this.mk(s.events, '在办事件', s.events ? 'danger' : ''),
        this.mk(s.cases, '报告病例', s.cases ? 'warn' : ''),
        this.mk(s.contacts, '重点人群', s.contacts ? 'warn' : ''),
        this.mk(s.highRiskDistricts, '高风险分区', s.highRiskDistricts ? 'danger' : ''),
        this.mk(s.criticalCases, '危重病例', s.criticalCases ? 'danger' : '')
      ])
    ]));

    // ===== 图层切换 =====
    const layers = [
      { k: 'all', t: '🌍 全部' }, { k: 'events', t: '🚨 事件' }, { k: 'cases', t: '🦠 病例' },
      { k: 'contacts', t: '👥 重点人群' }, { k: 'hospitals', t: '🏥 医院' }, { k: 'groups', t: '🚑 队伍' }
    ];
    page.appendChild(App.h('div', { class: 'tab-bar' }, layers.map(l =>
      App.h('div', { class: 'tab-item' + (this.layer === l.k ? ' active' : ''), onclick: () => { this.layer = l.k; this.render(root); } }, [App.h('b', {}, [l.t])])
    )));

    // ===== 主区：地图 + 侧栏 =====
    const mainRow = App.h('div', { class: 'map-layout' });

    // ---- 地图卡 ----
    const mapCard = App.h('div', { class: 'card map-card' }, [
      App.h('div', { class: 'card-head' }, [
        App.h('div', {}, [
          App.h('div', { class: 'card-title' }, ['城区态势图']),
          App.h('div', { class: 'card-sub' }, ['16个街道/乡镇分区 · 颜色=风险等级 · 点击标记查看详情'])
        ]),
        App.h('div', { class: 'map-legend' }, [
          App.h('span', {}, [App.h('i', { class: 'lg lg-high' }), '高风险']),
          App.h('span', {}, [App.h('i', { class: 'lg lg-mid' }), '中风险']),
          App.h('span', {}, [App.h('i', { class: 'lg lg-low' }), '低风险']),
          App.h('span', {}, [App.h('i', { class: 'lg lg-ev' }), '事件']),
          App.h('span', {}, [App.h('i', { class: 'lg lg-case' }), '病例']),
          App.h('span', {}, [App.h('i', { class: 'lg lg-ct' }), '密接'])
        ])
      ])
    ]);
    const mapBox = App.h('div', { class: 'map-box', id: 'geo_map' });
    mapCard.appendChild(mapBox);
    mainRow.appendChild(mapCard);

    // ---- 侧栏：分区排行 + 预警 ----
    const side = App.h('div', { class: 'map-side' });
    // 高风险分区榜
    const ranked = [...d.districts].filter(x => x.score > 0).sort((a, b) => b.score - a.score);
    const rankCard = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'card-title' }, ['分区风险排行'])
    ]);
    if (!ranked.length) rankCard.appendChild(App.h('div', { class: 'empty' }, ['全部分区平稳']));
    ranked.slice(0, 8).forEach((dz, i) => {
      rankCard.appendChild(App.h('div', { class: 'dz-row' }, [
        App.h('span', { class: 'dz-rank r' + (i < 3 ? i + 1 : '') }, [String(i + 1)]),
        App.h('div', { class: 'dz-b' }, [
          App.h('div', { class: 'flex between items' }, [
            App.h('b', { style: 'font-size:12px' }, [dz.name]),
            App.h('span', { class: 'tag ' + (dz.risk === 'high' ? 'bad' : dz.risk === 'mid' ? 'warn' : 'info') }, [
              dz.risk === 'high' ? '高' : dz.risk === 'mid' ? '中' : '低'
            ])
          ]),
          App.h('div', { class: 'muted', style: 'font-size:10px;margin:2px 0 4px' }, [
            `事件${dz.events} · 病例${dz.cases} · 密接${dz.contacts} · 人口${dz.pop}万`
          ]),
          App.h('div', { class: 'progress', style: 'height:4px' }, [
            App.h('div', { class: 'fill', style: 'width:' + Math.min(100, dz.score * 8) + '%;' + (dz.risk === 'high' ? 'background:var(--red)' : dz.risk === 'mid' ? 'background:var(--amber)' : '') })
          ])
        ])
      ]));
    });
    side.appendChild(rankCard);

    // 队伍出动侧卡
    const gCard = App.h('div', { class: 'card', style: 'margin-top:12px' }, [
      App.h('div', { class: 'card-title' }, ['队伍出动分布'])
    ]);
    (d.groups || []).forEach(g => {
      gCard.appendChild(App.h('div', { class: 'flex between items', style: 'padding:5px 0;border-bottom:1px dashed var(--line);font-size:12px' }, [
        App.h('span', {}, ['🚑 ' + g.group]),
        App.h('span', { class: 'muted' }, [`${g.arrived}到达 / ${g.total}人`])
      ]));
    });
    if (!(d.groups || []).length) gCard.appendChild(App.h('div', { class: 'empty' }, ['暂无出动']));
    side.appendChild(gCard);
    mainRow.appendChild(side);
    page.appendChild(mainRow);

    // 渲染SVG地图
    this.drawMap(mapBox, d);
  },

  mk(v, l, cls) { return App.h('div', { class: 'hstat ' + (cls || '') }, [App.h('div', { class: 'v' }, [String(v)]), App.h('div', { class: 'l' }, [l])]); },

  // ============ SVG 地图绘制 ============
  drawMap(box, d) {
    box.innerHTML = '';
    const W = this.W, H = this.H;
    const svg = Charts.svg(W, H);
    svg.setAttribute('class', 'geo-svg');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    // width/height 由CSS控制（100%自适应），移除固定尺寸避免缩放后点击命中偏移
    svg.removeAttribute('width'); svg.removeAttribute('height');
    const NS = 'http://www.w3.org/2000/svg';

    // ---- 水系装饰（河流曲线）----
    const river = document.createElementNS(NS, 'path');
    river.setAttribute('d', 'M -10 420 C 180 380, 300 480, 480 440 S 760 360, 1010 430');
    river.setAttribute('class', 'geo-river');
    svg.appendChild(river);
    const river2 = document.createElementNS(NS, 'path');
    river2.setAttribute('d', 'M 520 -10 C 560 120, 480 220, 560 340');
    river2.setAttribute('class', 'geo-river thin');
    svg.appendChild(river2);

    // ---- 分区块（Voronoi感：用圆角区块+风险底色）----
    d.districts.forEach(dz => {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'geo-dz');
      const r = dz.type === 'urban' ? 58 : dz.type === 'town' ? 46 : 38;
      const rect = document.createElementNS(NS, 'rect');
      const x = Math.max(4, dz.x - r), y = Math.max(4, dz.y - r);
      rect.setAttribute('x', x); rect.setAttribute('y', y);
      rect.setAttribute('width', r * 2); rect.setAttribute('height', r * 1.5);
      rect.setAttribute('rx', 12);
      rect.setAttribute('class', 'dz-bg risk-' + dz.risk + ' dt-' + dz.type);
      g.appendChild(rect);
      // 分区名
      const t1 = Charts.text(dz.x, dz.y - 6, dz.name, { class: 'dz-name' });
      g.appendChild(t1);
      // 态势计数
      const cnt = [];
      if (dz.events) cnt.push('事' + dz.events);
      if (dz.cases) cnt.push('病' + dz.cases);
      if (dz.contacts) cnt.push('密' + dz.contacts);
      if (cnt.length) {
        const t2 = Charts.text(dz.x, dz.y + 12, cnt.join(' '), { class: 'dz-cnt' });
        g.appendChild(t2);
      }
      // 人口
      g.appendChild(Charts.text(dz.x, dz.y + 27, dz.pop + '万人', { class: 'dz-pop' }));
      svg.appendChild(g);
    });

    const show = k => this.layer === 'all' || this.layer === k;

    // ---- 定点医院 ----
    if (show('hospitals')) d.hospitals.forEach(h => {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'geo-mark geo-hos');
      g.appendChild(this.mkShape(g, 'rect', h.x, h.y - 11, 22, 22, 5, 'mk-hos'));
      g.appendChild(Charts.text(h.x, h.y + 5, '✚', { class: 'mk-hos-cross', 'font-size': 14 }));
      const label = Charts.text(h.x, h.y - 18, h.name.replace(/\(.*\)/, ''), { class: 'mk-label' });
      g.appendChild(label);
      const rate = Charts.text(h.x, h.y + 22, '床位' + h.bedRate + '%', { class: 'mk-sub ' + (h.bedRate >= 85 ? 'hot' : '') });
      g.appendChild(rate);
      g.addEventListener('click', () => this.popHospital(h));
      svg.appendChild(g);
    });

    // ---- 事件点（脉冲圆 + 图标）----
    if (show('events')) d.events.forEach((e, i) => {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'geo-mark geo-ev');
      const cls = e.level === 'I级' || e.level === 'II级' ? 'lv-high' : 'lv-mid';
      // 脉冲圈
      const pulse = document.createElementNS(NS, 'circle');
      pulse.setAttribute('cx', e.x); pulse.setAttribute('cy', e.y); pulse.setAttribute('r', 16);
      pulse.setAttribute('class', 'ev-pulse ' + cls);
      g.appendChild(pulse);
      const core = document.createElementNS(NS, 'circle');
      core.setAttribute('cx', e.x); core.setAttribute('cy', e.y); core.setAttribute('r', 13);
      core.setAttribute('class', 'ev-core ' + cls);
      g.appendChild(core);
      g.appendChild(Charts.text(e.x, e.y + 4.5, e.icon, { 'font-size': 12 }));
      g.appendChild(Charts.text(e.x, e.y - 20, (e.isDrill ? '【演练】' : '') + e.level, { class: 'mk-label ' + (cls === 'lv-high' ? 'hot' : '') }));
      g.addEventListener('click', () => this.popEvent(e));
      svg.appendChild(g);
    });

    // ---- 病例点（按严重度着色的小圆点）----
    if (show('cases')) d.cases.forEach(c => {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'geo-mark');
      const r = c.severity === 'critical' ? 9 : c.severity === 'severe' ? 7 : 6;
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', c.x); dot.setAttribute('cy', c.y); dot.setAttribute('r', r);
      dot.setAttribute('class', 'case-dot sev-' + c.severity + (c.status === 'recovered' ? ' rec' : ''));
      g.appendChild(dot);
      if (c.severity === 'critical') {
        g.appendChild(Charts.text(c.x, c.y - 12, '⚠ ' + c.trackNo, { class: 'mk-label hot' }));
      }
      g.addEventListener('click', () => this.popCase(c));
      svg.appendChild(g);
    });

    // ---- 重点人群（管控圈：集中=实线 / 居家=虚线）----
    if (show('contacts')) d.contacts.forEach(c => {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'geo-mark');
      const ring = document.createElementNS(NS, 'circle');
      ring.setAttribute('cx', c.x); ring.setAttribute('cy', c.y); ring.setAttribute('r', 8);
      ring.setAttribute('class', 'ct-ring ' + (c.status === 'pending' ? 'pending' : c.status === 'managing' ? 'managing' : 'done') + (c.manageType === '居家隔离' ? ' home' : ''));
      g.appendChild(ring);
      g.appendChild(Charts.text(c.x, c.y + 3.5, c.contactType === '次密接' ? '次' : '密', { class: 'ct-t', 'font-size': 8 }));
      g.addEventListener('click', () => this.popContact(c));
      svg.appendChild(g);
    });

    // ---- 队伍群组（定位三角+人数）----
    if (show('groups')) d.groups.forEach(gp => {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'geo-mark');
      const tri = document.createElementNS(NS, 'polygon');
      tri.setAttribute('points', `${gp.x},${gp.y - 12} ${gp.x - 10},${gp.y + 7} ${gp.x + 10},${gp.y + 7}`);
      tri.setAttribute('class', 'grp-tri');
      g.appendChild(tri);
      g.appendChild(Charts.text(gp.x, gp.y + 1.5, '🚑', { 'font-size': 9 }));
      g.appendChild(Charts.text(gp.x, gp.y + 20, gp.group + ' ' + gp.arrived + '/' + gp.total, { class: 'mk-label' }));
      svg.appendChild(g);
    });

    box.appendChild(svg);
  },

  mkShape(parent, tag, x, y, w, h, rx, cls) {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    e.setAttribute('x', x); e.setAttribute('y', y);
    e.setAttribute('width', w); e.setAttribute('height', h);
    if (rx) e.setAttribute('rx', rx);
    e.setAttribute('class', cls);
    return e;
  },

  // ============ 弹层 ============
  popEvent(e) {
    App.modal('🚨 ' + e.title, App.h('div', {}, [
      App.h('div', { class: 'flex gap wrap', style: 'margin-bottom:8px' }, [
        App.tag(e.icon + ' ' + e.typeName, 'info'), App.tag(e.level, 'bad'), App.tag(e.isDrill ? '演练' : '实战', e.isDrill ? 'warn' : '')
      ]),
      App.h('div', { class: 'muted', style: 'font-size:12px;line-height:1.8' }, [
        '所在分区: ' + e.district, App.h('br'),
        '发生时间: ' + App.fmt(e.createdAt), App.h('br'),
        '关联地点: ' + (e.location || '未填写')
      ]),
      App.h('button', { class: 'primary', style: 'margin-top:10px', onclick: () => App.go('response', { eventId: e.id }) }, ['前往处置 ->'])
    ]), () => true, '关闭');
  },

  popCase(c) {
    const stMap = { pending_transfer: ['待转运', 'bad'], transferring: ['转运中', 'warn'], received: ['已收治', 'info'], observing: ['观察中', 'info'], admitted: ['住院治疗', 'warn'], icu: ['ICU', 'bad'], discharged: ['已出院', 'ok'], transferred_out: ['已转出', ''], dead: ['死亡', 'bad'] };
    const st = stMap[c.status] || [c.status, 'info'];
    const body = App.h('div', {}, [
      App.h('div', { class: 'flex gap wrap', style: 'margin-bottom:8px' }, [
        App.tag(c.severityName, c.severity === 'critical' ? 'bad' : c.severity === 'severe' ? 'warn' : 'info'),
        App.tag(st[0], st[1])
      ]),
      App.h('div', { class: 'muted', style: 'font-size:12px;line-height:1.8' }, [
        '姓名: ' + c.name, App.h('br'),
        '住址分区: ' + c.district, App.h('br'),
        '登记地址: ' + (c.address || '未填写')
      ])
    ]);
    const mask = App.modal('🦠 病例 ' + c.trackNo, body, () => true, '关闭');
    if (App.user.nav.includes('medical')) {
      body.appendChild(App.h('div', { class: 'flex gap', style: 'margin-top:10px' }, [
        App.h('button', { class: 'primary', onclick: () => { mask.remove(); App.go('medical', { tab: 'cases' }); } }, ['去医疗模块查看 ->'])
      ]));
    }
  },

  popContact(c) {
    App.modal('👥 ' + c.name + '（' + c.contactType + '）', App.h('div', {}, [
      App.h('div', { class: 'flex gap wrap', style: 'margin-bottom:8px' }, [
        App.tag(c.manageType, 'info'),
        App.tag(c.status === 'pending' ? '待转运' : c.status === 'managing' ? '在管' : '已解除',
          c.status === 'pending' ? 'bad' : c.status === 'managing' ? 'warn' : 'ok')
      ]),
      App.h('div', { class: 'muted', style: 'font-size:12px;line-height:1.8' }, [
        '管控分区: ' + c.district, App.h('br'),
        '隔离地点: ' + (c.quarantineSite || '待安排')
      ])
    ]), () => true, '关闭');
  },

  popHospital(h) {
    App.modal('🏥 ' + h.name, App.h('div', {}, [
      App.h('div', { class: 'flex gap wrap', style: 'margin-bottom:8px' }, [
        App.tag(h.level, 'info'), App.tag(h.designated ? '定点收治' : '后备', h.designated ? 'bad' : '')
      ]),
      App.h('div', { style: 'font-size:12px;line-height:2' }, [
        `床位占用: ${h.bedOccupied}/${h.bedTotal}（${h.bedRate}%）`,
        App.h('div', { class: 'progress', style: 'margin:2px 0 6px' }, [App.h('div', { class: 'fill', style: 'width:' + h.bedRate + '%;' + (h.bedRate >= 85 ? 'background:var(--red)' : '') })]),
        `ICU 占用: ${h.icuOccupied}/${h.icuTotal}`
      ])
    ]), () => true, '关闭');
  }
};
