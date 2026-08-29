# 烛龙 ZHULONG · 交接文档

> 写给下一个开发会话。框架已与用户对齐锁定，继续优化前**必读本文**。
> 最后更新：2026-08-29 05:40（feat-006 在线模式已提交，feat-007 懒加载待实现——**规格在 progress.md**）· 提交截止：8/29 24:00

## 0. 一句话现状

`zhulong.html`（`docs/prototype/` 下，~87KB 单文件）= 电力负荷预测决策台，浅/深双主题。
v14–v18 完成五轮重审并实测通过：主体化→减密→时光机并入主图→决策通知条→四格权重重排。
页面层级定稿：**告示（通知条）→ 仪表（四格）→ 机器（主图+胶片一体卡）**。剩余工作：接真数据。

## 1. 文件地图（只看这些）

| 文件 | 说明 |
|---|---|
| `docs/prototype/zhulong.html` | **唯一主文件**（用户明确：其它不看；2026-08-29 从根目录迁入） |
| `docs/prototype/data/zhulong-data.js` | 真数据快照（7.1MB，build-snapshot.mjs 产物，勿手改勿提交巨型 diff 外的改动） |
| `scripts/build-snapshot.mjs` | 快照生成器（ZL_SKEY 环境变量传入，绝不入库） |
| `CLAUDE.md` / `init.sh` / `feature_list.json` / `progress.md` | 工程 harness（启动验证走 `bash init.sh`） |
| `docs/zhulong-design.md` | 设计文档（布局/交互/方法论/质量记录/版本小史） |
| `docs/zhulong-handoff.md` | 本文 |
| `.shots/` | 验证截图（**v18_quad_final_\*** 双主题终稿；v17_strip / v16_qmark / v15_fused 为过程版） |
| `data/README.md` | Supabase `energy_hourly` 表结构 |
| ⚠️ `dashboard_v2~v8.html` | **旧线和他人的平行版本，全部忽略**（v8 是另一 AI 的简化重写，无时光机/演示模式，用户已裁决弃用） |

## 2. 框架（v18 定稿，勿动结构）

```
顶栏（吸顶）：烛龙 brand · 区域切换 · 时钟 · 演示数据徽章 · ☾/☀主题 · 演示按钮
⓪ 决策层（通知条·一行）：[⚡ 建议动作·未来24h] 预备窗 X–Y 内，预备 N MW 调峰资源 ⓘ [等级]
   数字内联 27px 琥珀；左色条=风险；重演态 [↺ 时光机·重演] 起点…对质 [上帝视角]
   依据在 ⓘ 弹层（P50→P90·距纪录·较30日·爬坡·校准·公式 + 审计链接；与 ⓘ/☰ 互斥）
① 状态层四格对等醒目（用户红线：现在负荷/预测偏差/今日峰值/预测误差 不可弱化）
   解剖：自解释标签 12px + ⓘ 解释（共用 sqTip 弹层）+ 24px 数字 + 唯一子数据
   被裁子指标（P90距纪录、±1.5%、MAPE口径等）在 ⓘ 弹层与格子 title 里
② 主线层【时空推演·时间机器一体卡】：全宽主图 clamp(290px,37vh,400px)，默认 3 天视窗
   实际(青)·昨日(灰)·NOW·双层扇形带·上帝视角(点线)·历史极值线·预备窗(琥珀)
   峰值两行标注含建议MW · [温度带｜偏差带(NOW右虚线)] · 龙睛光环在曲线终点
   ↕ 零隔层紧贴：#filmDock 擦洗器（无边线无小标题，"时光机"名在 hint；
     实时/重演chip·日期胶囊·极端日chips·可拖NOW）——主图=画面，胶片=进度条
   ─ 细线 ─ 图例单行chip · 频率句(脚注)＝字幕沉底；原独立 filmCard 已删除
③ 证据层两卡：为什么·归因（Δ温度×灵敏度，可复算）│ 可信·审计（覆盖率+MAPE+持久性基线对比）
抽屉（区域对比/极端日/热力图）
弹层四件套（互斥，页面无展开卡）：主图口径ⓘ · 叠加☰ · 决策依据（条内ⓘ）· 四格指标解释（标签ⓘ 共用 sqTip）
首屏预算：通知条+状态+主图卡(含胶片) = 783px < 900 视口，一屏收齐
```

