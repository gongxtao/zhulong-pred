# session-handoff.md — 权威交接文档

> **定位（用户裁决 2026-08-29）**：本文件是当前唯一的权威交接文档。
> `docs/zhulong-handoff.md` 冻结为历史记录（框架红线/坑清单仍可作背景参考，以本文件 + CLAUDE.md 为准）。

## 新会话恢复顺序

1. `CLAUDE.md`（纪律与范围红线）
2. 本文件（当前状态 + 待办）
3. `bash init.sh`
4. `feature_list.json`（活跃特性，一次一个）
5. `cd web && npx next dev -p 3100` 然后 `node scripts/verify.mjs`（51 项断言；
   ⚠️ 8/29 深夜起 §2 在线基线因生产库数据漂移中断——见「待办」首条，属预期红）

## 当前状态（2026-08-29 深夜收班）

- **聊天新建会话已上线（feat-024，专项 E2E 8/8）**：聊天抽屉头部「＋ 新会话」→
  换 session_id（QwenPaw 旧上下文随 id 作废）+ 清空记录 + 系统提示；流式中按钮与发送
  同锁禁用（防旧流污染新会话）。mock SSE 双 gate 确定性 E2E 验证（busy 禁用/重置/二次
  发送独立回答）；verify §7 增对应断言（当前因 §2 数据漂移中断在套件前段，未跑及）。
- **ChatBI 数据问答已上线（feat-023，verify 50/50）**：
  - 入口 = 右下角悬浮球 💬 → 右侧扩展式抽屉（互斥家族第五件）；5 预设 chips + 自由输入（预置问题已联动 NOW 锚点：双轨=2018-06 窗、指定日=2018-06-30，与页面数字互证）
    （textarea，Enter 发送 / Shift+Enter 换行，纸飞机按钮）；Agent 回答 markdown 表格渲染
  - 链路：`/api/chat`（web/src/app/api/chat/route.ts，SSE 透传+限流 20/分+500 字上限）
    → QwenPaw `:8088` Agent `zhulong` → Python 查 Supabase(anon 只读) 算指标再答
  - **env 三条（不进仓库）**：`QWENPAW_URL` / `QWENPAW_AGENT_ID` / `QWENPAW_TOKEN`。
    已固化进 `web/.env.local`（gitignored）。**2026-08-29 晚起指向云端 QwenPaw 2.1.0：
    `http://43.166.132.250:8088`**（本机实例不再是依赖，关掉本地也能演示）；删掉该段回降级态。
    云端已验证：版本探针 200、数据问答对账逐位一致（2.94/3.23，720 行）、web E2E 38s 流式。
    **云端认证已开启（2026-08-29 晚）**：无 token 401 / 带 token 200 实测；`QWENPAW_TOKEN`
    已入 Vercel Production（重部署 zhulong-6zfa3d97r）+ 本地 .env.local（三条齐）。
    **线上聊天已开启（2026-08-29 晚）**：Vercel Production 已加 `QWENPAW_URL`/`QWENPAW_AGENT_ID`
    并重新部署（Ready，zhulong-achg63ofj）。⚠️ 本机网络对 \*.vercel.app 是 IP 级阻断（DoH/强解均 000），
    线上链路最终验证需换网络（手机热点/评委网络）——已验证的等价链路段：部署 Ready+env 在列+
    云端 QwenPaw 公网可达+dev 同代码对云 200 流式。**git 已 push（8/29 深夜，用户裁决）：
    gongxtao=4bc99ac、main 合并=ffb1a87**；若 Vercel 挂 git 自动部署会随 push 触发，部署状态换网络后核。
    助手品牌=「烛龙助手」，UI/回答不出现 QwenPaw 字样（SOUL 自称+中文表达纪律）。
  - QwenPaw 配置 = 工作区文件模型（非 system prompt）：`~/.qwenpaw/workspaces/zhulong/`
    下 `skills/zhulong_analysis/SKILL.md`（分析手册，仓库 qwenpaw/ 同步）+ SOUL.md 末尾
    「烛龙数据纪律」锚点 + skill.json 注册。备份后缀 `.bak-174929`。
  - **体验三件套（晚间迭代）**：思考流上屏（「思考中·」实时滚动）+ 工具动作提示
    （「⚙ 第 N 步 · 载入分析技能/执行代码·查库」青色行）+ 表格横向滚动容器（宽表不破卡片）。
  - 实测对账（2026-08-29）：双轨 744 行 dyn 2.75/static 3.00；指定日 24 行 MAPE 2.67；
    全表 22,681 行/区 DOM 4.37>DAYTON 3.51>AEP 2.88、最差桶 h17-20。E2E 38-53s 流式。
    chips 已联动 NOW（2018-06 窗 720 行 dyn 2.94/static 3.23 与页面 3.39% 互证）。
  - 已知协议细节（chat.ts 已超集兼容）：SSE 含 token 增量帧/消息帧(reasoning|message)/
    plugin_call 代码执行帧；终值=终止事件 output[] 中 type:"message" 全文。
  - 云迁移：QwenPaw 上云 + 开认证 + Vercel env 配 URL/AGENT_ID/TOKEN 三条即通（qwenpaw/README.md）。
- **pred_dynamic 回放已完成**：68,043 行，origin 覆盖 2016-01-01→2018-08-03 全量。
  **boot 窗基线漂移已兑现并重录（17:10）**：MAPE 3.57→3.39、cov 85.6/49.0→88.8/54.2、
  四格 18,261→18,237@16:00、DAYTON 5.43→5.26、DOM 5.40→5.49——数据升级非回归（dyn 优先轨生效，
  持续学习故事在 NOW 锚点也成立了）。verify 区域断言改为**固定等 12s 再读**（dyn 分批合并实测 ~6.5s，
  任何"稳定即读"窗口都会锁死 static 旧值）。

