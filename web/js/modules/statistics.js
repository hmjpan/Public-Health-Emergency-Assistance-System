// 统计报表 -- 多维度数据分析，支持时间/类型筛选与导出
App.modules.statistics = {
  async render(root) {
    App.setTitle('统计报表');
    root.innerHTML = '';
    const page = App.h('div', { class: 'page' });
    root.appendChild(page);

    // 筛选条
    page.appendChild(App.h('div', { class: 'card' }, [
      App.h('div', { class: 'flex between items wrap gap' }, [
        App.h('div', { class: 'section-title', style: 'margin:0' }, [App.h('span', { class: 'bar' }), '📊 统计分析']),
        App.h('div', { class: 'flex gap' }, [
          App.h('button', { onclick: () => this.exportCSV() }, ['⬇ 导出CSV']),
          App.h('button', { class: 'primary', onclick: () => this.refresh() }, ['🔄 刷新'])
        ])
      ])
    ]));

    // KPI 总览
    const ov = await App.api.get('/statistics/overview');
    if (ov) {
      const k = ov.kpi;
      page.appendChild(App.h('div', { class: 'kpi-row', style: 'margin-top:12px' }, [
        this.kpi('累计事件', k.totalEvents, 'info'), this.kpi('在办', k.activeEvents, 'warn'),
        this.kpi('已终止', k.closedEvents, 'ok'), this.kpi('累计病例', k.totalCases, 'info'),
        this.kpi('在治病例', k.activeCases, 'warn'), this.kpi('出动人次', k.onDuty, 'ok'),
        this.kpi('待研判', k.pendingReports, k.pendingReports ? 'danger' : 'ok'), this.kpi('受阻任务', k.blockedTasks, k.blockedTasks ? 'danger' : 'ok')
      ]));
    }

    // 第一行图表：趋势 + 类型分布
    const [types, cases] = await Promise.all([App.api.get('/statistics/event-types'), App.api.get('/statistics/cases')]);
    const g1 = App.h('div', { class: 'grid g2', style: 'margin-top:12px' });
    g1.appendChild(this.chartCard('近7天事件/病例趋势', 'st_trend', 220));
    g1.appendChild(this.chartCard('事件类型分布', 'st_types', 220));
    page.appendChild(g1);
    if (ov) Charts.line(document.getElementById('st_trend'), { labels: ov.trend.map(t => t.date), series: [{ name: '事件', data: ov.trend.map(t => t.events) }, { name: '病例', data: ov.trend.map(t => t.cases) }], showValues: true });
    if (types) Charts.pie(document.getElementById('st_types'), { data: types });

    // 第二行：病例状态 + 严重程度
    const g2 = App.h('div', { class: 'grid g2', style: 'margin-top:12px' });
    g2.appendChild(this.chartCard('病例状态分布', 'st_casestatus', 220));
    g2.appendChild(this.chartCard('病例严重程度', 'st_sev', 220));
    page.appendChild(g2);
    if (cases) {
      Charts.bar(document.getElementById('st_casestatus'), { data: cases.byStatus });
      Charts.pie(document.getElementById('st_sev'), { data: cases.bySeverity });
    }

    // 第三行：响应时效表 + 医院占用率
    const [sla, res] = await Promise.all([App.api.get('/statistics/sla'), App.api.get('/statistics/resources')]);
    const g3 = App.h('div', { class: 'grid g2', style: 'margin-top:12px' });
    const slaCard = App.h('div', { class: 'card' }, [App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '响应时效分析(小时)'])]);
    if (sla) {
      const s = sla.summary;
      slaCard.appendChild(App.h('div', { class: 'kpi-row', style: 'margin-bottom:10px' }, [
        this.kpi('平均启动', s.avgLaunchH + 'h', 'info'), this.kpi('平均到现场', s.avgToFieldH + 'h', 'warn'),
        this.kpi('平均处置', s.avgTotalH + 'h', s.avgTotalH > 48 ? 'danger' : 'ok')
      ]));
      const t = App.h('table', {}, [App.h('tr', {}, [App.h('th', {}, ['事件']), App.h('th', {}, ['级别']), App.h('th', {}, ['启动h']), App.h('th', {}, ['到场h']), App.h('th', {}, ['总时长']), App.h('th', {}, ['状态'])])]);
      (sla.events || []).slice(0, 10).forEach(e => {
        t.appendChild(App.h('tr', {}, [
          App.h('td', {}, [e.title.slice(0, 12)]), App.h('td', {}, [e.level]),
          App.h('td', {}, [e.launchH ?? '-']), App.h('td', {}, [e.toFieldH ?? '-']),
          App.h('td', {}, [e.totalH ?? '-']), App.h('td', {}, [e.isClosed ? '已终止' : '处置中'])
        ]));
      });
      slaCard.appendChild(App.h('div', { style: 'max-height:240px;overflow:auto' }, [t]));
    }
    g3.appendChild(slaCard);
    g3.appendChild(this.chartCard('医院床位/ICU占用率', 'st_hosprate', 260));
    page.appendChild(g3);
    if (res) {
      const data = res.hospRate.flatMap(h => [{ name: h.name + '床位', value: h.bedRate }, { name: h.name + 'ICU', value: h.icuRate }]);
      Charts.hbar(document.getElementById('st_hosprate'), { data: res.hospRate.map(h => ({ name: h.name, value: h.bedRate })), max: 100 });
    }

    // 第四行：报告合规率 + 资源汇总
    const [comp, res2] = await Promise.all([App.api.get('/statistics/routine-compliance'), App.api.get('/statistics/resources')]);
    const g4 = App.h('div', { class: 'grid g2', style: 'margin-top:12px' });
    const compCard = App.h('div', { class: 'card' }, [App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '常态化报告合规率(近7天)'])]);
    if (comp && comp.length) {
      comp.forEach(c => {
        compCard.appendChild(App.h('div', { style: 'padding:8px 0;border-bottom:1px dashed var(--line)' }, [
          App.h('div', { class: 'flex between items' }, [App.h('b', {}, [c.title]), App.tag(c.rate + '%', c.rate >= 80 ? 'ok' : c.rate >= 50 ? 'warn' : 'bad')]),
          App.h('div', { class: 'progress', style: 'margin-top:6px' }, [App.h('div', { class: 'fill', style: 'width:' + c.rate + '%' })])
        ]));
      });
    } else compCard.appendChild(App.h('div', { class: 'empty' }, ['暂无在办事件']));
    g4.appendChild(compCard);

    const resCard = App.h('div', { class: 'card' }, [App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), '医疗资源汇总'])]);
    if (res2) {
      resCard.appendChild(App.h('div', { class: 'kpi-row', style: 'margin-bottom:10px' }, [
        this.kpi('床位可用', `${res2.summary.bedTotal - res2.summary.bedOccupied}/${res2.summary.bedTotal}`, 'ok'),
        this.kpi('ICU可用', `${res2.summary.icuTotal - res2.summary.icuOccupied}/${res2.summary.icuTotal}`, 'warn'),
        this.kpi('在岗医护', res2.summary.staffOnDuty, 'info'),
        this.kpi('可支援', res2.summary.staffAvailable, 'ok')
      ]));
      // 设备 + 药品表
      const t = App.h('table', {}, [App.h('tr', {}, [App.h('th', {}, ['设备']), App.h('th', {}, ['总数']), App.h('th', {}, ['在用']), App.h('th', {}, ['可用'])])]);
      (res2.devices || []).forEach(d => t.appendChild(App.h('tr', {}, [App.h('td', {}, [d.name]), App.h('td', {}, [d.total]), App.h('td', {}, [d.inUse]), App.h('td', {}, [String(d.available)])])));
      resCard.appendChild(App.h('div', { style: 'max-height:120px;overflow:auto' }, [t]));
    }
    g4.appendChild(resCard);
    page.appendChild(g4);
  },

  chartCard(title, id, h) {
    return App.h('div', { class: 'card chart-card' }, [App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), title]), App.h('div', { id, style: 'height:' + h + 'px' })]);
  },

  kpi(l, v, cls) { return App.h('div', { class: 'skpi ' + (cls || '') }, [App.h('div', { class: 'n' }, [String(v)]), App.h('div', { class: 'l' }, [l])]); },

  async refresh() { this.render(document.getElementById('content')); },

  async exportCSV() {
    const [ov, sla] = await Promise.all([App.api.get('/statistics/overview'), App.api.get('/statistics/sla')]);
    let csv = '\ufeff指标,数值\n';
    if (ov) Object.entries(ov.kpi).forEach(([k, v]) => csv += `${k},${v}\n`);
    csv += '\n事件时效\n事件,级别,启动h,到场h,总时长,状态\n';
    if (sla) sla.events.forEach(e => csv += `${e.title},${e.level},${e.launchH ?? ''},${e.toFieldH ?? ''},${e.totalH ?? ''},${e.isClosed ? '已终止' : '处置中'}\n`);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '统计报表_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    App.toast('已导出CSV');
  }
};
