// API客户端封装
window.App = window.App || { modules: {} };
App.token = localStorage.getItem('yj_token') || '';
App.user = JSON.parse(localStorage.getItem('yj_user') || 'null');

App.api = {
  async req(method, url, body) {
    const opt = { method, headers: { 'Content-Type': 'application/json', 'x-token': App.token || '' } };
    if (body) opt.body = JSON.stringify(body);
    try {
      const r = await fetch('/api' + url, opt);
      const j = await r.json();
      if (!j.ok) { App.toast(j.error || '操作失败', 'err'); return null; }
      return j.data;
    } catch (e) { App.toast('网络错误', 'err'); return null; }
  },
  get(u) { return this.req('GET', u); },
  post(u, b) { return this.req('POST', u, b || {}); },
  patch(u, b) { return this.req('PATCH', u, b || {}); },
  del(u) { return this.req('DELETE', u); }
};

App.toast = function (msg, kind) {
  let t = document.querySelector('.toast');
  if (t) t.remove();
  t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  if (kind === 'err') t.style.borderColor = 'var(--red)';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
};

App.h = function (tag, props, children) {
  const el = document.createElement(tag);
  if (props) {
    for (const k in props) {
      if (k === 'class') el.className = props[k];
      else if (k === 'html') el.innerHTML = props[k];
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), props[k]);
      else el.setAttribute(k, props[k]);
    }
  }
  (children || []).forEach(c => {
    if (c == null || c === false) return;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return el;
};

App.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&', '<': '<', '>': '>', '"': '"' }[c])); };
App.fmt = function (iso) { if (!iso) return '-'; const d = new Date(iso); if (isNaN(d)) return String(iso); const p = n => String(n).padStart(2, '0'); return `${d.getMonth() + 1}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

// 通用小部件
App.tag = function (text, kind) { return App.h('span', { class: 'tag ' + (kind || '') }, [text]); };
App.modal = function (title, bodyEl, onOk, okText) {
  const mask = App.h('div', { class: 'modal-mask' });
  const card = App.h('div', { class: 'card modal-card' }, [
    App.h('div', { class: 'section-title' }, [App.h('span', { class: 'bar' }), title]),
    bodyEl,
    App.h('div', { class: 'flex gap', style: 'margin-top:14px;justify-content:flex-end' }, [
      App.h('button', { class: 'ghost', onclick: () => mask.remove() }, ['取消']),
      App.h('button', { class: 'primary', onclick: async () => { const r = await onOk(); if (r !== false) mask.remove(); } }, [okText || '确定'])
    ])
  ]);
  mask.appendChild(card);
  mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
  document.body.appendChild(mask);
  return mask;
};