- **三线对比 + 预测纪元分割已上线（feat-016~020，verify 41/41）**：
  - 主图三线 = 实际负荷 + 持续学习 P50（展示轨 dyn 优先/static 填充）+ 静态预测灰虚线；线尾标签
    「静态/P50」labelLayout 入图（右缘裁剪曾吞掉二者）；昨日同时刻线已删（审计卡持久性数字保留）
  - **PRED_EPOCH=2016-01-01 04:00**：胶片画「▎预测纪元 2016」分割虚线；纪元前=档案模式
    （预测层全隐、四格降档案语义、重演横幅改文案、杀手锏话术改标「相似日基线——2016 起接入持续学习的论据」）
  - 纪元门放开：2016 全年重演窗实时拉双轨真预测（06/15 视窗分叉 1-2k MW 实测可见）
- **数据链路（data/README.md 权威）**：energy_hourly 模拟实时表（已加速释放至 2018-06-30+）；
  pred_dynamic 回放 15:27 至 2017-01-31、~8 起点/分加速（全程 945 起点）。
- **部署（并行会话）**：Vercel https://zhulong-seven.vercel.app；GitHub gongxtao/zhulong-pred。
  本机 \*.vercel.app DNS 污染，演示兜底 = 本地 dev。**git 已 push（8/29 深夜）：gongxtao=4bc99ac、
  main=ffb1a87（merge）**——Vercel 若挂 git 自动部署随 push 触发，Ready 与否换网络后核。
- 路演故事线：「负荷档案 14 年 → 2016 预测纪元（静态模型）→ 持续学习模型逐日推送（pred_dynamic），
  页面 SWR 实时吸收——拖胶片看双线分叉收窄；WAPE 4.39→4.23%（2016-02 实测，AEP -7.7%）」。

## 待办 / 运维提示

- **⚠️ 在线基线数据漂移（8/29 深夜，用户裁决=先落功能不改基线）**：17:10 重录基线
  （3.39/88.8/54.2）之后管线重推过 pred_dynamic（现 68,040 行=945 起点×3区×24h 整、
  max origin 2018-08-02，较 17:10 版少 1 天）+ 16:47 重训模型——页面 live 稳定值为
  MAPE 3.57/cov90 83.2/cov50 45.7（快照同为 3.57），verify §2 `waitForFunction` 45s 超时
  中断套件。**stash 铁证非代码回归**（干净 HEAD 同样超时）。回绿两条路：(a) 管线侧重推
  17:10 版 dyn 数据；(b) 数据定稿后按 17:10 同款流程重录（固定等 12s 再读纪律）。
- **基线漂移已兑现并重录**（见上，2026-08-29 17:10）——后续若再重放/改数据，跑 verify 取新值
  重记录 + 更新 verify.mjs 硬编码基线即可（同款流程）。
- pred_dynamic 回放若再停滞（曾停在 2016-07-31 约 15 分钟），先查管道——它是故事的燃料。
- calFrom 分位标定保持 static-only；dyn 已覆盖 boot 窗，**可评估切换**（切换前跑 verify 看分位带变化）。
- **ChatBI 线上终验（唯一未闭环）**：本机对 *.vercel.app IP 级阻断——用手机热点开
    zhulong-seven.vercel.app 点悬浮球问一句即完成（等价链路段已全绿）。
- ChatBI 路演前：云端 QwenPaw 在跑即可（`curl http://43.166.132.250:8088/api/version`，
    已开认证）；dev 经 .env.local 自动连云；演示用 chips 不手打（问法锁定+已对账）。
- **git push 已完成（8/29 深夜，用户裁决）**：gongxtao=4bc99ac、main=ffb1a87（merge）——
    此前 CLI 直部导致「线上领先 git」的局面已消除，git 与线上代码同源。
- 本机 vercel.app DNS 污染，线上兜底 = 本地 dev（feat-012 记录）。
- **Vercel git 自动部署已修复并双路验证（8/29 深夜）**：push 后 git 构建报
    「Couldn't find any pages or app directory」——根因项目未设 Root Directory（工程在 `web/`，
    git 集成从仓库根构建；此前 CLI 直部无此问题）。修复 = `zhulong` 项目 rootDirectory=**web**
    （API PATCH v9/projects）。验证：main 生产部署 READY（431d07c, 23:15）+ 并行会话推
    gongxtao（5fec2ba PPT 页）preview 部署 READY（23:18）——push→自动构建链路全通。
    ⚠️ 遗留：团队里还有一个误建的重复项目 **`guikesong`**（仓库根误跑 `vercel` 链出、同挂
    此 GitHub 仓库、零部署）——建议在 Dashboard 删除，免得每次 push 双份构建干扰。

## 指针

- 特性状态：`feature_list.json`（feat-014~024 全 done；023 = ChatBI；024 = 聊天新建会话）
- 会话日志：`progress.md`；验证：`web/scripts/verify.mjs`（51 项）；截图：`.shots/web_v10_chatbi_*`
- ChatBI 设计/计划：`docs/superpowers/specs/2026-08-29-chatbi-design.md`、`docs/superpowers/plans/2026-08-29-chatbi.md`
- QwenPaw 配置材料：`qwenpaw/`（README + skills/zhulong_analysis）
