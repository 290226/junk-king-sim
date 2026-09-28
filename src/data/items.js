/**
 * 废品模板库 —— 重量区间、材料配比（合计 1）、可掉落零件池、图标键。
 * 材料重量 = 物品重量 × CONFIG.MATERIAL_WEIGHT_RATIO × 配比。
 */
import { getLang } from '../i18n/index.js';

export const ITEM_KINDS = [
  {
    key: 'crt', name: '旧式显像管电视', en: 'CRT Television', icon: 'tv', weight: [18, 40],
    mix: { plastic: .30, iron: .25, copper: .15, pcb: .25, aluminum: .05 },
    parts: ['cable', 'knob', 'transformer', 'coil', 'panel']
  },
  {
    key: 'fan', name: '落地电风扇', en: 'Pedestal Fan', icon: 'fan', weight: [5, 14],
    mix: { iron: .40, plastic: .35, copper: .15, aluminum: .10 },
    parts: ['cable', 'knob', 'gear', 'motor', 'screw']
  },
  {
    key: 'washer', name: '双桶洗衣机', en: 'Twin-Tub Washer', icon: 'washer', weight: [25, 40],
    mix: { iron: .45, plastic: .30, copper: .10, aluminum: .10, pcb: .05 },
    parts: ['cable', 'gear', 'motor', 'pump', 'transformer']
  },
  {
    key: 'microwave', name: '微波炉', en: 'Microwave Oven', icon: 'microwave', weight: [8, 18],
    mix: { iron: .35, plastic: .30, copper: .15, pcb: .15, aluminum: .05 },
    parts: ['cable', 'knob', 'transformer', 'panel', 'screw']
  },
  {
    key: 'radio', name: '老式收音机', en: 'Vintage Radio', icon: 'radio', weight: [2, 6],
    mix: { plastic: .45, iron: .20, copper: .15, pcb: .15, aluminum: .05 },
    parts: ['knob', 'cable', 'coil', 'speaker', 'screw']
  },
  {
    key: 'bike', name: '二八大杠自行车', en: 'Old-School Bicycle', icon: 'bike', weight: [18, 30],
    mix: { iron: .70, aluminum: .15, plastic: .10, copper: .05 },
    parts: ['screw', 'gear', 'clip', 'coil']
  },
  {
    key: 'pc', name: '台式电脑主机', en: 'Desktop Tower', icon: 'pc', weight: [8, 20],
    mix: { iron: .30, plastic: .25, pcb: .25, copper: .12, aluminum: .08 },
    parts: ['fan', 'cable', 'mcu', 'screw', 'transformer']
  },
  {
    key: 'ac', name: '窗机空调', en: 'Window AC Unit', icon: 'ac', weight: [20, 40],
    mix: { iron: .35, copper: .25, aluminum: .20, plastic: .15, pcb: .05 },
    parts: ['compressor', 'fan', 'cable', 'coil', 'transformer']
  },
  {
    key: 'cooker', name: '电饭煲', en: 'Rice Cooker', icon: 'cooker', weight: [3, 8],
    mix: { plastic: .40, iron: .25, aluminum: .20, copper: .10, pcb: .05 },
    parts: ['cable', 'knob', 'screw', 'clip']
  },
  {
    key: 'printer', name: '喷墨打印机', en: 'Inkjet Printer', icon: 'printer', weight: [6, 15],
    mix: { plastic: .50, iron: .20, pcb: .20, copper: .05, aluminum: .05 },
    parts: ['gear', 'cable', 'mcu', 'screw', 'clip']
  },
  {
    key: 'stereo', name: '组合音响', en: 'Component Stereo', icon: 'stereo', weight: [10, 25],
    mix: { plastic: .35, iron: .20, pcb: .20, copper: .15, aluminum: .10 },
    parts: ['speaker', 'knob', 'cable', 'coil', 'transformer']
  },
  {
    key: 'laptop', name: '旧笔记本电脑', en: 'Old Laptop', icon: 'laptop', weight: [2, 8],
    mix: { plastic: .30, aluminum: .25, pcb: .25, copper: .10, iron: .10 },
    parts: ['panel', 'mcu', 'fan', 'cable', 'screw']
  },

  /* ---- 新增品类（丰富废品种类） ---- */
  {
    key: 'phone', name: '旧智能手机', en: 'Old Smartphone', icon: 'phone', weight: [0.3, 2],
    mix: { plastic: .40, pcb: .35, aluminum: .15, copper: .10 },
    parts: ['panel', 'mcu', 'cable', 'screw', 'clip']
  },
  {
    key: 'router', name: '废旧路由器', en: 'Old Router', icon: 'router', weight: [0.3, 1.5],
    mix: { plastic: .45, pcb: .35, copper: .10, iron: .10 },
    parts: ['mcu', 'cable', 'screw', 'fan', 'clip']
  },
  {
    key: 'camera', name: '老数码相机', en: 'Digital Camera', icon: 'camera', weight: [0.5, 2.5],
    mix: { plastic: .35, pcb: .30, aluminum: .20, copper: .15 },
    parts: ['panel', 'mcu', 'cable', 'screw', 'clip']
  },
  {
    key: 'kettle', name: '电热水壶', en: 'Electric Kettle', icon: 'kettle', weight: [2, 6],
    mix: { plastic: .30, iron: .30, aluminum: .25, copper: .15 },
    parts: ['cable', 'knob', 'screw', 'clip', 'gear']
  },
  {
    key: 'iron', name: '电熨斗', en: 'Clothes Iron', icon: 'iron', weight: [2, 5],
    mix: { iron: .50, plastic: .25, copper: .15, aluminum: .10 },
    parts: ['cable', 'knob', 'screw', 'clip']
  },
  {
    key: 'vacuum', name: '吸尘器', en: 'Vacuum Cleaner', icon: 'vacuum', weight: [4, 12],
    mix: { plastic: .40, iron: .30, copper: .15, pcb: .05, aluminum: .10 },
    parts: ['motor', 'fan', 'cable', 'screw', 'gear']
  },

  /* ---- 新增品类（形容词 × 废品名） ---- */
  {
    key: 'sewing', name: '老式缝纫机', en: 'Vintage Sewing Machine', icon: 'sewing', weight: [10, 25],
    mix: { iron: .45, plastic: .30, copper: .10, aluminum: .10, pcb: .05 },
    parts: ['gear', 'screw', 'clip', 'coil']
  },
  {
    key: 'fridge', name: '二手电冰箱', en: 'Old Fridge', icon: 'fridge', weight: [28, 40],
    mix: { iron: .40, plastic: .25, aluminum: .15, copper: .10, pcb: .10 },
    parts: ['compressor', 'motor', 'fan', 'cable', 'clip']
  },
  {
    key: 'vcr', name: '旧式录像机', en: 'Old VCR', icon: 'vcr', weight: [4, 10],
    mix: { plastic: .45, pcb: .25, iron: .15, copper: .10, aluminum: .05 },
    parts: ['gear', 'mcu', 'cable', 'screw', 'clip']
  },
  {
    key: 'heater', name: '废弃热水器', en: 'Old Water Heater', icon: 'heater', weight: [20, 40],
    mix: { iron: .50, copper: .20, aluminum: .15, plastic: .10, pcb: .05 },
    parts: ['coil', 'cable', 'screw', 'gear', 'clip']
  },
  {
    key: 'landline', name: '老式固定电话', en: 'Landline Phone', icon: 'landline', weight: [1, 3],
    mix: { plastic: .50, pcb: .25, copper: .10, iron: .10, aluminum: .05 },
    parts: ['speaker', 'mcu', 'cable', 'screw', 'clip']
  },
  {
    key: 'typewriter', name: '旧打字机', en: 'Old Typewriter', icon: 'typewriter', weight: [8, 16],
    mix: { iron: .55, plastic: .25, copper: .05, aluminum: .10, pcb: .05 },
    parts: ['gear', 'screw', 'clip', 'coil']
  },

  /* ---- 特殊商品（拆开可能藏钱） ---- */
  {
    key: 'safe', name: '老式保险柜', en: 'Old Safe', icon: 'safe', weight: [60, 100],
    mix: { iron: .80, copper: .05, aluminum: .10, plastic: .05 },
    parts: ['gear', 'screw', 'clip'],
    special: 'cash'
  },
  {
    key: 'vending', name: '废旧售货机', en: 'Old Vending Machine', icon: 'vending', weight: [60, 120],
    mix: { iron: .55, plastic: .20, pcb: .15, aluminum: .05, copper: .05 },
    parts: ['mcu', 'gear', 'cable', 'screw', 'coil'],
    special: 'cash'
  }
];

