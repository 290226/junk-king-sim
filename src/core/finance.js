/**
 * 钱庄 —— 理财与贷款的纯计算（不碰 gameState，只算数、返回结果）。
 * 全部系数来自 CONFIG.FINANCE / CONFIG.LOAN。
 */
import { CONFIG } from '../config.js';
import { round, clamp } from './rng.js';

const D = CONFIG.DECIMALS.money;

/** 活期账户 + 持仓（定期/期货） */
export function freshFinance() {
  return { demand: 0, deposits: [], seq: 1 };
}

/** 贷款账：温和模式，没有到期日、不催收，现金不够付利息就滚进本金 */
export function freshLoan() {
  return { principal: 0, interestPaid: 0, borrowed: 0 };
}

/* ---------------- 理财 ---------------- */

/** 活期日息 */
export function demandInterest(balance) {
  return round(Math.max(0, balance) * CONFIG.FINANCE.demand.dailyRate, D);
}

/** 定期到期本息（按期存满 lockDays 天） */
export function fixedMaturity(principal) {
  return round(principal * (1 + CONFIG.FINANCE.fixed.dailyRate * CONFIG.FINANCE.fixed.lockDays), D);
}

/** 定期提前支取：按活期利率计已存天数，再扣本金 × earlyPenalty */
export function fixedEarlyPayout(dep) {
  const gross = dep.principal * (1 + CONFIG.FINANCE.demand.dailyRate * (dep.daysHeld || 0));
  return round(Math.max(0, gross - dep.principal * CONFIG.FINANCE.fixed.earlyPenalty), D);
}

/**
 * 期货隔夜结算：押对方向按涨跌幅 × 杠杆赚，押错按同样幅度亏。
 * @returns {{win:boolean, draw:boolean, change:number, openPrice:number, settlePrice:number, gross:number, fee:number, payout:number}}
 */
export function settleFutures(dep, settlePrice) {
  const f = CONFIG.FINANCE.futures;
  const open = dep.openPrice || settlePrice;
  const change = open > 0 ? (settlePrice - open) / open : 0;
  const dir = dep.dir === 'up' ? 1 : -1;
  const mag = Math.abs(change) * f.leverage;
  const fee = round(dep.principal * f.fee, D);

  let win = false, draw = false, gross;
  if (Math.abs(change) < f.drawBand) {
    draw = true;
    gross = dep.principal;                                   // 纹丝不动：退本金
  } else if (change * dir > 0) {
    win = true;
    gross = dep.principal * (1 + clamp(mag, f.winFloor, f.winCap));
  } else {
    gross = dep.principal * Math.max(f.loseFloor, 1 - mag);
  }
  const g = round(gross, D);
  return { win, draw, change, openPrice: open, settlePrice, gross: g, fee, payout: round(Math.max(0, g - fee), D) };
}

/** 持仓到期日 */
export function dueDayOf(startDay, kind) {
  return startDay + (kind === 'fixed' ? CONFIG.FINANCE.fixed.lockDays : CONFIG.FINANCE.futures.lockDays);
}

/** 理财占用的总资金（活期 + 在持本金），用于身家统计 */
export function financeAssets(fin) {
  let sum = fin.demand || 0;
  for (const d of fin.deposits || []) sum += d.principal;
  return round(sum, D);
}

/* ---------------- 贷款 ---------------- */

/** 剩余可借额度 = 基础额度 + 身家 × 系数 - 未还本金 */
export function loanLimit(netWorth, principal) {
  const cap = CONFIG.LOAN.baseLimit + Math.max(0, netWorth) * CONFIG.LOAN.worthRatio;
  return round(Math.max(0, cap - principal), D);
}

/** 每天应付利息 */
export function dailyInterest(principal) {
  return round(Math.max(0, principal) * CONFIG.LOAN.dailyRate, D);
}
