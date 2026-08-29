# QwenPaw 接入指南（feat-023 ChatBI）

烛龙决策台「数据问答」由 QwenPaw Agent `zhulong` 提供分析能力。本目录是配置材料与安装方法。

## 架构

```
web 页面(悬浮球💬) → /api/chat(Next.js 代理) → QwenPaw /api/console/chat
                                                  ⇂ skills/zhulong_analysis + SOUL.md 数据纪律
                                          Agent 用 Python 查 Supabase(anon 只读) 再回答
```

QwenPaw Agent 不是"system prompt"式的配置，而是工作区文件模型
（`~/.qwenpaw/workspaces/<agent>/`）：

| 文件 | 职责 | 本项目用法 |
|---|---|---|
| `SOUL.md` | 常驻人设 | 末尾追加「烛龙数据纪律」锚点：数字必须来自查询、禁止拿记忆冒充数据 |
| `skills/zhulong_analysis/SKILL.md` | 按需加载的分析手册 | 表字典 / PostgREST 食谱 / 指标口径 / 时区纪律 / 三类问题作答法（frontmatter 触发词） |
| `skill.json` | skill 注册清单 | 登记 zhulong_analysis（enabled/channels/description） |
| `AGENTS.md` | 安全规则 | 不动（保留默认） |
| `PROFILE.md` | 身份卡 | 已配：烛龙 · 电力负荷预测助手 |

## 安装（本机已装，2026-08-29；重装/换机器照此）

```bash
WS=~/.qwenpaw/workspaces/zhulong
cp $WS/SOUL.md $WS/SOUL.md.bak && cp $WS/skill.json $WS/skill.json.bak   # 备份
# 1. skill
rm -rf $WS/skills/zhulong_analysis
cp -r qwenpaw/skills/zhulong_analysis $WS/skills/
# 2. SOUL 锚点（若未追加过：见下方文本，追加到 SOUL.md 末尾）
# 3. skill.json 注册 zhulong_analysis（enabled:true, channels:["all"], source:"workspace",
#    metadata=SKILL.md frontmatter 的 name/description）
```

SOUL.md 追加文本（数据纪律锚点）：

> ## 烛龙数据纪律（最高优先级，覆盖默认记忆优先行为）
> 你是「烛龙」电力负荷预测决策台的**数据分析师**——不是通用助理。
> 一切指标数字必须来自你刚执行的 Supabase 查询与计算（用法见 zhulong_analysis skill）。
> 禁止凭记忆、历史会话或"大概"输出任何 MAPE/WAPE/负荷数字。先查库，再回答；
> 答案先结论后数字，注明口径。翻本地文件或个人记忆回答数据问题 = 错误行为。

## 验证（三 chips 对账基准，Supabase 直查）

> ⚠️ 2026-08-30 起两表内容对调（见 SKILL.md「数据现状」节）：`pred_dynamic` 表实为静态模型输出、
> `pred_static` 表实为持续学习输出——下表数值按**内容语义**仍成立，但查库时需按 SKILL.md 换读表名。

| 问题 | 基准 |
|---|---|
| AEP 2016-03 双轨对比 | 对齐 744 行：dyn MAPE 2.75 / WAPE 2.74；static 3.00 / 2.99 |
| AEP 2016-03-15 指定日 | 24 行，origin 03:00Z（EDT），日 MAPE 2.67%，首点 P 12,279.6 / A 12,416 |
| 三区排名 + 时距桶（全表） | DOM 4.37 > DAYTON 3.51 > AEP 2.88（22,681 行/区）；最差桶 h17-20（5.35%） |

2026-08-29 实测：三 chips 全过（38–53s 流式），数字逐位对账一致。

## 环境变量（web 侧，不进仓库）

| 变量 | 本机演示 | 云端部署后 |
|---|---|---|
| `QWENPAW_URL` | `http://localhost:8088` | `https://<云地址>` |
| `QWENPAW_AGENT_ID` | `zhulong` | `zhulong` |
| `QWENPAW_TOKEN` | （localhost 自动免认证） | **必配**（QwenPaw 开认证后） |

⚠️ `/api/chat` = 谁能聊谁就能让 Agent 执行代码。上云必须 QwenPaw 开
`QWENPAW_AUTH_ENABLED=true` + web 配 `QWENPAW_TOKEN`，两者一起上。
未配 `QWENPAW_URL` 的部署（如 Vercel 线上）聊天自动降级，主页面不受影响。

## 已知协议细节（实测，与官方文档有出入）

SSE 流里除文档所述 `output[]` 快照外，还有 token 级增量帧
（`{type:"text",delta:true,msg_id,text}`）、消息帧（`object:"message"`，type 区分
reasoning/message）、Agent 代码执行帧（plugin_call / plugin_call_output）。
最终答案 = 终止事件 `output[]` 中 `type:"message"` 的全文。
web 端解析器 `web/src/lib/zl/chat.ts` 为两种格式超集实现。
