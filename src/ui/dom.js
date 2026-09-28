/** DOM 与格式化小工具（单位后缀随语言切换） */

import { getLang } from '../i18n/index.js';

export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** 金额：¥12.34 */
export function money(n, d = 2) {
  return `¥${Number(n || 0).toFixed(d)}`;
}

/** 重量：12.3 斤 / 12.3 lb */
export function weight(n, d = 1) {
  return `${Number(n || 0).toFixed(d)}${getLang() === 'en' ? ' lb' : ' 斤'}`;
}

/** 单价：¥3.20/斤 / ¥3.20/lb */
export function unitPrice(n) {
  return `¥${Number(n || 0).toFixed(2)}${getLang() === 'en' ? '/lb' : '/斤'}`;
}

export function pct(n) {
  return `${Math.round((n || 0) * 100)}%`;
}

let toastTimer = 0;
export function toast(msg, kind = '') {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.textContent = msg;
  wrap.appendChild(el);
  window.setTimeout(() => {
    el.style.transition = 'opacity .25s';
    el.style.opacity = '0';
    window.setTimeout(() => el.remove(), 260);
  }, 2200);
  while (wrap.children.length > 4) wrap.removeChild(wrap.firstChild);
  window.clearTimeout(toastTimer);
}
