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
