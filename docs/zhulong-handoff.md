# 烛龙 ZHULONG · 交接文档

> 写给下一个开发会话。框架已与用户对齐锁定，继续优化前**必读本文**。
> 最后更新：2026-08-29 13:50（feat-010 完成：web 秒开 SWR 架构 + 上帝视角退出修复 + 默认深色）· 提交截止：8/29 24:00

## 0. 一句话现状

**web/ 正式工程已就绪并通过 handoff §5 全部断言（feat-008 平移 + feat-010 秒开改造）**：
`web/src/lib/zl/`（util/const/sim/store/supabase/forecast/engine）+ React 静态骨架 + globals.css。
**boot = 快照秒开（~1s 全量 14 年渲染）→ 后台静默同步生产库（SWR，~12s）→ 徽章切「在线 · Supabase」
并重算指标收敛到 §5 基线**；离线保持快照可用；默认深色主题；时光机重演可经 决策条「↩ 回到实时」/
重演 chip ✕ / 拖到轴最右段松手磁吸 三入口退出。断言脚本：`web/scripts/verify.mjs`（playwright-core 有头，
21 项）。dev：`cd web && npm run dev -- --port 3100`。原型冻结为 spec 与兜底（另一线在做原型上帝视角联动，
web 侧尚未同步其图例 chip/横幅文案细节，收口时对齐）。

## 1. 文件地图（只看这些）

| 文件 | 说明 |
|---|---|
| `web/` | **主战场**：Next16+TS 正式工程（feat-008 平移完成）；`src/lib/zl/` 七模块 + `src/app/page.tsx` 骨架 + `globals.css`；快照 `public/data/` |
| `docs/prototype/zhulong.html` | 原型 v3（**冻结为 spec**，算法照抄来源；提交兜底） |
| `scripts/build-snapshot.mjs` | 快照生成器（ZL_SKEY 环境变量传入，绝不入库） |
| `CLAUDE.md` / `init.sh` / `feature_list.json` / `progress.md` | 工程 harness（启动验证走 `bash init.sh`） |
| `docs/zhulong-design.md` | 设计文档（布局/交互/方法论/质量记录/版本小史） |
| `docs/zhulong-handoff.md` | 本文 |
| `.shots/` | 验证截图（**v18_quad_final_\*** 双主题终稿；v17_strip / v16_qmark / v15_fused 为过程版） |
| `data/README.md` | Supabase `energy_hourly` 表结构 |
| ⚠️ `dashboard_v2~v8.html` | **旧线和他人的平行版本，全部忽略**（v8 是另一 AI 的简化重写，无时光机/演示模式，用户已裁决弃用） |

## 2. 框架（v18 定稿，勿动结构）

```
顶栏（吸顶）：烛龙 brand · 区域切换 · 时钟 · 演示数据徽章 · ☾/☀主题 · 演示按钮
⓪ 决策层（通知条·一行）：[⚡ 建议动作·未来24h] 预备窗 X–Y 内，预备 N MW 调峰资源 ⓘ [等级]
   数字内联 27px 琥珀；左色条=风险；重演态 [↺ 时光机·重演] 起点…对质 [上帝视角]
   依据在 ⓘ 弹层（P50→P90·距纪录·较30日·爬坡·校准·公式 + 审计链接；与 ⓘ/☰ 互斥）
① 状态层四格对等醒目（用户红线：现在负荷/预测偏差/今日峰值/预测误差 不可弱化）
   解剖：自解释标签 12px + ⓘ 解释（共用 sqTip 弹层）+ 24px 数字 + 唯一子数据
   被裁子指标（P90距纪录、±1.5%、MAPE口径等）在 ⓘ 弹层与格子 title 里
② 主线层【时空推演·时间机器一体卡】：全宽主图 clamp(290px,37vh,400px)，默认 3 天视窗
   实际(青)·昨日(灰)·NOW·双层扇形带·上帝视角(点线)·历史极值线·预备窗(琥珀)
   峰值两行标注含建议MW · [温度带｜偏差带(NOW右虚线)] · 龙睛光环在曲线终点
   ↕ 零隔层紧贴：#filmDock 擦洗器（无边线无小标题，"时光机"名在 hint；
     实时/重演chip·日期胶囊·极端日chips·可拖NOW）——主图=画面，胶片=进度条
   ─ 细线 ─ 图例单行chip · 频率句(脚注)＝字幕沉底；原独立 filmCard 已删除
③ 证据层两卡：为什么·归因（Δ温度×灵敏度，可复算）│ 可信·审计（覆盖率+MAPE+持久性基线对比）
抽屉（区域对比/极端日/热力图）
弹层四件套（互斥，页面无展开卡）：主图口径ⓘ · 叠加☰ · 决策依据（条内ⓘ）· 四格指标解释（标签ⓘ 共用 sqTip）
首屏预算：通知条+状态+主图卡(含胶片) = 783px < 900 视口，一屏收齐
```

