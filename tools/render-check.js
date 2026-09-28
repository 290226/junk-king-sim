/**
 * 渲染冒烟 + 隐藏信息泄漏检查（零依赖）。
 * 用最小 DOM 模拟在 Node 里跑真实渲染函数：
 *   1. 顾客讲价阶段：真值重量 / 底价 / 隐藏基准值 / 是否古董 不得出现在任何 HTML 里；
 *   2. 过秤之后重量才允许出现；
 *   3. 修理成功前不得出现隐藏基准值；
 *   4. 夜间面板只在夜间阶段出现，且能渲染翻桶结果；
 *   5. 切到英文后整页重绘不炸，隐藏信息依旧不泄漏。
 * 用法：node tools/render-check.js
 */
class El {
  constructor(id) {
    this.id = id; this.innerHTML = ''; this.textContent = '';
    this.dataset = {}; this.children = []; this.hidden = false; this.attrs = {};
    this.classList = { toggle() {}, remove() {}, add() {}, contains() { return false; } };
  }
  addEventListener() {}
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter(x => x !== c); }
  get firstChild() { return this.children[0]; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
}
const els = {};
globalThis.document = {
  getElementById: (id) => els[id] || (els[id] = new El(id)),
  createElement: () => new El('div'),
  addEventListener: () => {},
  readyState: 'complete',
  querySelector: () => null,
  querySelectorAll: () => [],
  documentElement: new El('html')
};
globalThis.window = { setTimeout, clearTimeout, confirm: () => true };

import { readFileSync } from 'node:fs';
const { initLang, setLang, getLang, t } = await import('../src/i18n/index.js');
const { createGame } = await import('../src/core/gameState.js');
const { renderCustomer } = await import('../src/ui/renderCustomer.js');
const { renderBench } = await import('../src/ui/renderBench.js');
const { renderNight } = await import('../src/ui/renderNight.js');
const { renderTop, renderMarket, renderStock, renderParts, renderTools, renderLog, renderDay, renderFinance, renderFinEntry } = await import('../src/ui/renderSide.js');
const { default: icon } = await import('../src/ui/icons.js');
const { matName } = await import('../src/data/materials.js');
const { toolName } = await import('../src/data/labels.js');

initLang();

let failed = 0;
function ok(cond, label) {
  console.log(`${cond ? ' ok ' : 'FAIL'}  ${label}`);
  if (!cond) failed++;
}

const ui = { drafts: {}, matQty: {}, plans: {}, fin: {} };
let game;
function render() {
  const s = game.state;
  renderTop(s, game.actions);
  renderDay(s);
  renderMarket(s);
  renderFinance(s, ui, game.actions);
  renderStock(s, ui);
  renderParts(s);
  renderTools(s);
  renderLog(s);
  renderNight(s, game.actions);
  renderCustomer(s, ui);
  renderBench(s, ui, game.actions);
}
game = createGame(render);
render();

const html = () => Object.values(els).map(e => e.innerHTML).join('\n');

/** 解析 HTML 里所有「数字+斤/lb」重量呈现，判断某个确切重量是否作为重量值出现。
 *  用解析而非 includes，避免把「8.8 lb」误判为泄漏了真值 8 斤/lb（目测区间本来就会包住真值）。 */
function hasExactWeight(h, w) {
  const re = /(\d+(?:\.\d+)?)\s*(lb|斤)/g;
  let m;
  while ((m = re.exec(h))) {
    if (Number(m[1]) === w) return true;
  }
  return false;
}

/** 从顾客面板 HTML 里抽出某一件废品自己的卡片区域（按按钮 data-id 定位）。
 *  泄漏检查必须只看本卡片——整页/整面板会混入已入库件的真值重量、以及其他件目测区间的端点，
 *  造成「18.0 lb 命中真值 18」之类的跨条目误报。 */
function cardHtmlFor(bodyHtml, itemId) {
  const startTag = '<div class="card';
  const idx = bodyHtml.indexOf(`data-id="${itemId}"`);
  if (idx < 0) return '';
  const cardStart = bodyHtml.lastIndexOf(startTag, idx);
  if (cardStart < 0) return '';
  const nextCard = bodyHtml.indexOf(startTag, cardStart + startTag.length);
  return bodyHtml.slice(cardStart, nextCard < 0 ? undefined : nextCard);
}

