/**
 * 修理 —— 成本看坏的严重程度（品相）与缺什么零件；
 * 缺失零件可以用货架上从别的废品拆下来的存货抵扣，抵扣不掉就得外购。
 * 成功率 = 工具成功率 - 每个未补齐缺件的惩罚。
 */
import { CONFIG } from '../config.js';
import { partName } from '../data/parts.js';
import { partBuyPrice, revealValue } from './economy.js';
import { rand, chance, round } from './rng.js';

export function toolRate(toolLevel) {
  const row = CONFIG.TOOL_TABLE.find(t => t.lv === toolLevel) || CONFIG.TOOL_TABLE[0];
  return row.rate;
}

/** 当前工具等级累计的修理费折扣（作用于工时费 baseCost） */
export function toolDiscount(toolLevel) {
  const row = CONFIG.TOOL_TABLE.find(t => t.lv === toolLevel) || CONFIG.TOOL_TABLE[0];
  return row.discount || 0;
}

export function repairDuration() {
  return CONFIG.REPAIR_TIME_BASE;
}

/**
 * 计算修理方案（不修改状态）。
 * 库存零件按缺件顺序逐个抵扣，抵扣不到的走外购。
 */
export function planRepair(item, state) {
  const coef = CONFIG.REPAIR_COST_BY_CONDITION[item.condition] ?? 0.2;
  const jitter = rand(CONFIG.REPAIR_COST_JITTER[0], CONFIG.REPAIR_COST_JITTER[1]);
  const discount = toolDiscount(state.toolLevel);
  const baseCost = round(item.hiddenBaseValue * coef * jitter * (1 - discount), CONFIG.DECIMALS.money);

  const stock = Object.assign({}, state.parts);
  const parts = item.missing.map(mp => {
    if ((stock[mp.key] || 0) > 0) {
      stock[mp.key] -= 1;
      return { key: mp.key, name: partName(mp.key), fromStock: true, cost: 0 };
    }
    return { key: mp.key, name: partName(mp.key), fromStock: false, cost: partBuyPrice(mp.key) };
  });

  const partCost = round(parts.reduce((s, p) => s + p.cost, 0), CONFIG.DECIMALS.money);
  const total = round(baseCost + partCost, CONFIG.DECIMALS.money);

  const unmatched = parts.filter(p => !p.fromStock).length;
  const base = toolRate(state.toolLevel);
  const rate = Math.max(0.05, Math.min(0.99, round(base - unmatched * CONFIG.REPAIR_MISSING_PENALTY, 4)));

  return { baseCost, parts, partCost, total, unmatched, baseRate: base, rate };
}

/**
 * 执行修理（会修改 item / state）。
 * @returns {{success:boolean, value?:number, coef?:number, antiqueMult?:number, lostParts?:string[]}}
 */
export function resolveRepair(item, plan, state) {
  // 库存零件先出库；失败时按 PART_LOSS_ON_FAIL 概率报废，其余归还货架
  const used = plan.parts.filter(p => p.fromStock).map(p => p.key);
  for (const key of used) {
    state.parts[key] = round((state.parts[key] || 0) - 1, 2);
    if (state.parts[key] <= 0) delete state.parts[key];
  }

  const success = chance(plan.rate);
  const lostParts = [];

  if (success) {
    const r = revealValue(item);
    item.state = 'repaired';
    item.revealedValue = r.value;
    item.sellCoef = round(r.coef, 2);
    item.antiqueMult = round(r.antiqueMult, 2);
    return { success: true, value: r.value, coef: r.coef, antiqueMult: r.antiqueMult };
  }

  for (const key of used) {
    if (chance(CONFIG.PART_LOSS_ON_FAIL)) {
      lostParts.push(key);
    } else {
      state.parts[key] = round((state.parts[key] || 0) + 1, 2);
    }
  }
  item.state = 'broken';
  item.salvageFactor = CONFIG.FAIL_SALVAGE;
  return { success: false, lostParts };
}
