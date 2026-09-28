/**
 * 工作台渲染 —— 已入库废品的决策区：修理 / 拆解 / 卖出。
 * 入库后重量与材料构成对玩家可见；但 hiddenBaseValue 与是否古董仍隐藏到修理成功。
 */
import { CONFIG } from '../config.js';
import { matName, matColor } from '../data/materials.js';
import { partName } from '../data/parts.js';
import { itemName, condLabel } from '../data/items.js';
import { peekMaterial, dismantleProgress } from '../core/dismantle.js';
import { money, esc, pct, weight as fmtWeight, unitPrice } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';

function missingList(item, plan) {
  if (!item.missing.length) return '';
  const rows = item.missing.map((mp, i) => {
    const p = plan && plan.parts[i];
    const fromStock = p && p.fromStock;
    const cls = fromStock ? 'can' : 'cant';
    const tail = fromStock
      ? `<span class="tag ok">${esc(t('bench.stockPart'))}</span>`
      : `<span class="tag bad">${esc(t('bench.buyPart', { v: money(p ? p.cost : 0) }))}</span>
         <button class="btn sm" data-act="buy-part" data-id="${item.id}" data-idx="${i}">${esc(t('bench.buyNow'))}</button>`;
    return `<div class="missing-row ${cls}">
      <span>${esc(partName(mp.key))}</span>
      <span class="spacer"></span>${tail}
    </div>`;
  }).join('');
  return `<div class="missing-list">${rows}</div>`;
}

function card(item, state, ui, plan) {
  const tags = [];
  tags.push(`<span class="tag">${esc(condLabel(item.condition))}</span>`);
  if (item.ageMark) tags.push(`<span class="tag rust">${esc(t('cust.ageMark'))}</span>`);
  if (item.special) tags.push(`<span class="tag gold">${esc(t('bench.specialTag'))}</span>`);
  if (item.fromDumpster) tags.push(`<span class="tag rust">${esc(t('night.tag.dumpster'))}</span>`);
  if (item.state === 'broken') tags.push(`<span class="tag bad">${esc(t('bench.damaged'))}</span>`);
  if (item.state === 'repaired' && item.isAntique) tags.push(`<span class="tag gold">${esc(t('bench.antiqueTag', { n: item.antiqueMult }))}</span>`);
  if (item.state === 'repaired' && !item.isAntique) tags.push(`<span class="tag ok">${esc(t('bench.repaired'))}</span>`);

  const matValue = Math.round((item.matValue || 0) * item.salvageFactor * 100) / 100;
  const matTags = item.materials.map(m =>
    `<span class="tag"><i class="dot" style="background:${matColor(m.key)}"></i>${esc(matName(m.key))}</span>`).join('');

  let action = '';

  if (item.state === 'pending') {
    const p = plan;
    const afford = p && p.total <= state.cash;
    const rateWarn = p && p.unmatched > 0
      ? `<div class="banner warn">${esc(t('bench.missingWarn', { n: p.unmatched, r: pct(p.rate) }))}</div>` : '';
    action = `
      ${missingList(item, p)}
      <div class="kv-grid">
        <div class="kv"><span class="k">${esc(t('bench.laborCost'))}</span><span class="v">${money(p ? p.baseCost : 0)}</span></div>
        <div class="kv"><span class="k">${esc(t('bench.partCost'))}</span><span class="v">${money(p ? p.partCost : 0)}</span></div>
        <div class="kv"><span class="k">${esc(t('bench.total'))}</span><span class="v">${money(p ? p.total : 0)}</span></div>
        <div class="kv"><span class="k">${esc(t('bench.rate'))}</span><span class="v">${pct(p ? p.rate : 0)}</span></div>
        <div class="kv"><span class="k">${esc(t('bench.matValue'))}</span><span class="v">${money(matValue)}</span></div>
      </div>
      ${rateWarn}
      <div class="row">
        <button class="btn ok" data-act="repair" data-id="${item.id}" ${afford ? '' : 'disabled'}>
          ${esc(t('bench.repairBtn', { v: money(p ? p.total : 0) }))}
        </button>
        <button class="btn" data-act="dismantle" data-id="${item.id}">${esc(t('bench.dismantleBtn'))}</button>
        ${afford ? '' : `<span class="dim" style="font-size:11.5px">${esc(t('bench.cashShortHint'))}</span>`}
      </div>`;
  } else if (item.state === 'repairing') {
    action = `<div class="banner">${esc(t('bench.repairing'))}</div>
      <div class="bar"><i style="width:100%"></i></div>`;
  } else if (item.state === 'repaired') {
    const suffix = item.isAntique ? t('bench.antiqueSuffix') : '';
    action = `<div class="banner ok">${esc(t('bench.repairedBanner', { v: money(item.revealedValue), suffix }))}</div>
      <div class="row">
        <button class="btn primary" data-act="sell-item" data-id="${item.id}">${esc(t('bench.sellBtn', { v: money(item.revealedValue) }))}</button>
      </div>`;
  } else if (item.state === 'broken') {
    const nextM = peekMaterial(item);
    action = `<div class="banner bad">${esc(t('bench.brokenBanner', { v: money(matValue) }))}</div>
      <div class="row">
        <button class="btn" data-act="dismantle" data-id="${item.id}">
          ${esc(nextM ? t('bench.dismantleNext', { m: matName(nextM.key) }) : t('bench.dismantleBtn'))}
        </button>
      </div>`;
  } else if (item.state === 'dismantling') {
    const nextM = peekMaterial(item);
    const prog = dismantleProgress(item);
    action = `<div class="row">
        <button class="btn" data-act="dismantle" data-id="${item.id}">
          ${esc(t('bench.keepDismantle', { suffix: nextM ? t('bench.nextSuffix', { m: matName(nextM.key) }) : '' }))}
        </button>
        <span class="dim" style="font-size:11.5px">${esc(t('bench.progress', { a: prog.done, b: prog.total }))}</span>
      </div>`;
  }

  const paidLine = item.buyCost
    ? `<div class="kv"><span class="k">${esc(t('bench.buyCost'))}</span><span class="v">${money(item.buyCost)}</span></div>` : '';

  return `<div class="card">
    <div class="card-head">
      <span class="card-icon">${icon(item.iconKey)}</span>
      <div class="card-title">
        <div class="name">${esc(itemName(item))}</div>
        <div class="sub">${item.buyCost
          ? `${fmtWeight(item.weight)} · ${esc(t('bench.boughtAt', { p: unitPrice(item.buyUnitPrice) }))}`
          : `${fmtWeight(item.weight)} · ${esc(t('night.tag.dumpster'))}`}</div>
      </div>
      <div class="card-tags">${tags.join('')}</div>
    </div>
    <div class="kv-grid">${paidLine}</div>
    <div class="row tight">${matTags}</div>
    ${action}
  </div>`;
}

export function renderBench(state, ui, actions) {
  const body = document.getElementById('bench-body');
  const sub = document.getElementById('bench-sub');
  if (!body) return;
  sub.textContent = t('bench.count', { n: state.workbench.length });

  if (!state.workbench.length) {
    body.innerHTML = `<div class="empty">${esc(t('bench.empty'))}</div>`;
    return;
  }

  body.innerHTML = state.workbench.map(item => {
    const plan = item.state === 'pending'
      ? (ui.plans[item.id] || (ui.plans[item.id] = actions.repairPlan(item.id)))
      : null;
    if (item.state !== 'pending' && ui.plans[item.id]) delete ui.plans[item.id];
    return card(item, state, ui, plan);
  }).join('');
}