console.log('— 像素点阵 —');
const { PIXEL_ART, PAL, pixelIcon } = await import('../src/ui/pixel.js');
let badRow = 0, badChar = 0, names = 0;
for (const [name, rows] of Object.entries(PIXEL_ART)) {
  names++;
  if (rows.length !== 12) badRow++;
  for (const r of rows) {
    if (r.length !== 12) badRow++;
    for (const ch of r) if (ch !== '.' && !PAL[ch]) badChar++;
  }
}
ok(badRow === 0, `${names} 个点阵图行宽正确（12×12）`);
ok(badChar === 0, '点阵只使用调色板内的颜色');
const svg = pixelIcon('tv');
ok(svg.startsWith('<svg') && svg.includes('<rect'), '点阵能生成内联 SVG');
ok(!/https?:|url\(|\.png|\.jpg|\.svg"/.test(svg), '图标不引用任何外部图片');

console.log('\n— 初始渲染（中文）—');
ok(els['customer-body'].innerHTML.includes(t('cust.callNext')), '顾客区空态正确');
ok(els['bench-body'].innerHTML.includes(t('bench.empty').slice(0, 6)), '工作台空态正确');
ok(els['stats'].innerHTML.includes(t('top.cash')), '顶部状态栏渲染');
ok(els['market-body'].innerHTML.includes(matName('pcb')), '行情面板渲染');
ok(els['tool-body'].innerHTML.includes(toolName(1)), '工具树渲染');
ok(els['night-panel'].hidden === true, '白天隐藏夜间面板');

console.log('\n— 顾客上门（讲价阶段）—');
game.actions.nextCustomer();
render();
const c = game.state.customer;
ok(els['customer-body'].innerHTML.includes(c.name), '顾客名渲染');
ok(els['customer-body'].innerHTML.includes(t('cust.appraise')), '行家估价渲染');

let leakWeight = 0, leakReserve = 0, leakBase = 0, leakAntique = 0;
for (const e of c.entries) {
  const r = e.reservePerLb;
  const b = String(e.item.hiddenBaseValue);
  const cardH = cardHtmlFor(els['customer-body'].innerHTML, e.item.id);
  if (hasExactWeight(cardH, e.item.weight)) leakWeight++;
  // 底价是数字，只检查它是否以「单价」形态出现（避免和其他数字巧合撞上）
  if (cardH.includes(`¥${r}/斤`) || cardH.includes(`¥${r}/lb`) || cardH.includes(`>${r} 元`)) leakReserve++;
  if (cardH.includes(b)) leakBase++;
  if (e.item.isAntique && /老物件|Antique ×/.test(cardH)) leakAntique++;
}
ok(leakWeight === 0, '讲价阶段未泄漏真值重量');
ok(leakReserve === 0, '讲价阶段未泄漏顾客底价');
ok(leakBase === 0, '讲价阶段未泄漏隐藏基准值');
ok(leakAntique === 0, '讲价阶段未泄漏古董身份');

console.log('\n— 报价 → 过秤 —');
let dealt = 0;
for (const e of c.entries.slice()) {
  const fair = e.item.matValue / e.item.weight;
  game.actions.offer(e.item.id, Math.max(0.05, fair * 0.8));
  if (e.phase === 'counter') game.actions.accept(e.item.id);
  if (e.phase === 'dealt') {
    const r = game.actions.weigh(e.item.id);
    if (r.ok) dealt++;
  }
  render();
}
ok(dealt > 0, `过秤入库 ${dealt} 件`);
ok(game.state.workbench.length === dealt, '工作台件数吻合');
const benchHtml = els['bench-body'].innerHTML;
ok(/斤|lb/.test(benchHtml), '入库后显示真实重量');
let leakAfter = 0;
for (const it of game.state.workbench) if (benchHtml.includes(String(it.hiddenBaseValue))) leakAfter++;
ok(leakAfter === 0, '修理前仍未泄漏隐藏基准值');

console.log('\n— 拆解与变现 —');
const first = game.state.workbench[0];
if (first) {
  let guard = 0;
  while (game.state.workbench.some(i => i.id === first.id) && guard++ < 12) {
    game.actions.dismantle(first.id);
    render();
  }
  ok(!game.state.workbench.some(i => i.id === first.id), '拆解完成后离开工作台');
  const matKeys = Object.keys(game.state.materials);
  ok(matKeys.length > 0, `材料入库：${matKeys.join('/')}`);
  ok(els['stock-body'].innerHTML.includes(t('stock.sell')), '材料仓库渲染卖出控件');
  const cashBefore = game.state.cash;
  const r = game.actions.sellMaterial(matKeys[0], game.state.materials[matKeys[0]]);
  render();
  ok(r.ok && game.state.cash > cashBefore, '卖材料到账');
}

console.log('\n— 修理流程 —');
game.actions.nextCustomer();
render();
for (const e of game.state.customer.entries.slice()) {
  const fair = e.item.matValue / e.item.weight;
  game.actions.offer(e.item.id, Math.max(0.05, fair * 0.8));
  if (e.phase === 'counter') game.actions.accept(e.item.id);
  if (e.phase === 'dealt') game.actions.weigh(e.item.id);
  render();
}
const target = game.state.workbench[0];
if (target) {
  const plan = game.actions.repairPlan(target.id);
  ok(!!plan && plan.total > 0, `修理方案生成：合计 ${plan.total}`);
  const started = game.actions.startRepair(target.id);
  if (started.ok) {
    render();
    ok(els['bench-body'].innerHTML.includes(t('bench.repairing').slice(0, 3)), '修理中状态渲染');
    const fin = game.actions.finishRepair(target.id);
    render();
    ok((fin.ok && target.state === 'repaired') || target.state === 'broken', `修理结算：${target.state}`);
  } else {
    ok(true, '现金不足未修理（符合预期兜底）');
  }
}

console.log('\n— 夜间翻垃圾桶 —');
game.actions.enterNight();
render();
ok(els['night-panel'].hidden === false, '进入夜间后面板显示');
ok(els['night-body'].innerHTML.includes(t('night.spot.community')), '地点一渲染');
ok(els['night-body'].innerHTML.includes(t('night.spot.alley')), '地点二渲染');
ok(els['night-body'].innerHTML.includes(t('night.spot.uptown')), '地点三渲染');
ok(els['night-body'].innerHTML.includes(t('night.risk.alley').split('：')[0].split(':')[0].trim().slice(0, 2)) ||
   /风险|Risk/.test(els['night-body'].innerHTML), '风险说明渲染');
ok(/disabled/.test(els['customer-body'].innerHTML), '夜间不能再招呼顾客（按钮禁用）');

const sc = game.actions.scavenge('alley');
render();
ok(sc.ok, `翻桶成功（${sc.result.kind}）`);
ok(els['night-body'].innerHTML.length > 0, '夜间面板渲染出翻桶结果');
if (sc.result.kind === 'item') {
  ok(game.state.workbench.some(i => i.fromDumpster), '捡到的废品进工作台并带标记');
  ok(els['bench-body'].innerHTML.includes(t('night.tag.dumpster')), '工作台标出垃圾桶来源');
}
const sc2 = game.actions.scavenge('alley');
ok(!sc2.ok && sc2.reason === 'limit', '同一晚第二次翻桶被拦下');

console.log('\n— 收摊过夜 —');
const { CONFIG } = await import('../src/config.js');
const rep = game.actions.endDay();
render();
ok(rep.ok, '过夜成功');
ok((els['day-chip'].textContent || '').includes(String(game.state.day)), `天数推进到第 ${game.state.day} 天`);
ok(game.state.dayCustomers === 0, '新的一天收货次数重置');
ok(els['night-panel'].hidden === true, '回到白天后夜间面板收起');
ok(els['log-body'].innerHTML.includes(t('log.newDay', { d: game.state.day }).replace(/—/g, '—').slice(0, 6)), '日志出现新一天');

console.log('\n— 每日收货上限 —');
for (let i = 0; i < CONFIG.DAY_CUSTOMER_LIMIT; i++) { game.actions.nextCustomer(); render(); }
const blocked = game.actions.nextCustomer();
render();
ok(!blocked.ok && blocked.reason === 'day-limit', `第 ${CONFIG.DAY_CUSTOMER_LIMIT + 1} 次收货被拦下`);
ok(/disabled/.test(els['customer-body'].innerHTML), '次数用尽时招呼按钮禁用');

console.log('\n— 钱庄交互 —');
game.actions.borrow(200);                 // 先借钱，保证后面有钱操作
render();
ok(els['finance-body'].innerHTML.includes(t('fin.owed', { v: '¥200.00' }).slice(0, 1)), '欠款渲染到钱庄面板');
game.actions.deposit(50);
render();
ok(game.state.finance.demand === 50, '活期存入成功');
ok(els['finance-body'].innerHTML.includes('50'), '活期余额渲染到钱庄面板');
const fut = game.actions.openFutures('copper', 'up', 100);
render();
ok(fut.ok && els['finance-body'].innerHTML.includes(t('fin.up')), '期货持仓渲染到钱庄面板');

console.log('\n— 手机端视图与钱庄页 —');
renderFinEntry(game.state);
ok(els['fin-entry-assets'].textContent.includes('50'), '钱庄入口卡显示理财资产');
ok(els['fin-entry-owed'].textContent.includes('200'), '钱庄入口卡显示欠款');
const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
ok(HTML.includes('id="finview"') && HTML.includes('data-act="close-finance"'), 'index.html 有钱庄全屏页与返回按钮');
ok(HTML.includes('id="fin-entry-panel"') && HTML.includes('data-act="open-finance"'), 'index.html 有钱庄入口卡与进入按钮');
ok(HTML.includes('class="tabbar"') && HTML.includes('data-tab="yard"'), 'index.html 有底部导航');
for (const v of ['yard', 'bench', 'stock', 'misc']) {
  ok(HTML.includes(`data-view="${v}"`), `index.html 有视图分组 ${v}`);
}
ok(HTML.includes('user-scalable=no') && HTML.includes('viewport-fit=cover'), 'viewport 禁止缩放并适配刘海屏');
ok(!HTML.includes('onclick="'), '没有内联 onclick（全走事件委托）');
ok(HTML.includes('id="modal"'), 'index.html 有自定义确认弹窗');
const tabIcon = icon('coin');
ok(tabIcon.startsWith('<svg') && !/https?:\/\//.test(tabIcon), '底部导航图标是内联 SVG，无外部图片');
for (const k of ['guest', 'wrench', 'crate', 'coin', 'scale']) {
  ok(icon(k).startsWith('<svg'), `底部导航图标 ${k} 可渲染`);
}

console.log('\n— 英文切换 —');
setLang('en');
ok(getLang() === 'en', '语言状态切到 en');
render();
ok(els['stats'].innerHTML.includes('Cash'), '顶部状态栏变英文');
ok(els['market-body'].innerHTML.includes('Circuit Board'), '材料名变英文');
ok(els['tool-body'].innerHTML.includes('Basic Toolkit'), '工具名变英文');
ok(els['finance-body'].innerHTML.includes('Demand Savings'), '理财名变英文');
const custBtn = [t('cust.callNext'), t('cust.next'), t('cust.sendAway')];
ok(custBtn.some(s => els['customer-body'].innerHTML.includes(s)), '顾客区按钮变英文');
ok(/Day \d+/.test(els['day-chip'].textContent || ''), `天数条变英文（${els['day-chip'].textContent}）`);
ok(els['log-body'].innerHTML.length > 0 && !/[\u4e00-\u9fa5]/.test(els['log-body'].innerHTML.replace(/¥/g, '')),
  '流水账全英文渲染（模板按新语言重译）');

// 英文下再走一遍泄漏检查
game.actions.nextCustomer();
render();
const c2 = game.state.customer;
let leakEn = 0;
for (const e of c2.entries) {
  const cardH = cardHtmlFor(els['customer-body'].innerHTML, e.item.id);
  if (hasExactWeight(cardH, e.item.weight)) leakEn++;
  if (cardH.includes(`¥${e.reservePerLb}/lb`) || cardH.includes(`¥${e.reservePerLb}/斤`)) leakEn++;
  if (cardH.includes(String(e.item.hiddenBaseValue))) leakEn++;
}
ok(leakEn === 0, '英文界面下隐藏信息同样不泄漏');

setLang('zh');
render();
ok(getLang() === 'zh' && els['stats'].innerHTML.includes('现金'), '切回中文');

console.log('\n— 存档 —');
const { saveState, clearState } = await import('../src/core/save.js');
const saved = saveState(game.state);
ok(saved === false || saved === true, '存档写入不抛异常（无 localStorage 时降级）');
clearState();

console.log(failed ? `\n× ${failed} 项未通过` : '\n√ 全部通过');
process.exit(failed ? 1 : 0);
