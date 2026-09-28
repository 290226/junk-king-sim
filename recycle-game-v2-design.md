---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: acad2337da1039b483b6a2305f367fc1_4d3d2cc2b5a711f188f9525400248c00
    ReservedCode1: 3hsYV5HsQqILnIgFrcEq0iDh6wGcpYm5h+7pdVsbvdGwJm9MPr60mL3SjizaS+4zVQAolHzz/jqSLjk7ggFBk/o4MUJBPbyzHZoqe2s2oQZPG5rbs9v/NCz4AF5Jg9XH7hGjbEiw1jX4EQJe65oPeoZSNvFLJiLiBWkpPV0pA4yPjeLFSfrMio/kc+U=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: acad2337da1039b483b6a2305f367fc1_4d3d2cc2b5a711f188f9525400248c00
    ReservedCode2: 3hsYV5HsQqILnIgFrcEq0iDh6wGcpYm5h+7pdVsbvdGwJm9MPr60mL3SjizaS+4zVQAolHzz/jqSLjk7ggFBk/o4MUJBPbyzHZoqe2s2oQZPG5rbs9v/NCz4AF5Jg9XH7hGjbEiw1jX4EQJe65oPeoZSNvFLJiLiBWkpPV0pA4yPjeLFSfrMio/kc+U=
---

# 收废品经营游戏 v3 · 设计文档

> 版本：v3（覆盖更新 recycle-game-v2-design.md）｜ 前身：v1 demo：recycle-game.html
> 数值约定：**所有可调数值统一集中在【架构框架】的 CONFIG 数值表（唯一来源）**，正文只引用参数名，不重复写数值。

## 【玩法设计】

**核心循环**：顾客上门（带 1~3 件废品）→ 讲价（谈「每斤多少钱」）→ 上称称重 → 按 单价 × 重量 结算入库 → 逐件决策【修理 / 拆解】→ 变现 → 升级工具 → 等下一批顾客。

1. **收购环节改为「顾客上门」**：每位顾客随机携带 CUSTOMER_SIZE 件废品（类型、重量均随机）。玩家与顾客逐轮讲价，谈的是**每斤单价**；谈拢后上称称重，按 `单价 × 重量` 结算（现金不足不能成交）。开局现金见 CONFIG.START_CASH。
2. **讲价阶段不显示准确重量**：卡片只给**目测区间**（宽度由 CONFIG.EYE_BAND 决定），玩家凭区间与材料行情估价值；称重后才揭示确切重量与总价。工具 5 级可解锁**准确重量估算**。
3. **顾客隐藏心理底价**：底价 = 该批材料价值 × CONFIG.RESERVE_COEF。报价 ≥ 底价 → 立即成交（报价越高玩家成本越高）；报价 < 底价 → 按 CONFIG.COUNTER_OFFER_CHANCE 概率还价一次（还价 = 底价 × CONFIG.COUNTER_MARKUP），或按 CONFIG.LEAVE_CHANCE 概率直接离开（丢单）。
4. **全部废品按重量计**：每件废品有重量（斤）；拆解产出的**每种材料也有重量**；材料一律按 **元/斤** 计价（价格表见 CONFIG.MAT_PRICE）。
5. **拆解不再一键完成**：每次点击「拆」只拆出**一种**材料，实时显示「材料名 X 斤 × ¥Y/斤 = ¥Z」并即时入库；该件材料全部拆完才结束。
6. **「年代感」标记噪音化**：任意物品（无论是否真古董）都有 CONFIG.AGE_MARK_CHANCE 概率带「年代感」标记，玩家无法据此判断真伪；真古董概率仍由 CONFIG.ANTIQUE_CHANCE 控制。
7. **工具树能力调整**：5 级能力由「疑似古董提示」改为**「显示准确重量估算」**；3 级保留「显示估值区间」。
8. **存档**：自动保存现金、库存、材料、工具等级、统计到 localStorage，刷新继续；另提供「重新开始」按钮清档。
9. **行情系统（预留）**：当前版本市价每批进货波动 CONFIG.PRICE_SWING；CONFIG 已预留 MARKET_MODE / DAILY_DRIFT / TICK_MINUTES 参数位，后期扩展为按天/按时间驱动的行情，届时**卖出时机**成为核心决策。
10. **保留 v2 已确认内容**：售价随机系数四档（CONFIG.SELL_COEF）、古董售价 CONFIG.ANTIQUE_MULT 倍、已损坏物品材料减半（CONFIG.FAIL_SALVAGE）、五级工具树；因收购成本改为动态重量计价，工具价格与各级成功率已**重新校准**（见 CONFIG.TOOL_TABLE 与「校准依据」）。

## 【架构框架】

