/**
 * 游戏状态与全部动作。
 * 状态：phase / day / dayCustomers / cash / finance / loan / customer / workbench[] /
 *      materials{} / parts{} / toolLevel / stats / market / night / log
 * 每个会改变状态的动作最后都会 save + notify。
 *
 * 日志只存 key + params，渲染时用当前语言翻译（切换语言即时生效）。
 * params 里 $mat / $part 是数据 key，由 ui/renderSide.js 的 renderLog 解析成名称。
 */
import { CONFIG } from '../config.js';
import { matName } from '../data/materials.js';
import { partName, partTier, tierLabel } from '../data/parts.js';
import { itemName, condLabel } from '../data/items.js';
import { customerName } from '../data/names.js';
import { toolName } from '../data/labels.js';
import { getLang, t } from '../i18n/index.js';
import { rollMarket, rollDailyMarket, rollIntraday, partSellPrice, materialValue, partBuyPrice } from './economy.js';
import {
  freshFinance, freshLoan, financeAssets, demandInterest, fixedMaturity, fixedEarlyPayout,
  settleFutures, loanLimit, dailyInterest, dueDayOf
} from './finance.js';
import { makeCustomer, makeOffer, acceptCounter, rejectCounter, hasPending, pendingWeigh, summarize } from './customer.js';
import { makeItem, makeScavengedItem, refreshMatValue, actualCost, worstCaseCost } from './itemFactory.js';
import { dismantleStep, dismantleProgress } from './dismantle.js';
import { planScavenge, SPOTS, SPOT_MAP } from './scavenge.js';
import { planRepair, resolveRepair, repairDuration, toolRate } from './repair.js';
import { saveState, loadState, clearState } from './save.js';
import { round } from './rng.js';

function freshStats() {
  return {
    customers: 0, deals: 0, lost: 0,
    repaired: 0, broken: 0, dismantled: 0,
    spent: 0, earned: 0, antiqueFound: 0, partsFound: 0, scavenged: 0
  };
}

export function createFreshState() {
  return {
    phase: 'day',                     // day | night
    day: CONFIG.START_DAY,
    dayCustomers: 0,
    cash: CONFIG.START_CASH,
    finance: freshFinance(),
    loan: freshLoan(),
    customer: null,
    workbench: [],
    materials: {},
    parts: {},
    toolLevel: 1,
    stats: freshStats(),
    market: rollMarket(),
    night: { used: 0, lastResult: null },
    log: [],
    tutorialSeen: false
  };
}

/** 载入存档并补齐字段（旧档缺字段时不炸） */
function hydrate(data) {
  const base = createFreshState();
  const state = Object.assign(base, data || {});
  state.stats = Object.assign(freshStats(), data.stats || {});
  state.materials = data.materials || {};
  state.parts = data.parts || {};
  state.workbench = (data.workbench || []).map(normalizeItem);
  state.phase = data.phase === 'night' ? 'night' : 'day';
  state.day = Number(data.day) || CONFIG.START_DAY;
  state.dayCustomers = Number(data.dayCustomers) || 0;
  state.finance = Object.assign(freshFinance(), data.finance || {});
  state.finance.deposits = Array.isArray(state.finance.deposits) ? state.finance.deposits : [];
  state.finance.demand = Number(state.finance.demand) || 0;
  state.finance.seq = Number(state.finance.seq) || 1;
  state.loan = Object.assign(freshLoan(), data.loan || {});
  state.market = (data.market && data.market.matPrices) ? data.market : rollMarket(state.day);
  state.market.day = state.day;
  state.night = Object.assign({ used: 0, lastResult: null }, data.night || {});
  state.night.used = Number(state.night.used) || 0;
  state.log = Array.isArray(data.log) ? data.log : [];
  // 老档无此字段视为已看过教程（只有明确为 false 的新档才弹教程）
  state.tutorialSeen = data.tutorialSeen !== false;
  state.customer = null;
  return state;
}

/** 修理中途刷新页面：把「修理中」退回待处理，避免卡死 */
function normalizeItem(item) {
  if (item && item.state === 'repairing') item.state = 'pending';
  return item;
}

function fmt(n, d = 2) {
  return Number(n || 0).toFixed(d);
}

/** 金额 ¥12.34 */
function mTxt(v) {
  return `¥${fmt(v)}`;
}

/** 重量：中文「斤」，英文「lb」 */
function wTxt(v) {
  return `${Number(v || 0).toFixed(1)}${getLang() === 'en' ? ' lb' : ' 斤'}`;
}

