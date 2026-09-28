/**
 * 零件表 —— 从废品上拆下来的可用零件。
 * 价值（元）用于：外购成本 = value × CONFIG.PARTS_BUY_MARKUP，
 * 卖废品价 = value × CONFIG.PART_SELL_COEF，修理抵扣时按 value 计入成本。
 */
import { getLang } from '../i18n/index.js';

export const PARTS = [
  // 常见件
  { key: 'screw',       name: '螺丝五金件', en: 'Screws & Fittings', value: 3,  tier: 'common' },
  { key: 'clip',        name: '塑料卡扣',   en: 'Plastic Clip',      value: 2,  tier: 'common' },
  { key: 'cable',       name: '电源线',     en: 'Power Cable',       value: 4,  tier: 'common' },
  { key: 'knob',        name: '开关旋钮',   en: 'Switch Knob',       value: 4,  tier: 'common' },
  { key: 'gear',        name: '齿轮组',     en: 'Gear Set',          value: 6,  tier: 'common' },
  // 中等件
  { key: 'speaker',     name: '扬声器单元', en: 'Speaker Unit',      value: 12, tier: 'mid' },
  { key: 'fan',         name: '散热风扇',   en: 'Cooling Fan',       value: 10, tier: 'mid' },
  { key: 'transformer', name: '变压器',     en: 'Transformer',       value: 15, tier: 'mid' },
  { key: 'pump',        name: '小型水泵',   en: 'Small Water Pump',  value: 18, tier: 'mid' },
  // 贵重件
  { key: 'coil',        name: '铜线圈',     en: 'Copper Coil',       value: 25, tier: 'valuable' },
  { key: 'panel',       name: '显示面板',   en: 'Display Panel',     value: 35, tier: 'valuable' },
  { key: 'motor',       name: '伺服电机',   en: 'Servo Motor',       value: 45, tier: 'valuable' },
  { key: 'compressor',  name: '压缩机',     en: 'Compressor',        value: 55, tier: 'valuable' },
  { key: 'mcu',         name: '主控板',     en: 'Main Control Board', value: 60, tier: 'valuable' }
];

export const PART_MAP = Object.fromEntries(PARTS.map(p => [p.key, p]));

export function partName(key) {
  const p = PART_MAP[key];
  if (!p) return key;
  return getLang() === 'en' ? (p.en || p.name) : p.name;
}

export function partValue(key) {
  return (PART_MAP[key] && PART_MAP[key].value) || 0;
}

export function partTier(key) {
  return (PART_MAP[key] && PART_MAP[key].tier) || 'common';
}

const TIERS = {
  common:   { zh: '常见', en: 'Common',   cls: '' },
  mid:      { zh: '中等', en: 'Mid',      cls: 'info' },
  valuable: { zh: '贵重', en: 'Valuable', cls: 'warn' }
};

/** 当前语言下的零件等级标签 */
export function tierLabel(tier) {
  const t = TIERS[tier] || TIERS.common;
  return { text: getLang() === 'en' ? t.en : t.zh, cls: t.cls };
}

/** 兼容旧引用：按当前语言给出 {text, cls} */
export function TIER_LABEL(tier) {
  return tierLabel(tier);
}

export { TIERS };
