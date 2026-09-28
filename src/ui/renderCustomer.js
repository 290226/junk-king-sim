/**
 * 顾客区渲染 —— 顾客上门 → 逐件讲价 → 过秤入库。
 * 硬约束：真值重量 / isAntique / hiddenBaseValue / 底价 在此阶段禁止渲染。
 */
import { CONFIG } from '../config.js';
import { matName, matColor } from '../data/materials.js';
import { itemName, condLabel, condHint } from '../data/items.js';
import { customerName, customerLine } from '../data/names.js';
import { metalRichness } from '../core/economy.js';
import { icon } from './icons.js';
import { esc, money, unitPrice, weight as fmtWeight } from './dom.js';
import { t } from '../i18n/index.js';

/** 「行家估价」：只用品类的固定配比 × 中位出材率 × 当前市价，不含本件的任何隐藏随机量 */
export function appraisePerLb(item, matPrices) {
  const mixRatio = (CONFIG.MATERIAL_WEIGHT_RATIO[0] + CONFIG.MATERIAL_WEIGHT_RATIO[1]) / 2;
  const mix = {};
  const total = item.materials.reduce((s, m) => s + m.qtyLb, 0) || 1;
  for (const m of item.materials) mix[m.key] = m.qtyLb / total;
  let per = 0;
  for (const [k, r] of Object.entries(mix)) per += r * mixRatio * (matPrices[k] || 0);
  return Math.round(per * 100) / 100;
}

function materialTags(item) {
  return item.materials
    .map(m => `<span class="tag"><i class="dot" style="background:${matColor(m.key)}"></i>${esc(matName(m.key))}</span>`)
    .join('');
}

function entryCard(entry, state, ui) {
  const item = entry.item;
  const toolRow = CONFIG.TOOL_TABLE.find(t => t.lv === state.toolLevel) || CONFIG.TOOL_TABLE[0];
  const showMetal = toolRow.perkKey === 'metal';
  const showAntique = toolRow.perkKey === 'antique';
  const appraise = appraisePerLb(item, state.market.matPrices);

  const tags = [];
  if (item.ageMark) tags.push(`<span class="tag rust">${esc(t('cust.ageMark'))}</span>`);
  if (item.missing.length) tags.push(`<span class="tag warn">${esc(t('cust.missing', { n: item.missing.length }))}</span>`);
  tags.push(`<span class="tag">${esc(condLabel(item.condition))}</span>`);
  if (item.special) tags.push(`<span class="tag gold">${esc(t('cust.specialHint'))}</span>`);
  if (showMetal) tags.push(`<span class="tag info">${esc(t(`cust.metal.${metalRichness(item)}`))}</span>`);
  if (showAntique && item.isAntique) tags.push(`<span class="tag gold">${esc(t('cust.antique'))}</span>`);

  let action = '';
  if (entry.phase === 'haggle') {
    const draft = ui.drafts[item.id] ?? '';
    const q1 = (appraise * 0.6).toFixed(2);
    const q2 = (appraise * 0.8).toFixed(2);
    const q3 = appraise.toFixed(2);
    action = `<div class="offer-row">
        <span class="field"><input type="number" inputmode="decimal" step="0.01" min="0.01" placeholder="${esc(t('cust.phPrice'))}" value="${esc(draft)}" data-act="offer-input" data-id="${item.id}"></span>
        <span class="unit">${esc(t('cust.unitSuffix'))}</span>
        <button class="btn primary" data-act="offer" data-id="${item.id}">${esc(t('cust.offerBtn'))}</button>
      </div>
      <div class="quick">
        <button class="btn sm" data-act="quick" data-id="${item.id}" data-v="${q1}">${q1}</button>
        <button class="btn sm" data-act="quick" data-id="${item.id}" data-v="${q2}">${q2}</button>
        <button class="btn sm" data-act="quick" data-id="${item.id}" data-v="${q3}">${q3}</button>
        <span class="dim" style="font-size:11.5px">${esc(t('cust.quickHint'))}</span>
      </div>`;
  } else if (entry.phase === 'counter') {
    action = `<div class="banner warn">${esc(t('cust.counterBanner', { p: unitPrice(entry.counterPerLb) }))}</div>
      <div class="row">
        <button class="btn ok" data-act="accept" data-id="${item.id}">${esc(t('cust.accept'))}</button>
        <button class="btn ghost" data-act="reject" data-id="${item.id}">${esc(t('cust.reject'))}</button>
      </div>`;
  } else if (entry.phase === 'dealt') {
    action = `<div class="banner ok">${esc(t('cust.dealtBanner', { p: unitPrice(entry.offerPerLb) }))}</div>
      <button class="btn primary" data-act="weigh" data-id="${item.id}">${esc(t('cust.weighBtn'))}</button>`;
  } else if (entry.phase === 'stored') {
    action = `<div class="weigh">
      <span class="big">${fmtWeight(item.weight)}</span>
      <span class="expr">× ${unitPrice(item.buyUnitPrice)} = ${money(item.buyCost)}</span>
      <span class="tag ok">${esc(t('cust.stored'))}</span>
    </div>`;
  } else if (entry.phase === 'left') {
    action = `<div class="banner bad">${esc(t('cust.lostBanner'))}</div>`;
  }

  const hl = entry.phase === 'haggle' || entry.phase === 'counter' ? ' hl' : '';
  const done = entry.phase === 'left' || entry.phase === 'stored' ? ' done' : '';

  return `<div class="card${hl}${done}">
    <div class="card-head">
      <span class="card-icon">${icon(item.iconKey)}</span>
      <div class="card-title">
        <div class="name">${esc(itemName(item))}</div>
        <div class="sub">${esc(condHint(item.condition) || '')}</div>
      </div>
      <div class="card-tags">${tags.join('')}</div>
    </div>
    <div class="kv-grid">
      <div class="kv"><span class="k">${esc(t('cust.appraise'))}</span><span class="v">${unitPrice(appraise)}</span></div>
    </div>
    <div class="row tight">${materialTags(item)}</div>
    ${action}
  </div>`;
}

