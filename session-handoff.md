# session-handoff.md — 权威交接文档

> **定位（用户裁决 2026-08-29）**：本文件是当前唯一的权威交接文档。
> `docs/zhulong-handoff.md` 冻结为历史记录（框架红线/坑清单仍可作背景参考，以本文件 + CLAUDE.md 为准）。

## 新会话恢复顺序

1. `CLAUDE.md`（纪律与范围红线）
2. 本文件（当前状态 + 待办）
3. `bash init.sh`
4. `feature_list.json`（活跃特性，一次一个）
5. `cd web && PORT=3100 npm run dev` 然后 `node scripts/verify.mjs`（36 项断言）

## 当前状态（2026-08-29 16:05）

- **三线对比 + 预测纪元分割已上线（feat-016~020，verify 41/41）**：
  - 主图三线 = 实际负荷 + 持续学习 P50（展示轨 dyn 优先/static 填充）+ 静态预测灰虚线；线尾标签
    「静态/P50」labelLayout 入图（右缘裁剪曾吞掉二者）；昨日同时刻线已删（审计卡持久性数字保留）
  - **PRED_EPOCH=2016-01-01 04:00**：胶片画「▎预测纪元 2016」分割虚线；纪元前=档案模式
    （预测层全隐、四格降档案语义、重演横幅改文案、杀手锏话术改标「相似日基线——2016 起接入持续学习的论据」）
  - 纪元门放开：2016 全年重演窗实时拉双轨真预测（06/15 视窗分叉 1-2k MW 实测可见）
- **数据链路（data/README.md 权威）**：energy_hourly 模拟实时表（已加速释放至 2018-06-30+）；
  pred_dynamic 回放 15:27 至 2017-01-31、~8 起点/分加速（全程 945 起点）。
- **部署（并行会话）**：Vercel https://zhulong-seven.vercel.app；GitHub gongxtao/zhulong-pred。
  本机 \*.vercel.app DNS 污染，演示兜底 = 本地 dev。**push 待用户裁决（会触发 Vercel 自动部署）。**
- 路演故事线：「负荷档案 14 年 → 2016 预测纪元（静态模型）→ 持续学习模型逐日推送（pred_dynamic），
  页面 SWR 实时吸收——拖胶片看双线分叉收窄；WAPE 4.39→4.23%（2016-02 实测，AEP -7.7%）」。

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
