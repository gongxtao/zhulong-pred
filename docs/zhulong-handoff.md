# 烛龙 ZHULONG · 交接文档

> 写给下一个开发会话。框架已与用户对齐锁定，继续优化前**必读本文**。
> 最后更新：2026-08-29 14:45（交接收口：feat-008/010/011 完成，主图视觉减法定稿，verify 30/30）· 提交截止：8/29 24:00

## 0. 一句话现状

**web/ 是主交付物**（feat-008 平移 + feat-010 秒开 + feat-011 实时校准 + 视觉减法，`15fb466`）：
`web/src/lib/zl/` 七模块（util/const/sim/store/supabase/forecast/engine）+ React 静态骨架
（page.tsx 的 id/class 与原型对齐保断言口径）+ globals.css（原型样式平移，CVD 色板未动）。

- **boot = 快照秒开（~1s 全量 14 年渲染）→ 后台静默同步近窗/日峰/pred（~12s）→ 徽章「在线 · Supabase」
  并重算指标收敛 §5 基线**；离线保持「真数据 · 快照」可用；快照缺失才走在线 Layer-1 慢路径（4s 跳过按钮）→ sim
- **查看任一历史段 = 实时查询**：ensureWindow 对「缺失或未校准（快照来源）」视窗发起真实 Supabase range
  查询（溯源 liveDays/livePredOrigins；toast + 网络面板可见；同窗二次零重查）；数据回来 FC_CACHE.clear+重渲
- **时光机重演可退出（三入口）**：决策条「↩ 回到实时」/ 重演 chip「✕」/ 胶片拖到轴最右段（NOW−5d 内）松手磁吸
- **主图（视觉减法定稿，用户裁决勿回退）**：实际(青) + P50 虚线 + **单层** P10–P90 概率带 + NOW 线 + 峰时刻
  虚线 + 右上 title 决策标注（日峰/最坏/建议备）+ 龙睛。**已删**：历史峰值记录线、预备窗琥珀竖带、内层
  P25–P75 窄带——相关信息按需呈现于悬停 title / 弹层 / 审计卡
- 默认深色（无 localStorage 记录时 dark，手动切换过则尊重）；主题/上帝视角等状态切换一律走 renderAll（坑 11）

**验证**：`cd web && node scripts/verify.mjs`（playwright-core + 系统 Chrome **有头**独立实例，30/30；
含秒开计时/同步收敛/三入口退出/磁吸/实时校准请求/离线兜底/三区/极涡话术/视觉减法断言）。
dev：`cd web && npm run dev -- --port 3100`。原型冻结为 spec 与兜底（原型线另有并行演进，见 §6）。

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

## 2. 框架（v18 定稿 + 8/29 用户裁决修订，勿动结构）

```
顶栏（吸顶）：烛龙 brand · 区域切换 · 时钟 · 徽章（同步中→在线·Supabase/真数据·快照）· ☾/☀ · 演示按钮
⓪ 决策层（通知条·一行）：[⚡ 建议动作·未来24h] 预备窗 X–Y 内，预备 N MW 调峰资源 ⓘ [等级]
   数字内联 27px 琥珀；左色条=风险；重演态 [↺ 时光机·重演] 起点…对质 [上帝视角 开/关] [↩ 回到实时]
   依据在 ⓘ 弹层（P50→P90·距纪录·较30日·爬坡·校准·公式 + 审计链接；与 ⓘ/☰ 互斥）
① 状态层四格对等醒目（用户红线：现在负荷/预测偏差/今日峰值/预测误差 不可弱化）
   解剖：自解释标签 12px + ⓘ 解释（共用 sqTip 弹层）+ 24px 数字 + 唯一子数据
   被裁子指标（P90距纪录、±1.5%、MAPE口径等）在 ⓘ 弹层与格子 title 里
② 主线层【时空推演·时间机器一体卡】：全宽主图 clamp(290px,37vh,400px)，默认 3 天视窗
   实际(青)·昨日(灰)·NOW·单层 P10–P90 概率带·P50(虚线)·上帝视角(点线，可☰关)·峰时刻(垂直虚线)
   右上 title 两行：日峰 P50·时刻 / 最坏 P90·建议备 MW（防右缘裁切，勿改回 markLine label）
   [温度带｜偏差带(NOW右虚线)] · 龙睛光环在曲线终点
   ↕ 零隔层紧贴：#filmDock 擦洗器（实时chip[可点✕回实时]·日期胶囊·极端日chips·可拖NOW；
     拖到最右段松手磁吸回实时）
   ─ 细线 ─ 图例单行chip（P10–P90 区间·90% 可能落入）· 频率句(单带版)＝字幕沉底
③ 证据层两卡：为什么·归因（Δ温度×灵敏度，可复算）│ 可信·审计（覆盖率+MAPE+持久性基线对比）
抽屉（区域对比/极端日/热力图）· 弹层四件套（互斥）
首屏预算：通知条+状态+主图卡(含胶片) = 783px < 900 视口，一屏收齐；默认深色
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

## 3. 代码结构（改哪里找哪里 · web 主架构 v4 = 秒开 SWR + 视窗实时校准）

```
web/src/lib/zl/（算法照抄原型，TS 化；React 只做静态骨架，engine 命令式接管渲染）
util.ts     时间/格式/随机工具（LOC/locDay/dayTs/etP/quantile…）
const.ts    ZONES/EVENTS/H_FC/RANGES/THEMES(light|dark CVD 调色板)/SQ_TIPS
sim.ts      仿真兜底（simLoadAt/simTempAt/eventW）
store.ts    唯一数据后端 store（hours/daily/pred/predOrigins/cal/model）+ 溯源
            liveDays/livePredOrigins（实时校准标记）+ 锚点(T_MIN/T_MAX/NOW_DEFAULT/D0/D1,
            applyAnchors(preserveView)) + loadAt/tempAt/candsFor/buildDaily + dbgHook
