/** 顾客姓名与上门台词（纯表现，不影响数值） */
import { getLang } from '../i18n/index.js';

export const CUSTOMER_NAMES = [
  { zh: '王大爷', en: 'Old Wang' },
  { zh: '刘婶',   en: 'Aunt Liu' },
  { zh: '老陈',   en: 'Old Chen' },
  { zh: '小赵',   en: 'Zhao' },
  { zh: '周师傅', en: 'Master Zhou' },
  { zh: '孙阿姨', en: 'Aunt Sun' },
  { zh: '老李头', en: 'Old Li' },
  { zh: '张同学', en: 'Student Zhang' },
  { zh: '吴师傅', en: 'Master Wu' },
  { zh: '徐大姐', en: 'Sister Xu' },
  { zh: '老郑',   en: 'Old Zheng' },
  { zh: '小马',   en: 'Xiao Ma' },
  { zh: '钱阿姨', en: 'Aunt Qian' },
  { zh: '何师傅', en: 'Master He' }
];

export const CUSTOMER_LINES = [
  { zh: '家里腾地方，这几样你给个价。',       en: 'Clearing out the house — name your price for these.' },
  { zh: '收废品的说你这儿价高，我来看看。',   en: 'The other collector said you pay better, so here I am.' },
  { zh: '搬家剩的，能卖几个是几个。',         en: 'Leftovers from the move. Whatever it is worth.' },
  { zh: '别压我价啊，我可是打听过的。',       en: "Don't lowball me — I did ask around first." },
  { zh: '这几件搁车库好几年了，你瞅瞅。',     en: 'These sat in the garage for years. Take a look.' },
  { zh: '急着出手，合适就给你了。',           en: "In a hurry — fair price and they're yours." },
  { zh: '隔壁说按斤收，我想着先问你。',       en: 'The neighbour buys by the pound, but I came to you first.' },
  { zh: '东西旧是旧，零件都还在。',           en: 'Old, yes, but the parts are all still there.' }
];

export function customerName(i) {
  const e = CUSTOMER_NAMES[i % CUSTOMER_NAMES.length];
  return getLang() === 'en' ? e.en : e.zh;
}

export function customerLine(i) {
  const e = CUSTOMER_LINES[i % CUSTOMER_LINES.length];
  return getLang() === 'en' ? e.en : e.zh;
}

/** 兼容旧结构：按当前语言展开成字符串数组 */
export function nameList() {
  return CUSTOMER_NAMES.map(e => (getLang() === 'en' ? e.en : e.zh));
}

export function lineList() {
  return CUSTOMER_LINES.map(e => (getLang() === 'en' ? e.en : e.zh));
}
