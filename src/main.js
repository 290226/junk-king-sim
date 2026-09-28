/**
 * 入口 —— 装配状态、渲染与事件。
 * 事件用委托：所有按钮带 data-act，输入框带 data-act + data-id/data-key。
 */
import { CONFIG } from './config.js';
import { createGame } from './core/gameState.js';
import { listSlots, clearState, getCurrentSlot, setCurrentSlot, migrateLegacy } from './core/save.js';
import { renderCustomer } from './ui/renderCustomer.js';
import { renderBench } from './ui/renderBench.js';
import { renderNight, nightResultText } from './ui/renderNight.js';
import { renderTop, renderDay, renderMarket, renderFinance, renderFinEntry, renderStock, renderParts, renderTools, renderLog } from './ui/renderSide.js';
import { toast, money, weight as fmtWeight, esc } from './ui/dom.js';
import { initLang, applyStatic, toggleLang, onLangChange, t, getLang } from './i18n/index.js';
import { matName } from './data/materials.js';
import { partName } from './data/parts.js';
import { toolName } from './data/labels.js';
import icon from './ui/icons.js';

const ui = { drafts: {}, matQty: {}, plans: {}, fin: {}, view: 'yard' };

let game = null;
let lastView = 'yard';     // 从哪个视图点开的钱庄，关闭时回到它
let currentSlot = 1;       // 当前激活的存档槽
let tutorialStep = 0;      // 新手教程当前步

function render() {
  if (!game) return;
  const s = game.state;
  renderTop(s, game.actions);
  renderDay(s);
  renderMarket(s);
  renderFinance(s, ui, game.actions);
  renderFinEntry(s, ui, game.actions);
  renderStock(s, ui);
  renderParts(s);
  renderTools(s);
  renderLog(s);
  renderNight(s, game.actions);
  renderCustomer(s, ui);
  renderBench(s, ui, game.actions);
}

/* ---------------- 视图切换（手机端底部导航） ---------------- */
function syncTabs(active) {
  const tabs = document.querySelectorAll('#tabbar .tab');
  for (const b of tabs) b.classList.toggle('is-on', b.dataset.tab === active);
}

function setView(name) {
  if (name === 'finance') { openFinance(); return; }
  ui.view = name;
  lastView = name;
  document.body.dataset.view = name;
  syncTabs(name);
}

function openFinance() {
  const view = document.getElementById('finview');
  if (view) view.hidden = false;
  document.body.dataset.view = 'finance';   // 底层仍显示收货页，避免切走后白屏
  syncTabs('finance');
  render();
}

function closeFinance() {
  const view = document.getElementById('finview');
  if (view) view.hidden = true;
  ui.view = lastView;
  document.body.dataset.view = lastView;
  syncTabs(lastView);
  render();
}

/* ---------------- 自定义确认弹窗（替代原生 confirm） ---------------- */
let confirmCb = null;

function openConfirm(text, onYes) {
  const modal = document.getElementById('modal');
  const box = document.getElementById('modal-text');
  if (!modal || !box) { onYes(); return; }   // 极端情况：拿不到节点就直接执行
  box.textContent = text;
  confirmCb = onYes;
  modal.hidden = false;
}

function closeConfirm(run) {
  const modal = document.getElementById('modal');
  if (modal) modal.hidden = true;
  const cb = confirmCb;
  confirmCb = null;
  if (run && cb) cb();
}

/* ---------------- 存档选择与新手教程 ---------------- */
const TUTORIAL_STEPS = [
  { icon: 'guest',  titleKey: 'tutorial.step1.t', textKey: 'tutorial.step1.d' },
  { icon: 'wrench', titleKey: 'tutorial.step2.t', textKey: 'tutorial.step2.d' },
  { icon: 'crate',  titleKey: 'tutorial.step3.t', textKey: 'tutorial.step3.d' },
  { icon: 'coin',   titleKey: 'tutorial.step4.t', textKey: 'tutorial.step4.d' }
];

