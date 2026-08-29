# feat-023 ChatBI 设计（对话式分析 pred_dynamic）

> 状态：已获用户批准（2026-08-29，方案 A）。本文档为实施依据。
> 硬约束：提交截止 2026-08-29 24:00；路演 8/30。

## 目标

用户在烛龙决策台（web/）用自然语言提问，由 QwenPaw Agent 实时查询 Supabase
`pred_dynamic`（对照 `pred_static`）、真算指标、流式回答。重点场景（用户裁决）：
**双轨对比 / 指定日查询 / 误差分析**，主要针对 pred_dynamic 表。

## 架构（方案 A）

```
顶栏 💬 按钮 → 聊天弹层(page.tsx) → POST /api/chat → QwenPaw :8088 (SSE)
                                    (Node runtime,     /api/console/chat
                                     流式透传)            ⇂ Skill: 烛龙数据分析
                                                      Agent 用 Python 查 Supabase(anon 只读)
```

- QwenPaw 本机先行（:8088），后续云部署——地址走 env，两阶段无缝切换。
- Agent 既有能力：代码执行（Python）+ HTTP 工具，**不新增基础设施**（无 MCP）。

## 新增文件

| 文件 | 职责 |
|---|---|
| `web/src/app/api/chat/route.ts` | 代理：env `QWENPAW_URL`/`QWENPAW_AGENT_ID`/`QWENPAW_TOKEN`；转发 + SSE 透传；未配置/不可达 → 503 `{error:'agent-unreachable'}`；消息 ≤500 字符；内存限流 20 次/分/IP |
| `web/src/lib/zl/chat.ts` | 客户端 SSE 消费：getReader() 逐行解析 `data:` 事件，累积 `output[].content[].text` 增量渲染 |
| 聊天弹层（page.tsx 内组件） | UI + 加入现有弹层互斥家族（第五件）+ 降级态 |
| `qwenpaw/skills/zhulong-analysis/SKILL.md` | 我产出 → 用户配置进 QwenPaw（建 Agent、贴 system prompt） |
| `qwenpaw/README.md` | 配置步骤说明 |

`web/src/lib/zl/` 现有模块零改动（`chat.ts` 为新增独立文件，不 import 现有模块）。

## 关键设计决策

- **会话**：`session_id = crypto.randomUUID()`，每次打开弹层新会话，不持久化；上下文由 QwenPaw 按 session 自管。
- **页面上下文注入**：客户端在消息前拼 `[页面上下文] 区域=AEP; 视图=实时/重演@2016-06-15`，Agent 回答对齐当前区域。
- **Skill 内容**：表结构（pred_dynamic/pred_static 六字段+主键语义、energy_hourly）、
  PostgREST 查询模式 + Python 示例（zone 过滤、origin 时间窗、`Prefer: count=exact` 计数、分页）、
  指标定义（MAPE/WAPE/按 horizon 分桶）、双轨对齐语义（同 origin+interval_end join）、
  时区陷阱（时间戳全 UTC、起点=纽约本地日前起源，防差一天）、
  回答纪律：数字必须来自查询结果、说明时间窗与行数、先结论后数字、中文。
- **UI 红线**：单栏不破坏；弹层加入互斥家族；不引入新色（现有中性色+青强调，CVD 安全）；
  弹层 `min(720px,92vw) × ~70vh`，记录区内滚（弹层是页面滚动例外层）。
- **预设 chips（3）**：`持续学习比静态模型好多少？` / `查 AEP 2016-03-15 前 24h 预测` /
  `哪个区、哪个时段误差最大？`——路演点 chips 不手打。
- **流式体验**：SSE `in_progress` 显示「正在查询数据/分析…」打字态（Agent 代码执行 10-30s）。

## 安全

- anon key 允许入仓（与页面同款 RLS 只读）；QwenPaw token/云端地址只在 env（init.sh 无需改）。
- ⚠️ `/api/chat` = 谁能聊谁就能让 Agent 执行代码：**Vercel env 先不配 `QWENPAW_URL`**
  （线上自然降级）；云部署 QwenPaw 时必须开认证 + 配 `QWENPAW_TOKEN`，两者一起上。
- 限流 + 消息长度上限降低滥用面。

## 验证

- verify.mjs 新增 3-4 项（44+）：聊天按钮存在+弹层可开；与 ⓘ/☰ 互斥；输入/发送交互；
  `/api/chat` 未配 env → 503 结构化响应。真机联调不进 verify（外部依赖）。
- 真机联调证据：本机 QwenPaw 跑通 3 chips，回答数字与 Supabase 直查对账，记 feature_list evidence。
- 收口：feature_list(feat-023) + progress + session-handoff + 提交；lint/tsc/build 零错。

## 风险与预案

- 回答幻觉 → Skill 回答纪律 + chips 锁定问法 + 演示前 warm-up。
- Agent 慢 → 流式 + 状态提示。
- 任何聊天故障不波及主页面（独立入口，路演零风险）。

## 排期（约 5.5h）

代理路由+客户端 SSE（1h）→ 弹层 UI+互斥+chips（1.5h）→ Skill 文件交用户配置（1h）→
联调 3 问题+Skill 调教（1h，用户在场）→ verify+回归（0.5h）→ 收口提交（0.5h）
