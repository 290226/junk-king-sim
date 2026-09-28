/**
 * 顾客 —— 携带 1~3 件废品上门，逐件讲价（谈每斤单价）。
 * 每件独立判定：成交 / 还价一次 / 直接离开（这件丢单）。
 * 心理底价 = 该件材料价值 ÷ 重量 × RESERVE_COEF，全程隐藏。
 */
import { CONFIG } from '../config.js';
import { CUSTOMER_NAMES, CUSTOMER_LINES, customerName, customerLine } from '../data/names.js';
import { makeItem } from './itemFactory.js';
import { rand, randInt, pick, chance, round, uid } from './rng.js';

export function makeCustomer(matPrices) {
  const n = randInt(CONFIG.CUSTOMER_SIZE[0], CONFIG.CUSTOMER_SIZE[1]);
  const items = [];
  for (let i = 0; i < n; i++) items.push(makeItem(matPrices));

  // 存下标而非字符串：切换语言时顾客名与台词能即时跟着变
  const nameIdx = randInt(0, CUSTOMER_NAMES.length - 1);
  const lineIdx = randInt(0, CUSTOMER_LINES.length - 1);

  return {
    id: uid('cust'),
    nameIdx,
    lineIdx,
    name: customerName(nameIdx),
    line: customerLine(lineIdx),
    entries: items.map(item => ({
      item,
      phase: 'haggle',        // haggle | counter | dealt | left | stored
      reservePerLb: round(
        (item.matValue / item.weight) * rand(CONFIG.RESERVE_COEF[0], CONFIG.RESERVE_COEF[1]),
        CONFIG.DECIMALS.price
      ),
      counterPerLb: 0,
      offerPerLb: 0,
      rounds: 0,              // 已报价次数，用于文案
      weighed: false
    }))
  };
}

/**
 * 对某件废品报价（每斤单价）。
 * @returns {{result:'deal'|'counter'|'leave', price?:number}}
 */
export function makeOffer(entry, pricePerLb) {
  if (entry.phase !== 'haggle') return { result: 'invalid' };
  const offer = round(Number(pricePerLb) || 0, CONFIG.DECIMALS.price);
  if (offer <= 0) return { result: 'invalid' };

  entry.rounds += 1;
  if (offer >= entry.reservePerLb) {
    entry.phase = 'dealt';
    entry.offerPerLb = offer;
    return { result: 'deal', price: offer };
  }
  if (chance(CONFIG.COUNTER_OFFER_CHANCE)) {
    entry.phase = 'counter';
    entry.counterPerLb = round(
      entry.reservePerLb * rand(CONFIG.COUNTER_MARKUP[0], CONFIG.COUNTER_MARKUP[1]),
      CONFIG.DECIMALS.price
    );
    return { result: 'counter', price: entry.counterPerLb };
  }
  entry.phase = 'left';
  return { result: 'leave' };
}

/** 接受顾客的还价 */
export function acceptCounter(entry) {
  if (entry.phase !== 'counter') return false;
  entry.phase = 'dealt';
  entry.offerPerLb = entry.counterPerLb;
  return true;
}

/** 拒绝还价 —— 这件丢单 */
export function rejectCounter(entry) {
  if (entry.phase !== 'counter') return false;
  entry.phase = 'left';
  return true;
}

/** 顾客是否还有未决定的件 */
export function hasPending(entryList) {
  return entryList.some(e => e.phase === 'haggle' || e.phase === 'counter');
}

/** 已成交但还没上称的件 */
export function pendingWeigh(entryList) {
  return entryList.filter(e => e.phase === 'dealt' && !e.weighed);
}

/** 顾客离开后本轮的统计 */
export function summarize(entryList) {
  const dealt = entryList.filter(e => e.phase === 'dealt' || e.phase === 'stored');
  const left = entryList.filter(e => e.phase === 'left');
  return { dealt: dealt.length, left: left.length };
}
