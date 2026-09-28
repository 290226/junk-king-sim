/**
 * 经济系统 —— 行情波动、材料价值、售价抽样、古董鉴定。
 * 全部系数来自 CONFIG。
 */
import { CONFIG } from '../config.js';
import { baseMatPrice } from '../data/materials.js';
import { partValue } from '../data/parts.js';
import { rand, round, chance, weightedIndex, clamp } from './rng.js';

/** 新开局市价：基准价 × (1 ± INTRADAY_SWING) */
export function rollMarket(day = CONFIG.START_DAY) {
  const prices = {};
  for (const key of Object.keys(CONFIG.MAT_PRICE)) {
    const swing = rand(1 - CONFIG.INTRADAY_SWING, 1 + CONFIG.INTRADAY_SWING);
    prices[key] = round(baseMatPrice(key) * swing, CONFIG.DECIMALS.price);
  }
  return { matPrices: prices, day, mode: CONFIG.MARKET_MODE, lastUpdate: Date.now() };
}

/**
 * 过夜刷新市价（按天驱动）：
 *   昨价 × 随机漂移 → 向基准价回归一部分（防连涨连跌跑飞）→ 夹到上下限。
 */
export function rollDailyMarket(prev, day) {
  const prices = {};
  const old = (prev && prev.matPrices) || {};
  for (const key of Object.keys(CONFIG.MAT_PRICE)) {
    const base = baseMatPrice(key);
    const from = old[key] ?? base;
    const drifted = from * rand(1 - CONFIG.DAILY_PRICE_SWING, 1 + CONFIG.DAILY_PRICE_SWING);
    const reverted = drifted * (1 - CONFIG.PRICE_REVERT) + base * CONFIG.PRICE_REVERT;
    prices[key] = round(
      clamp(reverted, base * CONFIG.PRICE_FLOOR_COEF, base * CONFIG.PRICE_CAP_COEF),
      CONFIG.DECIMALS.price
    );
  }
  return { matPrices: prices, day, mode: CONFIG.MARKET_MODE, lastUpdate: Date.now() };
}

/** 每批顾客上门时的日内微调（INTRADAY_SWING 为 0 时价格一天不变） */
export function rollIntraday(prev) {
  if (!(CONFIG.INTRADAY_SWING > 0)) return prev;
  const prices = {};
  for (const key of Object.keys(CONFIG.MAT_PRICE)) {
    const base = baseMatPrice(key);
    const from = prev.matPrices[key] ?? base;
    prices[key] = round(clamp(from * rand(1 - CONFIG.INTRADAY_SWING, 1 + CONFIG.INTRADAY_SWING),
      base * CONFIG.PRICE_FLOOR_COEF, base * CONFIG.PRICE_CAP_COEF), CONFIG.DECIMALS.price);
  }
  return { matPrices: prices, day: prev.day, mode: CONFIG.MARKET_MODE, lastUpdate: Date.now() };
}

/** 某件物品的材料清单按当前市价折算的价值 */
export function materialValue(materials, matPrices) {
  let sum = 0;
  for (const m of materials) {
    sum += m.qtyLb * (matPrices[m.key] ?? baseMatPrice(m.key));
  }
  return round(sum, CONFIG.DECIMALS.money);
}

/** 材料清单按基准价的固定价值（用于隐藏基准值，不随行情波动） */
export function baseMaterialValue(materials) {
  let sum = 0;
  for (const m of materials) {
    sum += m.qtyLb * baseMatPrice(m.key);
  }
  return round(sum, CONFIG.DECIMALS.money);
}

/**
 * 抽取售价系数。品相越高越容易落进高档区间：
 * 低档权重随品相递减，高档权重随品相递增，最后归一化。
 */
export function sampleSellCoef(condition = 3) {
  const bias = CONFIG.SELL_COEF_COND_BIAS;
  const delta = condition - 3;
  const raw = CONFIG.SELL_COEF.map((tier, i) => {
    const isHigh = i >= CONFIG.SELL_COEF.length / 2;
    const k = isHigh ? 1 + delta * bias.high : 1 - delta * bias.low;
    return Math.max(0.01, tier.p * k);
  });
  const idx = weightedIndex(raw);
  const tier = CONFIG.SELL_COEF[idx];
  return rand(tier.range[0], tier.range[1]);
}

/** 修理成功后揭示的出售价；古董在此刻才揭晓身份 */
export function revealValue(item) {
  const coef = sampleSellCoef(item.condition);
  let value = item.hiddenBaseValue * coef;
  let antiqueMult = 0;
  if (item.isAntique) {
    antiqueMult = rand(CONFIG.ANTIQUE_MULT[0], CONFIG.ANTIQUE_MULT[1]);
    value *= antiqueMult;
  }
  return { value: round(value, CONFIG.DECIMALS.money), coef, antiqueMult };
}

/** 3 级工具「贵金属含量」：按铜 + 电路板的重量占比分级（高/中/低） */
export function metalRichness(item) {
  const total = item.materials.reduce((s, m) => s + m.qtyLb, 0);
  if (total <= 0) return 'low';
  const precious = item.materials.reduce((s, m) =>
    (m.key === 'copper' || m.key === 'pcb') ? s + m.qtyLb : s, 0);
  const share = precious / total;
  if (share >= 0.3) return 'high';
  if (share >= 0.15) return 'mid';
  return 'low';
}

/** 零件外购价 */
export function partBuyPrice(key) {
  return round(partValue(key) * CONFIG.PARTS_BUY_MARKUP, CONFIG.DECIMALS.money);
}

/** 零件当废品卖出的价格 */
export function partSellPrice(key) {
  return round(partValue(key) * CONFIG.PART_SELL_COEF, CONFIG.DECIMALS.money);
}

/** 古董判定（生成时调用一次，结果隐藏） */
export function rollAntique() {
  return chance(CONFIG.ANTIQUE_CHANCE);
}

/** 「年代感」噪音标记（与真伪无关） */
export function rollAgeMark() {
  return chance(CONFIG.AGE_MARK_CHANCE);
}
