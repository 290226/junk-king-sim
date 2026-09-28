/**
 * 冒烟检查（零依赖）：
 *  1. 逐个 import 所有模块，抓语法错误与坏引用；
 *  2. 跑一局按天推进的模拟：收货 → 过秤 → 修理/拆解 → 变现 → 理财/贷款 → 收摊过夜；
 *  3. 钱庄纯函数校验（期货赔付、定期到期/提前支取、额度与利息）。
 * 用法：npm run check
 */
import { CONFIG } from '../src/config.js';
import { createGame } from '../src/core/gameState.js';
import { rollMarket, rollDailyMarket, materialValue, sampleSellCoef } from '../src/core/economy.js';
import {
  settleFutures, fixedMaturity, fixedEarlyPayout, loanLimit, dailyInterest
} from '../src/core/finance.js';
import { makeItem, makeScavengedItem } from '../src/core/itemFactory.js';
import { makeCustomer } from '../src/core/customer.js';
import { planRepair } from '../src/core/repair.js';
import { planScavenge, SPOT_MAP } from '../src/core/scavenge.js';
import { t, setLang, getLang, missingKeys } from '../src/i18n/index.js';
import { matName } from '../src/data/materials.js';
import { partName } from '../src/data/parts.js';
import { itemName, condLabel } from '../src/data/items.js';

let failed = 0;
function ok(cond, label) {
  console.log(`${cond ? ' ok ' : 'FAIL'}  ${label}`);
  if (!cond) failed++;
}

console.log('— 模块导入 —');
ok(!!CONFIG && !!CONFIG.TOOL_TABLE.length, 'config');
ok(!!makeItem && !!makeCustomer && !!planRepair && !!rollMarket, 'core 模块');
for (const p of ['../src/ui/icons.js', '../src/ui/dom.js', '../src/ui/renderCustomer.js', '../src/ui/renderBench.js', '../src/ui/renderSide.js', '../src/ui/renderNight.js', '../src/i18n/zh.js', '../src/i18n/en.js']) {
  try { await import(p); ok(true, `ui ${p.split('/').pop()}`); }
  catch (e) { ok(false, `ui ${p.split('/').pop()}: ${e.message}`); }
}

console.log('\n— 一局模拟（按天推进）—');
const g = createGame(() => {});
const A = g.actions;
let repaired = 0, dismantled = 0;
let buyTotal = 0, repairTotal = 0, sellFixed = 0, sellMat = 0;
let blockedByDay = 0, futuresPlaced = 0, futuresWon = 0;
let scavengeOk = 0, scavengeBlocked = 0, scavengedItems = 0, scavengeCash = 0, nightBlocked = 0;
const DAYS = 14;
const samples = [];

