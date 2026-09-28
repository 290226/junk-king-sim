/** 侧栏渲染：行情 / 材料仓库 / 零件架 / 工具树 / 流水账，以及顶部状态栏与天数条 */
import { CONFIG } from '../config.js';
import { MATERIALS, baseMatPrice, matName, matColor } from '../data/materials.js';
import { MAT_ICON } from './pixel.js';
import { PARTS, partName, tierLabel } from '../data/parts.js';
import { itemName } from '../data/items.js';
import { customerName } from '../data/names.js';
import { getLang } from '../i18n/index.js';
import { toolName, toolPerk, finName } from '../data/labels.js';
import { partSellPrice } from '../core/economy.js';
import { financeAssets, demandInterest, fixedMaturity, fixedEarlyPayout, loanLimit, dailyInterest } from '../core/finance.js';
import { money, esc, pct, weight as fmtWeight, unitPrice } from './dom.js';
import { icon } from './icons.js';
import { PART_ICON } from './pixel.js';
import { t } from '../i18n/index.js';

/* ---------------- 顶部状态栏 ---------------- */
export function renderTop(state, actions) {
  const box = document.getElementById('stats');
  if (!box) return;
  const worth = actions.netWorth();
  const st = state.stats;
  const tool = CONFIG.TOOL_TABLE.find(t => t.lv === state.toolLevel) || CONFIG.TOOL_TABLE[0];
  box.innerHTML = `
    <div class="stat cash"><span class="k">${esc(t('top.cash'))}</span><b>${money(state.cash)}</b></div>
    <div class="stat goods"><span class="k">${esc(t('top.worth'))}</span><b>${money(worth)}</b></div>
    <div class="stat tool"><span class="k">${esc(t('top.tool'))}</span><b>Lv${state.toolLevel}</b></div>
    <div class="stat"><span class="k">${esc(t('top.dealsLost'))}</span><b>${st.deals} / ${st.lost}</b></div>
    <div class="stat"><span class="k">${esc(t('top.repairedBroken'))}</span><b>${st.repaired} / ${st.broken}</b></div>
    <div class="stat"><span class="k">${esc(toolName(state.toolLevel))}</span><b>${pct(tool.rate)}</b></div>
  `;
  const logo = document.getElementById('brand-logo');
  if (logo && !logo.dataset.filled) {
    logo.innerHTML = icon('brand');
    logo.dataset.filled = '1';
  }
}

/* ---------------- 行情 ---------------- */
export function renderMarket(state) {
  const body = document.getElementById('market-body');
  if (!body) return;
  const p = state.market.matPrices;
  body.innerHTML = MATERIALS.map(m => {
    const cur = p[m.key] ?? baseMatPrice(m.key);
    const base = baseMatPrice(m.key);
    const diff = cur - base;
    const up = diff > 0.001;
    const down = diff < -0.001;
    const cls = up ? 'bad' : (down ? 'ok' : 'dim');
    const mark = up ? '▲' : (down ? '▼' : '—');
    return `<div class="row" style="justify-content:space-between">
      <span><i class="dot" style="background:${matColor(m.key)};display:inline-block;margin-right:6px"></i>${esc(matName(m.key))}</span>
      <span class="num ${cls}">${unitPrice(cur)} ${mark}</span>
    </div>`;
  }).join('') +
    (CONFIG.INTRADAY_SWING > 0
      ? `<div class="dim" style="font-size:11px">${esc(t('market.intraday', {
        a: Math.round(CONFIG.INTRADAY_SWING * 100), b: Math.round(CONFIG.DAILY_PRICE_SWING * 100)
      }))}</div>`
      : `<div class="dim" style="font-size:11px">${esc(t('market.daily', {
        b: Math.round(CONFIG.DAILY_PRICE_SWING * 100), d: state.day
      }))}</div>`);
}

/* ---------------- 天数条 ---------------- */
export function renderDay(state) {
  const chip = document.getElementById('day-chip');
  const slots = document.getElementById('day-slots');
  const hint = document.getElementById('day-hint');
  const limit = CONFIG.DAY_CUSTOMER_LIMIT;
  const used = Math.min(state.dayCustomers, limit);
  const left = Math.max(0, limit - used);
  if (chip) chip.textContent = t('day.label', { n: state.day });
  if (slots) {
    slots.innerHTML = Array.from({ length: limit },
      (_, i) => `<i class="slot${i < used ? ' used' : ''}"></i>`).join('') +
      `<span class="dim" style="font-size:11.5px;margin-left:6px">${esc(t('day.batches', { a: used, b: limit }))}</span>`;
  }
  if (hint) hint.textContent = left > 0 ? t('day.left', { n: left }) : t('day.done');
  // 顶部按钮随阶段切换：白天「进入夜间」，夜里「睡觉到天亮」
  const btn = document.getElementById('btn-phase');
  if (btn) {
    if (state.phase === 'night') {
      btn.dataset.act = 'end-day';
      btn.textContent = t('night.backToDay');
      btn.classList.remove('urge');
    } else {
      btn.dataset.act = 'enter-night';
      btn.textContent = t('day.end');
      btn.classList.toggle('urge', left === 0);
    }
  }
}

