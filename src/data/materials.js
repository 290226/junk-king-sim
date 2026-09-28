/**
 * 材料表 —— 名称（中/英）、颜色点、图标形状键。
 * 单价只从 CONFIG.MAT_PRICE 取，此处不写死价格。
 */
import { CONFIG } from '../config.js';
import { getLang } from '../i18n/index.js';

export const MATERIALS = [
  { key: 'pcb',      name: '电路板', en: 'Circuit Board', color: '#3f8f5a', icon: 'pcb' },
  { key: 'copper',   name: '铜',     en: 'Copper',        color: '#c0653a', icon: 'coil' },
  { key: 'aluminum', name: '铝',     en: 'Aluminium',     color: '#9aa7b4', icon: 'plate' },
  { key: 'iron',     name: '铁',     en: 'Iron',          color: '#6b7684', icon: 'bolt' },
  { key: 'plastic',  name: '塑料',   en: 'Plastic',       color: '#6f8fa8', icon: 'flake' }
];

export const MAT_MAP = Object.fromEntries(MATERIALS.map(m => [m.key, m]));

/** 当前语言下的材料名 */
export function matName(key) {
  const m = MAT_MAP[key];
  if (!m) return key;
  return getLang() === 'en' ? (m.en || m.name) : m.name;
}

export function matColor(key) {
  return (MAT_MAP[key] && MAT_MAP[key].color) || '#888';
}

export function baseMatPrice(key) {
  return CONFIG.MAT_PRICE[key] || 0;
}
