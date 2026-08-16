// 系统管理 —— 用户账号 + 通讯录维护(常态唯一工作) + 月度测试
App.modules.admin = {
  async render(root) {
    App.setTitle('系统管理');
    root.innerHTML = '';
    const page = App.h('div', { class: 'page' });
    root.appendChild(page);

    const grid = App.h('div', { class: 'grid g2' });
    page.appendChild(grid);

    /* ===== 用户账号 ===== */
    const uCard = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'flex between items' }, [
        App.h('div', { class: 'section-title', style: 'margin:0' }, [App.h('span', { class: 'bar' }), '用户账号']),
        App.h('button', { onclick: () => this.addUser() }, ['+ 新增账号'])
      ])
    ]);
    const users = await App.api.get('/admin/users');
    if (users && users.length) {
      const t = App.h('table', {}, [App.h('tr', {}, [App.h('th', {}, ['账号']), App.h('th', {}, ['姓名']), App.h('th', {}, ['角色']), App.h('th', {}, ['小组'])])]);
      users.forEach(u => t.appendChild(App.h('tr', {}, [
        App.h('td', {}, [u.username]), App.h('td', {}, [u.name]),
        App.h('td', {}, [App.tag(u.roleName, 'info')]), App.h('td', {}, [u.group || '-'])
      ])));
      uCard.appendChild(App.h('div', { style: 'margin-top:10px;max-height:300px;overflow:auto' }, [t]));
    }
    grid.appendChild(uCard);

    /* ===== 通讯录（常态维护） ===== */
    const dCard = App.h('div', { class: 'card' }, [
      App.h('div', { class: 'flex between items wrap gap' }, [
        App.h('div', { class: 'section-title', style: 'margin:0' }, [App.h('span', { class: 'bar' }), '应急通讯录（常态维护）']),
        App.h('div', { class: 'flex gap' }, [
          App.h('button', { onclick: () => this.addPerson() }, ['+ 新增人员']),
          App.h('button', { class: 'primary', onclick: () => this.testNotify() }, ['📤 发送月度测试'])
        ])
      ])
    ]);
    const groups = await App.api.get('/directory/groups');
    if (groups && groups.length) {
      dCard.appendChild(App.h('div', { class: 'flex gap wrap', style: 'margin:10px 0' }, groups.map(g =>
        App.h('div', { class: 'chip' }, [`${g.group}: ${g.confirmed}/${g.total}已确认`])
      )));
    }
    const directory = await App.api.get('/directory');
    if (directory && directory.length) {
      const t = App.h('table', {}, [App.h('tr', {}, [App.h('th', {}, ['姓名']), App.h('th', {}, ['小组']), App.h('th', {}, ['电话']), App.h('th', {}, ['状态'])])]);
      directory.forEach(d => t.appendChild(App.h('tr', {}, [
        App.h('td', {}, [d.name]), App.h('td', {}, [d.group]), App.h('td', {}, [d.phone || '-']),
        App.h('td', {}, [d.confirmStatus === 'confirmed' ? App.tag('已确认', 'ok') : App.tag('未确认', 'warn')])
      ])));
      dCard.appendChild(App.h('div', { style: 'margin-top:10px;max-height:260px;overflow:auto' }, [t]));
    }
    grid.appendChild(dCard);
  },

  addUser() {
    const un = App.h('input', { id: 'au_un', placeholder: '登录账号' });
    const nm = App.h('input', { id: 'au_nm', placeholder: '姓名' });
    const role = App.h('select', { id: 'au_role' }, ['commander', 'deputy', 'group_leader', 'member', 'material_mgr', 'driver', 'info', 'admin'].map(r => App.h('option', { value: r }, [r])));
    const grp = App.h('input', { id: 'au_grp', placeholder: '所属小组' });
    App.modal('新增账号', App.h('div', {}, [
      App.h('div', { class: 'field' }, [App.h('label', {}, ['账号']), un]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['姓名']), nm]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['角色']), role]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['小组']), grp])
    ]), async () => {
      const r = await App.api.post('/admin/users', { username: un.value.trim(), name: nm.value.trim(), role: role.value, group: grp.value.trim() });
      if (r) { App.toast('已创建(默认密码123456)'); this.render(document.getElementById('content')); }
    }, '创建');
  },

  addPerson() {
    const nm = App.h('input', { id: 'ap_nm', placeholder: '姓名' });
    const grp = App.h('input', { id: 'ap_grp', placeholder: '所属小组' });
    const ph = App.h('input', { id: 'ap_ph', placeholder: '联系电话' });
    const pos = App.h('input', { id: 'ap_pos', placeholder: '岗位' });
    App.modal('新增通讯录人员', App.h('div', {}, [
      App.h('div', { class: 'field' }, [App.h('label', {}, ['姓名']), nm]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['小组']), grp]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['电话']), ph]),
      App.h('div', { class: 'field' }, [App.h('label', {}, ['岗位']), pos])
    ]), async () => {
      const r = await App.api.post('/directory', { name: nm.value.trim(), group: grp.value.trim(), phone: ph.value.trim(), position: pos.value.trim() });
      if (r) { App.toast('已添加'); this.render(document.getElementById('content')); }
    }, '添加');
  },

  async testNotify() {
    const r = await App.api.post('/directory/test-notify');
    if (r) { App.toast(`已向${r.sent}人发送测试确认通知`); this.render(document.getElementById('content')); }
  }
};
