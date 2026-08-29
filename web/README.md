# 烛龙 ZHULONG · 正式前端工程

Next.js 16（App Router）+ TypeScript + Tailwind v4 + ECharts 6。

- **规格来源**：`../docs/zhulong-handoff.md`（框架/红线/验证基线）+ `../progress.md` 的 feat-007 节（懒加载 store 全规格）
- **移植基准**：`../docs/prototype/zhulong.html`（冻结的已验证实现，算法/配色/交互逐特性对照移植）
- **数据**：Supabase 五表 + `energy_daily` 视图（均已 anon 可读；RLS 只读策略为安全边界）

## 命令

```bash
npm run dev     # http://localhost:3000
npm run build && npm start
```

## 里程碑（详见根目录 feature_list.json）

1. 懒加载 store（src/lib/store.ts：boot 近窗+daily 视图+模型，按需 ensureWindow，并发去重）
2. 决策通知条 + 状态四格
3. 主图 + 时光机胶片（ECharts 选项从原型逐项移植）
4. 证据层（归因/审计）+ 抽屉
5. 演示模式 + 双主题 + 全量回归（对齐 handoff §5 断言）
