/**
 * 夜间面板 —— 收摊后可以选择去翻一次垃圾桶，然后睡觉进入第二天。
 * 三个地点各有产出侧重与风险，参数全部来自 CONFIG.SCAVENGE。
 */
import { CONFIG } from '../config.js';
import { matName, matColor } from '../data/materials.js';
import { partName, tierLabel } from '../data/parts.js';
import { itemName } from '../data/items.js';
import { SPOTS, spotRiskInfo } from '../core/scavenge.js';
import { icon } from './icons.js';
import { esc, money, weight as fmtWeight } from './dom.js';
import { t, getLang } from '../i18n/index.js';

const SPOT_ICON = { community: 'crate', alley: 'chip', uptown: 'coin' };

function riskLine(spot) {
  const info = spotRiskInfo(spot.key);
  if (!info) return esc(t('night.risk.community'));
  const key = info.kind === 'hurt' ? 'night.risk.alley' : 'night.risk.uptown';
  return esc(t(key, {
    p: Math.round(info.chance * 100), a: info.low, b: info.high
  }));
}

/** 把上一次翻桶结果翻译成一行文案 */
function resultLine(r) {
  if (!r) return '';
  if (r.kind === 'mat') return t('night.result.mat', { $mat: r.mat, w: fmtWeight(r.qty) });
  if (r.kind === 'part') return t('night.result.part', { $part: r.part, n: r.count });
  if (r.kind === 'cash') return t('night.result.cash', { v: money(r.cash) });
  if (r.kind === 'item') return t('night.result.item', { item: r.item ? itemName(r.item) : '' });
  return t(`night.result.${r.flavor || 'empty'}`);
}

export function renderNight(state, actions) {
  const panel = document.getElementById('night-panel');
  const body = document.getElementById('night-body');
  if (!panel || !body) return;

  if (state.phase !== 'night') {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;

  const used = state.night.used >= CONFIG.SCAVENGE.perNight;
  const sub = document.getElementById('night-sub');
  if (sub) sub.textContent = used ? t('night.used') : t('night.hint');

  const cards = SPOTS.map(spot => {
    const can = !used;
    return `<div class="spot-card">
      <div class="spot-head">
        <span class="picon">${icon(SPOT_ICON[spot.key] || 'crate')}</span>
        <span class="sname">${esc(t(`night.spot.${spot.key}`))}</span>
        <span class="spacer"></span>
        <button class="btn sm primary" data-act="scavenge" data-key="${esc(spot.key)}" ${can ? '' : 'disabled'}>${esc(t('night.go'))}</button>
      </div>
      <div class="spot-desc">${esc(t(`night.desc.${spot.key}`))}</div>
      <div class="spot-risk">${riskLine(spot)}</div>
    </div>`;
  }).join('');

  let last = '';
  const r = state.night.lastResult;
  if (r) {
    const bits = [`<span class="tag ${r.risk ? 'warn' : 'ok'}">${esc(resultLine(r))}</span>`];
    if (r.risk) {
      bits.push(`<span class="tag bad">${esc(t(r.risk.kind === 'hurt' ? 'night.result.hurt' : 'night.result.fine',
        { v: money(r.paid != null ? r.paid : r.risk.cost) }))}</span>`);
    }
    last = `<div class="night-last">${bits.join('')}</div>`;
  }

  body.innerHTML = `
    <div class="night-intro">${esc(t('night.intro'))}</div>
    <div class="spot-list">${cards}</div>
    ${last}
    <div class="row">
      <button class="btn primary" data-act="end-day">${esc(t('night.backToDay'))}</button>
      <button class="btn ghost" data-act="back-to-day">${esc(t('night.backToShop'))}</button>
    </div>`;
}

export function nightResultText(r) {
  if (!r) return '';
  let text = resultLine(r);
  // $mat / $part 在此处就地解析
  text = text.replace('{$mat}', r.mat ? matName(r.mat) : '')
             .replace('{$part}', r.part ? partName(r.part) : '');
  if (r.risk) {
    text += ` ${t(r.risk.kind === 'hurt' ? 'night.result.hurt' : 'night.result.fine',
      { v: money(r.paid != null ? r.paid : r.risk.cost) })}`;
  }
  return text;
}

export { SPOT_ICON };
