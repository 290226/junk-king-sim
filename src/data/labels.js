/** CONFIG 里的展示型文本（工具名、理财名）按当前语言取值 */
import { CONFIG } from '../config.js';
import { getLang } from '../i18n/index.js';

function toolRow(lv) {
  return CONFIG.TOOL_TABLE.find(t => t.lv === lv) || CONFIG.TOOL_TABLE[0];
}

export function toolName(lv) {
  const t = toolRow(lv);
  return getLang() === 'en' ? (t.en || t.name) : t.name;
}

export function toolPerk(lv) {
  const t = toolRow(lv);
  if (!t || !t.perk) return '';
  return getLang() === 'en' ? (t.perkEn || t.perk) : t.perk;
}

export function finName(kind) {
  const f = CONFIG.FINANCE[kind];
  if (!f) return kind;
  return getLang() === 'en' ? (f.en || f.name) : f.name;
}
