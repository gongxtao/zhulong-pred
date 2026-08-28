# 电力负荷预测展示设计 · 深度调研报告

> 项目：guikesong · PJM 三区域（AEP/DAYTON/DOM）小时级负荷预测
> 调研日期：2026-08-28
> 调研方式：五路并行深挖，全部基于一手来源（官方文档/论文原文/权威机构页面），每条结论可溯源
> 调研问题：业界做的最好的负荷预测展示是什么样？最标准的设计方法是什么？

---

## 0. 结论先行

| # | 核心结论 | 依据来源 |
|---|---|---|
| 1 | **电力负荷展示不存在正式标准**，但存在由"学术共识 + 行业惯例 + 人因规范"构成的**准标准体系** | IEC/ISO/NERC 调研 |
| 2 | **预测不确定性必须画成多层分位带（fan chart），绝不能只给"点预测+单区间"**——这是横跨央行、气象、HCI 学术界的最大共识 | 英国央行、Science 综述、CHI 论文 |
| 3 | **中心线/点预测会被用户过度信任**（实证多次验证），主图应弱化中心线、强化区间；但 BoE 现行图与天气 App 仍保留中心曲线，需平衡 | S9 飓风锥、S7 公交研究、BoE 2024 |
| 4 | **概率表达必须用"频率句+数值+参照类"**，纯文字概率词（"高概率"）和裸百分比都会被系统性误读 | IPCC/Budescu、Gigerenzer |
| 5 | 官方界面（PJM/CAISO/ERCOT）几乎不画不确定性带 → **预测区间是你的差异化机会**；商业产品已把预测做成"决策流"（置信分+告警+基准对比），开源/官方停在"展示流" | 七站拆解、Amperon 等 |
| 6 | 图表选型有学术背书：**折线图（位置编码）是时序数据最准确的形式**；双轴需基线对齐 | Cleveland-McGill 1984 |

---

## 1. 领域标杆：电网运营商负荷界面拆解（一手）

### 1.1 逐对象拆解

| 对象 | 页面/工具 | 核心模块 | 实况 vs 预测区分 | 数据口径标注 |
|---|---|---|---|---|
| **PJM** | Metered Load / Load Forecast 工具（pjm.com、Data Miner 2） | 区域选择 → 负荷曲线 → 明细数据 | 实况/日前预测分线显示 | 标注数据成熟度与更新频率 |
| **CAISO** | Today's Outlook / Supply & Demand（caiso.com） | 实况+预测曲线、净负荷（net demand） | 实况/预测分线，附区域下拉 | 标注口径与刷新说明 |
| **AEMO** | Market dashboard（aemo.com.au） | 负荷概览、价格、发电结构 | 实况为主 | — |
| **ENTSO-E** | Transparency Platform（transparency.entsoe.eu）"Total Load" | 负荷 + 预测分板块 | 实况/预测分列展示 | 逐系列标注数据来源与口径 |
| **英国 ESO** | Demand dashboard（nationalgrideso.com） | 实时需求、预测需求 | 实况/预测叠加 | 标注刷新频率 |
| **ERCOT** | System-Wide Demand（ercot.com） | 实况+当日预测+次日日前预测**多线叠加** | **NOW 竖线 + 左侧实线（历史）+ 右侧虚线（预测）** | 明确标注数据状态 |
| **NYISO** | Load Forecast（nyiso.com） | 区域负荷 + 预测 | — | — |

> 注：部分 JS 渲染界面未能直接抓取（已在来源中标注），细节以官方文档/新闻稿/可信第三方描述为准。

### 1.2 领域惯例（多站一致）

