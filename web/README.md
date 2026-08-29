# 烛龙 ZHULONG · web 工程

电力负荷预测决策台的正式工程（Next.js 16 + React 19 + TypeScript + ECharts 6）。
项目总览、数据口径与提交信息见[仓库根 README](../README.md)。

```bash
npm install
npm run dev -- --port 3100     # http://localhost:3100
node scripts/verify.mjs        # 30 项断言一键回归
node scripts/shot.mjs          # 双主题截图
npm run build && npm start     # 生产构建
```

- 数据三级兜底：在线 Supabase → `public/data/` 内嵌快照 → 内置仿真（`src/lib/zl/sim.ts`）。
- 架构与代码地图见 `docs/zhulong-handoff.md` §3（唯一权威开发文档）。
