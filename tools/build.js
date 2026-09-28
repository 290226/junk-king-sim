/**
 * 打 TapTap 上架用的 zip（零依赖）。
 *
 * 产物：dist/recycle_yard.zip
 *   └─ recycle_yard/            ← 解压后第一级有且仅有一个英文数字文件夹
 *        └─ index.html          ← 单文件、自包含：CSS 与全部 JS 已内联，无需任何外部请求
 *
 * 为什么做单文件内联：
 *   - TapTap H5 规范只要求「第一级单个英文文件夹 + index.html 直接在内、无 __MACOSX」；
 *   - 但部分 WebView / 内嵌环境对 ES Module 与 file:// 的 CORS 不友好，
 *     把 CSS+JS 全内联进一个 index.html 是最稳的「单文件」形态，任何环境直接打开即可跑。
 *
 * 实现：手写一个迷你模块打包器（仅处理本工程的 import/export 形态），
 *       再把三段 CSS 内联进 <style>，最后用 store 模式手写 zip（含 CRC32）。
 *
 * 用法：npm run build
 */
import {
  readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync
} from 'node:fs';
import { join, relative, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const OUT_DIR = join(ROOT, 'dist');
const FOLDER = 'recycleyard';                 // 只能是英文 + 数字（不能含下划线等）
const INDEX = join(ROOT, 'index.html');

/* ============================================================
 * 1. 收集模块（从 main.js 出发，DFS 后序 = 依赖在前、入口在后）
 * ========================================================== */
const modules = new Map();                     // absPath -> { varName, source }
const order = [];
const visited = new Set();

function moduleVar(absPath) {
  const rel = relative(SRC, absPath).replace(/\\/g, '/').replace(/\.js$/, '');
  return 'mod_' + rel.replace(/[^A-Za-z0-9_]/g, '_');
}

// 匹配 import 语句（含跨行），只抓相对路径依赖
const IMPORT_RE = /import\s+(?:(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*)?from\s*['"]([^'"]+)['"]\s*;?/g;

function collect(absPath) {
  const norm = resolve(absPath);
  if (visited.has(norm)) return;
  visited.add(norm);
  const src = readFileSync(norm, 'utf8');
  const deps = [];
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(src))) {
    const spec = m[3];
    if (!spec.startsWith('.')) continue;
    deps.push(resolve(dirname(norm), spec));
  }
  for (const d of deps) collect(d);
  modules.set(norm, { varName: moduleVar(norm), source: src });
  order.push(norm);
}
collect(join(SRC, 'main.js'));

/* ============================================================
 * 2. 把单个模块转成「IIFE + __exports」形态
 *    import ...  ->  const ... = mod_x.default / mod_x.y
 *    export ...  ->  __exports.y = y
 * ========================================================== */
function transformModule(norm, mod) {
  let src = mod.source;

  // --- import 转 const ---
  IMPORT_RE.lastIndex = 0;
  src = src.replace(IMPORT_RE, (full, def, named, spec) => {
    if (!spec.startsWith('.')) return full;
    const depVar = moduleVar(resolve(dirname(norm), spec));
    let decl = '';
    if (def) decl += `const ${def} = ${depVar}.default;\n`;
    if (named) {
      const parts = named.split(',')
        .map(s => s.trim()).filter(Boolean)
        .map(p => {
          const seg = p.split(/\s+as\s+/);
          const srcName = seg[0].trim();
          const exported = (seg[1] || seg[0]).trim();
          return `const ${exported} = ${depVar}.${srcName};`;
        });
      decl += parts.join('\n') + '\n';
    }
    return decl;
  });

  // --- export 收集并改写 ---
  const expNames = [];

  // export const|let|var|function|class|async function NAME
  src = src.replace(/export\s+(const|let|var|function|class|async\s+function)\s+([A-Za-z_$][\w$]*)/g,
    (mm, kw, name) => { expNames.push(name); return `${kw} ${name}`; });

  // export default <expr>;  ->  __exports.default = <expr>;
  src = src.replace(/export\s+default\s+/g, '__exports.default = ');

  // export { A, B as C };  ->  __exports.A = A; __exports.C = B;
  src = src.replace(/export\s*\{([^}]*)\}\s*;?/g, (mm, body) => body.split(',').map(p => {
    p = p.trim(); if (!p) return '';
    const seg = p.split(/\s+as\s+/);
    const srcName = seg[0].trim();
    const exported = (seg[1] || seg[0]).trim();
    return `__exports.${exported} = ${srcName};`;
  }).join('\n'));

  let tail = '';
  for (const n of expNames) tail += `\n__exports.${n} = ${n};`;

  return `const ${mod.varName} = (() => {\n  const __exports = {};\n${src}${tail}\n  return __exports;\n})();\n`;
}