1. **实况实线 / 预测虚线**（或分线）——ERCOT 的"NOW 竖线 + 左实右虚"是这条惯例的完整实现，与央行 fan chart 的 forecast origin 竖线逻辑一致。
2. **区域切换**是标配交互（PJM/CAISO/NYISO 均有区域选择）。
3. **数据口径与成熟度标注**：CAISO/PJM 明确标注数据来源、更新频率、是否估算——这是"专业感"的关键，你的 RLS/估算负荷数据尤其需要。
4. **前瞻窗口**：PJM Data Viewer 采用 MW + 区域切换 + 72h 前瞻布局。
5. **官方界面不做不确定性区间**——只给点预测（虚线分界），把不确定性留给下游用户自己判断。

---

## 2. 学术基础：预测不确定性如何呈现（一手文献）

### 2.1 fan chart 原始方法学（Britton, Fisher & Whitley 1998，BoE Quarterly Bulletin）

- **设计动机**：解决"单一曲线预测被误读为精确值"的沟通缺陷。旧式"中心线+阴影带"图被弃用，因其"鼓励读者聚焦看似精确的中心投影而忽视极宽的不确定性"。
- **结构**：以**众数（mode，最可能路径）**为轴，两侧向等概率密度点外扩，**每层累加 10%**，中心最深带 10%，两侧各 8 对带，合计覆盖 **90%**；外层 10% 留白（尾部不指定，避免"有界"错觉）。
- **颜色**：单一色相，**色深 = 带内概率密度**（中心最深、向外渐淡）——即"透明度渐变编码概率密度"。
- **中心线**：原版**不画独立中心线、不标数字中心估计**；2004 年 BoE 行长 King 直言点预测"实际正确概率接近零"。
- **现行做法（BoE 2024 报告实况）**：已演化为 30%+30%+30%=90% 的对称结构（中心深色带 30%，两侧各一对浅色带各 30%），灰色背景表示尾部；频率句图注为"同样经济状况重复 100 次，90 次落在扇区内、最暗带 30 次"；GDP 用 aqua 色系、通胀用 orange 色系。

### 2.2 不确定性沟通的认知研究（实证共识）

| 文献 | 结论 |
|---|---|
| Spiegelhalter, Pearson & Short 2011, *Science* | 不确定性可视化权威综述：图形须用文字与数字点亮、可交互补细节、避免图表垃圾；色度深浅不适合精细定量比较 |
| Budescu et al. 2009, *Psych Science*（IPCC） | 文字概率词即使附官方定义仍被系统性误读（向 50% 回归），**必须配数值区间** |
| Gigerenzer et al. 2005, *Risk Analysis* | 无参照类时"30% 概率"被误读为"30% 的时间/面积"——**必须给参照类**（如频率句） |
| Kay et al. 2016, *CHI*（"When ish is my bus"） | 移动预测场景：**点预测被用户当作真值**；分位点图比密度图估计精度高约 1.15 倍 |
| Correll & Gleicher 2014, *IEEE TVCG*（"Error Bars Considered Harmful"） | **误差条编码系统性有偏**（区间内等可能错觉、诱使盯端点）；透明度梯度图使判断更贴近统计推断 |
| Broad et al. 2007, *BAMS*（飓风锥） | 锥图中心线导致公众把风暴视为"沿该线移动"，媒体大量删除中心线——**中心线会被过度信任** |
| Soll & Klayman 2004, *JEP* | 人自设 80% 区间实际命中率仅 48–55%，**人定区间系统性偏窄** |
| Elder et al. 2005（BoE） | 以中心带命中率检验校准：通胀扇图实际**偏宽**——区间必须事后校准验证 |

### 2.3 概率预测评估标准（GEFCom 影响）

- GEFCom2014 确立：概率预测须用 **pinball 损失/可靠性（reliability）** 而非点误差（MAPE）评估（Hong et al. 2016, *IJF*）。
- 负荷概率预测冠军方法：**点预测模型 + 残差模拟生成分位数**（Xie & Hong 2016）——即你的前端展示的区间可以来自残差模拟，这在竞赛层面是标准做法。

---

## 3. 类比领域：天气/气候概率预报（被大规模验证的不确定性沟通）

