# QwenPaw 接入指南（feat-023 ChatBI）

烛龙决策台的「数据问答」由 QwenPaw Agent 提供分析能力。本目录是给 Agent 的全部配置材料。

## 架构

```
web 页面(悬浮球💬) → /api/chat(Next.js 代理) → QwenPaw /api/console/chat
                                                  ⇂ system prompt = SKILL.md
                                          Agent 用 Python 查 Supabase(anon 只读)
```

## 配置步骤（约 5 分钟）

1. **启动 QwenPaw**（本机）：`qwenpaw app` → Console `http://localhost:8088`
2. **新建 Agent**：Console 左上角 Agent 选择器 → 创建，Agent ID 建议 `zhulong`
3. **贴 system prompt**：把 `qwenpaw/skills/zhulong-analysis/SKILL.md` 全文粘贴进该 Agent
   的 system prompt / 人设配置
4. **确认能力**：该 Agent 需要代码执行（Python）+ HTTP 请求工具——QwenPaw 默认 Agent 自带，
   无需额外配置工具或 MCP
5. **冒烟验证**（终端）：

```bash
curl -X POST http://localhost:8088/api/console/chat \
  -H 'Content-Type: application/json' -H 'X-Agent-Id: zhulong' \
  -d '{"input":[{"role":"user","content":[{"type":"text","text":"pred_dynamic 现在 AEP 区 MAPE 多少？"}]}],"session_id":"smoke","channel":"console"}' \
  --no-buffer
```

预期：SSE 流里 Agent 逐段输出，最终给出查库算出的 MAPE 数字（而非寒暄）。

6. **接上 web**（重启 dev server 时带 env）：

```bash
cd web
QWENPAW_URL=http://localhost:8088 QWENPAW_AGENT_ID=zhulong npm run dev
# 页面右下角悬浮球 → 发送任意问题 → 流式回答
```

## 环境变量（全部不进仓库）

| 变量 | 本机演示 | 云端部署后 |
|---|---|---|
| `QWENPAW_URL` | `http://localhost:8088` | `https://<你的云地址>` |
| `QWENPAW_AGENT_ID` | `zhulong` | `zhulong` |
| `QWENPAW_TOKEN` | （本机 localhost 自动免认证，不用配） | **必配**：QwenPaw 开 Web 认证后的 Bearer token |

⚠️ **安全红线**：`/api/chat` 是"谁能聊，谁就能让 Agent 执行代码"的通道。云端部署 QwenPaw 时
**必须**同时：QwenPaw 开 `QWENPAW_AUTH_ENABLED=true` + web 侧配 `QWENPAW_TOKEN`。
未配置 `QWENPAW_URL` 的部署（如当前 Vercel 线上）聊天自动降级提示，主页面不受影响。

## Skill 调教记录

- 2026-08-29 v1：表字典 / PostgREST 食谱 / 双轨对齐口径 / 时区纪律 / 回答纪律。
  待真机联调（3 个预设 chips）后迭代。
