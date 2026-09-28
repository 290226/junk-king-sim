/**
 * 废品工厂 —— 生成一件废品：重量、目测区间、品相、古董判定、
 * 材料清单、缺失零件、隐藏基准值。
 * 硬约束：真值重量 / isAntique / hiddenBaseValue 在称重或修理成功前不得渲染。
 */
import { CONFIG } from '../config.js';
import { ITEM_KINDS, NAME_PREFIX, itemName } from '../data/items.js';
import { baseMatPrice } from '../data/materials.js';
import { baseMaterialValue } from './economy.js';
import { rand, randInt, pick, chance, weightedIndex, round, shuffle, uid } from './rng.js';

const MIN_QTY = 0.05;

/** 按配比把总材料重拆到各材料上，最后一种补齐尾差 */
function splitMaterials(totalLb, mix) {
  const keys = Object.keys(mix);
  const out = [];
  let used = 0;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    let qty;
    if (i === keys.length - 1) {
      qty = round(totalLb - used, 2);
    } else {
      qty = round(totalLb * mix[key], 2);
    }
    qty = Math.max(MIN_QTY, qty);
    used = round(used + qty, 2);
    out.push({ key, qtyLb: qty });
  }
  // 按材料清单顺序输出（贵重材料在前，拆解时先出）
  return out.sort((a, b) => {
    const order = Object.keys(CONFIG.MAT_PRICE);
    return order.indexOf(a.key) - order.indexOf(b.key);
  });
}

export function makeItem(matPrices, opts = {}) {
  // 特殊商品（保险柜/售货机等）不出现在垃圾桶，翻桶时用 excludeSpecial 排除
  const pool = opts.excludeSpecial ? ITEM_KINDS.filter(k => !k.special) : ITEM_KINDS;
  const kind = pick(pool);
  const special = !!kind.special;
  // 特殊大家伙用自己的重量区间，普通件走全局区间再夹到品类可信区间
  const weightRange = special ? kind.weight : CONFIG.ITEM_WEIGHT;
  const weight = round(rand(weightRange[0], weightRange[1]), CONFIG.DECIMALS.weight);
  const w = round(Math.min(Math.max(weight, kind.weight[0]), kind.weight[1]), CONFIG.DECIMALS.weight);

  // 目测区间：真值必在区间内，宽度上限由 EYE_BAND 决定
  const lowPct = rand(0.05, CONFIG.EYE_BAND);
  const highPct = rand(0.05, CONFIG.EYE_BAND);
  const eyeLow = round(Math.max(0.5, w * (1 - lowPct)), CONFIG.DECIMALS.weight);
  const eyeHigh = round(w * (1 + highPct), CONFIG.DECIMALS.weight);

  const condition = weightedIndex(CONFIG.CONDITION_WEIGHTS) + 1;
  const ratio = rand(CONFIG.MATERIAL_WEIGHT_RATIO[0], CONFIG.MATERIAL_WEIGHT_RATIO[1]);
  const materials = splitMaterials(round(w * ratio, 2), kind.mix);

  const hiddenBaseValue = round(
    baseMaterialValue(materials) * rand(CONFIG.BASE_VALUE_COEF[0], CONFIG.BASE_VALUE_COEF[1]),
    CONFIG.DECIMALS.money
  );

  // 缺失零件：从该品类的零件池里不重复抽取
  let missing = [];
  if (chance(CONFIG.MISSING_PART_CHANCE)) {
    const pool = shuffle(kind.parts.slice());
    const n = Math.min(randInt(1, CONFIG.MISSING_PART_MAX), pool.length);
    missing = pool.slice(0, n).map(key => ({ key }));
  }

  const pfx = randInt(0, NAME_PREFIX.length - 1);
  const prefix = NAME_PREFIX[pfx];

  // 特殊商品：可能藏钱
  let hasCash = false;
  let hiddenCash = 0;
  if (special && chance(CONFIG.SPECIAL_CASH.chance)) {
    hasCash = true;
    hiddenCash = round(rand(CONFIG.SPECIAL_CASH.amount[0], CONFIG.SPECIAL_CASH.amount[1]), CONFIG.DECIMALS.money);
  }

  return {
    id: uid('item'),
    kind: kind.key,
    kindName: kind.name,
    pfx,                                  // 名字前缀下标，跨语言即时拼名
    iconKey: kind.icon,
    name: `${prefix.zh}${kind.name}`,
    weight: w,
    eyeLow,
    eyeHigh,
    condition,
    ageMark: chance(CONFIG.AGE_MARK_CHANCE),
    isAntique: chance(CONFIG.ANTIQUE_CHANCE),
    hiddenBaseValue,
    materials,
    partPool: kind.parts,   // 拆解时可能掉落的可用零件池
    missing,
    special: special ? kind.special : null,  // 特殊商品标记（如 'cash'）
    hasCash,                                  // 是否真藏了钱
    hiddenCash,                               // 藏的钱（拆解完成才揭示）
    state: 'pending',        // pending | repairing | repaired | broken | dismantling
    salvageFactor: 1,
    dismantleIndex: 0,
    buyUnitPrice: 0,
    buyCost: 0,
    revealedValue: 0,
    sellCoef: 0,
    antiqueMult: 0,
    // 当前市价下的材料价值（用于顾客底价；随行情刷新而更新）
    matValue: round(materials.reduce((s, m) => s + m.qtyLb * (matPrices?.[m.key] ?? 0), 0), CONFIG.DECIMALS.money)
  };
}

/**
 * 垃圾桶里翻出来的废品：零成本，但品相差一档、必定缺件。
 * 走的是同一套生成逻辑，只是把品相与缺件往「更难修」的方向压。
 */
export function makeScavengedItem(matPrices) {
  const item = makeItem(matPrices, { excludeSpecial: true });
  item.condition = Math.max(1, item.condition - CONFIG.SCAVENGE.itemConditionPenalty);
  if (CONFIG.SCAVENGE.itemMissingGuarantee && !item.missing.length && item.partPool.length) {
    item.missing = [{ key: pick(item.partPool) }];
  }
  item.fromDumpster = true;
  item.name = itemName(item);
  return item;
}

/** 刷新某件物品在当前市价下的材料价值（行情滚动时用） */
export function refreshMatValue(item, matPrices) {
  item.matValue = round(
    item.materials.reduce((s, m) => s + m.qtyLb * (matPrices[m.key] ?? 0), 0),
    CONFIG.DECIMALS.money
  );
  return item.matValue;
}

/** 目测区间中值，玩家报价时的参考值 */
export function eyeMid(item) {
  return round((item.eyeLow + item.eyeHigh) / 2, CONFIG.DECIMALS.weight);
}

/** 按目测上限估算的最坏总价，用于「现金够不够」的前置校验 */
export function worstCaseCost(item, unitPrice) {
  return round(item.eyeHigh * unitPrice, CONFIG.DECIMALS.money);
}

export function actualCost(item, unitPrice) {
  return round(item.weight * unitPrice, CONFIG.DECIMALS.money);
}
