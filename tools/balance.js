/**
 * 平衡分析（零依赖、只算不玩）：
 * 抽样大量废品，统计「材料价值 / 讲价成本 / 拆解毛利 / 各工具等级的修理期望」，
 * 用来判断升级支出（工具总价 4330）需要多少批货才能赚回来。
 * 用法：node tools/balance.js
 */
import { CONFIG } from '../src/config.js';
import { rollMarket, materialValue, sampleSellCoef } from '../src/core/economy.js';
import { makeItem } from '../src/core/itemFactory.js';
import { planRepair } from '../src/core/repair.js';
import { rand, round } from '../src/core/rng.js';

const N = 20000;
const market = rollMarket();

const items = [];
let mvSum = 0;
for (let i = 0; i < N; i++) {
  const it = makeItem(market.matPrices);
  const mv = materialValue(it.materials, market.matPrices);
  it.mv = mv;
  mvSum += mv;
  items.push(it);
}
const MV = mvSum / N;

/** 讲价模拟：报价 = k × fair，返回 {成交概率, 条件期望单价系数} */
function haggle(k) {
  let deal = 0, priceSum = 0, trials = 40000;
  for (let i = 0; i < trials; i++) {
    const it = items[i % items.length];
    const fair = it.mv / it.weight;
    const reserve = fair * rand(CONFIG.RESERVE_COEF[0], CONFIG.RESERVE_COEF[1]);
    const offer = fair * k;
    if (offer >= reserve) { deal++; priceSum += offer; }
    else if (Math.random() < CONFIG.COUNTER_OFFER_CHANCE) {
      deal++;
      priceSum += reserve * rand(CONFIG.COUNTER_MARKUP[0], CONFIG.COUNTER_MARKUP[1]);
    }
  }
  return { p: deal / trials, coef: priceSum / deal / (MV / (items[0].weight)) * 0 + priceSum / deal, fairRef: 1 };
}

// 讲价：扫报价系数，找「期望成本」最低点
function scanHaggle() {
  const rows = [];
  for (let k = 0.40; k <= 1.05; k += 0.05) {
    let dealN = 0, costSum = 0, trials = 40000;
    for (let i = 0; i < trials; i++) {
      const it = items[(i * 7) % items.length];
      const fair = it.mv / it.weight;
      const reserve = fair * rand(CONFIG.RESERVE_COEF[0], CONFIG.RESERVE_COEF[1]);
      const offer = fair * k;
      let price = 0;
      if (offer >= reserve) price = offer;
      else if (Math.random() < CONFIG.COUNTER_OFFER_CHANCE) price = reserve * rand(CONFIG.COUNTER_MARKUP[0], CONFIG.COUNTER_MARKUP[1]);
      if (price > 0) { dealN++; costSum += price * it.weight; }
    }
    rows.push({ k: k.toFixed(2), rate: dealN / trials, cost: costSum / dealN / MV });
  }
  return rows;
}

const rows = scanHaggle();
const best = rows.reduce((a, b) => (b.cost < a.cost ? b : a));

console.log(`平均材料价值 MV = ${MV.toFixed(1)} 元/件\n`);
console.log('讲价扫描（报价 = k × 每斤材料价值）');
console.log('  k      成交率    成本/MV');
for (const r of rows) {
  const mark = r === best ? ' ← 最低' : '';
  console.log(`  ${r.k}    ${(r.rate * 100).toFixed(0)}%      ${r.cost.toFixed(2)}${mark}`);
}

const cost = best.cost * MV;
console.log(`\n最优讲价：报价 ${best.k} × fair，成交率 ${(best.rate * 100).toFixed(0)}%，单件成本 ≈ ${cost.toFixed(0)} 元（${best.cost.toFixed(2)} MV）`);
console.log(`拆解毛利 ≈ ${(MV - cost).toFixed(0)} 元/件\n`);

console.log('修理期望（按工具等级，假设缺件全部外购 / 全部库存抵扣 两种情形）');
console.log('  等级  成功率  工时费  零件费(外购)  售价   毛利(外购)  毛利(库存)  EV差');
for (const t of CONFIG.TOOL_TABLE) {
  let sellSum = 0, baseSum = 0, partSum = 0;
  const n = 4000;
  for (let i = 0; i < n; i++) {
    const it = items[(i * 13) % items.length];
    sellSum += it.hiddenBaseValue * sampleSellCoef(it.condition);
    const plan = planRepair(it, { toolLevel: t.lv, parts: {} });
    baseSum += plan.baseCost;
    partSum += plan.parts.reduce((s, p) => s + (p.fromStock ? 0 : p.cost), 0);
  }
  const sell = sellSum / n, base = baseSum / n, part = partSum / n;
  const evBuy = t.rate * (sell - cost - base - part) + (1 - t.rate) * (MV * CONFIG.FAIL_SALVAGE - cost - base - part);
  const evStock = t.rate * (sell - cost - base) + (1 - t.rate) * (MV * CONFIG.FAIL_SALVAGE - cost - base);
  console.log(`  Lv${t.lv}    ${(t.rate * 100).toFixed(0)}%     ${base.toFixed(0)}    ${part.toFixed(0)}        ${sell.toFixed(0)}    ${evBuy.toFixed(0)}        ${evStock.toFixed(0)}`);
}

const upgradeTotal = CONFIG.TOOL_TABLE.reduce((s, t) => s + t.price, 0);
console.log(`\n工具总升级支出 = ${upgradeTotal} 元`);
console.log('按修理路线逐级估算（每批按 2 件、走「有库存零件」档）：');
const evByLv = {};
for (const t of CONFIG.TOOL_TABLE) {
  let sellSum = 0, baseSum = 0, n = 4000;
  for (let i = 0; i < n; i++) {
    const it = items[(i * 13) % items.length];
    sellSum += it.hiddenBaseValue * sampleSellCoef(it.condition);
    baseSum += planRepair(it, { toolLevel: t.lv, parts: {} }).baseCost;
  }
  const sell = sellSum / n, base = baseSum / n;
  evByLv[t.lv] = t.rate * (sell - cost - base) + (1 - t.rate) * (MV * CONFIG.FAIL_SALVAGE - cost - base);
}
let batches = 0;
for (const t of CONFIG.TOOL_TABLE) {
  if (!t.price) continue;
  const perBatch = evByLv[t.lv - 1] * 2;
  const need = t.price / Math.max(perBatch, 1);
  batches += need;
  console.log(`  升到 Lv${t.lv}：每批毛利 ${perBatch.toFixed(0)} → 需 ${need.toFixed(1)} 批`);
}
console.log(`  合计约 ${batches.toFixed(0)} 批货升满（设计意图 3~8 批）`);
