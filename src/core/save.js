/**
 * 存档 —— localStorage 三槽位读写，失败时静默降级为内存态。
 * 每个槽一个独立键（前缀 + 槽号），另有「当前激活槽」记录。
 * 存档内容按设计文档：{ cash, workbench[], materials{}, parts{}, toolLevel, stats, market }（不含顾客）。
 */
import { CONFIG } from '../config.js';

function storage() {
  try {
    const s = window.localStorage;
    const probe = '__recycle_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function slotKey(slot) {
  const n = Number(slot) || 1;
  return `${CONFIG.SAVE_KEY_PREFIX}${n}`;
}

function normalizeSlot(slot) {
  const n = Number(slot) || 1;
  return n >= 1 && n <= CONFIG.SAVE_SLOTS ? n : 1;
}

export function saveState(state, slot) {
  const s = storage();
  if (!s) return false;
  try {
    const data = {
      v: 5,
      cash: state.cash,
      phase: state.phase,
      day: state.day,
      dayCustomers: state.dayCustomers,
      finance: state.finance,
      loan: state.loan,
      night: state.night,
      workbench: state.workbench,
      materials: state.materials,
      parts: state.parts,
      toolLevel: state.toolLevel,
      stats: state.stats,
      market: state.market,
      log: state.log,
      tutorialSeen: !!state.tutorialSeen
    };
    s.setItem(slotKey(slot), JSON.stringify(data));
    s.setItem(CONFIG.CURRENT_SLOT_KEY, String(normalizeSlot(slot)));
    return true;
  } catch {
    return false;
  }
}

export function loadState(slot) {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(slotKey(slot));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !Array.isArray(data.workbench)) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearState(slot) {
  const s = storage();
  if (!s) return false;
  try {
    s.removeItem(slotKey(slot));
    return true;
  } catch {
    return false;
  }
}

export function getCurrentSlot() {
  const s = storage();
  if (!s) return 1;
  try {
    const v = Number(s.getItem(CONFIG.CURRENT_SLOT_KEY));
    return (v >= 1 && v <= CONFIG.SAVE_SLOTS) ? v : 1;
  } catch {
    return 1;
  }
}

export function setCurrentSlot(slot) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(CONFIG.CURRENT_SLOT_KEY, String(normalizeSlot(slot)));
  } catch { /* 忽略 */ }
}

/** 三个槽的摘要（供存档选择界面渲染） */
export function listSlots() {
  const s = storage();
  const out = [];
  for (let i = 1; i <= CONFIG.SAVE_SLOTS; i++) {
    let meta = { id: i, empty: true };
    try {
      const raw = s ? s.getItem(slotKey(i)) : null;
      if (raw) {
        const d = JSON.parse(raw);
        meta = {
          id: i,
          empty: false,
          day: Number(d.day) || CONFIG.START_DAY,
          cash: Number(d.cash) || 0,
          toolLevel: Number(d.toolLevel) || 1,
          tutorialSeen: d.tutorialSeen !== false
        };
      }
    } catch { /* 坏档当空槽 */ }
    out.push(meta);
  }
  return out;
}

/** 旧版单键存档 → 迁移到槽 1（若槽 1 为空） */
export function migrateLegacy() {
  const s = storage();
  if (!s) return;
  try {
    const legacy = s.getItem(CONFIG.SAVE_KEY);
    if (legacy && !s.getItem(slotKey(1))) {
      s.setItem(slotKey(1), legacy);
    }
  } catch { /* 忽略 */ }
}