for (let day = 0; day < DAYS; day++) {
  for (let slot = 0; slot < CONFIG.DAY_CUSTOMER_LIMIT + 1; slot++) {
    const nc = A.nextCustomer();
    if (!nc.ok) { blockedByDay++; break; }   // 第 4 次应当被挡住
    const s = g.state;
    for (const e of s.customer.entries.slice()) {
      // 测试用真值报价：压到底价附近，模拟老练玩家
      const fair = e.item.matValue / e.item.weight;
      A.offer(e.item.id, Math.max(0.05, fair * 0.85));
      if (e.phase === 'counter') A.accept(e.item.id);
      if (e.phase === 'dealt') {
        const r = A.weigh(e.item.id);
        if (r.ok) buyTotal += r.cost;
      }
    }
  }
  // 工作台：有钱就修，没钱就拆
  for (const item of g.state.workbench.slice()) {
    if (item.state !== 'pending') continue;
    // 品相差的（1~2）直接拆材料攒零件，品相好的才花钱修
    const plan = A.repairPlan(item.id);
    if (plan && item.condition >= 3 && plan.total <= g.state.cash * 0.8) {
      repairTotal += plan.total;
      const r = A.startRepair(item.id);
      if (r.ok) { const f = A.finishRepair(item.id); repaired++; samples.push(f.item); }
    } else {
      let guard = 0;
      while (g.state.workbench.some(i => i.id === item.id) && guard++ < 12) A.dismantle(item.id);
      dismantled++;
    }
  }
  // 修好的卖掉、材料和多余零件清仓
  for (const item of g.state.workbench.slice()) {
    if (item.state === 'repaired') { const r = A.sellItem(item.id); if (r.ok) sellFixed += r.value; }
  }
  for (const k of Object.keys(g.state.materials)) {
    const r = A.sellMaterial(k, g.state.materials[k]);
    if (r.ok) sellMat += r.value;
  }
  if (g.state.cash > CONFIG.TOOL_TABLE[1].price) A.upgradeTool();

  // 钱庄：留足周转后把闲钱理财；第 5 天起每天押一笔期货
  if (g.state.cash > 900) A.deposit(200);
  if (g.state.day === 4 && g.state.cash > 500) A.openFixed(200);
  if (g.state.day >= 5 && g.state.cash > 500) {
    const mats = Object.keys(CONFIG.MAT_PRICE);
    const key = mats[g.state.day % mats.length];
    const r = A.openFutures(key, g.state.day % 2 ? 'up' : 'down', 150);
    if (r.ok) futuresPlaced++;
  }
  if (g.state.day === 3) A.borrow(300);               // 借钱周转
  if (g.state.loan.principal > 0 && g.state.cash > 1500) A.repay(200);

  // 夜间：进入夜间 → 翻一次垃圾桶（第二次应被拦）→ 睡觉
  A.enterNight();
  ok(g.state.phase === 'night', `第 ${g.state.day} 天收摊后进入夜间`);
  const spots = Object.keys(SPOT_MAP);
  const spot = spots[day % spots.length];
  const sc = A.scavenge(spot);
  if (sc.ok) {
    scavengeOk++;
    if (sc.result.kind === 'item') scavengedItems++;
  }
  const sc2 = A.scavenge(spot);            // 同一晚第二次
  if (!sc2.ok && sc2.reason === 'limit') scavengeBlocked++;
  const ncAtNight = A.nextCustomer();      // 夜里不该还能收货
  if (!ncAtNight.ok && ncAtNight.reason === 'night') nightBlocked++;

  const before = g.state.day;
  const rep = A.endDay();
  if (rep.ok) futuresWon += rep.report.futures.filter(f => f.result.win).length;
  ok(rep.ok && g.state.day === before + 1 && g.state.phase === 'day',
    `第 ${before} 天过夜 → 第 ${g.state.day} 天（回到白天）`);
}

console.log(`  收货 ${g.state.stats.deals} 件，走单 ${g.state.stats.lost} 件`);
console.log(`  修理 ${repaired} 件（成功 ${g.state.stats.repaired} / 失败 ${g.state.stats.broken}），拆解 ${dismantled} 件`);
console.log(`  进货支出 ${buyTotal.toFixed(0)}，修理支出 ${repairTotal.toFixed(0)}`);
console.log(`  修好卖出 ${sellFixed.toFixed(0)}，卖材料 ${sellMat.toFixed(0)}`);
console.log(`  活期 ${g.state.finance.demand.toFixed(0)}，在持定期 ${g.state.finance.deposits.length} 笔，期货押中 ${futuresWon}/${futuresPlaced} 笔`);
console.log(`  欠款 ${g.state.loan.principal.toFixed(0)}，累计付息 ${g.state.loan.interestPaid.toFixed(0)}`);
console.log(`  期末现金 ${g.state.cash.toFixed(0)}，身家 ${A.netWorth().toFixed(0)}，工具 Lv${g.state.toolLevel}，第 ${g.state.day} 天`);
console.log(`  拆出零件 ${g.state.stats.partsFound} 个，捡漏 ${g.state.stats.antiqueFound} 件`);

console.log('\n— 钱庄流程（独立一局，逐步验证）—');
const g2 = createGame(() => {});
const B = g2.actions;
const startCash = g2.state.cash;

// 活期：存入 → 过夜计息 → 取出
B.deposit(100);
ok(g2.state.finance.demand === 100 && g2.state.cash === startCash - 100, '活期存入从现金扣除');
B.endDay();
ok(g2.state.finance.demand === 100.4, `活期过夜计息（100 → ${g2.state.finance.demand}）`);
B.withdraw(50.4);
ok(g2.state.finance.demand === 50 && Math.abs(g2.state.cash - (startCash - 100 + 50.4)) < 1e-6,
  `活期取出回到现金（现金 ${g2.state.cash.toFixed(2)}，账户 50）`);