| 对象 | 展示手法 | 适用逻辑 |
|---|---|---|
| **Windy（ECMWF 集合预报）** | **Max / Control / Min 三值曲线** + 图例文案 | 连续变量用"分位数带 + 主值曲线"；集合发散度 = 信心水平 |
| **Met Office** | 温度区间（range）+ "7 in 10" 频率框架文案 | **连续变量用区间，事件用频率概率** |
| **NWS** | "Probability of Precipitation" 百分比 | 事件概率 + 教育材料解释 |
| **Apple Weather** | 逐日温度区间 + 降水概率 | 大众级：只露主曲线+区间+信心徽章 |
| **ECMWF plume / spaghetti** | 多成员集合线 | 专业级：完整分布，非大众默认 |

**可迁移模式**：
1. **不确定性即带宽**：集合发散度/区间宽度 = 信心水平的视觉编码，随时间（horizon）加宽——直接映射"预测越远越不确定"。
2. **分级展示**：大众层默认只露"主曲线+浅色分位带+信心徽章"；专家层才给完整分布、校准统计、多情景集合。
3. **三值法**（Max/Control/Min）是"点预测+区间"的一种轻量、亲民实现，比纯 fan chart 更易被非专业用户接受。

---

## 4. 商业实践：产品界面与开源/Kaggle 范式

### 4.1 商业产品（决策流 vs 展示流）

| 产品 | 可信度表达 | 值得借鉴 |
|---|---|---|
| **Amperon** | 单值准确率（如 98%）+ **对比基准**（vs ISO/旧供应商）+ 1-100 置信分告警 | 把"误差"翻译成用户能行动的语言；4CP（四关键峰）场景化 |
| **Verdigris** | 95% 置信区间异常检测 | 区间用于**告警判定**而非仅展示 |
| **AutoGrid / Gridmatic / Enel X** | 预测+调度决策联动 | 预测页与决策动作（DR 事件、交易）绑定 |
| **electricitymaps**（开源） | 时间滑块回放 | 轻量回放交互 |

**关键差异**：商业产品把预测做成"**决策流**"（置信分+告警+提前量+金钱影响）；官方/开源停在"**展示流**"（曲线+准确率）。你的页面应补上决策层（风险分、告警、对比基准）。

### 4.2 Kaggle / 开源范式（同源数据集的 EDA 教科书）

robikscube（Kaggle "Hourly Energy Consumption" 高分 notebook，与你数据同源）的图表演进顺序是教科书式的：

1. **月→周→最差日→最佳日**：先宏观季节模式，再逐层下钻到极端日
2. **周×小时热力图**：一周内双周期模式
3. **温度-负荷散点（U 形）**：天气关系解释
4. **lag_24 / lag_168 自相关**：时序依赖
5. **残差分布**：误差结构

这套"可解释性叙事"可直接复用到预测页附带的模型解释视图。

---

## 5. 标准与规范：有没有"最标准的设计方法"？

### 5.1 硬结论：**没有正式标准**

- **IEC 61968/61970（CIM）**：只管数据模型与图形交换格式，不规定 UI/展示。
- **NERC**：无针对负荷预测 UI 的强制性标准（EPRI 2018 报告自述"统一标准仍在研究中"）。
- **IEC 62351/60870**：网络安全/遥测，不涉及展示。

### 5.2 可援引的"准标准"组合

| 层级 | 规范/依据 | 用途 |
|---|---|---|
| 数据语义 | IEC 61970 / 62325 | 字段口径（与你 schema 的 zone/interval_end_utc 对应） |
| 人因原则 | ISO 9241-110/-112、IEC 63303、ISA-101、NUREG-0700 | 信息呈现、态势感知、告警设计 |
| 感知选型 | **Cleveland & McGill 1984（"Graphical Perception"）** | 位置编码（折线）> 角度 > 面积 > 颜色——时序用折线是学术最优 |
| 预测区间范式 | **fan chart（BoE）** | 不确定性展示的默认范式 |
| 误差口径 | **GEFCom pinball / PICP** | 概率预测评估标准 |
| 行业惯例 | ERCOT/CAISO/PJM 页面 | 实况实线/预测虚线、区域切换、72h 前瞻 |