/* ---------------- 钱庄 ---------------- */
export function renderFinance(state, ui, actions) {
  const body = document.getElementById('finance-body');
  const sub = document.getElementById('finance-sub');
  if (!body) return;
  const F = CONFIG.FINANCE;
  const fin = state.finance;
  const loan = state.loan;
  const fixedList = fin.deposits.filter(d => d.kind === 'fixed');
  const futList = fin.deposits.filter(d => d.kind === 'futures');
  const limit = loanLimit(actions.netWorth(), loan.principal);
  const tomorrowInterest = dailyInterest(loan.principal);

  if (sub) sub.textContent = t('fin.assets', { v: money(financeAssets(fin)) });

  const draft = (k) => esc(ui.fin[k] ?? '');
  const numInput = (k, ph) => `<input type="number" step="10" min="0" placeholder="${esc(ph)}" value="${draft(k)}" data-act="fin-input" data-k="${k}">`;

  /* 活期 */
  const demandGain = demandInterest(fin.demand);
  const demand = `<div class="fin-block">
    <div class="fin-head">
      <span class="fin-name">${esc(finName('demand'))}</span>
      <span class="tag ok">${esc(t('fin.dailyRate', { r: (F.demand.dailyRate * 100).toFixed(1) }))}</span>
      <span class="spacer"></span>
      <b class="num">${money(fin.demand)}</b>
    </div>
    <div class="fin-note">${esc(t('fin.demandNote', { v: money(demandGain) }))}</div>
    <div class="fin-row">${numInput('demand', t('fin.phAmount'))}
      <button class="btn sm" data-act="fin-deposit">${esc(t('fin.deposit'))}</button>
      <button class="btn sm ghost" data-act="fin-withdraw">${esc(t('fin.withdraw'))}</button>
    </div>
  </div>`;

  /* 定期 */
  const fixedRows = fixedList.length
    ? fixedList.map(d => `<div class="fin-row dep">
        <span class="num">${money(d.principal)}</span>
        <span class="tag info">${esc(t('fin.fixedDay', { a: (d.daysHeld || 0) + 1, b: F.fixed.lockDays }))}</span>
        <span class="dim">${esc(t('fin.fixedMaturity', { v: money(fixedMaturity(d.principal)) }))}</span>
        <span class="spacer"></span>
        <button class="btn sm ghost" data-act="fin-break" data-id="${esc(d.id)}">${esc(t('fin.break'))}</button>
      </div>`).join('')
    : `<div class="fin-note dim">${esc(t('fin.noFixed'))}</div>`;
  const fixed = `<div class="fin-block">
    <div class="fin-head">
      <span class="fin-name">${esc(finName('fixed'))}</span>
      <span class="tag gold">${esc(t('fin.dailyRate', { r: (F.fixed.dailyRate * 100).toFixed(1) }))}</span>
    </div>
    <div class="fin-note">${esc(t('fin.fixedNote', { d: F.fixed.lockDays, p: Math.round(F.fixed.earlyPenalty * 100) }))}</div>
    <div class="fin-row">${numInput('fixed', t('fin.minFrom', { n: F.fixed.minAmount }))}
      <button class="btn sm" data-act="fin-open-fixed">${esc(t('fin.buy'))}</button>
    </div>
    ${fixedRows}
  </div>`;

  /* 期货 */
  const futRows = futList.length
    ? futList.map(d => `<div class="fin-row dep">
        <span class="tag ${d.dir === 'up' ? 'ok' : 'bad'}">${esc(d.dir === 'up' ? t('fin.up') : t('fin.down'))}</span>
        <span>${esc(matName(d.mat))}</span>
        <span class="num">${money(d.principal)}</span>
        <span class="dim">${esc(t('fin.futOpen', { p: unitPrice(d.openPrice) }))}</span>
      </div>`).join('')
    : '';
  const futLines = MATERIALS.map(m => {
    const price = state.market.matPrices[m.key] ?? 0;
    return `<div class="fin-row fut">
      <span class="fin-mat"><i class="dot" style="background:${matColor(m.key)}"></i>${esc(matName(m.key))}</span>
      <span class="num">${unitPrice(price)}</span>
      <span class="spacer"></span>
      <button class="btn sm ok" data-act="fin-futures" data-key="${esc(m.key)}" data-dir="up">${esc(t('fin.up'))}</button>
      <button class="btn sm danger" data-act="fin-futures" data-key="${esc(m.key)}" data-dir="down">${esc(t('fin.down'))}</button>
    </div>`;
  }).join('');
  const futures = `<div class="fin-block">
    <div class="fin-head">
      <span class="fin-name">${esc(finName('futures'))}</span>
      <span class="tag warn">${esc(t('fin.futTag'))}</span>
    </div>
    <div class="fin-note">${esc(t('fin.futNote', {
      lev: F.futures.leverage,
      a: Math.round(F.futures.winFloor * 100), b: Math.round(F.futures.winCap * 100),
      c: Math.round(F.futures.loseFloor * 100), f: Math.round(F.futures.fee * 100)
    }))}</div>
    <div class="fin-row">${numInput('futures', t('fin.minFrom', { n: F.futures.minAmount }))}<span class="dim">${esc(t('fin.futHint'))}</span></div>
    ${futLines}
    ${futRows}
  </div>`;

  /* 贷款 */
  const loanBlock = `<div class="fin-block">
    <div class="fin-head">
      <span class="fin-name">${esc(t('fin.loan'))}</span>
      <span class="tag bad">${esc(t('fin.dailyRate', { r: (CONFIG.LOAN.dailyRate * 100).toFixed(1) }))}</span>
      <span class="spacer"></span>
      <b class="num ${loan.principal > 0 ? 'bad' : ''}">${esc(t('fin.owed', { v: money(loan.principal) }))}</b>
    </div>
    <div class="fin-note">${esc(t('fin.loanNote', {
      limit: money(limit), base: money(CONFIG.LOAN.baseLimit, 0), r: CONFIG.LOAN.worthRatio,
      i: money(tomorrowInterest)
    }))}</div>
    <div class="fin-row">${numInput('loan', t('fin.minFrom', { n: CONFIG.LOAN.minBorrow }))}
      <button class="btn sm warn" data-act="loan-borrow">${esc(t('fin.borrow'))}</button>
      <button class="btn sm ghost" data-act="loan-repay">${esc(t('fin.repay'))}</button>
    </div>
  </div>`;

  body.innerHTML = demand + `<div class="hr"></div>` + fixed + `<div class="hr"></div>` + futures + `<div class="hr"></div>` + loanBlock;
}