function renderSaveList(el) {
  if (!el) return;
  const slots = listSlots();
  el.innerHTML = slots.map(m => {
    const name = esc(t('save.slotName', { n: m.id }));
    if (m.empty) {
      return `<div class="save-slot empty">
        <div class="save-slot-title">${name}</div>
        <div class="save-slot-meta">${esc(t('save.empty'))}</div>
        <div class="save-slot-actions">
          <button class="btn primary block" data-act="slot-new" data-slot="${m.id}">${esc(t('save.new'))}</button>
        </div>
      </div>`;
    }
    const cur = m.id === currentSlot ? `<span class="tag gold">${esc(t('save.current'))}</span>` : '';
    return `<div class="save-slot${m.id === currentSlot ? ' current' : ''}">
      <div class="save-slot-title">${name}${cur}</div>
      <div class="save-slot-meta">
        <span>${esc(t('save.day', { n: m.day }))}</span>
        <span>${esc(t('save.cash', { v: money(m.cash) }))}</span>
        <span>${esc(t('save.tool', { n: m.toolLevel }))}</span>
      </div>
      <div class="save-slot-actions">
        <button class="btn primary" data-act="slot-load" data-slot="${m.id}">${esc(t('save.load'))}</button>
        <button class="btn ghost" data-act="slot-delete" data-slot="${m.id}">${esc(t('save.delete'))}</button>
      </div>
    </div>`;
  }).join('');
}

function refreshSaveLists() {
  renderSaveList(document.getElementById('save-list-cover'));
  renderSaveList(document.getElementById('save-list-overlay'));
}

function showCoverStory() {
  const cover = document.getElementById('cover');
  if (cover) cover.hidden = false;
  const a = document.getElementById('cover-story');
  const b = document.getElementById('cover-saves');
  const c = document.getElementById('cover-tutorial');
  if (a) a.hidden = false;
  if (b) b.hidden = true;
  if (c) c.hidden = true;
}

function showCoverSaves() {
  const cover = document.getElementById('cover');
  if (cover) cover.hidden = false;
  const a = document.getElementById('cover-story');
  const b = document.getElementById('cover-saves');
  const c = document.getElementById('cover-tutorial');
  if (a) a.hidden = true;
  if (b) b.hidden = false;
  if (c) c.hidden = true;
  refreshSaveLists();
}

function showCoverTutorial() {
  const cover = document.getElementById('cover');
  if (cover) cover.hidden = false;
  const a = document.getElementById('cover-story');
  const b = document.getElementById('cover-saves');
  const c = document.getElementById('cover-tutorial');
  if (a) a.hidden = true;
  if (b) b.hidden = true;
  if (c) c.hidden = false;
}

function hideCover() {
  const cover = document.getElementById('cover');
  if (cover) cover.hidden = true;
}

function openSavesOverlay() {
  refreshSaveLists();
  const ov = document.getElementById('saves-overlay');
  if (ov) ov.hidden = false;
}

function closeSavesOverlay() {
  const ov = document.getElementById('saves-overlay');
  if (ov) ov.hidden = true;
}

/** 切到某个槽：有档则读档进游戏，空档则新开并弹新手教程 */
function switchToSlot(slot) {
  currentSlot = slot;
  setCurrentSlot(slot);
  game = createGame(render, slot);
  ui.drafts = {};
  ui.matQty = {};
  ui.plans = {};
  ui.fin = {};
  if (game.state.tutorialSeen) {
    hideCover();
    closeSavesOverlay();
    setView('yard');
    render();
  } else {
    tutorialStep = 0;
    renderTutorial();
    showCoverTutorial();
  }
}

