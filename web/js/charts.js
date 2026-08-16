// 轻量纯 SVG 图表库 -- 零依赖、零构建，支持柱状/折线/饼图/环形/漏斗
// 用法: Charts.bar(container, {title, data:[{name,value}], unit})
window.Charts = window.Charts || {};

const COLORS = ['#3b82f6', '#22d3ee', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#fb7185', '#60a5fa'];
const NS = 'http://www.w3.org/2000/svg';

Charts.svg = function (w, h) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('width', w);
  s.setAttribute('height', h);
  s.setAttribute('viewBox', `0 0 ${w} ${h}`);
  return s;
};
Charts.el = function (tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
};
Charts.text = function (x, y, t, attrs) {
  const e = Charts.el('text', Object.assign({ x, y, 'font-size': 11, fill: '#9fb2cf', 'text-anchor': 'middle' }, attrs || {}));
  e.textContent = t;
  return e;
};

// 柱状图
Charts.bar = function (container, opt) {
  container.innerHTML = '';
  const data = opt.data || [];
  const W = opt.width || container.clientWidth || 320, H = opt.height || 180;
  const pad = { l: 36, r: 12, t: opt.title ? 22 : 10, b: 28 };
  const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
  const max = Math.max(1, ...data.map(d => d.value));
  const bw = data.length ? cw / data.length * 0.6 : 0;
  const gap = data.length ? cw / data.length * 0.4 : 0;
  const s = Charts.svg(W, H);
  if (opt.title) s.appendChild(Charts.text(W / 2, 14, opt.title, { 'font-size': 12, 'font-weight': 600, fill: '#9fb2cf' }));
  // 网格线
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ch - (ch / 4) * i;
    s.appendChild(Charts.el('line', { x1: pad.l, y1: y, x2: W - pad.r, y2: y, stroke: '#25375a', 'stroke-width': 1, 'stroke-dasharray': i === 0 ? '0' : '3 3' }));
    s.appendChild(Charts.text(pad.l - 6, y + 3, Math.round(max / 4 * i), { 'text-anchor': 'end', 'font-size': 10 }));
  }
  data.forEach((d, i) => {
    const bh = max ? (d.value / max) * ch : 0;
    const x = pad.l + i * (bw + gap) + gap / 2;
    const y = pad.t + ch - bh;
    s.appendChild(Charts.el('rect', { x, y, width: bw, height: bh, fill: COLORS[i % COLORS.length], rx: 3 }));
    s.appendChild(Charts.text(x + bw / 2, y - 4, d.value, { 'font-size': 10, fill: '#e8eef9' }));
    s.appendChild(Charts.text(x + bw / 2, H - 8, d.name.length > 5 ? d.name.slice(0, 4) + '…' : d.name, { 'font-size': 10, fill: '#9fb2cf' }));
  });
  container.appendChild(s);
};

// 折线图（可多系列）
Charts.line = function (container, opt) {
  container.innerHTML = '';
  const series = opt.series || [{ name: opt.title || '', data: opt.data || [] }];
  const labels = opt.labels || (series[0].data.map((_, i) => i));
  const W = opt.width || container.clientWidth || 320, H = opt.height || 180;
  const pad = { l: 36, r: 12, t: 16, b: 28 };
  const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
  const allVals = series.flatMap(s => s.data);
  const max = Math.max(1, ...allVals);
  const stepX = labels.length > 1 ? cw / (labels.length - 1) : cw;
  const s = Charts.svg(W, H);
  // 网格
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ch - (ch / 4) * i;
    s.appendChild(Charts.el('line', { x1: pad.l, y1: y, x2: W - pad.r, y2: y, stroke: '#25375a', 'stroke-dasharray': '3 3' }));
    s.appendChild(Charts.text(pad.l - 6, y + 3, Math.round(max / 4 * i), { 'text-anchor': 'end', 'font-size': 10 }));
  }
  series.forEach((ser, si) => {
    const pts = ser.data.map((v, i) => `${pad.l + i * stepX},${pad.t + ch - (v / max) * ch}`).join(' ');
    const color = COLORS[si % COLORS.length];
    s.appendChild(Charts.el('polyline', { points: pts, fill: 'none', stroke: color, 'stroke-width': 2 }));
    // 面积
    const areaPts = `${pad.l},${pad.t + ch} ${pts} ${pad.l + (ser.data.length - 1) * stepX},${pad.t + ch}`;
    s.appendChild(Charts.el('polygon', { points: areaPts, fill: color, 'fill-opacity': 0.12 }));
    ser.data.forEach((v, i) => {
      const x = pad.l + i * stepX, y = pad.t + ch - (v / max) * ch;
      s.appendChild(Charts.el('circle', { cx: x, cy: y, r: 3, fill: color }));
      if (opt.showValues) s.appendChild(Charts.text(x, y - 6, v, { 'font-size': 10, fill: '#e8eef9' }));
    });
  });
  labels.forEach((l, i) => s.appendChild(Charts.text(pad.l + i * stepX, H - 8, l, { 'font-size': 10 })));
  container.appendChild(s);
};

