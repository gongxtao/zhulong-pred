# progress.md — 会话连续性日志（追加式）

## 2026-08-29 03:00 · A 线启动（原型接 Supabase 真数据）

**决策**：方案 A（保留单文件原型接线真数据），Next.js+Tailwind 移植赛后进行（原型当 spec）。
按 harness-creator 五子系统建 harness（CLAUDE.md / feature_list.json / progress.md / init.sh / session-handoff.md）。

**已完成（v14–v18，均验证过）**：决策通知条、四格权重重排+ⓘ、时光机深度融合进主图卡、龙睛、
弹层四件套互斥、文件迁至 docs/prototype/。旧基线见 handoff §5（仿真值）。

**Supabase 实测**：
- energy_hourly 292,914 行（真实 2004-10→2016-01-31）；energy_hourly_future 68,055 行（模拟 2016-01→2018-08-03，重叠 2,232）
- pred_static 41,688 行 = 3 区 × 579 日起点 × 24h（2017-01→2018-08）
- model_versions 1 个 active；training_trials 3 个（winner WAPE 4.05%，昨日基线 6.5–8.0%）
- energy_forecasts / forecast_runs 空；simulation_state 卡在 2016-01-31 未走
- RLS：energy_hourly + pred_static +（补 SQL 后）energy_hourly_future 可 anon 读；model_versions/training_trials 需 GRANT

**当前**：A 线五特性全部完成（2026-08-29 04:00）。真数据全链路上线：

- feat-001 快照：7.1MB zhulong-data.js（3 区 358,800 小时 + 模型元数据 + pred_static 聚合），init.sh 自检过
- feat-002 接线：REAL 查表（O(1)）、时间锚推导（NOW=2018-07-31 05:00 EST）、徽章「真数据 · PJM+ERA5」、口径双分支
- feat-003 真模型注入：forecastAt 偏移重索引（mh=off+h）→ 生产模型 p50+真残差分位带；审计口径改 24h（模型契约视界）
- feat-004 审计卡：modelLine 显示生产模型 WAPE vs 昨日基线；天气四格真值
- feat-005 回归：零失败；**极涡话术在真数据成立**（持久性 17.02% → 相似日 23.14% 落后）

**真数据基线（handoff §5 已更新）**：AEP 3.64/88.8/52.2 · DAYTON 5.58/81.1/42.9 · DOM 5.47/87.2/48.5；hero 2,250/400/2,750 MW。

**关键工程决策**：
1. 审计口径 = 模型契约视界 24h（48h 混基线曾把 MAPE 打到 6.8% 劣于持久性；24h 纯模型段 3.64% 胜出 ↓38%）
2. forecastAt 偏移重索引使重演到 2017+ 任意时刻都能对质真模型预测
3. 快照走 `<script>` 标签避开 file:// fetch CORS；service_role 只走环境变量（init.sh 扫泄漏）

**下一步（可选）**：8/30 路演；赛后 Next.js 移植（原型当 spec）。

## 2026-08-29 05:00 · feat-006 在线数据模式（用户裁决："要真实数据，不然结果太假"）

- 启动改为异步 boot：`#loader` 遮罩（进度条 + 4s 后出现「跳过，使用内嵌快照」）→ `fetchLiveData()`
  在线拉 Supabase（249 请求 ≈25s，与快照同算法同数值）→ 失败回退动态 script 标签加载快照 → 再回退仿真
- 徽章三级：**在线 · Supabase**｜真数据 · 快照｜演示数据 · 仿真
- 修复：在线拉取器 modelId 字段名（API 是 model_id）；applyData 同步 window.ZL_DATA 便于断言
- 验证：24.4s 加载、live=true、3.64/88.8/52.2 与快照一致、模型行/极涡话术/三区/六幕/拖拽/主题全过
- 提交：225b921

## 2026-08-29 06:10 · 方向变更：冻结原型，转正式工程 web/（feat-007 归入新工程）

**用户裁决**："不希望在原型上面修改了，进入正式代码目录（src）"——Next.js + Tailwind 正式工程。
**已完成（本会话）**：
- `web/` 脚手架：Next.js 16.3 App Router + TS + Tailwind v4 + ESLint + **echarts 6.1**（npm）
- `web/.env.local` + `.env.example`（NEXT_PUBLIC_SUPABASE_URL / ANON_KEY，anon 公开安全）
- `web/README.md`（规格来源/命令/里程碑）；dev server 验证 HTTP 200（端口 3100）
- 原型 `docs/prototype/zhulong.html` **冻结为提交兜底**（在线全量模式，`7ad8fe0` 为最后提交）