function renderTutorial() {
  const box = document.getElementById('tutorial-box');
  if (!box) return;
  const step = TUTORIAL_STEPS[tutorialStep];
  const last = tutorialStep >= TUTORIAL_STEPS.length - 1;
  const dots = TUTORIAL_STEPS.map((_, i) => `<i class="t-dot${i === tutorialStep ? ' on' : ''}"></i>`).join('');
  box.innerHTML = `
    <span class="tutorial-step-tag">${tutorialStep + 1} / ${TUTORIAL_STEPS.length}</span>
    <span class="tutorial-icon">${icon(step.icon)}</span>
    <h3 class="tutorial-title">${esc(t(step.titleKey))}</h3>
    <p class="tutorial-text">${esc(t(step.textKey))}</p>
    <div class="tutorial-dots">${dots}</div>
    <div class="tutorial-actions">
      <button class="btn ghost" data-act="tutorial-skip">${esc(t('tutorial.skip'))}</button>
      <button class="btn primary" data-act="tutorial-next">${esc(t(last ? 'tutorial.start' : 'tutorial.next'))}</button>
    </div>`;
}

function finishTutorial() {
  if (game) game.actions.markTutorialSeen();
  hideCover();
  closeSavesOverlay();
  setView('yard');
  render();
}

/* ---------------- 点击 ---------------- */
function onClick(ev) {
  const btn = ev.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;

  // 存档与教程相关（不依赖 game 实例，封面阶段也能用）
  switch (act) {
    case 'slot-new':
    case 'slot-load':
      switchToSlot(Number(btn.dataset.slot));
      return;
    case 'slot-delete': {
      const slot = Number(btn.dataset.slot);
      openConfirm(t('save.deleteConfirm'), () => {
        clearState(slot);
        refreshSaveLists();
        toast(t('save.deleted'));
        if (slot === currentSlot) {
          game = null;
          closeSavesOverlay();
          showCoverSaves();
        }
      });
      return;
    }
    case 'tutorial-next': {
      if (tutorialStep < TUTORIAL_STEPS.length - 1) {
        tutorialStep += 1;
        renderTutorial();
      } else {
        finishTutorial();
      }
      return;
    }
    case 'tutorial-skip':
      finishTutorial();
      return;
  }

  const id = btn.dataset.id;
  const key = btn.dataset.key;
  const A = game.actions;

  switch (act) {
    case 'open-finance': {
      openFinance();
      return;
    }
    case 'close-finance': {
      closeFinance();
      return;
    }
    case 'next-customer': {
      const r = A.nextCustomer();
      if (!r.ok) toast(t('day.limitReached', { n: CONFIG.DAY_CUSTOMER_LIMIT }), 'bad');
      break;
    }
    case 'enter-night': {
      A.enterNight();
      break;
    }
    case 'back-to-day': {
      A.backToDay();
      break;
    }
    case 'scavenge': {
      const r = A.scavenge(key);
      if (!r.ok) {
        if (r.reason === 'limit') toast(t('night.used'), 'bad');
        else if (r.reason === 'phase') toast(t('night.closed'), 'bad');
        else toast(t('msg.futFail'), 'bad');
        break;
      }
      const text = nightResultText(r.result);
      toast(text, r.result.risk ? 'bad' : (r.result.kind === 'empty' ? '' : 'gold'));
      break;
    }
    case 'end-day': {
      const r = A.endDay();
      if (!r.ok) { toast(t('day.endFail'), 'bad'); break; }
      const rep = r.report;
      const bits = [];
      if (rep.demand > 0) bits.push(t('eod.demand', { v: money(rep.demand) }));
      for (const m of rep.matured) bits.push(t('eod.fixed', { v: money(m.payout) }));
      for (const f of rep.futures) {
        const diff = f.result.payout - f.dep.principal;
        const tag = f.result.win ? t('eod.win') : (f.result.draw ? t('eod.draw') : t('eod.lose'));
        bits.push(t('eod.futures', {
          tag, mat: matName(f.dep.mat), diff: `${diff >= 0 ? '+' : '-'}${money(Math.abs(diff))}`
        }));
      }
      if (rep.interest > 0) bits.push(t('eod.interest', { v: money(rep.interest) }));
      if (rep.rolled > 0) bits.push(t('eod.rolled', { v: money(rep.rolled) }));
      toast(bits.length
        ? t('eod.open', { n: rep.nextDay, bits: bits.join(' · ') })
        : t('eod.openPlain', { n: rep.nextDay }), 'ok');
      ui.drafts = {};
      break;
    }
    case 'fin-deposit': {
      const r = A.deposit(Number(ui.fin.demand || 0));
      if (!r.ok) toast(r.reason === 'cash' ? t('msg.depositFailCash') : t('msg.depositFailAmount'), 'bad');
      else { ui.fin.demand = ''; toast(t('msg.depositOk', { v: money(r.amount) }), 'ok'); }
      break;
    }
    case 'fin-withdraw': {
      const r = A.withdraw(Number(ui.fin.demand || 0));
      if (!r.ok) toast(t('msg.withdrawFail', { v: money(r.have || 0) }), 'bad');
      else { ui.fin.demand = ''; toast(t('msg.withdrawOk', { v: money(r.amount) }), 'ok'); }
      break;
    }
    case 'fin-open-fixed': {
      const r = A.openFixed(Number(ui.fin.fixed || 0));
      if (!r.ok) {
        if (r.reason === 'min') toast(t('msg.fixedMin', { v: money(CONFIG.FINANCE.fixed.minAmount, 0) }), 'bad');
        else toast(t('msg.fixedCash'), 'bad');
      } else { ui.fin.fixed = ''; toast(t('msg.fixedOk', { v: money(r.dep.principal), d: r.dep.dueDay }), 'gold'); }
      break;
    }
    case 'fin-break': {
      const r = A.breakFixed(id);
      if (!r.ok) toast(t('msg.fixedBreakNone'), 'bad');
      else toast(t('msg.fixedBreakOk', { v: money(r.payout) }), 'bad');
      break;
    }
    case 'fin-futures': {
      const dir = btn.dataset.dir;
      const r = A.openFutures(key, dir, Number(ui.fin.futures || 0));
      if (!r.ok) {
        if (r.reason === 'min') toast(t('msg.futMin', { v: money(CONFIG.FINANCE.futures.minAmount, 0) }), 'bad');
        else if (r.reason === 'cash') toast(t('msg.futCash'), 'bad');
        else toast(t('msg.futFail'), 'bad');
      } else {
        ui.fin.futures = '';
        toast(t('msg.futOk', { mat: matName(key), dir: dir === 'up' ? t('fin.up') : t('fin.down'), v: money(r.dep.principal) }), 'gold');
      }
      break;
    }
    case 'loan-borrow': {
      const r = A.borrow(Number(ui.fin.loan || 0));
      if (!r.ok) {
        if (r.reason === 'min') toast(t('msg.borrowMin', { v: money(CONFIG.LOAN.minBorrow, 0) }), 'bad');
        else if (r.reason === 'limit') toast(t('msg.borrowLimit', { v: money(r.limit) }), 'bad');
        else toast(t('msg.borrowFail'), 'bad');
      } else { ui.fin.loan = ''; toast(t('msg.borrowOk', { v: money(r.amount), i: money(A.dailyInterest()) }), 'gold'); }
      break;
    }
    case 'loan-repay': {
      const r = A.repay(Number(ui.fin.loan || 0));
      if (!r.ok) toast(r.reason === 'cash' ? t('msg.repayCash') : t('msg.repayNone'), 'bad');
      else { ui.fin.loan = ''; toast(t('msg.repayOk', { v: money(r.amount) }), 'ok'); }
      break;
    }
    case 'quick': {
      const v = Number(btn.dataset.v);
      if (id) {
        ui.drafts[id] = String(v);
        const r = A.offer(id, v);
        handleOfferResult(r);
      }
      break;
    }
    case 'offer': {
      const v = Number(ui.drafts[id] || 0);
      if (!(v > 0)) { toast(t('msg.offerEmpty'), 'bad'); return; }
      const r = A.offer(id, v);
      handleOfferResult(r);
      break;
    }
    case 'accept': {
      const r = A.accept(id);
      if (!r.ok) toast(t('msg.acceptFail'), 'bad');
      else toast(t('msg.acceptOk'), 'ok');
      break;
    }
    case 'reject': {
      A.reject(id);
      toast(t('msg.rejectOk'));
      break;
    }
    case 'weigh': {
      const r = A.weigh(id);
      if (!r.ok) toast(t('msg.weighFail'), 'bad');
      else toast(t('msg.weighOk', { w: fmtWeight(r.weight), v: money(r.cost) }), 'ok');
      break;
    }
    case 'repair': {
      const r = A.startRepair(id);
      if (!r.ok) {
        toast(r.reason === 'cash' ? t('msg.repairCash', { v: money(r.need) }) : t('msg.repairState'), 'bad');
        return;
      }
      delete ui.plans[id];
      render();
      window.setTimeout(() => {
        const fin = A.finishRepair(id);
        if (fin.ok && fin.result.success) {
          toast(t('msg.repairOk', { v: money(fin.result.value) }), fin.item.isAntique ? 'gold' : 'ok');
        } else if (fin.ok) {
          toast(t('msg.repairFail'), 'bad');
        }
        render();
      }, r.duration);
      return;
    }
    case 'buy-part': {
      const idx = Number(btn.dataset.idx);
      const r = A.buyMissingPart(id, idx);
      if (!r.ok) {
        if (r.reason === 'cash') toast(t('msg.buyPartCash', { part: partName(r.key), v: money(r.need) }), 'bad');
        else toast(t('msg.offerFail'), 'bad');
        break;
      }
      delete ui.plans[id];
      toast(t('msg.buyPartOk', { part: partName(r.key) }), 'ok');
      break;
    }
    case 'dismantle': {
      const r = A.dismantle(id);
      if (!r.ok) { toast(t('msg.dismantleDone')); return; }
      ui.plans = {}; // 零件库存变了，修理方案的抵扣情况要重算
      toast(r.step, 'ok');
      if (r.result.finished && r.result.dropped && r.result.dropped.length) {
        toast(t('msg.dismantleParts', { list: r.result.dropped.map(partName).join('、') }), 'gold');
      }
      break;
    }
    case 'sell-item': {
      const r = A.sellItem(id);
      if (r.ok) toast(t('msg.sellItemOk', { v: money(r.value) }), 'ok');
      break;
    }
    case 'sell-mat':
    case 'sell-mat-all': {
      const have = game.state.materials[key] || 0;
      const qty = act === 'sell-mat-all' ? have : Number(ui.matQty[key] || 0);
      const r = A.sellMaterial(key, qty);
      if (!r.ok) toast(t('msg.sellMatFail', { w: fmtWeight(have) }), 'bad');
      else { ui.matQty[key] = ''; toast(t('msg.sellMatOk', { v: money(r.value) }), 'ok'); }
      break;
    }
    case 'sell-part': {
      const r = A.sellPart(key, 1);
      if (!r.ok) toast(t('msg.sellPartNone'), 'bad');
      else { ui.plans = {}; toast(t('msg.sellPartOk', { v: money(r.value) }), 'ok'); }
      break;
    }
    case 'upgrade': {
      const r = A.upgradeTool();
      if (!r.ok) toast(r.reason === 'cash' ? t('msg.upgradeCash') : t('msg.upgradeMax'), 'bad');
      else { ui.plans = {}; toast(t('msg.upgradeOk', { name: toolName(r.tool.lv) }), 'gold'); }
      break;
    }
    default:
      break;
  }
  render();
}