**不可违背的设计原则**（历轮反馈换来的）：
1. 决策 = **一行通知条**（标签+消息+等级，~49px）；主视觉 = 时间机器。层级：告示→仪表→机器
2. 状态四格对等醒目，任何"突出重点"不得以弱化它们为代价
3. 单栏多层，无左右分栏（布局联动是历史 bug 源），无内部滚动条，看不完就页面滚动
4. **不可复算的数字不占屏**（SHAP、置信分都因此被删过）；参照系**按需呈现**（弹层/title），
   与决策层重复的数字不二次占屏——"深度是发现的，不是陈列的"
5. 诚实展示方法盲区（极涡段落后于持久性基线 = 接入气象预报的论据，是演示话术资产）
6. 双主题色板均经 CVD 六项验证，勿凭感觉改色
7. 时光机与主图是**同一台机器**（屏+进度条），勿再拆开或往中间插层

## 3. 代码结构（改哪里找哪里 · v3 懒加载架构）

```
CSS :root + html[data-theme="dark"]   全部视觉令牌（改色只动这里）
THEMES = {light, dark}                 图表调色板（改图表色动这里）
store（唯一数据后端）：hours Map<zone,Map<di,{L,T,H,W,P}F64(24)>> · daily Map<zone,[{ts,peak,ph,di}]>
      · pred Map<zone,Map<originTs,p[24]>> + predOrigins · cal[zone][h] · model
启动（异步 boot）：#loader 遮罩 → bootLayer1()（energy_daily 视图[order=zone,est_day] +
      近120天×3区 + 近70天 pred_static[CAL来源] + 模型元数据，~40请求≈12s）→ 失败回退
      loadSnapshot()→storeFromSnapshot() 全量灌 store → 再失败仿真（SRC: live|snapshot|sim）
按需：ensureWindow(zone,origin)（per-zone 串行队列+toast；小时[origin-80d,+2d]+pred[origin-48h,origin]）
      · windowReady()（拖拽冻结判定）· sbFetch（3 次重试）· sbPage（limit/offset 分页）
预测：forecastAt = 真模型注入（≤24h 最近 pred 起点偏移重索引 mh=off+h）+ 相似日基线兜底
      （25–48h/2017 前；candsFor 只取已加载日）+ CAL + FC_CACHE(memo)
评估：backtest(28起点×24h，审计=模型契约视界) + buildPers(24h) + replayBT(24h)
渲染：renderDecision/StatusQuad/Main/Film/Attrib/Cred/SM/Heat/Extremes/LegendTable
      （renderAll 带 try/catch 诊断日志 window.__renderLog）
交互：setZone/setOrigin（异步+originToken 令牌）/jumpTo/胶片拖拽（rAF 冻结式）/抽屉 tabs
      （sm tab 自动 ensure 三区）/弹层四件套/CSV
演示：DEMO 六幕 + demoToggle（D/Esc/←→）；boot 尾部预热极涡/热浪窗
主题：setTheme + localStorage('zl-theme')
快照再生成：ZL_SKEY=<service_role> node scripts/build-snapshot.mjs（密钥只走环境变量）
```

## 4. 已踩过的坑（红线清单）

1. **隐藏容器初始化 ECharts = 0×0**：heatC 必须 renderHeat 开头 `resize()`；抽屉展开后延时补 resize
2. **`overflow:hidden` 会裁切 tooltip**：时光机/热力图/小图三处 tooltip 已 `appendToBody:true`，新图表在有裁切祖先的容器里也要加
3. **FC_CACHE 时机**：buildCal 后必须 `FC_CACHE.clear()`，否则 backtest 吃到未标定结果（覆盖率会假跌到 77%）
4. **加权平均要除以权重和**（Σ(1/h)=2.45 教训）；任何"平均"先手算恒定值场景
5. **每处数字改动后跑指标断言**（见 §5），别只看页面正常——**目测转述截图会出错（吃过三次），
   以 evaluate 断言为准**