**feat-007（懒加载）实现位置变更**：不再改原型，在 `web/src/lib/store.ts` 原生实现——
规格（三层架构/统一 store/视图口径转换/ensureWindow/并发去重/拖拽冻结/事件窗预热）不变，见上一节。
**移植基准**：原型即 spec——算法/配色（THEMES 双 CVD 调色板）/ECharts 选项/交互（弹层四件套、
六幕演示、胶片 rAF 拖拽）逐特性对照移植；验收 = 同一套 evaluate 断言对 handoff §5 基线。
**里程碑**：M1 懒加载 store → M2 决策条+四格 → M3 主图+胶片 → M4 证据层+抽屉 → M5 演示+主题 → M6 全量回归。
**注意**：echarts 6（原型为 5.5）——选项兼容性总体良好，markPoint/markLine/appendToBody 需逐项验证。
**兜底决策点**：若当日 ~20:00 新工程未过全量断言，提交原型版本。

### 架构（已与用户对齐）

| 层 | 内容 | 请求 | 时机 |
|---|---|---|---|
| 首屏 boot (~4s) | 近 120 天小时明细×3 区（预测/回测/决策够用）+ energy_daily 全量（胶片/热力图/极值/RECORD/last30）+ 近 60 天 pred_static（残差分位 CAL 用）+ model 元数据 | ~32 | 打开 |
| 按需 ensureWindow | 跳转窗 ±80 天小时明细（range 查询 gte/lte）+ 该区该起点附近 pred_static | 2–3，~1s | 拖胶片松手/极端日/热力图点周 |
| 兜底 | 断网→内嵌快照（populating 同一 store）；再不行仿真 | 0 | 仅失败 |

### 实现规格（关键决策已定，照做）

1. **统一 store（消灭 ZD/REAL 双后端）**：
   `store.hours: Map<zone, Map<di, {L,T,H,W,P}各Float64Array(24)>>`；`store.daily: Map<zone,{ts,peak,ph,di}[]>`；
   `store.pred: Map<zone, Map<originTs, p[24]>>` + `store.cal[zone][h]`（boot 时由近 60 天残差算，全局用）；
   `store.model`。loadAt/tempAt 查 store，缺→NaN（**live 模式禁用 sim 兜底，防假数据**）；sim 仅 src='sim'。
   快照回退：loadSnapshot() 的 ZD 数组**转写进 store**（121k×3 转换毫秒级），daily 用现有 buildDaily REAL 分支算。
2. **视图行转换**（口径对齐现有 daily[] 约定）：`di = locDay(peak_ts_utc)`；`ts = Date.parse(peak_ts_utc) - HOUR`
   （视图给的是区间右端，现有约定是小时起点 dayTs+ph*HOUR）；`ph = etP(ts).h`。
   视图 est_day 即 locDay 口径（date_trunc(ts+5h)），已核对。
3. **boot Layer-1**（替代现有 fetchLiveData 全量）：近 120 天用 `interval_end_utc=gte.<ts>` 分页；
   daily 视图分页 15 页；pred_static 用 `forecast_origin_utc=gte.<D1-70d>` 只拉尾部（~60 起点）。
   CAL 语义变化：残差分位来自近 60 天而非全 579 起点（方法论更好：近期残差更相关）→ **指标基线会小幅漂移，测完更新 §5**。
4. **ensureWindow(zone, originTs)**：缺的小时日集 [d0-80d, d0+2d] 一次 range 请求（可合并成区间 gte/lte）；
   2017+ 时补 `pred_static?zone=&forecast_origin_utc=gte.<origin-24h>&lte.<origin>`。
   返回 Promise；期间右下角 toast「⇄ 查询生产库 2014-01 …」。