**CONFIG 数值表（唯一来源）**

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| START_CASH | ¥200 | 初始现金 |
| CUSTOMER_SIZE | 1~3 件 | 每次上门携带件数 |
| ITEM_WEIGHT | 2~40 斤/件 | 单件废品重量区间 |
| EYE_BAND | ±25% | 讲价阶段目测重量区间宽度（相对真值） |
| RESERVE_COEF | 0.60~0.90 | 顾客心理底价 = 该批材料价值 × 系数 |
| COUNTER_OFFER_CHANCE | 60% | 报价低于底价时还价一次的概率 |
| LEAVE_CHANCE | 40% | 报价低于底价时直接离开的概率 |
| COUNTER_MARKUP | 1.05~1.15 | 还价报价 = 底价 × 系数 |
| MATERIAL_WEIGHT_RATIO | 0.50~0.80 | 拆解材料总重 / 物品重量 |
| MAT_PRICE | 铜 ¥18/斤、铁 ¥1.2/斤、铝 ¥5/斤、塑料 ¥0.8/斤、电路板 ¥25/斤 | 材料市价（元/斤） |
| PRICE_SWING | ±10% | 每批进货时材料市价波动 |
| SELL_COEF | 70%→0.8~1.6；20%→1.6~2.5；8%→2.5~4；2%→5~10 | 售价 = 隐藏基准值 × 随机系数（品相越高越易落高区间） |
| ANTIQUE_CHANCE | 5% | 真古董概率 |
| AGE_MARK_CHANCE | 50% | 「年代感」标记概率（与真伪无关，纯噪音） |
| ANTIQUE_MULT | 10~50 倍 | 古董修理成功后揭示身份的售价倍数 |
| FAIL_SALVAGE | 0.5 | 已损坏物品拆解材料减半 |
| REPAIR_TIME_BASE | 2000 ms | 基础修理耗时（4 级及以上 ×0.7） |
| BALANCE_TARGET | 材料价值 ≈ 成本的 0.6~1.2 倍；售价期望 ≈ 拆解价值的 1.5~2 倍 | 数值平衡目标（沿用 v2） |
| SAVE_KEY / AUTOSAVE | 'recycle.v3.save' / 状态变更即写 | 存档键与自动保存时机 |
| MARKET_MODE | 'batch'（预留 'daily'） | 行情驱动模式 |
| DAILY_DRIFT / TICK_MINUTES | 预留、当前版本不启用 | 按天 / 按时间行情参数位 |

**CONFIG.TOOL_TABLE（重校准后的完整数值表）**

| 等级 | 工具 | 成功率 | 附加能力 | 升级价 |
| --- | --- | --- | --- | --- |
| 1 | 基础工具箱 | 55% | — | 初始拥有 |
| 2 | 电动工具 | 68% | — | ¥180 |
| 3 | 检测仪表 | 78% | 显示估值区间 | ¥450 |
| 4 | 焊接台 | 88% | 修理耗时 -30% | ¥1100 |
| 5 | 专业维修台 | 94% | 显示准确重量估算 | ¥2600 |

**校准依据**：收购成本改为「单价 × 重量」后，玩家最多只能压到顾客底价（≈ 材料价值 × CONFIG.RESERVE_COEF），毛利空间被压缩，故整体下调升级价（¥200/500/1200/3000 → ¥180/450/1100/2600），并让低级工具更保守（60/72/82/90/95% → 55/68/78/88/94%），使 1→5 级的升级支出约等于「3~8 批货的可支配毛利」，同时保留 5 级的高阶回报。

**模块划分**：CONFIG（全部可调参数）｜ Customer（顾客生成与心理底价）｜ Offer（报价与还价、目测区间）｜ Scale（称重结算）｜ ItemFactory（类型、重量、品相、古董判定、材料清单、隐藏基准值）｜ DismantleQueue（逐步拆解，每次出一种材料并入库）｜ Economy（市价波动、售价抽样、结算）｜ GameState（cash / customers / workbench[] / materials{} / toolLevel / stats）｜ Save（localStorage 存档 + 重新开始）｜ Actions（nextCustomer / makeOffer / acceptCounter / weigh / repair / dismantleStep / sellItem / sellMaterials / upgradeTool）｜ Renderer（顾客与卡片、称重面板、材料面板、工具面板、操作日志）。

**状态机**：
- 单件：待处理 → 修理中 → 已修复 → 已售 ／ 待处理 → 已拆解 ／ 修理中 → 已损坏 → 拆解中 → 已拆解
- 上门流程：GUEST_IN → HAGGLE → (COUNTER) → DEAL / LEAVE → WEIGH → STORED

**数据模型**：

```
item     = { id, name, kind, weight(真值隐藏/仅给目测区间), condition(1~5), ageMark, isAntique(隐藏),
             hiddenBaseValue(隐藏), materials[{key, qtyLb, unitPrice}], state, repairCost, revealedValue, priceRange }
customer = { id, items[], reservePrice(隐藏), countersLeft }
market   = { matPrices{key → ¥/斤}, mode, lastUpdate }
save     = { cash, workbench[], materials{}, toolLevel, stats, market }
```

## 【开发要点（防遗忘锚点）】

- 所有可调数值（底价系数、还价/离开概率、重量区间、材料单价、售价系数、工具表、存档键、行情预留位）只能来自 CONFIG，严禁写死在逻辑分支里。
- isAntique / hiddenBaseValue / reservePrice / 重量真值在「称重或修理成功」前严禁出现在任何可见文本或 DOM 属性中；目测区间必须另行生成，不能直接绑定真值。
- 「年代感」是噪音标记：渲染层不得由 ageMark 反推 isAntique；5 级的「准确重量估算」只能展示重量，不得泄露古董身份。
- 拆解必须走 DismantleQueue 逐材料推进，每次点击只出一种材料并即时入库，展示格式固定为「材料名 X 斤 × ¥Y/斤 = ¥Z」。
- 「无钱可走」兜底：现金不足时不能收货/修理，但拆解与卖材料始终免费可用；所有按钮覆盖禁用态与提示文案。
- 存档读写必须 try/catch 包裹，localStorage 不可用时静默降级为内存态；「重新开始」需二次确认后清档。
- 行情预留参数位（MARKET_MODE / DAILY_DRIFT / TICK_MINUTES）当前不生效，切换 daily 前不得改动其它逻辑。
- 视觉：废品站工业风，深色底 + 金属锈色点缀；图标用 CSS 几何或内联 SVG，禁用 emoji 与外部图片；窄屏自动单列。
*（内容由AI生成，仅供参考）*