**不可违背的设计原则**（历轮反馈换来的）：
1. 决策 = **一行通知条**（标签+消息+等级，~49px）；主视觉 = 时间机器。层级：告示→仪表→机器
2. 状态四格对等醒目，任何"突出重点"不得以弱化它们为代价
3. 单栏多层，无左右分栏（布局联动是历史 bug 源），无内部滚动条，看不完就页面滚动
4. **不可复算的数字不占屏**（SHAP、置信分都因此被删过）；参照系**按需呈现**（弹层/title），
   与决策层重复的数字不二次占屏——"深度是发现的，不是陈列的"
5. 诚实展示方法盲区（极涡段落后于持久性基线 = 接入气象预报的论据，是演示话术资产）
6. 双主题色板均经 CVD 六项验证，勿凭感觉改色
7. 时光机与主图是**同一台机器**（屏+进度条），勿再拆开或往中间插层

## 3. 代码结构（改哪里找哪里）

```
CSS :root + html[data-theme="dark"]   全部视觉令牌（改色只动这里）
THEMES = {light, dark}                 图表调色板（改图表色动这里）
启动（异步 boot，页面底部）：#loader 遮罩 → fetchLiveData()（在线拉 Supabase，249 请求 ≈25s，
      进度条+跳过按钮）→ 失败回退 loadSnapshot()（动态 script 标签读 data/zhulong-data.js）
      → 再失败回退内置仿真；applyData(zd) 初始化 ZD/REAL/时间锚 → startEngine(src)（buildDaily/
      buildCal/FC_CACHE.clear/BT/PERS/renderAll，徽章：在线·Supabase｜真数据·快照｜演示数据·仿真）
在线拉取器：SB.URL/SB.KEY（anon）+ sbPage(limit/offset 分页) + gridFrom(去重∪线性插值)
      + model 元数据 + pred_static 聚合（与 scripts/build-snapshot.mjs 同算法）
预测：forecastAt = 真模型注入（≤24h 内最近 pred_static 日起点，偏移重索引 mh=off+h，
      p50+真残差分位带）+ 相似日基线兜底（25–48h/2017 前）+ CAL + FC_CACHE(memo)
评估：backtest(28起点×24h，审计=模型契约视界) + buildPers(24h 同视界) + replayBT(24h)
渲染：renderDecision/StatusQuad/Main/Film/Attrib/Cred/SM/Heat/Extremes/LegendTable
交互：setZone/setOrigin/jumpTo/胶片拖拽(rAF轻量刷新)/抽屉tabs/弹层四件套(互斥+重渲即关)/CSV
演示：DEMO 六幕数组 + demoToggle（D键/Esc/←→）
主题：setTheme + localStorage('zl-theme')
快照再生成：ZL_SKEY=<service_role> node scripts/build-snapshot.mjs（密钥只走环境变量）
```

## 4. 已踩过的坑（红线清单）

1. **隐藏容器初始化 ECharts = 0×0**：heatC 必须 renderHeat 开头 `resize()`；抽屉展开后延时补 resize
2. **`overflow:hidden` 会裁切 tooltip**：时光机/热力图/小图三处 tooltip 已 `appendToBody:true`，新图表在有裁切祖先的容器里也要加
3. **FC_CACHE 时机**：buildCal 后必须 `FC_CACHE.clear()`，否则 backtest 吃到未标定结果（覆盖率会假跌到 77%）
4. **加权平均要除以权重和**（Σ(1/h)=2.45 教训）；任何"平均"先手算恒定值场景
5. **每处数字改动后跑指标断言**（见 §5），别只看页面正常——**目测转述截图会出错（吃过三次），
   以 evaluate 断言为准**