6. 相似日必须**按目标日星期**选（跨午夜星期切换），候选不晚于起点前一日（无泄露）
7. **弹层互斥必须双向闭环**：四个入口（口径/叠加/决策依据/四格解释）彼此都要关对方，
   漏一向就出现"两个弹层同屏"；且 renderDecision/renderStatusQuad 开头要隐藏弹层
   （innerHTML 换锚后旧弹层会悬空显示陈旧内容）
8. **弹层定位**：入口在页面左侧时必须左锚定（togglePop 第三参 'left'），右对齐会推出屏幕
9. **多区分页排序必须含唯一键**（order=zone,est_day 而非 est_day）——否则翻页可能丢行/重行；
   网关偶发瞬时 5xx，sbFetch 必须 3 次重试
10. **删常量先全量 grep 引用**（REAL 删除时残留一处 → startEngine 半途 ReferenceError，
    页面停在半初始化态且无提示——renderAll/startEngine 的 try/catch 诊断日志因此常驻）
11. **状态切换类交互（god/主题/区域等）一律走 renderAll 标准路径**——手工罗列渲染函数必漏
    （toggleGod 首版漏 renderCred）；renderLegendTable 已纳入 renderAll（图例含上帝视角联动 chip）
12. **localStorage 缓存注意 JSON 把 NaN 序列化为 null**——Float64Array.from 会把 null 变 0，
    hydrate 必须映射回 NaN；缓存路径要显式设 SRC（曾漏设致仿真与真模型混算）

## 5. 验证基线（v3 懒加载口径：审计 = 日前 24h · CAL = 近 60 天残差，改完必须对上）

**先决**：`bash init.sh` 全绿；HTTP 服务（`cd docs/prototype && python3 -m http.server 4173`）。
**懒加载在线模式（主路径）**：boot ≈12s / ~40 请求（近 120 天×3 区 + energy_daily 视图 + 近 70 天 pred_static
+ 模型元数据 + 极涡/热浪预热窗）；徽章「在线 · Supabase」；未加载区跳转 toast + 按需 range 查询 ≈1–2s；
拖拽过未加载区主图冻结提示「松手加载」；翻页请求有 3 次重试（网关瞬时 5xx）。

- BT.AEP：MAPE **3.57** / cov90 **85.6** / cov50 **49.0**（DAYTON **5.43**，DOM **5.40**）
- 模型行：WAPE 3.82% vs 昨日基线 6.51% ↓41%（DAYTON 3.43/7.48 ↓54%，DOM 5.08/7.97 ↓36%）
- 四格基线（AEP live @2018-07-31 05:00 EST）：现在负荷 **12,926** · 偏差 **−2.03%** · 今日峰 **18,261 @16:00** · 误差 **3.57%**
- 决策通知条：预备 **2,450 MW**
- 极涡重演（jumpTo 2014-01-06）：持久性 **17.02% → 相似日 23.14% 落后于基线**——杀手锏话术成立
- 回归点：切区域/跳极涡(预热秒跳)/拖到未加载区(冻结+松手加载)/回到当前(即时)/热力图/极端日/演示六幕/主题/弹层互斥
- 旧基线（全量在线模式，v2）：AEP 3.64/88.8/52.2（CAL=全 579 起点残差）；再旧仿真基线：2.34/87.8/46.3

## 6. 待办（按优先级）

1. **feat-009 全量回归与提交**：web 已过全部基线断言（见 progress.md 8/29 12:15 节），
   剩余：CSV 下载实检、双工程并排走查、`.shots/web_v3_*` 存档、收口提交。
   ~20:00 决策点已解除：web 与原型数字逐位一致，以 web 为主提交、原型一并入库兜底
2. ~~正式工程 web/ 平移~~ ✅ feat-008 完成（8/29 12:15，M1-M5 一次过）
3. ~~接 Supabase 真数据 + 懒加载~~ ✅ v3 完整落地（feat-005/006/007）
4. 可选：energy_forecasts 管道跑起来后切真前瞻；模拟器 cron 开启（"活的 NOW"）

## 7. 演示剧本（按 D）

纵深(热力图)→节律(区域对比)→推演(收抽屉)→**验证(自动跳2014极涡,预测vs真实对质)**→自证(审计卡)→落地(决策层+品牌句「烛龙：睁眼为昼，闭眼为夜」)。
评分对应：问题洞察25/现场Demo25/完整度20/落地20/人气10（贵州黑客松赛道二）。
杀手锏话术：拖到极涡→审计卡显示"天气突变段落后于基线(相似日盲区,正是接入气象预报的论据)"→"我们知道自己什么时候不行"。