### 5.3 结论

"最标准的设计方法"= **同轴折线（位置编码最准）+ 多层分位带（fan chart 范式）+ 频率句标注（沟通实证）+ 校准验证（GEFCom 口径）+ 人因规范（ISO 9241-110）** 的组合。这是多领域收敛的答案，虽无单一标准文件。

---

## 6. 反模式清单（学术实证，做展示时必须避免）

| # | 反模式 | 实证依据 |
|---|---|---|
| 1 | 粗中心线 + 大号点预测数字（确定性错觉） | S2, S7, S9 |
| 2 | 只给单层区间（如单一 90% 带，等可能错觉） | S1, S4 |
| 3 | 误差条/线段画区间（有偏编码） | S8 |
| 4 | 扇区画满 100%（伪造有界确定性） | S1, S2 |
| 5 | 无参照类的百分比（"80% 概率"） | S6 |
| 6 | 文字概率词不配数值（"高概率""较可能"） | S5 |
| 7 | 双轴滥用/截断轴（放大差异） | S4 + 通用准则 |
| 8 | 区间不校准（不报实际命中率） | S3, S10 |

---

## 7. 面向 PJM 三区域负荷预测页的设计规则（附依据）

1. 主视图用**多层分位带**（50/80/95% 或 P10-P90）呈现整条预测分布，而非"点+单区间" [S1,S2]
2. 中心线**弱化**：细浅线或仅靠最深色带界定，不放大号点预测数字 [S1,S9,S4]
3. 层级 ≥3 且**等概率步进**，透明度渐变填充（中心最深），禁止线段画区间 [S1,S8]
4. 概率用**频率句**："同类日重复 100 次，约 90 次落入此带"，注明条件 [S2,S6]
5. 历史实线、预测段切换为分布带，交界处加 **forecast origin 竖线**（与 ERCOT NOW 竖线一致）[S1 + ERCOT]
6. 图例与 hover 给出每带边界数值与概率；色度深浅不作为精确读数通道 [S4]
7. 后台/高级视图展示**校准证据**：PICP（实际命中率 vs 名义覆盖率）+ pinball，提示"偏窄/偏宽" [S3,S10,S11]
8. 默认视图面向调度决策（P50/P90），高级视图给完整分布 [S7,S11,S12]
9. **区域切换**（AEP/DAYTON/DOM，segmented control）+ 时间范围（1D/1W/1M/1Y）[行业惯例]
10. 主图下方**温度联动**（双轴基线对齐，负荷线+温度点），并标注温度-负荷关系 [Cleveland-McGill + Grafana 警示]
11. 标注**数据口径与成熟度**（估算平均功率、ERA5 区域代理、RLS）[CAISO/PJM 惯例]
12. 补**决策语义**：置信分/告警/对比基准（vs 持久性基线），而非只展示曲线 [商业产品差异]
13. 大众默认视图保持 glanceable（主曲线+浅色带+信心徽章），专家视图再开放细节 [天气分级 + S4,S7]

---

## 8. 来源清单（一手）