/* ---------------- 钱庄入口卡（主界面上的摘要 + 进入按钮） ---------------- */
export function renderFinEntry(state) {
  const a = document.getElementById('fin-entry-assets');
  const o = document.getElementById('fin-entry-owed');
  if (a) a.textContent = money(financeAssets(state.finance));
  if (o) {
    o.textContent = money(state.loan.principal);
    o.classList.toggle('bad', state.loan.principal > 0);
  }
}

/* ---------------- 材料仓库 ---------------- */
export function renderStock(state, ui) {
  const body = document.getElementById('stock-body');
  const sub = document.getElementById('stock-sub');
  if (!body) return;
  const keys = Object.keys(state.materials).filter(k => (state.materials[k] || 0) > 0);
  if (!keys.length) {
    sub.textContent = '';
    body.innerHTML = `<div class="empty">${esc(t('stock.empty'))}</div>`;
    return;
  }
  let total = 0;
  for (const k of keys) total += (state.materials[k] || 0) * (state.market.matPrices[k] || 0);
  sub.textContent = t('stock.value', { v: money(total) });

  body.innerHTML = `<div class="mat-list">${keys.map(k => {
    const qty = state.materials[k];
    const price = state.market.matPrices[k] ?? 0;
    const draft = ui.matQty[k] ?? '';
    return `<div class="mat-row">
      <span class="mat-name"><span class="picon">${icon(MAT_ICON[k] || 'crate')}</span><i class="dot" style="background:${matColor(k)}"></i>${esc(matName(k))}</span>
      <span class="num">${fmtWeight(qty)}</span>
      <span class="mat-price">${unitPrice(price)}</span>
      <span class="mat-sell">
        <input type="number" step="0.1" min="0" max="${qty}" placeholder="${esc(t('stock.phLb'))}" value="${esc(draft)}" data-act="mat-input" data-key="${k}">
        <button class="btn sm" data-act="sell-mat" data-key="${k}">${esc(t('stock.sell'))}</button>
        <button class="btn sm ghost" data-act="sell-mat-all" data-key="${k}">${esc(t('stock.all'))}</button>
      </span>
    </div>`;
  }).join('')}</div>`;
}