// 定期：买入 → 锁 7 天 → 到期自动本息到账
const fx = B.openFixed(100);
ok(fx.ok && g2.state.finance.deposits.length === 1, '买入七天定期');
ok(B.breakFixed(fx.dep.id).ok, '定期可提前支取（扣手续费）');
ok(g2.state.finance.deposits.length === 0, '提前支取后持仓清空');
const fx2 = B.openFixed(100);
const cashBeforeMature = g2.state.cash;
for (let i = 0; i < CONFIG.FINANCE.fixed.lockDays; i++) B.endDay();
ok(g2.state.finance.deposits.length === 0, '存满 7 天后定期自动到期');
ok(Math.abs((g2.state.cash - cashBeforeMature) - fixedMaturity(100)) < 1e-6,
  `到期本息 ${fixedMaturity(100)} 已到账（现金 ${g2.state.cash.toFixed(2)}）`);

// 期货：押一笔 → 过夜必结算
const openPrice = g2.state.market.matPrices.copper;
const fut = B.openFutures('copper', 'up', 100);
ok(fut.ok && g2.state.finance.deposits.length === 1, '期货下单成功');
const rep2 = B.endDay();
ok(g2.state.finance.deposits.length === 0, '期货隔夜已结算离场');
ok(rep2.report.futures.length === 1 && rep2.report.futures[0].result.openPrice === openPrice,
  `结算用开仓价 ${openPrice} 与次日价对比（${rep2.report.futures[0].result.win ? '押中' : (rep2.report.futures[0].result.draw ? '走平' : '押错')}）`);

// 贷款：借款 → 过夜付息 → 还款
const b = B.borrow(300);
ok(b.ok && g2.state.loan.principal === 300, '借款到账并记账');
const cashBeforeInt = g2.state.cash;
B.endDay();
const expectInt = Math.round(300 * CONFIG.LOAN.dailyRate * 100) / 100;
ok(Math.abs((cashBeforeInt - g2.state.cash) - expectInt) < 1e-6, `过夜扣贷款利息 ${expectInt} 元`);
ok(g2.state.loan.interestPaid >= expectInt, '利息计入统计');
B.repay(300);
ok(g2.state.loan.principal === 0, '还清后欠款归零');
const overLimit = B.borrow(999999);
ok(!overLimit.ok && overLimit.reason === 'limit', '超额借款被额度拦下');

console.log('\n— 夜间翻垃圾桶 —');
ok(scavengeOk === DAYS, `${DAYS} 天里每晚翻桶一次，全部成功`);
ok(scavengeBlocked === DAYS, '每晚第二次翻桶都被次数限制拦下');
ok(nightBlocked === DAYS, '夜间阶段不能再招呼顾客');
ok(g.state.stats.scavenged === DAYS, '翻桶次数计入统计');

// 各地点产出分布
for (const key of Object.keys(SPOT_MAP)) {
  const tally = {};
  let riskHits = 0;
  for (let i = 0; i < 4000; i++) {
    const p = planScavenge(key);
    const k = p.kind === 'empty' ? `empty:${p.flavor}` : p.kind;
    tally[k] = (tally[k] || 0) + 1;
    if (p.risk) riskHits++;
  }
  const riskPct = (riskHits / 40).toFixed(1);
  console.log(`  ${key}: ${JSON.stringify(tally)} 风险 ${riskPct}%`);
  ok(Object.keys(tally).length >= 4, `${key} 能产出多种结果`);
}
ok(planScavenge('nope') === null, '未知地点返回 null');
const sItem = makeScavengedItem(rollMarket().matPrices);
ok(sItem.fromDumpster === true && sItem.missing.length >= 1, '垃圾桶里捡来的废品带标记且必定缺件');
ok(sItem.condition >= 1 && sItem.condition <= 4, `捡来的废品品相被打压（${sItem.condition}）`);

console.log('\n— 中英双语 —');
ok(missingKeys().length === 0, `英文词条覆盖中文全部 key（缺失 ${missingKeys().length} 个）`);
setLang('zh');
ok(t('panel.customer') === '顾客' && matName('copper') === '铜' && condLabel(5) === '成色不错', '中文词条与数据名正确');
ok(/¥/.test(t('log.weighOk', { item: '旧电视', w: '12.3 斤', p: '¥2.00/斤', v: '¥24.60' })), '中文日志模板可渲染');
setLang('en');
ok(t('panel.customer') === 'Customers' && matName('copper') === 'Copper' && partName('mcu') === 'Main Control Board',
  '英文词条与数据名正确');