5. **交互接线**：`setOrigin/jumpTo` → 先 toast + await ensureWindow 再 renderAll（避免 NaN 闪烁）；
   **拖拽预览冻结**（2026-08-29 补钉）：拖拽 rAF 阶段不发请求，且若目标窗未加载则**跳过 renderMain**
   （主图保持旧画面，只有胶片手柄/日期胶囊动）+ 右下角提示「松手加载」，pointerup 走 setOrigin 路径；
   `setZone` → ensure 该区近窗（首次切区 ~1s）；演示六幕的 jumpTo 天然走同路径。
5b. **并发去重**（补钉）：ensureWindow 按 (zone, 日期区间) 缓存 in-flight Promise，快速连跳
   （热力图连点/演示自动切幕）合并为一次请求，后到者 await 先发者。
5c. **演示事件窗预热**（补钉）：boot Layer-1 追加预取 2014 极涡窗与 2012 热浪窗（+3 请求），
   保证六幕第四幕零等待——这两窗也是评委最可能要求现场回放的时段。
6. **backtest/buildPers/buildCal**：基于 boot 近窗即可（28 起点候选日最深 origin-70d，120 天窗覆盖 ✓）。
7. **保留**：loader 遮罩（首屏）、4s 跳过按钮（跳到快照路径）、`window.ZL_DATA` 断言钩子、
   极涡话术、弹层四件套、CSV（窗口已 ensure）。
8. **验收**：首屏 <6s 出全部内容；拖到 2014 松手 ≤2s 出图；网络面板可见按需请求；
   指标新基线写入 handoff §5；回归清单全过；双主题截图 v20。

**会话恢复**：bash init.sh → 读 CLAUDE.md + docs/zhulong-handoff.md → 本文件本节 → feature_list feat-007。
**本地服务**：python3 http.server 4173 已随本会话结束而停，重启：`cd docs/prototype && python3 -m http.server 4173 --bind 127.0.0.1`（或 0.0.0.0 局域网）。

## 2026-08-29 11:30 · feat-007 懒加载在原型上完整落地（用户裁决变更实现位置）

**实现**（按规格 8 条 + 补钉 5b/5c 全部落地）：
- 统一 store（hours/daily/pred/predOrigins/cal/model）为唯一后端，消灭 ZD/REAL 双后端
- bootLayer1：energy_daily 视图（唯一排序 zone,est_day）+ 近 120 天×3 区 + 近 70 天 pred_static + 模型元数据
  （~40 请求 ≈12s）；极涡/热浪窗预热（演示第四幕秒跳）
- ensureWindow：per-zone 串行队列 + toast；pred 覆盖 [origin−48h, origin]（含偏差带昨日起点）
- 拖拽冻结：未加载区主图不重渲（防 NaN 空洞），提示「松手加载」，松手统一 setOrigin→ensure→render
- setOrigin/setZone 异步化 + originToken 令牌防过期渲染；renderAll try/catch 诊断日志（window.__renderLog）
- sbFetch 重试 ×3（600ms 递增退避）——实测网关有瞬时 5xx
- loadAt/tempAt live 缺数据=NaN 禁仿真填充；快照兜底走 storeFromSnapshot 全量灌入

**实测**：boot 12s/40 请求；跳极涡 0.6s（预热）；拖 2010 松手 ≈1s 加载渲染；回到当前即时；
三区 5.43/5.40/3.57；热力图/极端日/六幕/主题全过零错误。**新基线 AEP 3.57/85.6/49.0（CAL 语义变化，
handoff §5 已更新）**。截图 .shots/v20_lazy_{light,dark}.jpeg。

**踩坑记录**（handoff §4 已有，新增两条）：
- 视图/多区分页排序必须含唯一键（zone,day），否则翻页可能丢行
- 删常量（REAL）必须全量 grep 引用——一次 ReferenceError 让 startEngine 半途死、页面停在半刈化状态

## 2026-08-29 15:20 · 渐进式启动 + 可点击的重演控件（用户反馈两问题，仅原型）

**问题 1（用户）**：每次刷新都长时间等待——boot 虽是懒加载（40 请求），但**阻断式**遮罩等全部完成（~12s）。
**修法**：渐进式启动——
- 删除整页遮罩，页面**秒开**（静态骨架立即渲染）
- `bootCritical()` 首屏关键路径（当前区近 120 天 + 模型回测尾 + 元数据，并行 ≈2-3s）→ startEngine
- `bootBackground()` 后台补齐：14 年日峰视图**按区并行**（原串行 15 页 ≈13s → 3 流 ≈5s）→ 胶片/纪录线
  渲染 → 事件窗预热；期间 toast 非阻断提示，胶片区显示「14 年总览查询中…」占位
