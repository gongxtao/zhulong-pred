'use client';
/* =====================================================================
   烛龙 ZHULONG · 页面骨架（静态结构照抄原型 <body>，id/class 一致以保断言口径）
   交互与渲染由 lib/zl/engine.ts 以命令式接管（React 不重渲本骨架）。
   ===================================================================== */
import { useEffect } from 'react';
import { mountEngine } from '@/lib/zl/engine';

export default function Home() {
  useEffect(() => mountEngine(), []);

  return (
    <>
      <div id="app">

        {/* 顶栏（吸顶） */}
        <header id="topbar">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
            <title>烛龙 · 睁眼为昼，闭眼为夜</title>
            <path d="M2.5 13 C6 7.5 20 7.5 23.5 13 C20 18.5 6 18.5 2.5 13 Z" stroke="#0E7490" strokeWidth="1.4" />
            <circle cx="13" cy="13" r="3.4" stroke="#0E7490" strokeWidth="1.4" />
            <circle cx="13" cy="13" r="1.1" fill="#0E7490" />
            <path d="M13 4.2 v2.6 M13 19.2 v2.6 M4.2 13 h2.6 M19.2 13 h2.6 M6.6 6.6 l1.8 1.8 M17.6 17.6 l1.8 1.8 M19.4 6.6 l-1.8 1.8 M8.4 17.6 l-1.8 1.8" stroke="#67B7CE" strokeWidth="1.1" />
          </svg>
          <div className="brand">
            <span className="brand-zh">烛龙</span><span className="brand-en">ZHULONG</span>
          </div>
          <div className="seg" id="zoneSeg" role="tablist" aria-label="负荷区域">
            <button data-zone="AEP" className="on">AEP</button>
            <button data-zone="DAYTON">DAYTON</button>
            <button data-zone="DOM">DOM</button>
          </div>
          <span id="zoneCap"></span>
          <div className="tb-right">
            <span id="clock" aria-live="off"></span>
            <span className="live" id="srcBadge" style={{ color: 'var(--ink3)' }}><span className="dot" style={{ background: 'var(--actual)', animation: 'none' }}></span><span id="srcText">演示数据 · 仿真</span></span>
            <button className="iconBtn" id="themeBtn" title="深色 / 浅色切换" aria-label="主题切换">
              <svg className="ic-moon" viewBox="0 0 16 16"><path d="M13.2 9.8 A5.8 5.8 0 1 1 6.2 2.8 A4.6 4.6 0 0 0 13.2 9.8 Z" /></svg>
              <svg className="ic-sun" viewBox="0 0 16 16"><circle cx="8" cy="8" r="3" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" /></svg>
            </button>
            <button id="demoBtn" title="按 D 键也可进入"><svg viewBox="0 0 12 12"><path d="M2 1.2 L10.6 6 L2 10.8 Z" /></svg>演示模式</button>
          </div>
        </header>

        {/* ⓪ 决策层（最顶层结论）：建议动作 · 峰值 · 置信 */}
        <div id="decisionBanner" role="status"></div>

        {/* ① 状态层：现在 / 偏差 / 今日峰 / 可信 */}
        <div id="statusQuad" role="status"></div>

        {/* ② 主线层：全宽时间脊柱（决策数字长在峰值标注上） */}
        <div className="card" id="stageCard">
          <div className="card-h" id="stageHead">
            <h2>时空推演</h2>
            <span className="rangeSeg" id="rangeSeg">
              <button data-r="24h">24h</button><button data-r="3d" className="on">3 天</button><button data-r="7d">7 天</button>
            </span>
            <span className="hint">每个数字都有参照：昨日 · 历史极值 · 概率区间</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button className="iconBtn" id="optBtn" title="叠加选项" aria-label="叠加选项">
                <svg viewBox="0 0 16 16"><path d="M2 4h12M2 8h12M2 12h12" /><circle cx="6" cy="4" r="1.6" style={{ fill: 'var(--bg1)' }} /><circle cx="11" cy="8" r="1.6" style={{ fill: 'var(--bg1)' }} /><circle cx="5" cy="12" r="1.6" style={{ fill: 'var(--bg1)' }} /></svg>
              </button>
              <button className="iconBtn" id="calBtn" title="关于本图（数据口径）" aria-label="关于本图">
                <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.3" /><path d="M8 7.2 v3.6" /><circle cx="8" cy="4.9" r=".4" fill="currentColor" /></svg>
              </button>
              <button className="iconBtn" id="csvBtn" title="导出可见窗口 CSV" aria-label="导出 CSV">
                <svg viewBox="0 0 16 16"><path d="M8 2.5 v7.5 M4.8 7.2 L8 10.4 L11.2 7.2 M2.8 13 h10.4" /></svg>
              </button>
            </div>
          </div>
          <div id="chartWrap">
            <div id="mainChart"></div>
            <div id="stripRow">
              <div className="mini"><span className="tag">气温 °C · 区域加权</span><div id="tempChart" style={{ position: 'absolute', inset: '10px 0 0 0' }}></div></div>
              <div className="mini"><span className="tag">偏差 % · 实际−预测 · 虚线 ±3% 为关注线</span><div id="devChart" style={{ position: 'absolute', inset: '10px 0 0 0' }}></div></div>
            </div>
          </div>
          {/* 时光机 dock：紧贴画面之下的擦洗器——同一台时间机器，无边线无小标题 */}
          <div id="filmDock">
            <div id="filmHead">
              <button type="button" className="modeChip" id="modeChip" title="回到实时">实时</button>
              <div id="dateCapsule">
                <button className="stepBtn" id="stepPrev" title="前移一天（起点）" aria-label="前移一天">‹</button>
                <span className="zd" id="originDate"></span>
                <button className="stepBtn" id="stepNext" title="后移一天（起点）" aria-label="后移一天">›</button>
              </div>
              <span className="hint">时光机 · 拖动 NOW，回看任一天的「当时预测 vs 真实后续」</span>
              <div className="extChips" id="extChips"></div>
            </div>
            <div id="filmWrap">
              <div id="filmChart"></div>
              <div id="filmEvents"></div>
              <div id="filmHandle" aria-hidden="true"><div className="bar"></div><div className="grip">NOW</div></div>
            </div>
          </div>
          <div id="legendTable" aria-hidden="true"></div>
          <div id="freqSentence">在相似的天气与日历条件下重复 <i>100</i> 次，约 <i>90</i> 次的实际负荷会落入这条区间带（P10–P90）。<b>区间随时间张开——越远，越不确定。</b></div>
        </div>

        {/* ③ 证据层：归因 / 审计（建议在顶部决策层，口径见主图 ⓘ 弹层） */}
        <div id="evidenceRow">

          <div className="card" id="railAttrib">
            <div className="card-h"><h2>为什么 · 归因</h2><span className="hint" style={{ marginLeft: 'auto' }}>较昨日同时</span></div>
            <div className="rc-body">
              <div id="attribRows"></div>
              <div id="wxGrid"></div>
            </div>
          </div>

          <div className="card" id="railCred">
            <div className="card-h"><h2>可信 · 审计</h2><span className="hint" style={{ marginLeft: 'auto' }} id="credScope">近 28 个起点回测</span></div>
            <div className="rc-body">
              <div className="covRow">
                <div className="lbl"><span>P90 区间命中率 <span className="hint">标称 90%</span></span><b id="cov90v">—</b></div>
                <div className="covBar" id="cov90bar"><div className="fill"></div><div className="tick" style={{ left: '90%' }}></div></div>
              </div>
              <div className="covRow">
                <div className="lbl"><span>P50 区间命中率 <span className="hint">标称 50%</span></span><b id="cov50v">—</b></div>
                <div className="covBar" id="cov50bar"><div className="fill"></div><div className="tick" style={{ left: '50%' }}></div></div>
              </div>
              <div id="mapeRow">
                <div id="mapeSpark"></div>
                <div>
                  <div id="mapeVal">—</div>
                  <div id="mapeNote">日前 24h 预测平均绝对百分比误差（行业优良 &lt;3%）</div>
                </div>
              </div>
              <div id="basisCmp" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--line)', fontSize: '11.5px', color: 'var(--ink2)' }}></div>
              <div id="modelLine" style={{ marginTop: 6, fontSize: '11.5px', color: 'var(--ink2)' }}></div>
              <div style={{ marginTop: 8 }} id="credBadge"></div>
            </div>
          </div>

        </div>

        {/* 底部抽屉 */}
        <div id="drawer">
          <div id="drawerTabs">
            <button data-t="sm" className="on">区域对比</button>
            <button data-t="ext">极端日排行</button>
            <button data-t="heat">季节热力图 · 14 年</button>
            <button id="drawerFold" className="iconBtn" style={{ width: 24, height: 24 }} title="收起 / 展开">
              <svg viewBox="0 0 16 16" style={{ width: 12, height: 12 }}><path d="M3 6 l5 5 l5 -5" /></svg>
            </button>
          </div>
          <div id="drawerBody">
            <div className="drawerPane on" id="pane-sm"><div id="smGrid"></div></div>
            <div className="drawerPane" id="pane-ext"><div id="extList"></div></div>
            <div className="drawerPane" id="pane-heat">
              <div id="heatWrap"><div id="heatChart"></div>
                <div id="heatLegend"><span>周峰值 / 当年最大</span><div className="ramp"></div><span>低 → 高</span><span className="hint">点击任一周 · 时光机跳转</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 弹层：口径 */}
      <div id="calPopover" role="dialog" aria-label="关于本图">
        <h3>关于本图</h3>
        <div id="calPopoverBody"></div>
      </div>
      {/* 弹层：叠加选项 */}
      <div id="optPopover">
        <label><input type="checkbox" id="optTemp" defaultChecked />温度带</label>
        <label><input type="checkbox" id="optYday" defaultChecked />昨日同时刻</label>
        <label><input type="checkbox" id="optGod" defaultChecked />上帝视角（真实后续）</label>
        <label><input type="checkbox" id="optPeak" defaultChecked />峰值与预备窗</label>
      </div>
      {/* 弹层：建议依据（决策层按需展开，不常驻屏上） */}
      <div id="basisPopover" role="dialog" aria-label="建议依据"></div>
      {/* 弹层：状态格指标解释（四格标签 ⓘ 共用一个） */}
      <div id="sqTip" role="dialog" aria-label="指标解释"></div>
      {/* 悬浮数据问答按钮（feat-023 ChatBI） */}
      <button id="chatBtn" title="数据问答 · Agent 实时查库" aria-label="数据问答">
        <svg viewBox="0 0 16 16"><path d="M2 3.2 h12 v7.6 h-7 L3.6 13.6 v-2.8 H2 Z" /><circle cx="5.6" cy="7" r=".5" fill="currentColor" /><circle cx="8" cy="7" r=".5" fill="currentColor" /><circle cx="10.4" cy="7" r=".5" fill="currentColor" /></svg>
      </button>
      {/* 右侧抽屉：数据问答（浏览器扩展式侧栏，互斥家族第五件） */}
      <div id="chatLayer" role="dialog" aria-label="数据问答">
        <div className="chat-h">
          <h3>数据问答</h3>
          <span className="hint">烛龙助手实时查询生产库 · pred_dynamic 双轨分析</span>
          <button className="iconBtn" id="chatClose" title="关闭" aria-label="关闭" style={{ marginLeft: 'auto', width: 26, height: 26 }}>
            <svg viewBox="0 0 16 16"><path d="M4 4 L12 12 M12 4 L4 12" /></svg>
          </button>
        </div>
        <div id="chatLog" aria-live="polite"></div>
        <div id="chatChips">
          <button data-q="对比持续学习(pred_dynamic)与静态模型(pred_static)在 AEP 区 2018 年 6 月的日前预测精度（MAPE/WAPE），给出结论和数字">持续学习比静态模型好多少？</button>
          <button data-q="查询 pred_dynamic 表 AEP 区 forecast_origin_utc 为 2018-06-30 的日前预测：逐小时 predicted_load_mw 与 actual_load_mw、并给出当日 MAPE">查 AEP 2018-06-30 前 24h 预测</button>
          <button data-q="分析 pred_dynamic 表：三个区（AEP/DAYTON/DOM）各自的 MAPE 排名如何？误差按 forecast_horizon_hour 分桶后哪个时距段最差？">哪个区、哪个时段误差最大？</button>
          <button data-q="用 pred_dynamic 表 AEP 区按季度聚合 MAPE 看趋势：持续学习的误差是否随时间改善？与 pred_static 同窗对比（静态应持平、动态应下降），给出逐季表格和结论">误差在改善吗？看学习趋势</button>
          <button data-q="分析 pred_dynamic 表 AEP 区：按 forecast_origin_utc 起点日聚合当日 MAPE，列出最差的 5 天（日期+MAPE），并指出各自误差集中在哪个时距段">哪些天预测得最差？</button>
        </div>
        <div className="chat-input">
          <textarea id="chatInput" rows={2} maxLength={500} placeholder="用中文问任何问题：持续学习效果、双轨对比、某天的预测…" autoComplete="off"></textarea>
          <button id="chatSend" title="发送" aria-label="发送">
            <svg viewBox="0 0 16 16"><path d="M2 8.2 L14 2.4 L9.4 14 L7.4 9.4 Z M7.4 9.4 L14 2.4" /></svg>
          </button>
        </div>
      </div>

      {/* 按需查询 toast */}
      <div id="sbToast" role="status"><span className="spin"></span><span id="sbToastText">查询生产库…</span></div>
      {/* 数据加载遮罩 */}
      <div id="loader">
        <div className="ld-box">
          <svg width="44" height="44" viewBox="0 0 26 26" fill="none" style={{ margin: '0 auto', display: 'block' }}>
            <path d="M2.5 13 C6 7.5 20 7.5 23.5 13 C20 18.5 6 18.5 2.5 13 Z" stroke="#0E7490" strokeWidth="1.4" />
            <circle cx="13" cy="13" r="3.4" stroke="#0E7490" strokeWidth="1.4" />
            <circle cx="13" cy="13" r="1.1" fill="#0E7490" />
          </svg>
          <div className="ld-title">烛龙 ZHULONG</div>
          <div className="ld-sub">正在实时查询生产数据库（Supabase）</div>
          <div className="ld-bar"><div className="fill" id="ldFill"></div></div>
          <div className="ld-detail" id="ldDetail">准备中…</div>
          <button id="ldSkip">跳过，使用内嵌快照</button>
        </div>
      </div>
      {/* 演示模式 */}
      <div id="demoLayer">
        <div className="veil"></div>
        <div id="demoCap"><div className="eyebrow"></div><h1></h1><p></p></div>
        <div id="demoHud">
          <span className="kbd">←/→ 切幕 · ESC 退出</span>
          <div className="dots" id="demoDots"></div>
          <button id="demoExit">退出</button>
        </div>
      </div>
    </>
  );
}