/* ============================================================
 * 3. 内联 CSS
 * ========================================================== */
const css = ['base.css', 'layout.css', 'components.css']
  .map(f => readFileSync(join(ROOT, 'styles', f), 'utf8'))
  .join('\n');

/* ============================================================
 * 4. 组装单文件 HTML
 * ========================================================== */
let bundle = '';
for (const norm of order) bundle += transformModule(norm, modules.get(norm)) + '\n';

let html = readFileSync(INDEX, 'utf8');
html = html.replace(/<link rel="stylesheet"[^>]*>\s*/g, '');        // 去掉三个外链 css
html = html.replace(/<\/head>/, `<style>\n${css}\n</style>\n</head>`); // 内联 css
html = html.replace(
  /<script type="module" src="\.\/src\/main\.js"><\/script>/,
  `<script type="module">\n${bundle}\n</script>`
);

/* ============================================================
 * 5. 写出 dist/recycle_yard/index.html
 * ========================================================== */
if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(join(OUT_DIR, FOLDER), { recursive: true });
const outHtml = join(OUT_DIR, FOLDER, 'index.html');
writeFileSync(outHtml, html);

/* ============================================================
 * 6. 语法自检：把 bundle 抽出来 node --check
 * ========================================================== */
try {
  const tmpBundle = join(OUT_DIR, '_bundle_check.mjs');
  writeFileSync(tmpBundle, bundle);
  execFileSync(process.execPath, ['--check', tmpBundle], { stdio: 'pipe' });
  rmSync(tmpBundle, { force: true });
} catch (e) {
  // Windows 某些沙箱下 node 无法再拉起自身（EBUSY），这只是语法自检，不阻断出包；
  // bundle 语法正确性已由 tools/check.js + tools/render-check.js 全绿覆盖。
  if (e.code === 'EBUSY' || e.code === 'ENOENT') {
    console.log('· 跳过 bundle 语法自检（node 自 spawn 被环境拒绝：' + e.code + '），语法由 check/render-check 兜底。');
  } else {
    console.log('× 打包后的 JS 语法检查未通过：');
    console.log('  ' + (e.stderr ? e.stderr.toString() : e.message));
    process.exit(1);
  }
}

/* ============================================================
 * 7. CRC32 + 手写 zip（store 模式，零依赖）
 * ========================================================== */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function buildZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const crc = crc32(e.data);
    const size = e.data.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034B50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);          // UTF-8 文件名
    local.writeUInt16LE(0, 8);               // store
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x2100, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, e.data);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014B50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(size, 20);
    cd.writeUInt32LE(size, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cd, nameBuf]));
    offset += local.length + nameBuf.length + size;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054B50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, centralBuf, eocd]);
}

/* ============================================================
 * 8. 规范自检 + 出包
 * ========================================================== */
function checkLayout(entries) {
  const tops = new Set(entries.map(e => e.name.split('/')[0]));
  const problems = [];
  if (tops.size !== 1) problems.push(`第一级应只有 1 个文件夹，实际 ${[...tops].join(', ')}`);
  const top = [...tops][0];
  if (!/^[A-Za-z0-9]+$/.test(top)) problems.push(`第一级文件夹名 "${top}" 含非英文数字字符`);
  if (!entries.some(e => e.name === `${top}/index.html`)) problems.push('缺少 ' + top + '/index.html');
  for (const e of entries) {
    if (/(^|\/)__MACOSX|\.DS_Store/.test(e.name)) problems.push('夹带了 Mac 隐藏文件: ' + e.name);
  }
  return problems;
}

const entries = [{ name: `${FOLDER}/index.html`, data: readFileSync(outHtml) }];
const problems = checkLayout(entries);
if (problems.length) {
  console.log('包体结构不合规：');
  for (const p of problems) console.log('  × ' + p);
  process.exit(1);
}

const zipPath = join(OUT_DIR, `${FOLDER}.zip`);
writeFileSync(zipPath, buildZip(entries));

const size = statSync(zipPath).size;
const htmlSize = statSync(outHtml).size;
console.log(`√ 已生成 ${zipPath}`);
console.log(`  zip 体积 ${(size / 1024).toFixed(1)} KB（TapTap 上限 20 MB，余量充足）`);
console.log(`  内联后单文件 index.html 体积 ${(htmlSize / 1024).toFixed(1)} KB`);
console.log(`  打包模块 ${order.length} 个，第一级文件夹：${FOLDER}/`);
console.log('  结构自检通过（单英文文件夹 + index.html 直接在内 + 无 __MACOSX），可直接上传 TapTap 开发者中心。');