- **localStorage 缓存（SWR）**：`zl-cache-v1`（hours/daily/pred/cal/model，~370KB）——刷新秒开，
  后台 bootCritical+bootBackground 静默校验
- 渐进容错：renderDecision 对日峰未到时跳过距纪录/较30日段；heat/ext tab 等 `dailyReady`；
  buildDaily 对空 daily 天然安全（RECORD.v=−1 守卫）

**问题 2（用户）**：上帝视角/↺ 刷新图标"点不动"——它们是**死文本**（标签装饰字符/静态 tag）。
**修法**：全部变成真控件——
- 重演 banner「↺ 时光机 · 重演」→ 点击=回到当前（`backToLive`）
- banner「上帝视角 开/关」tag → 点击开关（`toggleGod`，与 ☰ 复选框双向同步）
- 四格「现在 · 重演起点 ↺」→ 点击=回到当前
- ☰ 叠加开关变更后同步重渲 banner（修掉 tag 状态陈旧）

**过程中修掉的两个真 bug（实证定位）**：
1. 缓存路径漏设 `SRC='live'` → 刷新后 loadAt 走仿真公式与真模型预测混算（MAPE 11.55% 垃圾值、徽章"仿真"）——已补
2. `presetAnchorsLive` 的 T_MAX（最后数据时刻 08-03T04Z）与 `applyAnchors`（最后数据日日末 08-04T04Z）
   差一天 → 冷/热启动 D1 不一致（3.64 vs 3.57 漂移）——预设统一为日末口径，两路径确定一致，基线应回 3.57
3. 缓存 JSON 把 NaN 存为 null → Float64Array.from 变 0——hydrate 时映射回 NaN

**验证状态**：init.sh 语法门全绿；冷启动机制实测（页面秒开、关键路径完成即出首屏、后台补齐）在断连前已过；
SRC/D1/NaN 三修复后**浏览器回归未跑**（chrome-devtools MCP 连接中断）——待手动或下会话验证：
刷新两次（冷→缓存）、检查徽章/基线 3.57/85.6/49.0、点 ↺ 与上帝视角 tag、拖 2010 松手加载。

