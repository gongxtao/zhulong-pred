# session-handoff.md — 权威交接文档

> **定位（用户裁决 2026-08-29）**：本文件是当前唯一的权威交接文档。
> `docs/zhulong-handoff.md` 对应的旧阶段任务已完成，**冻结为历史记录，不再更新**（其中框架红线/坑清单/验证基线仍可作背景参考，但以本文件 + CLAUDE.md 为准）。

## 新会话恢复顺序

1. `CLAUDE.md`（项目纪律与范围红线）
2. 本文件（当前状态 + 待办）
3. `bash init.sh`（结构自检：快照/语法/密钥）
4. `feature_list.json`（挑 in-progress 特性；一次只做一个）
5. `cd web && node scripts/verify.mjs`（31 项断言，需先 `PORT=3100 npm run dev`）

## 当前状态（2026-08-29 14:40）

- **交付主线已完成**：web v5（秒开 SWR + 视窗实时校准 + 视觉减法定稿），verify 31/31 绿。
- **部署（并行会话）**：Vercel 生产 https://zhulong-seven.vercel.app（READY 38s，env 四条零代码密钥）；
  GitHub https://github.com/gongxtao/zhulong-pred（main）。本机访问 \*.vercel.app 有 DNS 污染，
  演示兜底 = 本地 dev / build+start（与线上同代码同数据）。
- **pred_dynamic 接入（feat-014/015，本会话）**：生产模型持续推送 pred_dynamic（同构六列，实测
  2016-02 段 WAPE 4.23% vs static 4.39%）。读层已双轨化：static 先入、dynamic 同起点覆盖
  （`ingestPred` override 语义）、dynamic 失败/空静默回退；calFrom 标定保持 static-only。
  **当前回放 6.3%（至 2016-02），未过模型纪元 2016-12-01，页面零可见变化；推过纪元后数字自动变优。**

## 待办 / 运维提示

- ⚠️ **verify 基线漂移预期**：pred_dynamic 回放推过 2018-05 后，verify 硬编码基线
  （首屏 MAPE 3.57 / cov 85.6/49.0 / DAYTON 5.43 / DOM 5.40）将因数据变优失配——是数据升级非回归，
  届时跑 verify 取新值重记录即可。
- 路演（8/30）前可再查一次 pred_dynamic 进度（`select count(*)` 或 verify 的 dyn 请求数变多）；
  回放若完成，演示数字自动体现新模型，无需改代码。
- 新建 Supabase 表上线 checklist：**anon SELECT 策略**（pred_dynamic 曾漏配——RLS 拦截返回 200+空集，
  与空表无法区分，排障时先怀疑策略）。
- calFrom 切 dynamic 残差的评估：等回放覆盖 boot 窗（2018-05+）后再议。

## 指针

- 特性状态：`feature_list.json`（feat-014/015 = pred_dynamic 双轨读层，done）
- 会话日志：`progress.md`
- 验证：`web/scripts/verify.mjs`（31 项）
