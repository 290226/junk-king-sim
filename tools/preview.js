/**
 * 生成像素图标全览页：docs/icons-preview.html
 * 用法：node tools/preview.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PIXEL_ART, PAL, pixelIcon, PART_ICON, MAT_ICON } from '../src/ui/pixel.js';
import { ITEM_KINDS } from '../src/data/items.js';
import { PARTS, partName } from '../src/data/parts.js';
import { MATERIALS, matName } from '../src/data/materials.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const kindName = Object.fromEntries(ITEM_KINDS.map(k => [k.icon, k.name]));

function cell(key, label) {
  return `<div class="cell"><span class="art">${pixelIcon(key)}</span><span class="lb">${label}</span></div>`;
}

const items = ITEM_KINDS.map(k => cell(k.icon, k.name)).join('');
const parts = PARTS.map(p => cell(PART_ICON[p.key] || 'gear', partName(p.key))).join('');
const mats = MATERIALS.map(m => cell(MAT_ICON[m.key], matName(m.key))).join('');
const misc = ['guest', 'brand', 'coin', 'crate', 'wrench', 'scale', 'spark']
  .map(k => cell(k, { guest: '顾客', brand: '站徽', coin: '现金', crate: '货箱', wrench: '扳手', scale: '台秤', spark: '捡漏' }[k])).join('');

const pal = Object.entries(PAL).map(([k, v]) => `<span class="sw"><i style="background:${v}"></i>${k}</span>`).join('');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>像素图标全览 · 收废品经营 v3</title>
<style>
  body { margin:0; background:#14121f; color:#d6d9e8; font-family:"Segoe UI","Microsoft YaHei",system-ui,sans-serif; padding:22px; -webkit-font-smoothing:none; }
  h2 { font-size:13.5px; letter-spacing:3px; color:#f3f4ff; margin:22px 0 10px; text-shadow:2px 2px 0 rgba(0,0,0,.55); }
  h2::before { content:""; display:inline-block; width:6px; height:13px; background:#d16b3f; margin-right:8px; }
  .grid { display:flex; flex-wrap:wrap; gap:10px; }
  .cell { width:88px; background:#262040; padding:8px 4px 6px; text-align:center;
    box-shadow:0 -3px 0 0 #0c0d14,0 3px 0 0 #0c0d14,-3px 0 0 0 #0c0d14,3px 0 0 0 #0c0d14; }
  .art { display:flex; justify-content:center; }
  .art svg { width:48px; height:48px; image-rendering:pixelated; }
  .lb { display:block; font-size:11px; color:#8f93b2; margin-top:5px; }
  .pal { display:flex; gap:8px; flex-wrap:wrap; margin-top:6px; }
  .sw i { display:inline-block; width:14px; height:14px; margin-right:4px; box-shadow:0 0 0 2px #0c0d14; }
  .sw { font-size:11px; color:#8f93b2; font-family:Consolas,monospace; }
  p { font-size:12px; color:#8f93b2; }
</style>
</head>
<body>
<h1 style="font-size:17px;letter-spacing:3px;color:#f3f4ff">像素图标全览</h1>
<p>共 ${Object.keys(PIXEL_ART).length} 个 12×12 点阵，运行时拼成内联 SVG，无外部图片。</p>
<h2>废品 12 种</h2><div class="grid">${items}</div>
<h2>零件 14 种（8 种形态复用）</h2><div class="grid">${parts}</div>
<h2>材料 5 种</h2><div class="grid">${mats}</div>
<h2>其它</h2><div class="grid">${misc}</div>
<h2>调色板</h2><div class="pal">${pal}</div>
</body>
</html>`;

const out = path.join(ROOT, 'docs', 'icons-preview.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html, 'utf-8');
console.log('已生成', out, `(${Object.keys(PIXEL_ART).length} 个图标)`);