**web/ 工程**：用户指示"只管原型"——本节改动**未同步 web/**，移植时需带上（boot/toggleGod/backToLive/缓存）。

**追加（同日 15:40）**：①默认主题改深色（localStorage 无偏好时 fallback 'dark'；已保存的偏好仍优先）；
②确认浏览器由另一会话占用——本会话不再触碰浏览器实例，验证改为用户手动清单。

## 2026-08-29 12:15 · feat-008 原型 v3 → web/ 正式工程平移完成（M1-M5 一次过）

**架构**：React 只提供静态骨架（page.tsx 照抄原型 body，id/class 逐一对齐保断言口径），
lib/zl/engine.ts 以命令式接管渲染与交互（与原型行为逐项一致）；
globals.css = 原型 <style> 原样平移（无 Tailwind 注入，避免 preflight 干扰令牌）。
分层：util/const/sim/store/supabase/forecast/engine 七模块，算法逐行照抄 TS 化。

**移植要点**：
- store + bootLayer1 + ensureWindow + windowReady + sbFetch×3 重试 + sbPage 分页（M1）
- forecastAt（pred 起点偏移重索引 mh=off+h + 相似日兜底 + CAL + FC_CACHE）/backtest×28/buildPers/replayBT（M2）
- 决策条/四格/主图+温度带+偏差带/胶片 rAF 冻结拖拽/归因/审计/抽屉三 tab/CSV/弹层四件套互斥（M3）
- DEMO 六幕 + D/Esc/←→ + boot 尾部极涡/热浪预热 + setTheme+localStorage + layout 前置主题脚本（M4）
- gridFrom 确认死代码未移植；快照 cp 至 web/public/data/（与原型同 blob，零 git 体积）

**实测（evaluate 断言，非目测）**：
- live 主路径：boot 13s/119 天×3 区/5055 日峰；四格 12,926/−2.03%/18,261@16:00/3.57%；
  MAPE 3.57/cov 85.6/49.0；预备 2,450MW——handoff §5 基线逐位对上
- 三区：DAYTON 5.43、DOM 5.40 ✓；模型行 3.43/7.48 ↓54% ✓
- 极涡重演：秒跳（预热）、持久性 17.02% → 相似日 23.14% 落后——杀手锏话术逐字成立
- 拖 2010 未加载区：冻结+「松手加载」toast，松手 1.5s 出图；回到当前 202ms
- 热力图（惰性 init 后 canvas 1579×153）/极端日 8 行（首行 2008/10/20 12:00 与原型一致）/六幕/主题来回/弹层互斥全过
- 兜底三级：snapshot（四格/MAPE 3.57 同源一致）、sim（MAPE 2.34 = 旧仿真基线逐位吻合）
- lint+tsc 零错零警；npm run build 成功（静态预渲染）；console 干净（ECharts 0×0 警告已修：heatC 惰性 init + reactStrictMode:false）

**截图**：.shots/web_v3_{light,dark}.jpeg。**dev**：web @3100（遗留 dev server HMR 在跑）；原型对照 @4173。

**遗留**：feat-009 全量回归收口（本会话已覆盖大部分，剩余：CSV 文件下载实检、多窗口并排对照走查）；
~20:00 决策点：web 已过基线，可直接以 web 提交，原型兜底仍在 HEAD。

## 2026-08-29 13:50 · feat-010 web boot 改造——秒开 SWR + 上帝视角退出 + 默认深色（用户裁决）

**问题**（用户实测反馈）：①每次刷新阻塞等待 ~12s 在线 Layer-1 才出内容，体验差；
②时光机进入重演后无法关闭上帝视角，必须刷新页面。

**boot 改造（stale-while-revalidate，替代原型 v3 阻塞式 Layer-1）**：
- 快路径：内嵌快照先行（layout `<link rel=preload>` 预取 + loadSnapshot）→ **~1s 全量 14 年渲染**
  （四格/MAPE 立即就位，cov 为快照口径 87.9/53.3）→ 徽章「同步生产库…」
- 后台静默 bootLayer1(preserveView=true)：完成 → SRC=live + startEngine 重算 → 徽章「在线 · Supabase」、
  cov 收敛 §5 基线 **85.6/49.0**；失败（离线）→ 保持快照可用，徽章「真数据 · 快照」
- 慢路径仅剩快照缺失时：在线 Layer-1（保留 4s 跳过按钮）→ 再失败 sim；loader 文案随路径动态化
- bootLayer1 daily 改替换式写入（同步路径防重复行）；applyAnchors(preserveView) 不打断用户浏览位置

**上帝视角退出（三入口 + 联动）**：
- 重演 chip 变按钮「重演 ✕」点击回实时；决策条重演态加「↩ 回到实时」按钮
- 胶片松手磁吸：拖到轴最右段（NOW−5d 内；轴右端=T_MAX≈NOW+4.2d，±24h 窗够不着右缘）→ 回实时
- opts 切换一律走 renderAll（坑 11；决策条「上帝视角 开/关」随之同步）

**默认深色**（用户裁决）：无 localStorage 记录时 data-theme=dark，手动切换过则尊重。

**验证（scripts/verify.mjs，playwright-core 系统 Chrome 有头独立实例——与并行会话的浏览器隔离，
21/21 通过）**：秒开 1.08s；后台同步后 12,926/−2.03%/18,261@16:00/3.57、cov 85.6/49.0、预备 2,450、
三区 5.43/5.40；极涡 17.02→23.14 落后话术；上帝视角三入口退出+点线移除(series 48→0)+决策条同步；
磁吸回实时/远处保持重演；离线保持快照；控制台零错误。lint+tsc+build 零错。
截图 .shots/web_v4_swr_{dark,light}.jpeg。

**已知差异**：原型线（另一会话）新增上帝视角全联动（图例 chip 退场/横幅文案/审计口径切换），
web 暂未同步——收口时对齐。window.ZL_DATA 增加 anchors 字段（tMin/tMax/nowDefault，磁吸诊断用）。

## 2026-08-29 14:10 · feat-011 历史视窗实时校准（SWR per view）+ 历史峰值线移除（用户裁决）

**问题**（用户实测反馈）：feat-010 秒开后，查看历史数据（拖 2014、跳极端日）一个 Supabase 请求都不发
——快照全量灌 store 后 ensureWindow「缺数据才查」永远不缺，「实时查询生产库」卖点消失。

**方案分析**：A 退回 v3 纯在线（12s 阻塞，复发等待问题）/ B 只查近窗首屏（仍等待+断网不可用）/
**C 秒开 + 视窗级实时校准（选定）**——store 加数据溯源 liveDays/livePredOrigins，
ensureWindow 升级为「缺失或未实时校准（快照来源）都发起真实查询」：
页面先用快照即时渲染（不等），同时查询该视窗（起点−80d~+2d 小时 + 模型纪元 pred ±48h），
toast 可见、网络面板可见真实请求；回来后合并 → FC_CACHE.clear → renderAll（数字同源通常不变）。
同窗二次访问零重查（已校准标记）。setOrigin/setZone 在非 sim 模式一律走 ensureWindow。
口径/徽章 tooltip 已如实注明「查看任一历史段时按视窗实时查询生产库校准（SWR）」。

**历史峰值线移除**（用户裁决）：主图 markLine 的 14 年纪录虚线 + y 轴 max 拉高逻辑 + 图例「历史峰值」
chip 全部移除；距纪录数字保留在四格悬停 title 与决策依据弹层（按需呈现原则不变）。

**实测（verify.mjs 26/26，有头独立 Chrome）**：新增断言——跳极涡发出 3 个真实 energy_hourly 查询
（2013-10 窗）+ liveHours 121→204 增长 + 极涡话术 17.02→23.14 在校准后保持 + 二次访问零重查；
基线全保持（秒开 1.07s、cov 85.6/49.0、三区 5.43/5.40、预备 2,450、离线快照、磁吸、深色默认）。
坑：改码后立即跑 verify 会撞上 Next dev 热重编译拿到混合 chunk（偶发基线漂移）——verify 已加编译预热
+ 等数字稳定到基线再采样；切区断言先等 zoneCap 渲染确认再判稳（防把上一区残值判稳）。

## 2026-08-29 14:40 · feat-011b 主图视觉减法三连（用户裁决）+ 标注防裁

用户连续三轮反馈收敛为：主图只保留「叙事必需」元素。
1. **历史峰值记录虚线**（含 y 轴拉高逻辑、图例项）——移除；距纪录数字保留在四格悬停/依据弹层
2. **预备窗琥珀竖带**（markArea 全高条+标签）——移除；窗口时间在决策条/依据弹层（"主图琥珀段"措辞同步删）
3. **内层 P25–P75 窄带**——移除（用户："P50 基本都在宽带里，窄的看起来很突兀"）；
   外层 P10–P90 宽带保留（台风圆锥语义：90% 把握、P90=调度底线、cov90 审计对象、预备容量来源）；
   频率句改写单带版、图例改「P10–P90 区间 · 90% 可能落入」；cov50/P25–75 数字仍在审计卡与悬停按需呈现
4. **日峰/最坏标注被右缘裁切**（用户实测被遮）——markLine label 的 align 在 ECharts 6 该场景不生效，
   改 title 组件固定图右上（两行等宽字体），峰时刻仍由 P50 系列垂直虚线指示

verify 30/30（新增：markArea=0 / 无历史峰值 markLine / b50 不存在 b90 存在）；lint+tsc+build 零错。
截图 .shots/diag_stage.png（诊断用，最终版见 web_v4 截图）。

## 2026-08-29 15:45 · feat-012 Vercel 生产部署

- **密钥纪律收严（用户裁决）**：supabase.ts 的 URL/KEY 全部只走 NEXT_PUBLIC_* 环境变量，代码零真实值；
  未配置时 sbFetch 快速失败 → 三级兜底降级快照/仿真（cd824f4）
- **Vercel 账号部署**（用户 gongxtaos-projects-546ada90，项目 zhulong）：env 四条（URL/KEY × production/preview，
  `vercel env add --type config --value`）；`vercel deploy --prod` **READY 38s**，
  生产别名 **https://zhulong-seven.vercel.app**；匿名临时部署（temporary-snappy-zinc-hp7f8oh，曾 30/30 验证通过）
  按用户要求弃用（60min 自动过期）
- **本机网络阻断（非部署问题）**：\*.vercel.app DNS 污染（解析到 88.191.249.183/168.143.171.189 假 IP）+
  edge IP 直连亦被 reset；vercel.com API 域名正常——部署经 API inspect 确认 READY；生产 URL 的浏览器验证
  待用户网络（有代理时）或现场网络确认；本地 `npm run dev`/`build+start` 与线上同代码同数据，为演示兜底

## 2026-08-29 16:05 · feat-013 GitHub 发布

- 仓库根新增 .gitignore（工具状态/密钥/构建产物），untrack 误跟踪的 .omc（98 文件）、.workbuddy、web/.omc
  （web/.gitignore 的 `web/.omc/` 路径笔误修正为 `.omc/`）；跟踪文件 191→91，全部为项目本体
- 推送 https://github.com/gongxtao/zhulong-pred.git（main，走用户本地代理 127.0.0.1:17891；
  直连 GitHub 被 reset）——HEAD ed8ada1，README 已加源码地址
- 注：早期历史提交中曾含 .omc 工具状态（无密钥，init.sh 全程扫描 service_role 零命中）；
  如需彻底清除历史可 filter-repo 重写（会改写全部 commit hash，未做）

## 2026-08-29 · feat-014/015 pred_dynamic 读层接入（运营模型优先）

**背景**：生产模型开始向 pred_dynamic 推送。实测四表版图——energy_hourly(2004-10→2016-02, 295,002 行)
∪ energy_hourly_future(2016-01→2018-08-03, 68,055 行) 是唯一 14 年负荷+4 列气象档案，不可被 pred 表替换
（用户曾提议替换，已论证否决）；pred_static(68,040 行=945 起点×24h×3 区) 是冻结回测；
pred_dynamic 是运营推送流（同构六列）。同窗对决：2016-02 段 dynamic WAPE 4.23% vs static 4.39%（-3.8%，
三区全面更优；1 月值与 static 逐值相同、2 月起换新模型）。

**坑（重要）**：pred_dynamic 建表时漏配 anon SELECT 策略——RLS 拦截时 PostgREST 返回 200+空集，
与空表从客户端无法区分；用户已在库端补 `for select to anon using (true)`。新表上线 checklist 应含策略对照。

**feat-014 改动**（web/src/lib/zl/supabase.ts 三处，~30 行）：
1. `ingestPred(rows, override=false)`——static 首写优先不变；dynamic 传 override=true 同起点无条件覆盖
2. `bootLayer1` 步骤 3 双表并行（同 D1-70 窗），`.catch(()=>[])` 隔离——dynamic 空/失败不得拖垮 boot
3. `ensureWindow` 纪元内起点校准双表（同参数 Promise.all），走既有 notifyLiveMerge → 清 FC_CACHE 重渲

**不变**：calFrom 分位标定 static-only（dynamic 真值滞后且混模型污染残差带）；小时/日峰表查询零改动；
快照结构不动（SWR 首渲 static、live 合并 dynamic 覆盖属预期行为）。

**验收**：verify **31/31**（第 31 项新增「boot 双轨预测查询 sta 5/dyn 1」）；探针实测 boot 后 pred_dynamic
请求 1 次、在线徽章正常；init.sh/tsc/eslint 零错；现有 30 项基线零漂移（dynamic 回放 6.3%，未过模型纪元
2016-12-01，今天接入可见表现为零变化——纯「线路就绪」，回放推进后数字自动变优）。

**feat-015 收口**：verify 第 31 项断言；engine.ts 口径双轨化（srcBadge title + 预测口径文案）；
session-handoff.md 升格为权威交接文档（用户裁决，docs/zhulong-handoff.md 冻结为历史）。

**运维提示（后续会话必读）**：pred_dynamic 回放推过 2018-05 后，首屏 MAPE 3.57/cov 85.6/49.0 等
verify 硬编码基线将因数据变优而失配——那是数据升级不是回归，届时重记录基线即可；
路演现场若回放完成，演示数字自动体现新模型。

## 2026-08-29 15:45 · feat-016/017/018 三线对比（持续学习故事落地）

**方法论**：harness-creator 五件套流程——一次一个特性、每特性独立验证、证据先行入库、逐 feat 提交。

- **feat-016 store 双轨化**（552690b）：predStatic/predDyn 原始轨 + store.pred 展示轨（同起点 dyn 优先/
  static 填充、起点级重算）；快照只嵌静态轨且与展示轨隔离副本防串轨。verify 31/31 逐位零漂移（纯结构重构证明）。
- **feat-017 主图三线**：删「昨日同时刻」线+图例（审计卡持久性对比数字保留——杀手锏话术不变）；
  新增「静态预测」灰虚线（staticLineAt 只画模型覆盖的 0-24h 段，对照线不造数）；「预测 P50」→「持续学习 P50」。
  verify 34/34；数据级复核 NOW 锚点两线重叠段 17/17 全等 maxGap=0（dyn 回放未达 boot 窗，兜底语义正确）；
  截图 web_v6_triline_{dark,light}。注意：视觉模型曾幻觉「NOW 处两线偏离」，以 evaluate 数据为准的教训再次印证。
- **feat-018 纪元门放开 + 分叉断言**：ensureWindow pred 查询门从 2016-12-01 放开到 2016-01-01 首起点
  （2016 全年重演窗均可拉双轨真预测，行为变化经用户确认）；verify 36/36 关键证据：
  2016-06-15 重演窗 predDyn.AEP=2 入店（门放开铁证）+ 静态线 10/11 点偏离学习线（分叉 1-2k MW 肉眼可见，
  截图 web_v6_diverge_2016-06_dark）；静态线线宽/不透明度微调提升深色主题可读性（CVD 调色板未动）。

**口径**：口径文案 feat-014 已写「双轨注入」，图例现为 实际/P10-P90/持续学习P50/静态预测/实际·后续。
**运维**：pred_dynamic 回放 15:27 已到 2017-01-31（26,424 行，~8 起点/分加速中）；推过 2018-05-26 后
boot 窗 dyn>0 → NOW 锚点两线开始分叉、首屏 MAPE/cov 基线将变优（verify 硬编码基线届时按 session-handoff
流程重记录——数据升级非回归）。

## 2026-08-29 16:05 · feat-019/020 线尾标签修复 + 预测纪元分割

- **feat-019（0bcdd6e）**：用户实测质疑「看不到静态线」→ 实证分两层：①数据级两线在 NOW 重叠 17/17 全等
  （dyn 未达 boot 窗，静态被学习线严丝盖住，非 bug）；②但用户对标签的质疑**成立**——预测段线尾 endLabel
  被 ECharts 右缘裁剪（「静态」「P50」全丢，只有历史段「实际」幸存）。修复：labelLayout 偏移入图
  （静态左下/P50 左上错开不叠字）+ 图例 title 注明重合=学习未覆盖。教训：视觉模型曾称 NOW 处两线
  「分离」是幻觉，用户肉眼「无标签」才是真相——**以用户实测+DOM 断言双重验证，不轻信视觉模型**。
- **feat-020**：PRED_EPOCH=2016-01-01 04:00（pred 首起点）常量化。①胶片纪元分割虚线+「▎预测纪元 2016」
  小标（.filmEpoch）；②纪元前 renderMain 档案模式：band/静态/学习线/title 全隐（实际/真实后续保留）；
  ③四格降级：峰值格→「今日峰值·实际」（daily 档案值）、MAPE 格→「—」、偏差格→「模型纪元前无预测」；
  ④重演横幅纪元前文案「无生产预测，回放实际负荷档案」；⑤杀手锏话术纪元前改标「相似日基线」+
  「2016 起接入持续学习模型的论据」（数字 17.02→23.14 不变）。verify 41/41。
  坑：verify basisCmp 断言截断 slice(0,46) 被「相似日基线」多 2 字顶穿——46→60。

## 2026-08-29 16:20 · feat-021 悬停静态值 + 纪元标记增强

用户实测反馈两项修复：①主图 tooltip 加「▤ 静态预测 MW」行（悬停任一预测点可见对照值；
重合段 P50=静态同值也透明展示——顺带回答了「字段用哪个」：静态线=pred_static.predicted_load_mw，
学习线=pred_dynamic.predicted_load_mw 且 dyn 缺时回填 static.predicted（NOW 重合即回填语义，非接线错）；
actual≠predicted 是预测误差，画在实线上）；②胶片纪元标记增强：1.5px 实线+加粗标签「预测纪元 2016 ▸」
+bg 描边防混底。verify 42/42（新增悬停断言：tooltip 须含静态预测数值）。
