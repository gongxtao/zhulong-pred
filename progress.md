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
- 验证：24.4s 加载、live=true、3.64/88.8/52.2 与快照一致、模型行/极涡话术/三区/六幕/拖拽/主题全过；
  快照兜底路径可用；anon key 嵌入页面（RLS 只读策略为安全边界）
- 提交：见 git log