export function renderCustomer(state, ui) {
  const body = document.getElementById('customer-body');
  const sub = document.getElementById('customer-sub');
  if (!body) return;
  const left = Math.max(0, CONFIG.DAY_CUSTOMER_LIMIT - state.dayCustomers);
  const night = state.phase === 'night';
  const stop = (left === 0 || night) ? 'disabled' : '';

  if (!state.customer) {
    const hint = night
      ? t('cust.doneToday')
      : (left ? t('cust.leftToday', { n: left }) : t('cust.doneToday'));
    sub.textContent = hint;
    body.innerHTML = `<div class="empty">${night
      ? esc(t('night.intro'))
      : (left
        ? esc(t('cust.emptyWait'))
        : esc(t('cust.emptyDone', { n: CONFIG.DAY_CUSTOMER_LIMIT, d: state.day + 1 })))}</div>
      <button class="btn primary block" data-act="next-customer" ${stop}>${esc(t('cust.callNext'))}</button>`;
    return;
  }

  const c = state.customer;
  const pending = c.entries.filter(e => e.phase === 'haggle' || e.phase === 'counter').length;
  const cname = c.nameIdx != null ? customerName(c.nameIdx) : c.name;
  const cline = c.lineIdx != null ? customerLine(c.lineIdx) : c.line;
  sub.textContent = `${cname} · ${t('cust.pending', { n: pending })}`;
  body.innerHTML = `
    <div class="guest">
      <span class="avatar">${icon('guest')}</span>
      <div class="meta">
        <div class="name">${esc(cname)}</div>
        <div class="say">「${esc(cline)}」</div>
      </div>
      <span class="spacer"></span>
      <button class="btn ghost" data-act="next-customer" ${stop}>${esc(pending ? t('cust.sendAway') : t('cust.next'))}</button>
    </div>
    ${c.entries.map(e => entryCard(e, state, ui)).join('')}`;
}