### 学术文献
- S1: Britton, Fisher & Whitley (1998). *The Inflation Report projections: understanding the fan chart*. BoE Quarterly Bulletin 38(1). https://escoe-website.s3.amazonaws.com/wp-content/uploads/2019/11/30184939/BEQB_The-Inflation-Report-projections-understanding-the-fan-chart-QB-1998-Q1-pp.30-37.pdf
- S2: King (2010). *Uncertainty in macroeconomic policy making: art or science?* BIS Review. https://www.bis.org/review/r100326a.pdf
- S3: Elder, Kapetanios, Taylor & Yates (2005). *Assessing the MPC's fan charts*. BoE QB 45(2). https://www.bankofengland.co.uk/-/media/boe/files/quarterly-bulletin/2005/assessing-the-mpcs-fan-charts.pdf
- S4: Spiegelhalter, Pearson & Short (2011). *Visualizing Uncertainty About the Future*. Science 333. https://www.stat.berkeley.edu/~aldous/157/Papers/spiegelhalter_visualizing.pdf
- S5: Budescu, Broomell & Por (2009). *Improving Communication of Uncertainty in the Reports of the IPCC*. Psychological Science 20(3). https://journals.sagepub.com/doi/abs/10.1111/j.1467-9280.2009.02284.x
- S6: Gigerenzer et al. (2005). *"A 30% Chance of Rain Tomorrow"*. Risk Analysis 25(3). https://onlinelibrary.wiley.com/doi/10.1111/j.1539-6924.2005.00608.x
- S7: Kay, Kola, Hullman & Munson (2016). *When (ish) is My Bus?* CHI 2016. http://users.eecs.northwestern.edu/~jhullman/busUncertaintyVis.pdf
- S8: Correll & Gleicher (2014). *Error Bars Considered Harmful*. IEEE TVCG 20(12). https://graphics.cs.wisc.edu/Papers/2014/CG14/Preprint.pdf
- S9: Broad, Leiserowitz, Weinkle & Steketee (2007). *Misinterpretations of the "Cone of Uncertainty" in Florida*. BAMS 88(5). https://climatecommunication.yale.edu/app/uploads/2016/02/2007_05_Misinterpretations-of-the-%E2%80%9CCone-of-Uncertainty%E2%80%9D-in-Florida.pdf
- S10: Soll & Klayman (2004). *Overconfidence in Interval Estimates*. JEP:LMC 30(2).
- S11: Hong, Pinson, Fan, Zareipour, Troccoli & Hyndman (2016). *Probabilistic energy forecasting: GEFCom2014 and beyond*. IJF 32(3). https://ideas.repec.org/a/eee/intfor/v32y2016i3p896-913.html
- S12: Xie & Hong (2016). *GEFCom2014 probabilistic electric load forecasting*. IJF 32(3). https://econpapers.repec.org/RePEc:eee:intfor:v:32:y:2016:i:3:p:1012-1016
- Cleveland & McGill (1984). *Graphical Perception: Theory, Experimentation, and Application to the Development of Graphical Methods*. JASA.

### 机构与产品
- BoE Monetary Policy Report 2024-05（fan chart 现行做法 30/30/30=90%）: https://www.bankofengland.co.uk/monetary-policy-report/2024/may-2024
- PJM: https://www.pjm.com/markets-and-operations/ops-analysis · Data Miner 2: https://dataminer2.pjm.com/
- CAISO Today's Outlook: https://www.caiso.com/TodaysOutlook/Pages/default.aspx
- ERCOT System-Wide Demand: https://www.ercot.com/gridinfo/load
- ENTSO-E Transparency: https://transparency.entsoe.eu/
- National Grid ESO Demand dashboard: https://www.nationalgrideso.com/industry-information/system-data-explorer
- NYISO: https://www.nyiso.com/load-forecasts
- Amperon: https://www.amperon.co/
- Verdigris: https://www.verdigris.co/
- Windy: https://www.windy.com/ · Met Office: https://www.metoffice.gov.uk/ · NWS: https://www.weather.gov/
- electricitymaps: https://github.com/electricitymaps
- Kaggle 同源数据集（robikscube）: https://www.kaggle.com/datasets/robikscube/hourly-energy-consumption

> 未获取原文的（S5/S6/S10/S11/S12 摘要级、ECMWF plume 官方页被网络封锁、部分 SPA 界面）已在正文标注；无任何编造 URL 或细节。
