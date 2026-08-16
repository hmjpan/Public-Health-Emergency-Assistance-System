// JSON 文件存储 -- 数据硬化版（第16.4节：原子写入/启动自检/每日快照）
// 接口不变（load/save/uid/now），平滑替换；可进一步替换关系库
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backup');

function fp(name) { return path.join(DATA_DIR, name + '.json'); }

/* ============ 原子写入 ============ */
// 写临时文件 -> rename 覆盖，防止写一半损坏
function save(name, data) {
  const target = fp(name);
  const tmp = target + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, target);
}

/* ============ 读取（损坏容错） ============ */
function load(name) {
  const p = fp(name);
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    // 损坏表隔离至 backup/，以空表启动，不阻塞服务（FMEA #7）
    console.warn(`[store] 表 ${name} 损坏(${e.message})，已隔离并以空表启动`);
    try {
      if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const corrupt = path.join(BACKUP_DIR, `${name}.corrupt.${Date.now()}.json`);
      fs.renameSync(p, corrupt);
      console.warn(`[store] 损坏文件已移至 ${corrupt}`);
    } catch (e2) { console.error('[store] 隔离失败:', e2.message); }
    save(name, []);
    return [];
  }
}

/* ============ 启动自检 ============ */
// 逐表解析检查，返回报告；损坏表自动隔离（load 触发）
function startupCheck() {
  const report = { total: 0, ok: 0, quarantined: [] };
  if (!fs.existsSync(DATA_DIR)) return report;
  fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json')).forEach(f => {
    const name = f.replace('.json', '');
    report.total++;
    try {
      const before = fs.existsSync(path.join(BACKUP_DIR)) ? fs.readdirSync(BACKUP_DIR).length : 0;
      const data = load(name);
      const after = fs.existsSync(BACKUP_DIR) ? fs.readdirSync(BACKUP_DIR).length : 0;
      if (after > before) report.quarantined.push(name);
      else report.ok++;
      if (!Array.isArray(data)) throw new Error('非数组结构');
    } catch (e) {
      report.quarantined.push(name);
    }
  });
  return report;
}

/* ============ 每日快照 ============ */
// data/ 整目录快照至 backup/snapshot-YYYYMMDD/，保留最近7份
function dailySnapshot() {
  try {
    if (!fs.existsSync(DATA_DIR)) return { ok: false };
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    const tag = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
    const snapDir = path.join(BACKUP_DIR, 'snapshot-' + tag);
    if (fs.existsSync(snapDir)) return { ok: true, skipped: true }; // 当日已快照
    fs.mkdirSync(snapDir, { recursive: true });
    fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && !f.includes('.tmp')).forEach(f => {
      fs.copyFileSync(path.join(DATA_DIR, f), path.join(snapDir, f));
    });
    // 清理过期快照（保留7份）
    const snaps = fs.readdirSync(BACKUP_DIR).filter(d2 => d2.startsWith('snapshot-')).sort();
    while (snaps.length > 7) {
      fs.rmSync(path.join(BACKUP_DIR, snaps.shift()), { recursive: true, force: true });
    }
    return { ok: true, files: fs.readdirSync(snapDir).length };
  } catch (e) {
    console.error('[store] 快照失败:', e.message);
    return { ok: false, error: e.message };
  }
}

function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function now() { return new Date().toISOString(); }

module.exports = { load, save, uid, now, DATA_DIR, startupCheck, dailySnapshot };
