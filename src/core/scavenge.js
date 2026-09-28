/**
 * 夜间翻垃圾桶 —— 纯逻辑，产出结构化结果，入库与扣钱交给 gameState。
 *
 * 三个地点各有产出侧重与风险（见 CONFIG.SCAVENGE）：
 *   community 小区垃圾桶：免费，塑料与铁居多
 *   alley     电子城后巷：电路板与贵重零件多，容易被划伤
 *   uptown    高档小区：现金与成色好的大件，可能被保安罚款
 *
 * @returns {{spot:string, kind:string, flavor?:string, mat?:string, qty?:number,
 *            part?:string, count?:number, cash?:number, risk?:object|null}}
 */
import { CONFIG } from '../config.js';
import { PARTS } from '../data/parts.js';
import { rand, randInt, pick, chance, round } from './rng.js';

export const SPOTS = CONFIG.SCAVENGE.spots;
export const SPOT_MAP = Object.fromEntries(SPOTS.map(s => [s.key, s]));

/** 按权重抽一种产出 */
function pickKind(weights) {
  const keys = Object.keys(weights);
  const total = keys.reduce((s, k) => s + weights[k], 0);
  let r = rand(0, total);
  for (const k of keys) {
    r -= weights[k];
    if (r <= 0) return k;
  }
  return keys[keys.length - 1];
}

/** 从指定等级池里抽一个零件 */
function pickPartOfTiers(tiers) {
  const pool = PARTS.filter(p => tiers.includes(p.tier));
  if (!pool.length) return PARTS[0].key;
  return pick(pool).key;
}

/**
 * 摇一次翻桶结果（不修改任何状态）。
 * @param {string} spotKey 地点 key
 * @returns {object|null} 地点不存在时返回 null
 */
export function planScavenge(spotKey) {
  const spot = SPOT_MAP[spotKey];
  if (!spot) return null;

  const kind = pickKind(spot.weights);
  const out = { spot: spotKey, kind, risk: null };

  if (kind === 'empty') {
    out.flavor = chance(0.5) ? 'empty' : 'trash';
  } else if (kind === 'mat') {
    out.mat = pick(spot.mats);
    out.qty = round(rand(spot.qty[0], spot.qty[1]), 2);
  } else if (kind === 'part') {
    out.part = pickPartOfTiers(spot.tiers);
    out.count = randInt(spot.partCount[0], spot.partCount[1]);
  } else if (kind === 'cash') {
    out.cash = round(rand(spot.cash[0], spot.cash[1]), CONFIG.DECIMALS.money);
  }

  if (spot.risk && chance(spot.risk.chance)) {
    out.risk = {
      kind: spot.risk.kind,
      cost: round(rand(spot.risk.cost[0], spot.risk.cost[1]), CONFIG.DECIMALS.money)
    };
  }
  return out;
}

/** 地点风险文案所需的数值（供 UI 展示，不发随机） */
export function spotRiskInfo(spotKey) {
  const spot = SPOT_MAP[spotKey];
  if (!spot || !spot.risk) return null;
  return {
    chance: spot.risk.chance,
    kind: spot.risk.kind,
    low: spot.risk.cost[0],
    high: spot.risk.cost[1]
  };
}