/* ---------------- 零件架 ---------------- */
export function renderParts(state) {
  const body = document.getElementById('parts-body');
  const sub = document.getElementById('parts-sub');
  if (!body) return;
  const keys = Object.keys(state.parts).filter(k => (state.parts[k] || 0) > 0);
  if (!keys.length) {
    sub.textContent = '';
    body.innerHTML = `<div class="empty">${esc(t('parts.empty'))}</div>`;
    return;
  }
  sub.textContent = t('parts.kinds', { n: keys.length });
  const rows = keys.map(k => {
    const count = state.parts[k];
    const p = PARTS.find(x => x.key === k);
    const tier = p ? tierLabel(p.tier) : tierLabel('common');
    return `<div class="part-row">
      <span class="picon">${icon(PART_ICON[k] || 'gear')}</span>
      <span class="pname">${esc(partName(k))}</span>
      <span class="tag ${tier.cls}">${esc(tier.text)}</span>
      <span class="pcount">×${count}</span>
      <span class="pval">${esc(t('parts.sellPrice', { v: money(partSellPrice(k)) }))}</span>
      <button class="btn sm ghost" data-act="sell-part" data-key="${k}">${esc(t('parts.sellOne'))}</button>
    </div>`;
  }).join('');
  body.innerHTML = `<div class="part-list">${rows}</div>
    <div class="dim" style="font-size:11px">${esc(t('parts.note', { x: CONFIG.PARTS_BUY_MARKUP }))}</div>`;
}

/* ---------------- 工具树 ---------------- */
export function renderTools(state) {
  const body = document.getElementById('tool-body');
  if (!body) return;
  body.innerHTML = `<div class="tool-list">${CONFIG.TOOL_TABLE.map(row => {
    const cur = row.lv === state.toolLevel;
    const owned = row.lv <= state.toolLevel;
    const next = row.lv === state.toolLevel + 1;
    const cls = cur ? 'cur' : (owned ? '' : 'locked');
    const priceLine = owned
      ? (row.price ? `<span class="tag ok">${esc(t('tool.owned'))}</span>` : `<span class="tag">${esc(t('tool.initial'))}</span>`)
      : `<span class="price">${money(row.price, 0)}</span>`;
    const btn = next
      ? `<button class="btn sm primary" data-act="upgrade" ${state.cash >= row.price ? '' : 'disabled'}>${esc(t('tool.upgrade'))}</button>`
      : '';
    return `<div class="tool-row ${cls}">
      <div class="top">
        <span class="lv">Lv${row.lv}</span>
        <span class="tname">${esc(toolName(row.lv))}</span>
        <span class="rate">${pct(row.rate)}</span>
        <span class="spacer"></span>
        ${priceLine}
      </div>
      ${toolPerk(row.lv) ? `<div class="perk">${esc(toolPerk(row.lv))}</div>` : ''}
      ${btn ? `<div class="row">${btn}${state.cash >= row.price ? '' : `<span class="dim" style="font-size:11.5px">${esc(t('tool.cashShort'))}</span>`}</div>` : ''}
    </div>`;
  }).join('')}</div>`;
}

/* ---------------- 流水账 ---------------- */

/** 把日志参数里的 $mat / $part 数据 key 换成当前语言的名称 */
function resolveParams(params) {
  if (!params) return null;
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    if (k === '$mat') out.$mat = matName(v);
    else if (k === '$part') out.$part = partName(v);
    else if (k === '$item') out.$item = itemName(v);
    else if (k === '$cust') out.$cust = customerName(v.idx);
    else if (k === '$spot') out.$spot = t(`night.spot.${v}`);
    else if (k === '$dir') out.$dir = v === 'up' ? t('fin.up') : t('fin.down');
    else if (k === '$lost' && Array.isArray(v)) {
      out.$lost = t('log.repairFailLost', { list: v.map(partName).join(getLang() === 'en' ? ', ' : '、') });
    }
    else if (k === 'tag' && typeof v === 'boolean') out.tag = v ? t('log.partValuable') : '';
    else if (k === 'w' && typeof v === 'number') out.w = fmtWeight(v);
    else if (k === 'p' && typeof v === 'number') out.p = unitPrice(v);
    else out[k] = v;
  }
  return out;
}

/** 单条日志：支持 _key / _params 这种「子模板」，切换语言后能整体重译 */
function logText(l) {
  const p = resolveParams(l.params);
  if (l.params && l.params._key) {
    const inner = t(l.params._key, resolveParams(l.params._params));
    return t(l.key, Object.assign({}, p, { text: inner }));
  }
  return t(l.key, p);
}

export function renderLog(state) {
  const body = document.getElementById('log-body');
  if (!body) return;
  if (!state.log.length) {
    body.innerHTML = `<div class="empty">${esc(t('log.empty'))}</div>`;
    return;
  }
  body.innerHTML = state.log.map(l => {
    // 新档存 key + params；老档只有 msg
    const msg = l.key ? logText(l) : (l.msg || '');
    return `<div class="log-line ${esc(l.kind || '')}"><span class="t">${esc(l.t)}</span><span class="m">${esc(msg)}</span></div>`;
  }).join('');
}
