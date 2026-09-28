/**
 * 语言框架 —— 零依赖，字典分 zh / en 两份。
 *
 * 用法：
 *   import { t, getLang, setLang } from '../i18n/index.js';
 *   t('panel.customer')                       // 「顾客」
 *   t('log.weigh', { item: '旧电视', w: 12.3, cost: 30 })
 *
 * 占位符约定（由调用方或 renderLog 的 resolveParams 负责解析）：
 *   {xxx}   普通值，直接替换
 *   {$mat}  材料 key，渲染前会换成当前语言的材料名
 *   {$part} 零件 key，渲染前会换成当前语言的零件名
 */
import { ZH } from './zh.js';
import { EN } from './en.js';

const DICTS = { zh: ZH, en: EN };
const STORE_KEY = 'recycle.v3.lang';
const LISTENERS = [];

let current = 'zh';

/** 读取 localStorage，浏览器环境缺失时降级为内存变量 */
function readStore() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(STORE_KEY);
  } catch (e) { /* 隐私模式等，忽略 */ }
  return null;
}

function writeStore(v) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORE_KEY, v);
  } catch (e) { /* 忽略 */ }
}

function detect() {
  const saved = readStore();
  if (saved === 'zh' || saved === 'en') return saved;
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return /^zh/i.test(navigator.language) ? 'zh' : 'en';
    }
  } catch (e) { /* 忽略 */ }
  return 'zh';
}

export function getLang() {
  return current;
}

export function setLang(lang) {
  const next = lang === 'en' ? 'en' : 'zh';
  if (next === current) return current;
  current = next;
  writeStore(next);
  applyStatic();
  for (const fn of LISTENERS) fn(next);
  return current;
}

export function toggleLang() {
  return setLang(current === 'zh' ? 'en' : 'zh');
}

export function initLang() {
  current = detect();
  return current;
}

/** 订阅语言变化（UI 用来整页重绘） */
export function onLangChange(fn) {
  if (typeof fn === 'function') LISTENERS.push(fn);
}

/** 取词条；en 缺失时回退中文，再缺失就返回 key 本身 */
export function t(key, params) {
  const dict = DICTS[current] || ZH;
  let s = dict[key];
  if (s == null || s === '') s = ZH[key];
  if (s == null || s === '') return key;
  if (!params) return s;
  return s.replace(/\{(\$?\w+)\}/g, (m, k) => {
    const v = params[k];
    return v == null ? '' : String(v);
  });
}

/** 按 key 取另一语言的文本（用于「对照」场景，例如日志导出） */
export function tIn(lang, key, params) {
  const dict = DICTS[lang] || ZH;
  let s = dict[key];
  if (s == null) s = ZH[key];
  if (s == null) return key;
  if (!params) return s;
  return s.replace(/\{(\$?\w+)\}/g, (m, k) => {
    const v = params[k];
    return v == null ? '' : String(v);
  });
}

/** 字典完整性检查：en 必须覆盖 zh 的全部 key */
export function missingKeys() {
  const zhKeys = Object.keys(ZH);
  const enKeys = new Set(Object.keys(EN));
  return zhKeys.filter(k => !enKeys.has(k) || EN[k] === '');
}

/**
 * 替换 HTML 里带 data-i18n 的静态节点。
 * data-i18n="key"              → textContent
 * data-i18n-attr="placeholder" → 写入该属性
 */
export function applyStatic(root) {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;
  const r = root || document;
  const nodes = r.querySelectorAll('[data-i18n]');
  for (const el of nodes) {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');
    const val = t(key);
    if (attr) el.setAttribute(attr, val);
    else el.textContent = val;
  }
  const html = r.documentElement || r;
  if (html && html.setAttribute) html.setAttribute('lang', current === 'zh' ? 'zh-CN' : 'en');
  const title = r.getElementById && r.getElementById('doc-title');
  if (title) title.textContent = t('app.title');
}

export default { t, getLang, setLang, toggleLang, initLang, onLangChange, applyStatic, missingKeys };