// 饼图
Charts.pie = function (container, opt) {
  container.innerHTML = '';
  const data = opt.data || [];
  const W = opt.width || container.clientWidth || 200, H = opt.height || 180;
  const cx = W / 2, cy = H / 2 + 4, r = Math.min(W, H) / 2 - 30;
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  const s = Charts.svg(W, H);
  if (opt.title) s.appendChild(Charts.text(W / 2, 14, opt.title, { 'font-size': 12, 'font-weight': 600 }));
  let angle = -Math.PI / 2;
  data.forEach((d, i) => {
    const a2 = angle + (d.value / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    const large = (d.value / total) > 0.5 ? 1 : 0;
    const path = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`;
    s.appendChild(Charts.el('path', { d: path, fill: COLORS[i % COLORS.length], 'fill-opacity': 0.85, stroke: '#0b1220', 'stroke-width': 1 }));
    // 标签
    const mid = (angle + a2) / 2;
    const lx = cx + (r * 0.6) * Math.cos(mid), ly = cy + (r * 0.6) * Math.sin(mid);
    if (d.value / total > 0.06) s.appendChild(Charts.text(lx, ly + 3, d.value, { 'font-size': 10, fill: '#fff', 'font-weight': 600 }));
    angle = a2;
  });
  // 图例
  let ly = H - data.length * 14 + 4;
  // 改为右侧图例
  container.appendChild(s);
  // 图例用div
  const legend = document.createElement('div');
  legend.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;font-size:11px';
  data.forEach((d, i) => {
    const it = document.createElement('div');
    it.style.cssText = 'display:flex;align-items:center;gap:4px';
    const dot = document.createElement('span');
    dot.style.cssText = `width:8px;height:8px;border-radius:2px;background:${COLORS[i % COLORS.length]}`;
    it.appendChild(dot);
    it.appendChild(document.createTextNode(`${d.name} ${d.value}`));
    legend.appendChild(it);
  });
  container.appendChild(legend);
};

// 环形图（单值占比）
Charts.ring = function (container, opt) {
  container.innerHTML = '';
  const W = opt.width || 120, H = opt.height || 120;
  const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 8;
  const pct = Math.max(0, Math.min(100, opt.value || 0));
  const s = Charts.svg(W, H);
  s.appendChild(Charts.el('circle', { cx, cy, r, fill: 'none', stroke: '#25375a', 'stroke-width': 8 }));
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  s.appendChild(Charts.el('circle', { cx, cy, r, fill: 'none', stroke: opt.color || COLORS[0], 'stroke-width': 8, 'stroke-dasharray': `${dash} ${circ}`, 'stroke-linecap': 'round', transform: `rotate(-90 ${cx} ${cy})` }));
  s.appendChild(Charts.text(cx, cy + 4, pct + '%', { 'font-size': 16, 'font-weight': 700, fill: '#e8eef9' }));
  container.appendChild(s);
  if (opt.label) {
    const l = document.createElement('div');
    l.style.cssText = 'text-align:center;color:#9fb2cf;font-size:11px;margin-top:-4px';
    l.textContent = opt.label;
    container.appendChild(l);
  }
};

// 水平条形（多类别对比，如机构占用率）
Charts.hbar = function (container, opt) {
  container.innerHTML = '';
  const data = opt.data || [];
  const W = opt.width || container.clientWidth || 320, H = opt.height || (data.length * 26 + 16);
  const pad = { l: 90, r: 40, t: opt.title ? 22 : 8, b: 8 };
  const cw = W - pad.l - pad.r;
  const max = opt.max || Math.max(100, ...data.map(d => d.value));
  const s = Charts.svg(W, H);
  if (opt.title) s.appendChild(Charts.text(W / 2, 14, opt.title, { 'font-size': 12, 'font-weight': 600 }));
  data.forEach((d, i) => {
    const y = pad.t + i * 26;
    const bw = (d.value / max) * cw;
    const color = d.value > 85 ? '#f87171' : d.value > 60 ? '#f59e0b' : '#34d399';
    s.appendChild(Charts.text(pad.l - 6, y + 12, d.name.length > 8 ? d.name.slice(0, 7) + '…' : d.name, { 'text-anchor': 'end', 'font-size': 10, fill: '#9fb2cf' }));
    s.appendChild(Charts.el('rect', { x: pad.l, y, width: cw, height: 16, fill: '#1c2d4d', rx: 4 }));
    s.appendChild(Charts.el('rect', { x: pad.l, y, width: bw, height: 16, fill: color, rx: 4 }));
    s.appendChild(Charts.text(pad.l + bw + 4, y + 12, d.value + (opt.unit || '%'), { 'text-anchor': 'start', 'font-size': 10, fill: '#e8eef9' }));
  });
  container.appendChild(s);
};

// 仪表盘（半圆，单值占比，带刻度）
Charts.gauge = function (container, opt) {
  container.innerHTML = '';
  const W = opt.width || 140, H = opt.height || 110;
  const cx = W / 2, cy = H - 12, r = Math.min(W / 2 - 8, H - 20);
  const pct = Math.max(0, Math.min(100, opt.value || 0));
  const s = Charts.svg(W, H);
  // 背景半圆
  const bgPath = `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`;
  s.appendChild(Charts.el('path', { d: bgPath, fill: 'none', stroke: '#1c2d4d', 'stroke-width': 10, 'stroke-linecap': 'round' }));
  // 刻度
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI + (i / 10) * Math.PI;
    const x1 = cx + (r - 6) * Math.cos(a), y1 = cy + (r - 6) * Math.sin(a);
    const x2 = cx + r * Math.cos(a), y2 = cy + r * Math.sin(a);
    s.appendChild(Charts.el('line', { x1, y1, x2, y2, stroke: '#25375a', 'stroke-width': 1 }));
  }
  // 数值弧
  const endA = Math.PI + (pct / 100) * Math.PI;
  const ex = cx + r * Math.cos(endA), ey = cy + r * Math.sin(endA);
  const large = pct > 50 ? 1 : 0;
  const valPath = `M${cx - r},${cy} A${r},${r} 0 ${large} 1 ${ex},${ey}`;
  const color = pct > 85 ? '#f87171' : pct > 60 ? '#f59e0b' : opt.color || '#34d399';
  s.appendChild(Charts.el('path', { d: valPath, fill: 'none', stroke: color, 'stroke-width': 10, 'stroke-linecap': 'round' }));
  // 指针
  s.appendChild(Charts.el('line', { x1: cx, y1: cy, x2: ex, y2: ey, stroke: '#e8eef9', 'stroke-width': 2 }));
  s.appendChild(Charts.el('circle', { cx, cy, r: 3, fill: '#e8eef9' }));
  s.appendChild(Charts.text(cx, cy - r / 2, pct + (opt.unit || '%'), { 'font-size': 18, 'font-weight': 700, fill: '#e8eef9' }));
  container.appendChild(s);
  if (opt.label) {
    const l = document.createElement('div');
    l.style.cssText = 'text-align:center;color:#9fb2cf;font-size:11px;margin-top:-6px';
    l.textContent = opt.label;
    container.appendChild(l);
  }
};

// 漏斗图（阶段转化）
Charts.funnel = function (container, opt) {
  container.innerHTML = '';
  const data = opt.data || [];
  const W = opt.width || container.clientWidth || 200, H = opt.height || (data.length * 40 + 10);
  const cx = W / 2;
  const max = Math.max(1, ...data.map(d => d.value));
  const s = Charts.svg(W, H);
  data.forEach((d, i) => {
    const w = (d.value / max) * (W - 40);
    const y = i * 40 + 5;
    const color = COLORS[i % COLORS.length];
    s.appendChild(Charts.el('rect', { x: cx - w / 2, y, width: w, height: 30, fill: color, 'fill-opacity': 0.85 - i * 0.08, rx: 4 }));
    s.appendChild(Charts.text(cx, y + 19, `${d.name} ${d.value}`, { 'font-size': 12, fill: '#fff', 'font-weight': 600 }));
    if (i < data.length - 1) {
      const nextW = (data[i + 1].value / max) * (W - 40);
      const conv = data[i].value ? Math.round(data[i + 1].value / data[i].value * 100) : 0;
      s.appendChild(Charts.text(W - 6, y + 19, conv + '%', { 'text-anchor': 'end', 'font-size': 10, fill: '#9fb2cf' }));
    }
  });
  container.appendChild(s);
};

// 迷你折线（sparkline，用于KPI卡内嵌趋势）
Charts.sparkline = function (container, data, color) {
  container.innerHTML = '';
  const W = container.clientWidth || 80, H = 24;
  if (!data || !data.length) return;
  const max = Math.max(1, ...data), min = Math.min(0, ...data);
  const s = Charts.svg(W, H);
  const stepX = data.length > 1 ? W / (data.length - 1) : W;
  const pts = data.map((v, i) => `${i * stepX},${H - ((v - min) / (max - min || 1)) * (H - 4) - 2}`).join(' ');
  s.appendChild(Charts.el('polyline', { points: pts, fill: 'none', stroke: color || '#22d3ee', 'stroke-width': 1.5 }));
  container.appendChild(s);
};

