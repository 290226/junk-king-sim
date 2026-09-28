/** 随机工具：所有随机都必须走这里，方便后续加种子/测试。 */

/** [min, max] 闭区间内随机整数 */
export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** [min, max] 区间内随机浮点 */
export function rand(min, max) {
  return Math.random() * (max - min) + min;
}

/** 从数组中随机取一个 */
export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 概率命中 */
export function chance(p) {
  return Math.random() < p;
}

/** 按权重抽样，返回索引 */
export function weightedIndex(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

/** 按权重抽样，返回元素 */
export function weightedPick(items, weights) {
  return items[weightedIndex(weights)];
}

/** 保留小数位（避免浮点毛刺） */
export function round(x, d = 2) {
  const p = Math.pow(10, d);
  return Math.round((x + Number.EPSILON) * p) / p;
}

/** 夹到区间内 */
export function clamp(x, min, max) {
  return Math.min(max, Math.max(min, x));
}

/** 数组洗牌（原地） */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let _id = 0;
export function uid(prefix = 'id') {
  _id += 1;
  return `${prefix}_${Date.now().toString(36)}_${_id.toString(36)}`;
}
