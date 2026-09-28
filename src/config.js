/**
 * CONFIG —— 全局唯一数值来源。
 * 规则（来自设计文档「开发要点」）：任何可调数值只能出现在本文件，
 * 逻辑分支里严禁写死数字。新增参数请加在对应分组并填写说明。
 */

export const CONFIG = {
  /* ---------- 基础经济 ---------- */
  START_CASH: 300,                    // 初始现金（元）
  CUSTOMER_SIZE: [1, 3],              // 每位顾客携带废品件数区间
  ITEM_WEIGHT: [2, 40],               // 单件废品重量区间（斤）
  EYE_BAND: 0.25,                     // 目测重量区间半宽（相对真值 ±25%）
  RESERVE_COEF: [0.60, 0.90],         // 顾客心理底价 = 该件材料价值 × 系数（折算为每斤单价）
  COUNTER_OFFER_CHANCE: 0.60,         // 报价低于底价时「还价一次」的概率
  LEAVE_CHANCE: 0.40,                 // 报价低于底价时「直接离开」的概率
  COUNTER_MARKUP: [1.05, 1.15],       // 还价报价 = 底价 × 系数
  MATERIAL_WEIGHT_RATIO: [0.50, 0.80],// 拆解材料总重 / 物品重量

  /* ---------- 材料市价（元/斤） ---------- */
  MAT_PRICE: {
    copper: 18,
    iron: 1.2,
    aluminum: 5,
    plastic: 0.8,
    pcb: 25
  },
  PRICE_SWING: 0.10,                  // 每批顾客上门时材料市价波动 ±10%

  /* ---------- 售价与古董 ---------- */
  // 售价 = 隐藏基准值 × 随机系数；品相越高越容易落进高档区间（见 SELL_COEF_COND_BIAS）
  SELL_COEF: [
    { p: 0.70, range: [0.8, 1.6] },
    { p: 0.20, range: [1.6, 2.5] },
    { p: 0.08, range: [2.5, 4.0] },
    { p: 0.02, range: [5.0, 10.0] }
  ],
  SELL_COEF_COND_BIAS: { low: 0.20, high: 0.35 }, // 品相每高一级：低档权重 -20%，高档权重 +35%
  BASE_VALUE_COEF: [1.60, 2.40],      // 隐藏基准值 = 该件材料价值 × 系数（修复溢价，用户确认上调）
  ANTIQUE_CHANCE: 0.05,               // 真古董概率
  AGE_MARK_CHANCE: 0.50,              // 「年代感」标记概率（与真伪无关的噪音）
  ANTIQUE_MULT: [10, 50],             // 古董修理成功后揭示身份的售价倍数
  FAIL_SALVAGE: 0.5,                  // 已损坏物品拆解材料减半

  /* ---------- 品相与修理 ---------- */
  CONDITION_WEIGHTS: [0.12, 0.20, 0.30, 0.24, 0.14], // 品相 1~5 出现权重（1 最破）
  REPAIR_COST_BY_CONDITION: { 1: 0.35, 2: 0.26, 3: 0.18, 4: 0.12, 5: 0.08 }, // 修理费 = 基准价值 × 系数
  REPAIR_COST_JITTER: [0.85, 1.15],   // 修理费随机浮动
  REPAIR_TIME_BASE: 2000,             // 基础修理耗时（ms）

  /* ---------- 零件系统（v3 新增） ---------- */
  MISSING_PART_CHANCE: 0.55,          // 物品存在缺失零件的概率
  MISSING_PART_MAX: 3,                // 单件最多缺失零件数
  REPAIR_MISSING_PENALTY: 0.15,       // 每个未补齐的缺件，修理成功率 -15%（逼玩家拆旧货攒零件）
  PARTS_BUY_MARKUP: 2.20,             // 缺件需要外购时的溢价（相对零件基准价，外购明显吃亏）
  PART_SELL_COEF: 0.85,               // 零件卖废品的回收价系数
  PART_DROP_CHANCE: 0.55,             // 拆解完成时掉落可用零件的概率
  PART_DROP_COUNT: [1, 2],            // 掉落零件数量区间
  PART_DROP_COND_BONUS: 0.10,         // 品相每高一级，掉落概率 +10%
  PART_LOSS_ON_FAIL: 0.50,            // 修理失败时，已装上的库存零件报废概率（其余归还）

  /* ---------- 工具树（三类效果：鉴定古董/贵金属含量、成功率、减少维修费） ---------- */
  // discount = 当前等级累计的修理费折扣（作用于工时费 baseCost）
  TOOL_TABLE: [
    { lv: 1, name: '基础工具箱', en: 'Basic Toolkit',   rate: 0.62, perk: null,          perkEn: null,                 price: 0,    perkKey: null,    discount: 0 },
    { lv: 2, name: '电动工具',   en: 'Power Tools',     rate: 0.74, perk: '维修费 -15%',  perkEn: 'Repair cost -15%',   price: 220,  perkKey: 'cheap', discount: 0.15 },
    { lv: 3, name: '金属检测仪', en: 'Metal Detector',  rate: 0.82, perk: '看出贵金属含量', perkEn: 'Reveals metal content', price: 580, perkKey: 'metal', discount: 0.15 },
    { lv: 4, name: '焊接台',     en: 'Soldering Bench', rate: 0.90, perk: '维修费 -30%',  perkEn: 'Repair cost -30%',   price: 1400, perkKey: 'cheap', discount: 0.30 },
    { lv: 5, name: '鉴宝台',     en: 'Appraisal Bench', rate: 0.95, perk: '鉴定古董真伪', perkEn: 'Identifies antiques', price: 3300, perkKey: 'antique', discount: 0.30 }
  ],

  /* ---------- 特殊商品（藏钱） ---------- */
  // 保险柜、售货机这类「特殊商品」拆开后可能藏着现金
  SPECIAL_CASH: {
    chance: 0.6,                      // 特殊商品里藏钱的概率
    amount: [30, 500]                 // 藏钱金额区间（元）
  },

  /* ---------- 夜间翻垃圾桶（v3 新增） ---------- */
  // 每晚一次，三个地点各有产出侧重与风险；捡到的废品零成本进工作台
  SCAVENGE: {
    perNight: 1,                      // 每晚可翻几次
    itemConditionPenalty: 1,          // 捡来的废品品相下调几级（最低 1）
    itemMissingGuarantee: true,       // 捡来的废品必定至少缺 1 个零件
    spots: [
      {
        key: 'community', weights: { empty: .30, mat: .40, part: .15, cash: .08, item: .07 },
        mats: ['plastic', 'iron'], qty: [1, 6], partCount: [1, 2],
        tiers: ['common', 'common', 'mid'], cash: [5, 40], risk: null
      },
      {
        key: 'alley', weights: { empty: .22, mat: .25, part: .35, cash: .05, item: .13 },
        mats: ['pcb', 'copper', 'aluminum'], qty: [0.5, 3], partCount: [1, 2],
        tiers: ['common', 'mid', 'valuable'], cash: [10, 60],
        risk: { chance: 0.28, kind: 'hurt', cost: [30, 80] }
      },
      {
        key: 'uptown', weights: { empty: .25, mat: .10, part: .10, cash: .25, item: .30 },
        mats: ['copper', 'aluminum', 'pcb'], qty: [1, 4], partCount: [1, 2],
        tiers: ['mid', 'valuable'], cash: [30, 150],
        risk: { chance: 0.18, kind: 'fine', cost: [50, 50] }
      }
    ]
  },

  /* ---------- 时间与天数 ---------- */
  START_DAY: 1,                       // 开局是第几天
  DAY_CUSTOMER_LIMIT: 3,              // 每天最多接待几批顾客（用完必须收摊过夜）
  INTRADAY_SWING: 0,                  // 日内市价波动（0 = 一天之内价格固定）
  DAILY_PRICE_SWING: 0.18,            // 过夜时材料市价漂移 ±18%
  PRICE_REVERT: 0.15,                 // 向基准价回归的力度，防止连涨连跌跑飞
  PRICE_FLOOR_COEF: 0.55,             // 市价下限 = 基准价 × 系数
  PRICE_CAP_COEF: 2.20,               // 市价上限 = 基准价 × 系数

  /* ---------- 钱庄：理财 ---------- */
  FINANCE: {
    demand: {                         // 活期：随时存取，每天结算利息
      key: 'demand', name: '活期存钱罐', en: 'Demand Savings',
      dailyRate: 0.004, lockDays: 0, minAmount: 0
    },
    fixed: {                          // 定期：锁定 7 天，到期自动本息到账
      key: 'fixed', name: '七天定期', en: '7-Day Fixed',
      dailyRate: 0.012, lockDays: 7, minAmount: 100,
      earlyPenalty: 0.01              // 提前支取：按活期利率计已存天数，并扣本金 1%
    },
    futures: {                        // 期货：押某种材料隔夜涨跌，第二天开盘即结算
      key: 'futures', name: '期货囤货', en: 'Futures Hoarding',
      lockDays: 1, minAmount: 100, fee: 0.02,
      leverage: 4,                    // 收益/亏损 = 价格变动幅度 × 杠杆
      winFloor: 0.30, winCap: 1.60,   // 押中：最少赚 30%，最多赚 160%
      loseFloor: 0.35,                // 押错：至少还剩 35% 本金
      drawBand: 0.005                 // 变动幅度小于此值算平局，退本金（仍扣手续费）
    }
  },

  /* ---------- 钱庄：贷款 ---------- */
  LOAN: {
    dailyRate: 0.005,                 // 日息 0.5%，温和模式：没有到期日、不催收
    baseLimit: 800,                   // 基础额度
    worthRatio: 1.0,                  // 额度 = 基础额度 + 身家 × 系数 - 未还本金
    minBorrow: 100                    // 单次最低借款额
  },

  /* ---------- 存档与日志 ---------- */
  SAVE_KEY: 'recycle.v3.save',        // 旧版存档键（启动时自动迁移到槽 1）
  SAVE_KEY_PREFIX: 'recycle.v3.slot.',// 槽位存档键前缀（= 前缀 + 槽号）
  CURRENT_SLOT_KEY: 'recycle.v3.current', // 当前激活槽号
  SAVE_SLOTS: 3,                      // 存档槽数量
  AUTOSAVE: 'state-change',           // 状态变更即写
  LOG_LIMIT: 80,                      // 流水账最多保留条数

  /* ---------- 行情 ---------- */
  MARKET_MODE: 'daily',               // 行情驱动模式：按天更新（过夜结算时刷新）

  /* ---------- 显示精度（非经济数值） ---------- */
  DECIMALS: { weight: 1, money: 2, price: 2 }
};

/** 数值平衡目标（沿用 v2，用于人工校验，不参与逻辑） */
export const BALANCE_TARGET = {
  materialVsCost: '材料价值 ≈ 成本的 0.6~1.2 倍',
  sellVsSalvage: '售价期望 ≈ 拆解价值的 1.5~2 倍'
};

export default CONFIG;
