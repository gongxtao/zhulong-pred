# CLAUDE.md — 烛龙 ZHULONG 项目 harness

比赛项目：电力负荷预测决策台（贵州黑客松赛道二，**提交截止 2026-08-29 24:00**，路演 8/30）。

## Startup Workflow

1. `pwd` 确认在仓库根（`/Users/mac/Develop/project/guikesong`）
2. 读本文件 + `docs/zhulong-handoff.md`（**必读**：框架红线、坑清单、验证基线）
3. `bash init.sh` 验证环境（快照在位、页面脚本语法、无密钥泄漏）
4. 读 `feature_list.json` 确认当前活跃特性（**一次只做一个**）
5. `git log --oneline -5` 看最近改动

基线失败先修复，不加新范围。

## Scope 边界（红线）

- **主战场（下一阶段）**：`web/`（Next.js 16 + TS + Tailwind v4 + ECharts 6 正式工程，`npm run dev` @ :3100）
- **spec 与兜底**：`docs/prototype/zhulong.html` —— 懒加载已完整落地并验证（v3，`cc69a6e`），
  **移植期间原则上不再修改**（发现 bug 先评估：小修 prototype 保持同步，大改进 web/）；
  提交兜底版本即当前 HEAD
- **可改**：`scripts/`、`docs/prototype/data/`、harness 五件套、`docs/zhulong-*.md`
- **不碰**：`dashboard_v2~v10.html`（他人/旧线）、`.omc/`、Supabase 库结构
- 设计红线见 handoff §2/§4：告示→仪表→机器层级、四格对等、单栏无分栏、弹层四件套互斥、CVD 色板勿改

## 数据架构（v2，真数据）

三级数据源，启动时探测：
1. **本地快照** `docs/prototype/data/zhulong-data.js`（`window.ZL_DATA`，含 3 区全量小时序列 + 模型元数据 + pred_static 回测）——演示主路径，断网可用
2. **在线 Supabase**（anon key 内嵌页面，RLS 只读策略）——在线刷新
3. **内置仿真**（原 DataHub 公式）——最终兜底

替换点已隔离：`loadAt/tempAt/buildDaily/RECORD` + 时间锚（`T_MIN/T_MAX/NOW_DEFAULT` 从数据推导）。

## 密钥纪律

- 页面/仓库内**只允许 anon key**（`ZL_ANON_KEY`，公开只读）
- service_role key 只经环境变量 `ZL_SKEY` 传给 `scripts/build-snapshot.mjs`，**绝不写入任何仓库文件**（init.sh 会扫描泄漏）

## Working Rules

- 一次一个特性；完成 = 行为实现 + 验证实际跑过 + 证据写入 `feature_list.json`/`progress.md`
- 每处数字/计算改动后必须跑指标断言（见下）
- 会话结束前更新 `progress.md` + `feature_list.json` + 提交

## 验证协议

```bash
bash init.sh                          # 结构性检查（快照/语法/密钥）
cd web && node scripts/verify.mjs     # web 主交付物 30 项断言（秒开/基线/回归，一键全量）
```

浏览器断言（chrome-devtools MCP，`file:///.../docs/prototype/zhulong.html`）：
1. 指标断言：三区域 MAPE/cov90/cov50 对上 `docs/zhulong-handoff.md §5` 当前基线
2. 回归清单：切区域 / 胶片拖拽→2014 / 极涡重演审计卡 / 热力图 tab / 演示六幕 / 主题来回 / 弹层四件套互斥
3. 截图存 `.shots/`（浅深双主题）

**以 evaluate 断言为准，不以目测转述为准。**

## Definition of Done

- [ ] 行为实现
- [ ] init.sh 通过 + 浏览器断言通过（证据记录）
- [ ] handoff/progress 同步
- [ ] 下个会话可从 Startup Workflow 直接恢复