export const KIND_MAP = Object.fromEntries(ITEM_KINDS.map(k => [k.key, k]));

/** 品类基础名（当前语言） */
export function kindName(key) {
  const k = KIND_MAP[key];
  if (!k) return key;
  return getLang() === 'en' ? (k.en || k.name) : k.name;
}

/** 名字前缀，只做风味，不影响数值 */
export const NAME_PREFIX = [
  { zh: '蒙尘的',       en: 'Dusty' },
  { zh: '锈迹斑斑的',   en: 'Rusty' },
  { zh: '缺了盖的',     en: 'Lidless' },
  { zh: '搬家清出来的', en: 'Moving-Out' },
  { zh: '库房角落的',   en: 'Backroom' },
  { zh: '落灰的',       en: 'Grey' },
  { zh: '老式的',       en: 'Old-Fashioned' },
  { zh: '被淘汰的',     en: 'Obsolete' },
  { zh: '闲置多年的',   en: 'Long-Idle' },
  { zh: '摔过一角的',   en: 'Banged-Up' }
];

/**
 * 物品显示名：跨语言即时生成。
 * item 需要带 kind（品类 key）与 pfx（前缀下标）；缺字段时回退到 item.name。
 */
export function itemName(item) {
  if (!item) return '';
  if (item.kind == null || item.pfx == null) return item.name || '';
  const p = NAME_PREFIX[item.pfx] || NAME_PREFIX[0];
  const pre = getLang() === 'en' ? p.en : p.zh;
  const base = kindName(item.kind);
  return getLang() === 'en' ? `${pre} ${base}` : `${pre}${base}`;
}