const enLog = t('log.weighOk', { item: 'Dusty CRT Television', w: '12.3 lb', p: '¥2.00/lb', v: '¥24.60' });
ok(enLog.startsWith('Weighed:') && enLog.includes('lb'), `英文日志模板可渲染：${enLog}`);
ok(itemName(sItem).length > 0 && !/[一-龥]/.test(itemName(sItem)), `物品名按语言生成：${itemName(sItem)}`);
setLang('zh');
ok(getLang() === 'zh', '切回中文');
const market = rollMarket();
let ratioSum = 0, sellSum = 0, salvageSum = 0, n = 0;
for (let i = 0; i < 4000; i++) {
  const item = makeItem(market.matPrices);
  const mv = materialValue(item.materials, market.matPrices);
  const cost = (mv / item.weight) * 0.85 * item.weight; // 底价 0.85 成交时的成本
  ratioSum += mv / cost;
  salvageSum += mv;
  sellSum += item.hiddenBaseValue * sampleSellCoef(item.condition);
  n++;
}
const matOverCost = ratioSum / n;
const sellOverSalvage = sellSum / salvageSum;
console.log(`  材料价值 / 收购成本 = ${matOverCost.toFixed(2)}（目标 0.6~1.2 → 约 ${(1 / 0.85).toFixed(2)}）`);
console.log(`  售价期望 / 拆解价值 = ${sellOverSalvage.toFixed(2)}（目标 1.5~2）`);

ok(matOverCost > 0.6 && matOverCost < 1.6, '材料价值与收购成本比值合理');
// 说明：BASE_VALUE_COEF 已由用户确认上调，售价/拆解约 3.3 倍（文档原目标 1.5~2）
ok(sellOverSalvage > 2.5 && sellOverSalvage < 4.0, `售价期望与拆解价值比值合理（${sellOverSalvage.toFixed(2)}，用户确认上调后的区间）`);
ok(g.state.stats.deals > 20, '模拟能持续成交');
ok(g.state.cash > 0, '没有出现负现金');

console.log('\n— 时间与收货上限 —');
ok(g.state.day === DAYS + 1, `${DAYS} 天后进入第 ${g.state.day} 天`);
ok(blockedByDay === DAYS, '每天第 4 次收货都被拦下');
ok(g.state.dayCustomers === 0, '过夜后当日收货次数已重置');

console.log('\n— 按天行情 —');
let mkt = rollMarket(1);
let moved = 0, outOfBand = 0;
for (let d = 2; d <= 60; d++) {
  const next = rollDailyMarket(mkt, d);
  for (const key of Object.keys(CONFIG.MAT_PRICE)) {
    const base = CONFIG.MAT_PRICE[key];
    if (Math.abs(next.matPrices[key] - mkt.matPrices[key]) > 1e-6) moved++;
    if (next.matPrices[key] < base * CONFIG.PRICE_FLOOR_COEF - 1e-6 ||
        next.matPrices[key] > base * CONFIG.PRICE_CAP_COEF + 1e-6) outOfBand++;
  }
  mkt = next;
}
ok(moved > 0, '过夜后市价会变动');
ok(outOfBand === 0, '市价始终夹在上下限内（不会跑飞）');

console.log('\n— 钱庄纯函数 —');
const fUp = settleFutures({ principal: 1000, dir: 'up', openPrice: 10 }, 12);      // +20% → ×4 = 0.8
const fDown = settleFutures({ principal: 1000, dir: 'up', openPrice: 10 }, 9);     // -10% → ×4 = 0.4
const fFlat = settleFutures({ principal: 1000, dir: 'down', openPrice: 10 }, 10);  // 纹丝不动
ok(fUp.win && fUp.payout === 1780, `押中按涨幅×杠杆计收益（+20% → ${fUp.payout}）`);
ok(!fDown.win && fDown.payout === 580, `押错按跌幅扣本金（-10% → ${fDown.payout}）`);
ok(fFlat.draw && fFlat.payout === 980, `价格不动退本金（扣手续费 → ${fFlat.payout}）`);
const cap = settleFutures({ principal: 1000, dir: 'up', openPrice: 10 }, 30);
ok(cap.payout === 1000 * (1 + CONFIG.FINANCE.futures.winCap) - 20, '收益有封顶，不会爆表');
ok(fixedMaturity(1000) === 1084, `定期到期本息 = ${fixedMaturity(1000)}`);
ok(fixedEarlyPayout({ principal: 1000, daysHeld: 3 }) === 1002, '提前支取按活期计息并扣手续费');
ok(loanLimit(1000, 0) === 1800 && loanLimit(1000, 800) === 1000, '借款额度随身家与欠款变化');
ok(dailyInterest(1000) === 5, '日息 0.5% 计算正确');

console.log(failed ? `\n× ${failed} 项未通过` : '\n√ 全部通过');
process.exit(failed ? 1 : 0);