supabase.ts SB(env NEXT_PUBLIC_*) · sbFetch(3 重试)/sbPage(分页) · bootLayer1(preserveView)
            （daily 视图替换式写入 + 近120天×3区 + 近70d pred_static + 模型元数据）
            · ensureWindow（缺失**或未校准**都查；小时[origin-80d,+2d]+模型纪元 pred[-48h,origin]）
            · fetchHoursRange(成功即 markLiveDays) · ingestPred(标记 livePredOrigins)
            · loadSnapshot/storeFromSnapshot（快照兜底）· setLiveMergeHook（合并→engine 清缓存重渲）
forecast.ts FC_CACHE(memo) · forecastAt（pred 起点偏移重索引 mh=off+h 注入 + 相似日兜底 + CAL）
            · buildCal/backtest(28×24h)/buildPers/replayBT · BT/PERS/CAL
engine.ts   图表实例+renderAll 标准路径（状态切换一律走它，坑 11）· renderDecision/StatusQuad/
            Main/Film/Attrib/Cred/SM/Heat/Extremes · boot()（快照先行→后台 bootLayer1(true)→
            startEngine('live')）· setOrigin/setZone(非 sim 一律 ensureWindow) · 胶片拖拽(rAF)+
            最右段磁吸回实时 · 演示六幕 · setTheme · mountEngine/dispose
app/        page.tsx 骨架（id/class 与原型对齐=断言口径）· layout.tsx（THEME_INIT 默认 dark +
            快照 <link rel=preload>）· globals.css（原型样式平移）