export const CONDITIONS = {
  1: { zh: '几乎报废', en: 'Near Scrap',   hintZh: '外壳碎裂，零件散落',       hintEn: 'Shell cracked, parts loose' },
  2: { zh: '破损严重', en: 'Badly Broken', hintZh: '多处变形，缺件明显',       hintEn: 'Warped, parts clearly missing' },
  3: { zh: '能用但旧', en: 'Worn',         hintZh: '有划痕，功能待验',         hintEn: 'Scratched, untested' },
  4: { zh: '保养尚可', en: 'Fair',         hintZh: '外观完整，略有磨损',       hintEn: 'Intact, light wear' },
  5: { zh: '成色不错', en: 'Good',         hintZh: '成色新，看着就能用',       hintEn: 'Clean, looks usable' }
};

export function condLabel(c) {
  const e = CONDITIONS[c];
  if (!e) return '';
  return getLang() === 'en' ? e.en : e.zh;
}

export function condHint(c) {
  const e = CONDITIONS[c];
  if (!e) return '';
  return getLang() === 'en' ? e.hintEn : e.hintZh;
}

/** 兼容旧引用 */
export const CONDITION_LABEL = { 1: '几乎报废', 2: '破损严重', 3: '能用但旧', 4: '保养尚可', 5: '成色不错' };
export const CONDITION_HINT = {
  1: '外壳碎裂，零件散落', 2: '多处变形，缺件明显', 3: '有划痕，功能待验',
  4: '外观完整，略有磨损', 5: '成色新，看着就能用'
};