6. 相似日必须**按目标日星期**选（跨午夜星期切换），候选不晚于起点前一日（无泄露）
7. **弹层互斥必须双向闭环**：四个入口（口径/叠加/决策依据/四格解释）彼此都要关对方，
   漏一向就出现"两个弹层同屏"；且 renderDecision/renderStatusQuad 开头要隐藏弹层
   （innerHTML 换锚后旧弹层会悬空显示陈旧内容）
8. **弹层定位**：入口在页面左侧时必须左锚定（togglePop 第三参 'left'），右对齐会推出屏幕

## 5. 验证基线（真数据 v2 口径：审计 = 日前 24h，改完必须对上）

**先决**：`bash init.sh` 全绿（快照在位、脚本语法、无 service_role 泄漏）。
**在线模式（主路径）**：HTTP 服务后打开（`python3 -m http.server 4173` 于 docs/prototype），首载 ≈25s
实时查询 Supabase（249 请求）；徽章「在线 · Supabase」；可点「跳过」用快照。网络面板可向评委展示真实查询。

- BT.AEP：MAPE **3.64** / cov90 **88.8** / cov50 **52.2**（DAYTON **5.58/81.1/42.9**，DOM **5.47/87.2/48.5**）
- 基线对比：持久性 5.84% → 3.64% ↓38%（DAYTON 8.94→5.58 ↓38%，DOM 7.62→5.47 ↓28%）
- 模型行：WAPE 3.82% vs 昨日基线 6.51% ↓41%（DAYTON 3.43/7.48 ↓54%，DOM 5.08/7.97 ↓36%）
- 四格基线（AEP live @2018-07-31 05:00 EST）：现在负荷 **12,926** · 偏差 **−2.03%** · 今日峰 **18,261 @16:00** · 误差 **3.64%**
- 决策通知条：预备 **2,250 MW**（DAYTON 400 / DOM 2,750）
- 极涡重演（jumpTo 2014-01-06，真数据）：持久性 **17.02% → 相似日 23.14% 落后于基线**——杀手锏话术在真数据上成立
- 页面总装：`file:///.../docs/prototype/zhulong.html`（同目录需 `data/zhulong-data.js`）
- 回归点：切区域/胶片拖拽/极涡重演(审计卡切"本段重演·24h")/热力图 tab/演示六幕/主题来回/弹层四件套互斥
- 旧仿真基线（无快照时的回退路径，勿删）：AEP 2.34/87.8/46.3 · 今日峰 20,229@19:00 · 预备 2,700 MW

## 6. 待办（按优先级）

1. **feat-007 拆分式懒加载（当前活跃，规格见 progress.md 对应节）**：首屏只拉近 120 天 + `energy_daily`
   视图（**用户已建好并授权**，14,953 行：zone/est_day/peak_mw/peak_ts_utc）+ 近 60 天 pred_static ≈4s；
   跳转按需 range 查询 + toast；消灭首载全量 25s。实现后重测基线写入 §5
2. ~~接 Supabase 真数据~~ ✅ v2 完成并已上线在线模式（feat-005/006）
3. 可选：energy_forecasts 管道跑起来后切真前瞻；模拟器 cron 开启（"活的 NOW"）
4. 赛后：Next.js + Tailwind 工程化移植（本原型当 spec，断言基线照搬）

## 7. 演示剧本（按 D）

纵深(热力图)→节律(区域对比)→推演(收抽屉)→**验证(自动跳2014极涡,预测vs真实对质)**→自证(审计卡)→落地(决策层+品牌句「烛龙：睁眼为昼，闭眼为夜」)。
评分对应：问题洞察25/现场Demo25/完整度20/落地20/人气10（贵州黑客松赛道二）。
杀手锏话术：拖到极涡→审计卡显示"天气突变段落后于基线(相似日盲区,正是接入气象预报的论据)"→"我们知道自己什么时候不行"。