scripts/    verify.mjs（30 项断言，playwright-core 系统 Chrome **有头**独立实例）· shot.mjs 截图
public/data/zhulong-data.js  内嵌快照（与 docs/prototype/data 同 git blob，零体积）
快照再生成：ZL_SKEY=<service_role> node scripts/build-snapshot.mjs（密钥只走环境变量，勿入库）
```

**boot 时序（勿乱）**：快照 loadSnapshot → storeFromSnapshot → SRC=snapshot → startEngine（快照口径
cov 87.9/53.3）→ 徽章「同步生产库…」→ 后台 bootLayer1(true)（不打断用户浏览位置）→ SRC=live →
startEngine 重算（cov 收敛 85.6/49.0=§5 基线）→「在线 · Supabase」。失败保持快照。
**数据流红线**：快照全量在 store → 任何跳转即时渲染；ensureWindow 只为「实时校准」发查询（用户要求
看历史=实时查询）→ 合并后 FC_CACHE.clear()+renderAll（数字同源通常不变）→ 同窗零重查。

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
13. **改码后立即跑 verify 会撞 Next dev 热重编译**（新旧 chunk 混用出现幻影失败）——verify 已加
    编译预热（先 request.get），且 phase2 等「数字稳定到基线」而非徽章；切区断言先等 zoneCap 渲染确认
14. **胶片轴右端 = T_MAX（≈NOW+4.2 天预测远端），不是 NOW**——「拖到最右=回现在」的磁吸窗必须按
    NOW−5d 设（±24h 够不着右缘像素），已按此实现
15. **markLine label 的 align 在 ECharts 6 语义化 position 下不生效**——长标注防裁用 title 组件固定
    图右上，勿改回 markLine label（用户实测被遮两次）
16. **多会话并行时浏览器要隔离**：共享 chrome-devtools MCP 会互相踢；verify 用 playwright-core +
    系统 Chrome 独立实例（用户要求有头模式直测）；pkill 共享实例会打断别的会话，勿再犯

## 5. 验证基线（web v4：审计 = 日前 24h · CAL = 近 60 天 pred_static 残差，改完必须对上）

**先决**：`bash init.sh` 全绿；dev server 在 3100（`cd web && npm run dev -- --port 3100`）。
**web 主路径（秒开 SWR）**：刷新 ~1s 出全量（快照口径 cov 87.9/53.3）→ 徽章「同步生产库…」→ ~12s 后
「在线 · Supabase」且数字收敛下列基线；**跳任何历史段发真实 range 查询（toast + 网络面板可见，同窗
二次零重查）**；离线保持「真数据 · 快照」；重演三入口可退出；拖拽永不冻结（快照全量在店）。

- BT.AEP：MAPE **3.57** / cov90 **85.6** / cov50 **49.0**（DAYTON **5.43**，DOM **5.40**）
- 模型行：WAPE 3.82% vs 昨日基线 6.51% ↓41%（DAYTON 3.43/7.48 ↓54%，DOM 5.08/7.97 ↓36%）
- 四格基线（AEP live @2018-07-31 05:00 EST）：现在负荷 **12,926** · 偏差 **−2.03%** · 今日峰 **18,261 @16:00** · 误差 **3.57%**
- 决策通知条：预备 **2,450 MW**；主图右上 title 两行完整可见（防裁断言）
- 极涡重演（jumpTo 2014-01-06）：持久性 **17.02% → 相似日 23.14% 落后于基线**——杀手锏话术成立
  （实时校准合并后数字不变，verify 已断言）
- 视觉减法断言：无历史峰值 markLine / markArea=0 / 系列无 b50 有 b90 / 图例无「历史峰值」
- 一键全量回归：`cd web && node scripts/verify.mjs`（30/30）；截图 `node scripts/shot.mjs`
- 旧基线（v3 原型在线懒加载）：同 MAPE/cov；v2 全量在线 3.64/88.8/52.2；仿真 2.34/87.8/46.3

## 6. 待办（按优先级）

1. **feat-009 收口（本会话已覆盖大部分）**：剩余 CSV 下载实检、演示全流程带妆走查一遍（六幕按 D）、
   提交材料整理。web 已 30/30 断言（verify.mjs），直接以 web 为主提交、原型一并入库兜底
2. **原型↔web 细节对齐（可选）**：原型线并行演进了上帝视角全联动（图例 chip 退场/横幅文案/审计口径
   切换，`6cbfea6`+）与渐进启动（`ecad8df`）——web 已有等价秒开/退出机制，联动细节若要平移须逐项
   对照用户裁决（视觉减法在 web 已超出原型，勿反向覆盖）
3. ~~web 平移/秒开/实时校准/视觉减法~~ ✅ feat-008/010/011（`15fb466`）
4. 可选：energy_forecasts 管道跑起来后切真前瞻；模拟器 cron 开启（"活的 NOW"）

## 7. 演示剧本（按 D）

纵深(热力图)→节律(区域对比)→推演(收抽屉)→**验证(自动跳2014极涡,预测vs真实对质)**→自证(审计卡)→落地(决策层+品牌句「烛龙：睁眼为昼，闭眼为夜」)。
评分对应：问题洞察25/现场Demo25/完整度20/落地20/人气10（贵州黑客松赛道二）。
话术资产：①拖到极涡→toast「查询生产库」实时校准→审计卡"天气突变段落后于基线(相似日盲区,正是接入
气象预报的论据)"→"我们知道自己什么时候不行"；②刷新秒开→"页面内嵌真数据快照秒开，任何你看的历史段
都在实时向生产库对账"（SWR，网络面板可验）；③P10–P90 带＝台风路径圆锥，越远越宽=越不确定。
