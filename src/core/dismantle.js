/**
 * 拆解队列 —— 每次点击只拆出「一种」材料，即时入库，
 * 展示格式固定为「材料名 X 斤 × ¥Y/斤 = ¥Z」。
 * 全部拆完后按概率掉落可用零件（品相越好越容易掉）。
 */
import { CONFIG } from '../config.js';
import { rand, randInt, chance, round, shuffle } from './rng.js';

/** 当前这一步要拆出的材料（考虑损坏减半） */
export function peekMaterial(item) {
  if (item.dismantleIndex >= item.materials.length) return null;
  const m = item.materials[item.dismantleIndex];
  return { key: m.key, qtyLb: round(m.qtyLb * item.salvageFactor, 2) };
}

/** 剩余未拆出的材料清单（用于展示进度） */
export function remainingMaterials(item) {
  return item.materials.slice(item.dismantleIndex).map(m => ({
    key: m.key,
    qtyLb: round(m.qtyLb * item.salvageFactor, 2)
  }));
}

export function dismantleProgress(item) {
  const total = item.materials.length;
  return { done: item.dismantleIndex, total };
}

/**
 * 执行一次拆解。
 * @param {object} state 游戏状态（会被修改：materials / parts 入库）
 * @param {object} item  废品
 * @returns {{ok:boolean, text?:string, finished?:boolean, dropped?:Array}}
 */
export function dismantleStep(state, item) {
  const m = peekMaterial(item);
  if (!m) return { ok: false };

  const unitPrice = state.market.matPrices[m.key] ?? 0;
  const value = round(m.qtyLb * unitPrice, CONFIG.DECIMALS.money);

  state.materials[m.key] = round((state.materials[m.key] || 0) + m.qtyLb, 2);
  item.dismantleIndex += 1;
  item.state = 'dismantling';

  // 文本交给上层按当前语言拼（dismantle.step 词条）
  const finished = item.dismantleIndex >= item.materials.length;

  let dropped = [];
  if (finished) dropped = rollPartsDrop(item);

  return { ok: true, mat: m.key, qty: m.qtyLb, price: unitPrice, value, finished, dropped };
}

/** 拆解完成时的零件掉落（只生成结果，入库由调用方决定） */
export function rollPartsDrop(item) {
  const pool = item.partPool || [];
  if (!pool.length) return [];
  const p = CONFIG.PART_DROP_CHANCE + (item.condition - 1) * CONFIG.PART_DROP_COND_BONUS;
  if (!chance(Math.min(1, p))) return [];
  const n = Math.min(randInt(CONFIG.PART_DROP_COUNT[0], CONFIG.PART_DROP_COUNT[1]), pool.length);
  const bag = shuffle(pool.slice());
  return bag.slice(0, n);
}
