# session-handoff.md — 权威交接文档

> **定位（用户裁决 2026-08-29）**：本文件是当前唯一的权威交接文档。
> `docs/zhulong-handoff.md` 冻结为历史记录（框架红线/坑清单仍可作背景参考，以本文件 + CLAUDE.md 为准）。

## 新会话恢复顺序

1. `CLAUDE.md`（纪律与范围红线）
2. 本文件（当前状态 + 待办）
3. `bash init.sh`
4. `feature_list.json`（活跃特性，一次一个）
5. `cd web && PORT=3100 npm run dev` 然后 `node scripts/verify.mjs`（36 项断言）

## 当前状态（2026-08-29 15:50）

- **三线对比已上线（feat-016/017/018，verify 36/36）**：主图 = 实际负荷 + 持续学习 P50（展示轨 dyn
  优先/static 填充）+ 静态预测灰虚线（predStatic 原始轨）；昨日同时刻线已删（审计卡持久性对比数字保留）；
  纪元门放开到 2016-01-01——**2016 全年重演窗都能看到双轨真预测与分叉**（06/15 视窗分叉 1-2k MW 实测）。
- **数据链路（data/README.md 是权威）**：energy_hourly 模拟实时表（15:04 已加速释放到 2018-06-30）；
  pred_dynamic 持续学习回放 15:27 推进到 2017-01-31（26,424 行，~8 起点/分加速，全程 945 起点）；
  生产预测流在 forecast_runs/energy_forecasts（anon 不可读）。
- **部署（并行会话）**：Vercel https://zhulong-seven.vercel.app；GitHub gongxtao/zhulong-pred。
  本机 \*.vercel.app 有 DNS 污染，演示兜底 = 本地 dev。
- 路演故事：「管道模拟真实到达 + 持续学习模型逐日重训推送（pred_dynamic），页面 SWR 实时吸收——
  拖到任一历史段可见静态 vs 学习双线分叉，WAPE 4.39→4.23%（2016-02 段实测，AEP -7.7%）」。

## 待办 / 运维提示

- ⚠️ **基线漂移预期**：pred_dynamic 回放推过 **2018-05-26**（boot 窗）后，NOW 锚点两线开始分叉、
  首屏 MAPE 3.57 / cov 85.6/49.0 / DAYTON 5.43 / DOM 5.40 将**变优失配**——数据升级非回归，
  跑 verify 取新值重记录 + 更新 verify.mjs 硬编码基线即可。分叉断言（diffPts>0）届时在 NOW 锚点也成立。
- pred_dynamic 回放若再停滞（曾停在 2016-07-31 约 15 分钟），先查管道——它是故事的燃料。
- calFrom 分位标定保持 static-only；等 dyn 覆盖 boot 窗后再评估切换。
- README（data/）pred_dynamic 与权限段已更新到现状（2026-08-29）。

## 指针

- 特性状态：`feature_list.json`（feat-014~018 = pred_dynamic 双轨读层 + 三线对比，全 done）
- 会话日志：`progress.md`；验证：`web/scripts/verify.mjs`（36 项）；截图：`.shots/web_v6_*`