/** 单价 ¥3.20/斤 */
function pTxt(v) {
  return `¥${fmt(v)}${getLang() === 'en' ? '/lb' : '/斤'}`;
}

/** 日志里存原始数值时用的格式化（给 renderLog 之外的即时文案用） */
function fmtWeight(v) {
  return `${Number(v || 0).toFixed(1)}${getLang() === 'en' ? ' lb' : ' 斤'}`;
}

function unitPriceTxt(v) {
  return `¥${fmt(v)}${getLang() === 'en' ? '/lb' : '/斤'}`;
}

function pctTxt(v) {
  return `${Math.round((v || 0) * 100)}%`;
}

/** 日志里只存物品的品类与前缀下标，渲染时按当前语言拼名 */
function itemRef(item) {
  return { kind: item.kind, pfx: item.pfx };
}

/** 顾客名按当前语言实时拼（存下标，切语言后日志也跟着变） */
function custName(c) {
  if (!c) return '';
  return c.nameIdx != null ? customerName(c.nameIdx) : (c.name || '');
}

export function createGame(onChange, slot) {
  const slotId = (Number(slot) >= 1 && Number(slot) <= CONFIG.SAVE_SLOTS) ? Number(slot) : 1;
  const saved = loadState(slotId);
  let state = saved ? hydrate(saved) : createFreshState();

  function notify() {
    saveState(state, slotId);
    if (typeof onChange === 'function') onChange(state);
  }

  /** 日志：只存 key + params，渲染时按当前语言翻译 */
  function log(key, params, kind = '') {
    const d = new Date();
    const stamp = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    state.log.unshift({ t: stamp, key, params: params || null, kind });
    if (state.log.length > CONFIG.LOG_LIMIT) state.log.length = CONFIG.LOG_LIMIT;
  }

  /* ---------------- 顾客（每天限次） ---------------- */

  function nextCustomer() {
    if (state.phase === 'night') {
      log('log.dayLimit', { n: CONFIG.DAY_CUSTOMER_LIMIT });
      notify();
      return { ok: false, reason: 'night' };
    }
    if (state.dayCustomers >= CONFIG.DAY_CUSTOMER_LIMIT) {
      log('log.dayLimit', { n: CONFIG.DAY_CUSTOMER_LIMIT });
      notify();
      return { ok: false, reason: 'day-limit' };
    }
    if (state.customer) {
      const s = summarize(state.customer.entries);
      log('log.customerLeave', { $cust: { idx: state.customer.nameIdx }, a: s.dealt, b: s.left });
      state.customer = null;
    }
    state.market = rollIntraday(state.market);
    for (const item of state.workbench) refreshMatValue(item, state.market.matPrices);
    state.customer = makeCustomer(state.market.matPrices);
    state.dayCustomers += 1;
    state.stats.customers += 1;
    log('log.customerArrive', {
      d: state.day, i: state.dayCustomers, n: CONFIG.DAY_CUSTOMER_LIMIT,
      $cust: { idx: state.customer.nameIdx }, c: state.customer.entries.length
    });
    notify();
    return { ok: true };
  }

  function findEntry(entryId) {
    if (!state.customer) return null;
    return state.customer.entries.find(e => e.item.id === entryId) || null;
  }

  /** 报价（每斤单价）。现金不足时不允许成交。 */
  function offer(entryId, pricePerLb) {
    const entry = findEntry(entryId);
    if (!entry || entry.phase !== 'haggle') return { ok: false, reason: 'phase' };
    const price = round(Number(pricePerLb), CONFIG.DECIMALS.price);
    if (!(price > 0)) return { ok: false, reason: 'price' };

    const worst = worstCaseCost(entry.item, price);
    if (worst > state.cash) {
      log('log.cashShortEye', { w: entry.item.eyeHigh, v: mTxt(worst) }, 'bad');
      notify();
      return { ok: false, reason: 'cash', need: worst };
    }

    const r = makeOffer(entry, price);
    if (r.result === 'deal') {
      log('log.offerDeal', { $item: itemRef(entry.item), p: price }, 'good');
    } else if (r.result === 'counter') {
      log('log.offerCounter', { $item: itemRef(entry.item), p: r.price }, 'warn');
    } else if (r.result === 'leave') {
      log('log.offerLeave', { $item: itemRef(entry.item) }, 'bad');
      state.stats.lost += 1;
    }
    notify();
    return { ok: true, result: r.result, price: r.price };
  }

  function accept(entryId) {
    const entry = findEntry(entryId);
    if (!entry || entry.phase !== 'counter') return { ok: false };
    const price = entry.counterPerLb;
    const worst = worstCaseCost(entry.item, price);
    if (worst > state.cash) {
      log('log.cashShortEye', { w: wTxt(entry.item.eyeHigh), v: mTxt(worst) }, 'bad');
      notify();
      return { ok: false, reason: 'cash', need: worst };
    }
    acceptCounter(entry);
    log('log.acceptCounter', { $item: itemRef(entry.item), p: price }, 'good');
    notify();
    return { ok: true };
  }

  function reject(entryId) {
    const entry = findEntry(entryId);
    if (!entry || entry.phase !== 'counter') return { ok: false };
    rejectCounter(entry);
    state.stats.lost += 1;
    log('log.reject', { $item: itemRef(entry.item) }, 'bad');
    notify();
    return { ok: true };
  }

  /** 上称：揭示真实重量与总价，扣现金，入库 */
  function weigh(entryId) {
    const entry = findEntry(entryId);
    if (!entry || entry.phase !== 'dealt' || entry.weighed) return { ok: false };
    const cost = actualCost(entry.item, entry.offerPerLb);
    if (cost > state.cash) {
      log('log.weighCash', { v: mTxt(cost) }, 'bad');
      entry.phase = 'left';
      state.stats.lost += 1;
      notify();
      return { ok: false, reason: 'cash', need: cost };
    }
    state.cash = round(state.cash - cost, CONFIG.DECIMALS.money);
    state.stats.spent = round(state.stats.spent + cost, CONFIG.DECIMALS.money);
    state.stats.deals += 1;
    entry.item.buyUnitPrice = entry.offerPerLb;
    entry.item.buyCost = cost;
    entry.weighed = true;
    entry.phase = 'stored';
    state.workbench.push(entry.item);
    log('log.weighOk', {
      $item: itemRef(entry.item), w: entry.item.weight,
      p: entry.offerPerLb, v: mTxt(cost)
    }, 'good');
    notify();
    return { ok: true, cost, weight: entry.item.weight };
  }

  function customerDone() {
    return state.customer ? !hasPending(state.customer.entries) : true;
  }

  function itemsToWeigh() {
    return state.customer ? pendingWeigh(state.customer.entries) : [];
  }

  /* ---------------- 夜间 ---------------- */

  /** 收摊进入夜间（打发门口的顾客） */
  function enterNight() {
    if (state.phase === 'night') return { ok: false, reason: 'phase' };
    if (state.customer) {
      const s = summarize(state.customer.entries);
      log('log.closeUp', { $cust: { idx: state.customer.nameIdx }, a: s.dealt, b: s.left });
      state.customer = null;
    }
    state.phase = 'night';
    notify();
    return { ok: true };
  }

  /** 白天继续收货（夜间面板里的「回白天」） */
  function backToDay() {
    if (state.phase !== 'night') return { ok: false, reason: 'phase' };
    state.phase = 'day';
    notify();
    return { ok: true };
  }

  function canScavenge() {
    return state.phase === 'night' && state.night.used < CONFIG.SCAVENGE.perNight;
  }

  /**
   * 翻垃圾桶：产出入库，风险扣钱。每晚 CONFIG.SCAVENGE.perNight 次。
   * @returns {{ok:boolean, result?:object, reason?:string}}
   */
  function scavenge(spotKey) {
    if (state.phase !== 'night') return { ok: false, reason: 'phase' };
    if (state.night.used >= CONFIG.SCAVENGE.perNight) return { ok: false, reason: 'limit' };
    const plan = planScavenge(spotKey);
    if (!plan) return { ok: false, reason: 'spot' };

    state.night.used += 1;
    state.stats.scavenged += 1;
    const spotName = t(`night.spot.${plan.spot}`);
    const result = Object.assign({}, plan);

    if (plan.kind === 'mat') {
      state.materials[plan.mat] = round((state.materials[plan.mat] || 0) + plan.qty, 2);
      log('log.scavenge', {
        $spot: plan.spot, text: t('night.result.mat', { $mat: plan.mat, w: fmtWeight(plan.qty) }),
        _key: 'night.result.mat', _params: { $mat: plan.mat, w: plan.qty }
      }, 'good');
    } else if (plan.kind === 'part') {
      state.parts[plan.part] = (state.parts[plan.part] || 0) + plan.count;
      state.stats.partsFound += plan.count;
      log('log.scavenge', {
        $spot: plan.spot, text: t('night.result.part', { $part: plan.part, n: plan.count }),
        _key: 'night.result.part', _params: { $part: plan.part, n: plan.count }
      }, partTier(plan.part) === 'valuable' ? 'gold' : 'good');
    } else if (plan.kind === 'cash') {
      state.cash = round(state.cash + plan.cash, CONFIG.DECIMALS.money);
      state.stats.earned = round(state.stats.earned + plan.cash, CONFIG.DECIMALS.money);
      log('log.scavenge', {
        $spot: plan.spot, text: t('night.result.cash', { v: mTxt(plan.cash) }),
        _key: 'night.result.cash', _params: { v: mTxt(plan.cash) }
      }, 'gold');
    } else if (plan.kind === 'item') {
      const item = makeScavengedItem(state.market.matPrices);
      state.workbench.push(item);
      result.item = item;
      log('log.scavenge', {
        $spot: plan.spot, text: t('night.result.item', { $item: itemRef(item) }),
        _key: 'night.result.item', _params: { $item: itemRef(item) }
      }, 'gold');
    } else {
      log('log.scavenge', {
        $spot: plan.spot, text: t(`night.result.${plan.flavor || 'empty'}`),
        _key: `night.result.${plan.flavor || 'empty'}`, _params: {}
      }, '');
    }

    if (plan.risk) {
      const pay = Math.min(plan.risk.cost, state.cash);
      state.cash = round(state.cash - pay, CONFIG.DECIMALS.money);
      state.stats.spent = round(state.stats.spent + pay, CONFIG.DECIMALS.money);
      result.paid = pay;
      log('log.scavenge', {
        $spot: plan.spot,
        text: t(plan.risk.kind === 'hurt' ? 'night.result.hurt' : 'night.result.fine', { v: mTxt(pay) }),
        _key: plan.risk.kind === 'hurt' ? 'night.result.hurt' : 'night.result.fine',
        _params: { v: mTxt(pay) }
      }, 'bad');
    }

    state.night.lastResult = result;
    notify();
    return { ok: true, result };
  }

  /* ---------------- 收摊过夜 ---------------- */

  /**
   * 一天结束：刷新市价 → 期货结算 → 定期到期 → 活期计息 → 贷款计息 → 进入第二天。
   * @returns {{ok:true, report:object}} report 供 UI 弹结算面板
   */
  function endDay() {
    const report = {
      day: state.day, nextDay: state.day + 1,
      demand: 0, matured: [], futures: [], interest: 0, rolled: 0, prices: {}
    };

    // 门口还有人：直接打发走
    if (state.customer) {
      const s = summarize(state.customer.entries);
      log('log.closeUp', { $cust: { idx: state.customer.nameIdx }, a: s.dealt, b: s.left });
      state.customer = null;
    }

    // 1. 刷新材料市价（按天漂移）
    const before = state.market.matPrices;
    state.day += 1;
    state.market = rollDailyMarket(state.market, state.day);
    for (const item of state.workbench) refreshMatValue(item, state.market.matPrices);
    for (const key of Object.keys(state.market.matPrices)) {
      report.prices[key] = { from: before[key] ?? 0, to: state.market.matPrices[key] };
    }

    // 2. 期货结算（隔夜即到期）
    for (const dep of state.finance.deposits.filter(d => d.kind === 'futures')) {
      const r = settleFutures(dep, state.market.matPrices[dep.mat] ?? 0);
      state.cash = round(state.cash + r.payout, CONFIG.DECIMALS.money);
      state.stats.earned = round(state.stats.earned + r.payout, CONFIG.DECIMALS.money);
      report.futures.push({ dep, result: r });
      const move = `${r.change >= 0 ? '+' : ''}${(r.change * 100).toFixed(1)}%`;
      const outcome = r.draw ? t('eod.draw') : (r.win ? t('eod.win') : t('eod.lose'));
      log('log.futures', {
        $mat: dep.mat, dir: dep.dir,
        outcome, move, v: mTxt(r.payout)
      }, r.win ? 'gold' : (r.draw ? '' : 'bad'));
    }
    state.finance.deposits = state.finance.deposits.filter(d => d.kind !== 'futures');

    // 3. 定期：计持有天数，到期自动本息到账
    for (const dep of state.finance.deposits.filter(d => d.kind === 'fixed')) {
      dep.daysHeld = (dep.daysHeld || 0) + 1;
      if (dep.daysHeld >= CONFIG.FINANCE.fixed.lockDays) {
        const payout = fixedMaturity(dep.principal);
        state.cash = round(state.cash + payout, CONFIG.DECIMALS.money);
        state.stats.earned = round(state.stats.earned + payout, CONFIG.DECIMALS.money);
        report.matured.push({ dep, payout });
        log('log.fixedMature', { v: mTxt(payout) }, 'good');
      }
    }
    state.finance.deposits = state.finance.deposits.filter(
      d => !(d.kind === 'fixed' && (d.daysHeld || 0) >= CONFIG.FINANCE.fixed.lockDays)
    );

    // 4. 活期利息
    const di = demandInterest(state.finance.demand);
    if (di > 0) {
      state.finance.demand = round(state.finance.demand + di, CONFIG.DECIMALS.money);
      state.stats.earned = round(state.stats.earned + di, CONFIG.DECIMALS.money);
      report.demand = di;
      log('log.demandInterest', { v: mTxt(di), b: mTxt(state.finance.demand) }, 'good');
    }

    // 5. 贷款利息（温和模式：不催收，现金不够就滚进本金）
    const interest = dailyInterest(state.loan.principal);
    if (interest > 0) {
      if (state.cash >= interest) {
        state.cash = round(state.cash - interest, CONFIG.DECIMALS.money);
        state.stats.spent = round(state.stats.spent + interest, CONFIG.DECIMALS.money);
        state.loan.interestPaid = round(state.loan.interestPaid + interest, CONFIG.DECIMALS.money);
        report.interest = interest;
        log('log.loanInterest', { v: mTxt(interest) }, 'warn');
      } else {
        state.loan.principal = round(state.loan.principal + interest, CONFIG.DECIMALS.money);
        report.rolled = interest;
        log('log.loanRolled', { v: mTxt(interest), b: mTxt(state.loan.principal) }, 'bad');
      }
    }

    // 6. 新的一天
    state.dayCustomers = 0;
    state.phase = 'day';
    state.night = { used: 0, lastResult: null };
    log('log.newDay', { d: state.day }, '');
    notify();
    return { ok: true, report };
  }

  /* ---------------- 修理 ---------------- */

  function findItem(itemId) {
    return state.workbench.find(i => i.id === itemId) || null;
  }

  /**
   * 直接外购某件缺失零件：扣现金、入库，之后重算修理方案即可抵扣。
   */
  function buyMissingPart(itemId, index) {
    const item = findItem(itemId);
    if (!item || item.state !== 'pending') return { ok: false, reason: 'state' };
    const mp = item.missing[index];
    if (!mp) return { ok: false, reason: 'part' };
    const cost = partBuyPrice(mp.key);
    if (cost > state.cash) {
      log('log.buyPartCash', { $part: mp.key, v: mTxt(cost - state.cash) }, 'bad');
      notify();
      return { ok: false, reason: 'cash', key: mp.key, need: cost };
    }
    state.cash = round(state.cash - cost, CONFIG.DECIMALS.money);
    state.stats.spent = round(state.stats.spent + cost, CONFIG.DECIMALS.money);
    state.parts[mp.key] = (state.parts[mp.key] || 0) + 1;
    state.stats.partsFound += 1;
    log('log.buyPart', { $part: mp.key, v: mTxt(cost) }, '');
    notify();
    return { ok: true, key: mp.key, cost };
  }

  function repairPlan(itemId) {
    const item = findItem(itemId);
    if (!item || item.state !== 'pending') return null;
    return planRepair(item, state);
  }

  /** 开始修理：扣钱、置为修理中，返回耗时（ms） */
  function startRepair(itemId) {
    const item = findItem(itemId);
    if (!item || item.state !== 'pending') return { ok: false, reason: 'state' };
    const plan = planRepair(item, state);
    if (plan.total > state.cash) {
      log('log.repairCash', { $item: itemRef(item), v: mTxt(plan.total) }, 'bad');
      notify();
      return { ok: false, reason: 'cash', need: plan.total };
    }
    state.cash = round(state.cash - plan.total, CONFIG.DECIMALS.money);
    state.stats.spent = round(state.stats.spent + plan.total, CONFIG.DECIMALS.money);
    item.state = 'repairing';
    item.lastPlan = {
      baseCost: plan.baseCost, partCost: plan.partCost, total: plan.total,
      rate: plan.rate, parts: plan.parts.map(p => ({ key: p.key, fromStock: p.fromStock }))
    };
    log('log.repairStart', { $item: itemRef(item), v: mTxt(plan.total), r: pctTxt(plan.rate) });
    notify();
    return { ok: true, duration: repairDuration(), plan };
  }

  /** 修理结算（由 UI 在耗时结束后调用） */
  function finishRepair(itemId) {
    const item = findItem(itemId);
    if (!item || item.state !== 'repairing' || !item.lastPlan) return { ok: false };
    const plan = {
      baseCost: item.lastPlan.baseCost,
      partCost: item.lastPlan.partCost,
      total: item.lastPlan.total,
      rate: item.lastPlan.rate,
      parts: item.lastPlan.parts.map(p => ({ key: p.key, name: partName(p.key), fromStock: p.fromStock, cost: 0 }))
    };
    const r = resolveRepair(item, plan, state);
    if (r.success) {
      state.stats.repaired += 1;
      if (item.isAntique) {
        state.stats.antiqueFound += 1;
        log('log.repairAntique', { $item: itemRef(item), v: mTxt(r.value) }, 'gold');
      } else {
        log('log.repairOk', { $item: itemRef(item), v: mTxt(r.value) }, 'good');
      }
    } else {
      state.stats.broken += 1;
      const lost = r.lostParts && r.lostParts.length
        ? t('log.repairFailLost', { list: r.lostParts.map(partName).join(getLang() === 'en' ? ', ' : '、') })
        : '';
      log('log.repairFail', { $item: itemRef(item), lost }, 'bad');
    }
    notify();
    return { ok: true, result: r, item };
  }

  /* ---------------- 拆解 ---------------- */

  function dismantle(itemId) {
    const item = findItem(itemId);
    if (!item) return { ok: false };
    if (item.state === 'repaired') return { ok: false, reason: 'repaired' };
    const r = dismantleStep(state, item);
    if (!r.ok) return { ok: false, reason: 'done' };
    const step = t('dismantle.step', {
      mat: matName(r.mat), w: fmtWeight(r.qty), p: unitPriceTxt(r.price), v: mTxt(r.value)
    });
    log('log.dismantleStep', {
      $item: itemRef(item), text: step,
      _key: 'dismantle.step', _params: { $mat: r.mat, w: r.qty, p: r.price, v: mTxt(r.value) }
    }, '');
      if (r.finished) {
      state.workbench = state.workbench.filter(i => i.id !== item.id);
      state.stats.dismantled += 1;
      if (r.dropped && r.dropped.length) {
        for (const key of r.dropped) {
          state.parts[key] = (state.parts[key] || 0) + 1;
          state.stats.partsFound += 1;
          const tier = partTier(key);
          log('log.partDrop', { $part: key, tag: tier === 'valuable' },
            tier === 'valuable' ? 'gold' : 'good');
        }
      }
      // 特殊商品：拆开可能藏钱
      if (item.hasCash) {
        state.cash = round(state.cash + item.hiddenCash, CONFIG.DECIMALS.money);
        state.stats.earned = round(state.stats.earned + item.hiddenCash, CONFIG.DECIMALS.money);
        log('log.specialCash', { $item: itemRef(item), v: mTxt(item.hiddenCash) }, 'gold');
      }
      log('log.dismantleDoneItem', { $item: itemRef(item) }, '');
    }
    notify();
    return { ok: true, result: r, step };
  }

  /* ---------------- 变现 ---------------- */

  function sellItem(itemId) {
    const item = findItem(itemId);
    if (!item || item.state !== 'repaired') return { ok: false };
    const value = item.revealedValue;
    state.cash = round(state.cash + value, CONFIG.DECIMALS.money);
    state.stats.earned = round(state.stats.earned + value, CONFIG.DECIMALS.money);
    state.workbench = state.workbench.filter(i => i.id !== item.id);
    log('log.sellItem', { $item: itemRef(item), v: mTxt(value) }, 'good');
    notify();
    return { ok: true, value };
  }

  /** 卖材料：手动输入斤数 */
  function sellMaterial(key, qtyLb) {
    const have = state.materials[key] || 0;
    const qty = round(Number(qtyLb), 2);
    if (!(qty > 0) || qty > have + 1e-6) return { ok: false, reason: 'qty', have };
    const price = state.market.matPrices[key] ?? 0;
    const value = round(qty * price, CONFIG.DECIMALS.money);
    const left = round(have - qty, 2);
    if (left <= 0.0001) delete state.materials[key];
    else state.materials[key] = left;
    state.cash = round(state.cash + value, CONFIG.DECIMALS.money);
    state.stats.earned = round(state.stats.earned + value, CONFIG.DECIMALS.money);
    log('log.sellMat', { $mat: key, w: qty, p: price, v: mTxt(value) }, 'good');
    notify();
    return { ok: true, value };
  }

  /** 卖零件（贵重件留着修东西更划算） */
  function sellPart(key, qty = 1) {
    const have = state.parts[key] || 0;
    const n = Math.min(Math.floor(Number(qty) || 0), have);
    if (n <= 0) return { ok: false, reason: 'qty', have };
    const unit = partSellPrice(key);
    const value = round(n * unit, CONFIG.DECIMALS.money);
    const left = have - n;
    if (left <= 0) delete state.parts[key];
    else state.parts[key] = left;
    state.cash = round(state.cash + value, CONFIG.DECIMALS.money);
    state.stats.earned = round(state.stats.earned + value, CONFIG.DECIMALS.money);
    log('log.sellPart', { $part: key, n, v: mTxt(value) }, '');
    notify();
    return { ok: true, value };
  }

  /* ---------------- 钱庄：理财 ---------------- */

  /** 活期存入 */
  function deposit(amount) {
    const amt = round(Number(amount), CONFIG.DECIMALS.money);
    if (!(amt > 0)) return { ok: false, reason: 'amount' };
    if (amt > state.cash) return { ok: false, reason: 'cash', need: amt };
    state.cash = round(state.cash - amt, CONFIG.DECIMALS.money);
    state.finance.demand = round(state.finance.demand + amt, CONFIG.DECIMALS.money);
    log('log.demandDeposit', { v: mTxt(amt), b: mTxt(state.finance.demand) }, '');
    notify();
    return { ok: true, amount: amt };
  }

  /** 活期取出 */
  function withdraw(amount) {
    const amt = round(Number(amount), CONFIG.DECIMALS.money);
    const have = state.finance.demand;
    if (!(amt > 0) || amt > have + 1e-6) return { ok: false, reason: 'qty', have };
    state.finance.demand = round(have - amt, CONFIG.DECIMALS.money);
    state.cash = round(state.cash + amt, CONFIG.DECIMALS.money);
    log('log.demandWithdraw', { v: mTxt(amt), b: mTxt(state.finance.demand) }, '');
    notify();
    return { ok: true, amount: amt };
  }

  /** 买入七天定期 */
  function openFixed(amount) {
    const amt = round(Number(amount), CONFIG.DECIMALS.money);
    const min = CONFIG.FINANCE.fixed.minAmount;
    if (!(amt >= min)) return { ok: false, reason: 'min', need: min };
    if (amt > state.cash) return { ok: false, reason: 'cash', need: amt };
    state.cash = round(state.cash - amt, CONFIG.DECIMALS.money);
    const dep = {
      id: `f${state.finance.seq++}`, kind: 'fixed', principal: amt,
      startDay: state.day, dueDay: dueDayOf(state.day, 'fixed'), daysHeld: 0
    };
    state.finance.deposits.push(dep);
    log('log.fixedOpen', { v: mTxt(amt), d: dep.dueDay, m: mTxt(fixedMaturity(amt)) }, 'gold');
    notify();
    return { ok: true, dep };
  }

  /** 提前支取定期：按活期利率计已存天数，扣本金 1% */
  function breakFixed(depId) {
    const dep = state.finance.deposits.find(d => d.id === depId);
    if (!dep || dep.kind !== 'fixed') return { ok: false, reason: 'none' };
    const payout = fixedEarlyPayout(dep);
    state.cash = round(state.cash + payout, CONFIG.DECIMALS.money);
    state.finance.deposits = state.finance.deposits.filter(d => d.id !== depId);
    log('log.fixedBreak', { v: mTxt(dep.principal), d: dep.daysHeld, p: mTxt(payout) }, 'warn');
    notify();
    return { ok: true, payout };
  }

  /** 押期货：dir = 'up' 看涨 / 'down' 看跌，隔夜结算 */
  function openFutures(matKey, dir, amount) {
    const amt = round(Number(amount), CONFIG.DECIMALS.money);
    const min = CONFIG.FINANCE.futures.minAmount;
    if (dir !== 'up' && dir !== 'down') return { ok: false, reason: 'dir' };
    if (!(matKey in CONFIG.MAT_PRICE)) return { ok: false, reason: 'mat' };
    if (!(amt >= min)) return { ok: false, reason: 'min', need: min };
    if (amt > state.cash) return { ok: false, reason: 'cash', need: amt };
    state.cash = round(state.cash - amt, CONFIG.DECIMALS.money);
    const openPrice = state.market.matPrices[matKey] ?? 0;
    const dep = {
      id: `f${state.finance.seq++}`, kind: 'futures', principal: amt,
      mat: matKey, dir, openPrice,
      startDay: state.day, dueDay: state.day + CONFIG.FINANCE.futures.lockDays, daysHeld: 0
    };
    state.finance.deposits.push(dep);
    log('log.futuresOpen', {
      $mat: matKey, dir,
      v: mTxt(amt), p: openPrice
    }, 'warn');
    notify();
    return { ok: true, dep };
  }

  /* ---------------- 钱庄：贷款 ---------------- */

  function borrow(amount) {
    const amt = round(Number(amount), CONFIG.DECIMALS.money);
    const limit = loanLimit(netWorth(), state.loan.principal);
    if (!(amt >= CONFIG.LOAN.minBorrow)) return { ok: false, reason: 'min', need: CONFIG.LOAN.minBorrow };
    if (amt > limit) return { ok: false, reason: 'limit', limit };
    state.loan.principal = round(state.loan.principal + amt, CONFIG.DECIMALS.money);
    state.loan.borrowed = round(state.loan.borrowed + amt, CONFIG.DECIMALS.money);
    state.cash = round(state.cash + amt, CONFIG.DECIMALS.money);
    log('log.borrow', { v: mTxt(amt), r: (CONFIG.LOAN.dailyRate * 100).toFixed(1), b: mTxt(state.loan.principal) }, 'warn');
    notify();
    return { ok: true, amount: amt };
  }

  function repay(amount) {
    const amt = round(Number(amount), CONFIG.DECIMALS.money);
    const pay = Math.min(amt, state.loan.principal);
    if (!(pay > 0)) return { ok: false, reason: 'none' };
    if (pay > state.cash) return { ok: false, reason: 'cash', need: pay };
    state.cash = round(state.cash - pay, CONFIG.DECIMALS.money);
    state.loan.principal = round(state.loan.principal - pay, CONFIG.DECIMALS.money);
    log('log.repay', { v: mTxt(pay), b: mTxt(state.loan.principal) }, 'good');
    notify();
    return { ok: true, amount: pay };
  }

  /* ---------------- 工具 ---------------- */

  function upgradeTool() {
    const cur = state.toolLevel;
    const next = CONFIG.TOOL_TABLE.find(t => t.lv === cur + 1);
    if (!next) return { ok: false, reason: 'max' };
    if (state.cash < next.price) {
      log('log.upgradeCash', { name: toolName(next.lv), v: mTxt(next.price, 0) }, 'bad');
      notify();
      return { ok: false, reason: 'cash', need: next.price };
    }
    state.cash = round(state.cash - next.price, CONFIG.DECIMALS.money);
    state.stats.spent = round(state.stats.spent + next.price, CONFIG.DECIMALS.money);
    state.toolLevel = next.lv;
    log('log.upgradeOk', { name: toolName(next.lv), lv: next.lv, r: pctTxt(next.rate) }, 'gold');
    notify();
    return { ok: true, tool: next };
  }

  /* ---------------- 其它 ---------------- */

  function restart() {
    clearState(slotId);
    state = createFreshState();
    log('log.restart', { v: mTxt(CONFIG.START_CASH, 0) }, '');
    notify();
    return { ok: true };
  }

  /** 新手教程看完后落档，下次读档不再弹出 */
  function markTutorialSeen() {
    state.tutorialSeen = true;
    notify();
    return { ok: true };
  }

  /** 库存总估值（现金 + 活期 + 在持本金 + 材料 + 零件 + 已修复待售 - 欠款） */
  function netWorth() {
    let mat = 0;
    for (const [key, qty] of Object.entries(state.materials)) {
      mat += qty * (state.market.matPrices[key] ?? 0);
    }
    let part = 0;
    for (const [key, qty] of Object.entries(state.parts)) {
      part += qty * partSellPrice(key);
    }
    let fixed = 0;
    for (const item of state.workbench) {
      if (item.state === 'repaired') fixed += item.revealedValue;
      else fixed += materialValue(item.materials, state.market.matPrices) * item.salvageFactor;
    }
    const total = state.cash + financeAssets(state.finance) + mat + part + fixed
      - state.loan.principal;
    return round(total, CONFIG.DECIMALS.money);
  }

  return {
    get state() { return state; },
    notify,
    actions: {
      nextCustomer, offer, accept, reject, weigh, customerDone, itemsToWeigh,
      repairPlan, startRepair, finishRepair, buyMissingPart,
      dismantle, sellItem, sellMaterial, sellPart,
      enterNight, backToDay, canScavenge, scavenge, endDay,
      deposit, withdraw, openFixed, breakFixed, openFutures, borrow, repay,
      upgradeTool, restart, markTutorialSeen,
      netWorth, toolRate, loanLimit: () => loanLimit(netWorth(), state.loan.principal),
      dailyInterest: () => dailyInterest(state.loan.principal),
      findItem, findEntry,
      dismantleProgress,
      conditionLabel: (c) => condLabel(c),
      tierLabel: (tier) => tierLabel(tier)
    }
  };
}