function handleOfferResult(r) {
  if (!r.ok) {
    if (r.reason === 'cash') toast(t('msg.offerCash', { v: money(r.need) }), 'bad');
    else if (r.reason === 'price') toast(t('msg.offerPrice'), 'bad');
    return;
  }
  if (r.result === 'deal') toast(t('msg.offerDeal'), 'ok');
  else if (r.result === 'counter') toast(t('msg.offerCounter', { p: money(r.price) }), 'bad');
  else if (r.result === 'leave') toast(t('msg.offerLeave'), 'bad');
}

/* ---------------- 输入 ---------------- */
function onInput(ev) {
  const el = ev.target;
  const act = el.dataset.act;
  if (!act) return;
  if (act === 'offer-input') {
    ui.drafts[el.dataset.id] = el.value;
    return;
  }
  if (act === 'mat-input') {
    ui.matQty[el.dataset.key] = el.value;
    return;
  }
  if (act === 'fin-input') {
    ui.fin[el.dataset.k] = el.value;
    return;
  }
}

/* ---------------- 启动 ---------------- */
function boot() {
  initLang();
  migrateLegacy();
  currentSlot = getCurrentSlot();
  applyStatic(document);
  onLangChange(() => {
    if (game) render();
    refreshSaveLists();
  });

  const updateLangButtons = () => {
    const label = getLang() === 'zh' ? 'EN' : '中文';
    const a = document.getElementById('btn-lang');
    const b = document.getElementById('btn-cover-lang');
    if (a) a.textContent = label;
    if (b) b.textContent = label;
  };
  const toggleLangUi = () => {
    toggleLang();
    updateLangButtons();
    ui.plans = {};   // 修理方案里的零件名要按新语言重取
    if (game) render();
    refreshSaveLists();
  };
  const langBtn = document.getElementById('btn-lang');
  if (langBtn) langBtn.addEventListener('click', toggleLangUi);
  const coverLang = document.getElementById('btn-cover-lang');
  if (coverLang) coverLang.addEventListener('click', toggleLangUi);
  updateLangButtons();

  // 开场封面：填充招牌图标，点击「开始营业」进入存档选择
  const coverLogo = document.getElementById('cover-logo');
  if (coverLogo) coverLogo.innerHTML = icon('brand');
  const startBtn = document.getElementById('btn-start');
  if (startBtn) startBtn.addEventListener('click', showCoverSaves);
  const savesBack = document.getElementById('btn-saves-back');
  if (savesBack) savesBack.addEventListener('click', showCoverStory);
  const savesOpen = document.getElementById('btn-saves');
  if (savesOpen) savesOpen.addEventListener('click', openSavesOverlay);
  const savesClose = document.getElementById('btn-saves-close');
  if (savesClose) savesClose.addEventListener('click', closeSavesOverlay);
  showCoverStory();   // 初始显示故事屏

  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    const el = ev.target;
    if (!el || !el.dataset || !el.dataset.act) return;
    if (el.dataset.act === 'offer-input') {
      const btn = el.closest('.card')?.querySelector('[data-act="offer"]');
      if (btn) btn.click();
    } else if (el.dataset.act === 'mat-input') {
      const btn = el.closest('.mat-row')?.querySelector('[data-act="sell-mat"]');
      if (btn) btn.click();
    }
  });

  // 底部导航图标（内联 SVG，不引外部图片）
  for (const slot of document.querySelectorAll('#tabbar .ticon')) {
    slot.innerHTML = icon(slot.dataset.icon || 'crate');
  }
  const tabbar = document.getElementById('tabbar');
  if (tabbar) {
    tabbar.addEventListener('click', (ev) => {
      const b = ev.target.closest('.tab');
      if (b) setView(b.dataset.tab);
    });
  }

  // 确认弹窗按钮
  const yes = document.getElementById('modal-yes');
  const no = document.getElementById('modal-no');
  if (yes) yes.addEventListener('click', () => closeConfirm(true));
  if (no) no.addEventListener('click', () => closeConfirm(false));
  const modal = document.getElementById('modal');
  if (modal) {
    modal.addEventListener('click', (ev) => {
      if (ev.target === modal) closeConfirm(false);   // 点遮罩=取消
    });
  }

  setView('yard');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
