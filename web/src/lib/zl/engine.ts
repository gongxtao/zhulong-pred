'use client';
/* =====================================================================
   烛龙 ZHULONG · 渲染与交互引擎（照抄 docs/prototype/zhulong.html，TS 化）
   React 只提供静态骨架（page.tsx），本引擎以命令式 DOM + ECharts 渲染——
   与原型行为逐项一致（断言口径不变）。
   ===================================================================== */
import * as echarts from 'echarts';
import { streamChat } from './chat';
import {
  EVENTS, H_FC, PRED_EPOCH, RANGES, SQ_TIPS, THEMES, ZONES, ZONE_KEYS, type Theme, type Zone,
} from './const';
import {
  applyAnchors, buildDaily, curToken, daily, dbgHook, loadAt, nextToken, NOW_DEFAULT,
  packAt, RECORD, sensAt, setSrc, sbToast, SRC, state, store, T_MAX, T_MIN, tempAt,
} from './store';
import {
  backtest, buildCal, buildPers, BT, CAL, FC_CACHE, forecastAt, PERS, replayBT, staticLineAt,
} from './forecast';
import {
  bootLayer1, ensureWindow, ldAbort, ldReset, loadSnapshot, setLiveMergeHook, storeFromSnapshot,
  windowReady,
} from './supabase';
import {
  clamp, DAY, doyOf, etP, fmt, fmtFull, fmtHM, fmtMD, fmtMDH, fmtNow, HOUR,
  locDay, LOC, p2, rgba, rnd2, WD_ZH,
} from './util';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

/* ECharts 回调参数的局部类型（只用到的字段） */
type TipParam = { axisValue?: number; value: [number, number] };
type HeatTipParam = { data: [number, number, string] };
type AxisExtent = { max: number; min: number };
/* CSV 导出行单元格 */
type CsvCell = { a?: number; g?: number; t?: number; f?: ReturnType<typeof forecastAt>[0] };
/* window 上的断言钩子 */
interface ZLWindow {
  __renderLog?: { z: string; err?: string }[];
  __zlCharts?: { mainC: echarts.ECharts };
}
const zlWindow = () => window as unknown as ZLWindow;

/* ---------- 主题调色板（C 在 mount 时按持久化主题选定） ---------- */
let C: Theme = THEMES.light;

/* ---------- 图表实例 ---------- */
let mainC: echarts.ECharts, tempC: echarts.ECharts, devC: echarts.ECharts,
  filmC: echarts.ECharts, mapeC: echarts.ECharts, heatC: echarts.ECharts | null = null;
const smC: Partial<Record<Zone, echarts.ECharts>> = {};
let FC_PREV: ReturnType<typeof forecastAt> | null = null; // 昨日起点预测（供偏差带）

let mounted = false;
let bootStarted = false;
const cleanups: Array<() => void> = [];
function onMount(fn: () => void) { cleanups.push(fn); }

/* =====================================================================
   渲染 · ② 主线层（全宽时间脊柱）
   ===================================================================== */
function stageData() {
  const z = state.zone, org = state.origin, back = RANGES[state.range].back;
  const hist: [number, number][] = [], god: [number, number][] = [];
  for (let ts = org - back * HOUR; ts <= org; ts += HOUR) hist.push([ts, loadAt(z, ts)]);
  if (state.opts.god) for (let ts = org + HOUR; ts <= Math.min(org + H_FC * HOUR, T_MAX); ts += HOUR) god.push([ts, loadAt(z, ts)]);
  const fc = forecastAt(z, org);
  /* 昨日同时刻参照线已按用户裁决移除（2026-08-29）：由「静态预测」对照线取代（持续学习故事） */
  const temps: [number, number][] = [];
  for (let ts = org - back * HOUR; ts <= org + H_FC * HOUR; ts += HOUR) temps.push([ts, tempAt(ts, ZONES[z].tOff)]);
  FC_PREV = forecastAt(z, org - 24 * HOUR);
  return { hist, god, fc, temps, back };
}
function bandStack(fc: ReturnType<typeof forecastAt>, loK: 'p10' | 'p25', hiK: 'p90' | 'p75', stack: string, color: string) {
  const base: [number, number][] = [], delta: [number, number][] = [];
  fc.forEach(p => { base.push([p.ts, p[loK]]); delta.push([p.ts, p[hiK] - p[loK]]) });
  return [
    { name: '_' + stack, type: 'line', stack: 'b', data: base, lineStyle: { opacity: 0 }, symbol: 'none', silent: true, z: 2,
      tooltip: { show: false }, emphasis: { disabled: true } },
    { name: stack, type: 'line', stack: 'b', data: delta, lineStyle: { opacity: 0 }, symbol: 'none', silent: true, z: 2,
      areaStyle: { color }, tooltip: { show: false }, emphasis: { disabled: true } },
  ] as Record<string, unknown>[];
}
function renderMain() {
  const { hist, god, fc, temps, back } = stageData();
  const stat = staticLineAt(state.zone, state.origin); /* 静态模型对照线（predStatic 原始轨） */
  const preEpoch = state.origin < PRED_EPOCH; /* 预测纪元前=档案模式：无任何预测层（用户裁决 feat-020） */
  const org = state.origin;
  const tMax = org + H_FC * HOUR;
  /* 未来 24h 峰值与决策数字（钉在图上） */
  const day1 = fc.filter(p => p.ts <= org + 24 * HOUR);
  const peak = day1.reduce((a, b) => b.p50 > a.p50 ? b : a, day1[0]);
  const peak90 = day1.reduce((a, b) => b.p90 > a.p90 ? b : a, day1[0]);
  const peakEt = fmtHM(peak.ts);
  const prepMW = Math.ceil((peak90.p90 - peak.p50 * 0.97) / 50) * 50;
  /* 偏差带数据：NOW 左 = 实际 − 昨日预测（实线）；NOW 右 = 真实 − 当前预测（虚线，语义不同的追踪段） */
  const devL: [number, number][] = [], devR: [number, number][] = [];
  for (let ts = org - back * HOUR; ts <= org; ts += HOUR) {
    const idx = (ts - (org - 24 * HOUR)) / HOUR;
    if (idx >= 1 && idx <= H_FC && FC_PREV![idx - 1].ts === ts) devL.push([ts, (loadAt(state.zone, ts) - FC_PREV![idx - 1].p50) / FC_PREV![idx - 1].p50 * 100]);
  }
  if (state.opts.god) for (const p of fc) {
    if (p.ts <= T_MAX) devR.push([p.ts, (loadAt(state.zone, p.ts) - p.p50) / p.p50 * 100]);
  }

  const series = [
    ...(preEpoch ? [] : bandStack(fc, 'p10', 'p90', 'b90', C.b90)),
    /* 内层 P25–P75 窄带已按用户裁决移除（2026-08-29）：P50 在宽带中央，窄带视觉突兀；
       cov50 数字仍按需呈现于审计卡与悬停 */
    { name: '实际·后续', type: 'line', data: god, showSymbol: false, z: 3,
      lineStyle: { color: C.actual, type: 'dotted', width: 1.7, opacity: .7 }, itemStyle: { color: C.actual },
      endLabel: { show: god.length > 0, formatter: '真实', color: C.ink3, fontSize: 10, distance: 4 } },
    ...(preEpoch ? [] : [{ name: '静态预测', type: 'line', data: stat, showSymbol: false, z: 4, silent: true,
      lineStyle: { color: C.yday, width: 1.7, type: 'dashed', opacity: .95 }, itemStyle: { color: C.yday },
      endLabel: { show: stat.length > 0, formatter: '静态', color: C.yday, fontSize: 10, fontWeight: 600, distance: 4 },
      /* 线尾标签左下入图（右缘裁剪修复）+ 与学习线错位（重合段两线同值，标签须避让不叠字） */
      labelLayout: stat.length ? { dx: -16, dy: 14 } : undefined,
      tooltip: { show: false } }]),
    { name: '实际负荷', type: 'line', data: hist, showSymbol: false, z: 6,
      lineStyle: { color: C.actual, width: 3 }, itemStyle: { color: C.actual },
      emphasis: { focus: 'series' },
      endLabel: { show: true, formatter: '实际', color: C.actualHi, fontSize: 10, fontWeight: 700, distance: 4 },
      markLine: { symbol: 'none', silent: true,
        lineStyle: { color: C.ink2, width: 1, type: 'solid', opacity: .8 },
        data: [
          { xAxis: org, label: { show: true, formatter: 'NOW', color: C.ink2, fontFamily: 'JetBrains Mono', fontSize: 10, position: 'insideEndTop' } },
        ] },
      markPoint: { symbol: 'circle', symbolSize: 5.5, silent: true,
        itemStyle: { color: C.actual, borderColor: C.tipBg, borderWidth: 2 },
        data: [{ coord: [hist[hist.length - 1][0], hist[hist.length - 1][1]] },
          /* 龙睛：实际曲线终点的光环——眼随时间，拖动胶片它跟着走 */
          { coord: [hist[hist.length - 1][0], hist[hist.length - 1][1]], symbolSize: 15,
            itemStyle: { color: 'transparent', borderColor: C.actual, borderWidth: 1.5, opacity: .55 } }] },
    },
    ...(preEpoch ? [] : [{ name: '持续学习 P50', type: 'line', data: fc.map(p => [p.ts, p.p50]), showSymbol: false, z: 5,
      lineStyle: { color: C.fc, width: 1.8, type: 'dashed' }, itemStyle: { color: C.fc }, emphasis: { focus: 'series' },
      endLabel: { show: true, formatter: 'P50', color: C.fcHi, fontSize: 10, fontWeight: 600, distance: 4 },
      labelLayout: { dx: -14, dy: -10 }, /* 线尾标签移入图内（右缘裁剪修复，与「静态」上下错开 */
      markLine: { symbol: 'none', silent: true,
        lineStyle: { color: C.fcHi, width: 1, type: 'dashed', opacity: .7 },
        /* 文字标注移至 title 组件（图右上固定，永不裁切）；此线仅指示峰时刻 */
        data: state.opts.peak && peak ? [{ xAxis: peak.ts, label: { show: false } }] : [] },
      /* 预备窗琥珀竖带已按用户裁决移除（2026-08-29）：窗口时间在决策条/依据弹层按需呈现，主图保持干净 */
    }]),
  ];
  mainC.setOption({
    animationDuration: 650, animationDurationUpdate: 350,
    grid: { left: 58, right: 46, top: 44, bottom: 52 }, /* bottom 容纳双行轴标签 */
    legend: { show: false },
    /* 日峰/最坏/建议备：固定右上角，峰时刻由 P50 系列的垂直虚线指示（防右缘裁切，用户实测被遮） */
    title: !preEpoch && state.opts.peak && peak ? {
      text: `日峰 P50 ${fmt(peak.p50)} · ${peakEt}`,
      subtext: `最坏 P90 ${fmt(peak90.p90)} · 建议备 ${fmt(prepMW)} MW`,
      right: 52, top: 4,
      textStyle: { color: C.fcHi, fontSize: 11.5, fontWeight: 700, fontFamily: 'JetBrains Mono' },
      subtextStyle: { color: C.ink2, fontSize: 10.5, fontFamily: 'JetBrains Mono' },
    } : { show: false },
    tooltip: { trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: C.axisLine, width: 1 } },
      backgroundColor: C.tipBg, borderColor: C.tipLine, padding: [9, 13], textStyle: { color: C.ink, fontSize: 12 },
      extraCssText: 'box-shadow:0 6px 20px rgba(15,23,42,.12);',
      formatter(ps: TipParam[]) {
        const ts = ps[0].axisValue!;
        let h = `<b style="font-family:JetBrains Mono;font-size:11.5px">${fmtFull(ts)}</b>`;
        const a = hist.find(p => p[0] === ts);
        if (a) h += `<div style="margin-top:4px"><span style="color:${C.actual}">●</span> 实际　<b style="font-family:JetBrains Mono">${fmt(a[1])}</b> MW</div>`;
        const g = god.find(p => p[0] === ts);
        if (g) h += `<div><span style="color:${C.actual};opacity:.7">○</span> 真实后续　<b style="font-family:JetBrains Mono">${fmt(g[1])}</b> MW</div>`;
        const p = fc.find(q => q.ts === ts);
        if (p) {
          h += `<div><span style="color:${C.fcHi}">▤</span> P50　<b style="font-family:JetBrains Mono">${fmt(p.p50)}</b> MW</div>`;
          h += `<div style="color:${C.ink2};font-size:11px">P10–P90　${fmt(p.p10)} – ${fmt(p.p90)}</div>`;
          h += `<div style="color:${C.ink2};font-size:11px">P25–P75　${fmt(p.p25)} – ${fmt(p.p75)}</div>`;
        }
        const s = stat.find(q => q[0] === ts); /* 静态预测对照值（feat-021：悬停须可见，含与学习线重合段） */
        if (s) h += `<div><span style="color:${C.yday}">▤</span> 静态预测　<b style="font-family:JetBrains Mono">${fmt(s[1])}</b> MW</div>`;
        const t = temps.find(q => q[0] === ts);
        if (t) h += `<div style="color:${C.ink3};font-size:11px">气温　${t[1].toFixed(1)} °C</div>`;
        return h;
      } },
    xAxis: { type: 'time', min: org - back * HOUR, max: tMax,
      axisLine: { lineStyle: { color: C.axisLine } }, axisTick: { show: false },
      axisLabel: { color: C.ink3, fontSize: 10, fontFamily: 'JetBrains Mono', hideOverlap: true, lineHeight: 13,
        formatter: (v: number) => { const p = etP(v); return p2(p.mo) + '/' + p2(p.da) + '\n' + p2(p.h) + ':00' } }, /* 双行：日期+时间，任何缩放都看得出哪天 */
      splitLine: { show: false } },
    yAxis: { type: 'value', scale: true,
      axisLabel: { color: C.ink3, fontSize: 10.5, fontFamily: 'JetBrains Mono', formatter: (v: number) => (v / 1000).toFixed(1) + 'k' },
      splitLine: { lineStyle: { color: C.split, width: 1 } }, axisLine: { show: false } },
    series,
  }, true);

  /* 温度带 + 偏差带（共享时间窗，独立刻度——拒绝双轴） */
  tempC.setOption({
    animationDuration: 600,
    grid: { left: 58, right: 8, top: 6, bottom: 12 },
    tooltip: { trigger: 'axis', backgroundColor: C.tipBg, borderColor: C.tipLine, textStyle: { color: C.ink, fontSize: 11.5 },
      formatter: (ps: TipParam[]) => `${fmtMDH(ps[0].axisValue!)}　<b>${ps[0].value[1].toFixed(1)}</b> °C` },
    xAxis: { type: 'time', min: org - back * HOUR, max: tMax, axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { show: false }, splitLine: { show: false } },
    yAxis: { type: 'value', scale: true, axisLabel: { show: false }, splitLine: { show: false }, axisLine: { show: false } },
    series: [{ type: 'line', data: state.opts.temp ? temps : [], showSymbol: false, z: 2,
      lineStyle: { color: C.ink2, width: 1.4, opacity: .9 }, itemStyle: { color: C.ink2 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
        { offset: 0, color: 'rgba(148,163,184,.18)' }, { offset: 1, color: 'rgba(148,163,184,0)' }] } },
      markLine: { symbol: 'none', silent: true, label: { show: false },
        lineStyle: { color: C.ink2, width: 1, opacity: .8 }, data: [{ xAxis: org }] } }],
  }, true);
  devC.setOption({
    animationDuration: 600,
    grid: { left: 30, right: 8, top: 6, bottom: 12 },
    tooltip: { trigger: 'axis', backgroundColor: C.tipBg, borderColor: C.tipLine, textStyle: { color: C.ink, fontSize: 11.5 },
      formatter: (ps: TipParam[]) => { const v = ps[0].value[1];
        return `${fmtMDH(ps[0].axisValue!)}　<b>${v >= 0 ? '+' : ''}${v.toFixed(2)}%</b>` } },
    xAxis: { type: 'time', min: org - back * HOUR, max: tMax, axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { show: false }, splitLine: { show: false } },
    yAxis: { type: 'value', min: (v: AxisExtent) => Math.min(-4, v.min), max: (v: AxisExtent) => Math.max(4, v.max),
      axisLabel: { show: false }, splitLine: { show: false }, axisLine: { show: false } },
    series: [
      { name: '偏差·已发生', type: 'line', data: devL, showSymbol: false, z: 2, connectNulls: false,
        lineStyle: { color: C.actualHi, width: 1.5 }, itemStyle: { color: C.actualHi },
        markLine: { symbol: 'none', silent: true, label: { show: false },
          data: [
            { yAxis: 0, lineStyle: { color: C.axisLine, width: 1 } },
            { yAxis: 3, lineStyle: { color: C.danger, type: 'dashed', width: 1, opacity: .4 } },
            { yAxis: -3, lineStyle: { color: C.danger, type: 'dashed', width: 1, opacity: .4 } },
            { xAxis: org, lineStyle: { color: C.ink2, width: 1, opacity: .8 } },
          ] } },
      { name: '偏差·预测追踪', type: 'line', data: devR, showSymbol: false, z: 2, connectNulls: false,
        lineStyle: { color: C.actualHi, width: 1.4, type: 'dashed', opacity: .8 }, itemStyle: { color: C.actualHi } },
    ],
  }, true);
}

/* =====================================================================
   渲染 · ① 状态层（问题式四格，对等醒目）
   ===================================================================== */
function renderStatusQuad() {
  const z = state.zone, org = state.origin;
  const live = state.mode === 'live';
  const preEpoch = org < PRED_EPOCH; /* 模型纪元前：预测类格子降为档案/— 语义（feat-020） */
  const bt = BT[z]!;
  const mape = bt.reduce((s, d) => s + d.mape, 0) / bt.length;
  const cov90 = bt.reduce((s, d) => s + d.cov90, 0) / bt.length;
  const fc = forecastAt(z, org).filter(p => p.ts <= org + 24 * HOUR);
  const peak = fc.reduce((a, b) => b.p50 > a.p50 ? b : a, fc[0]);
  const peak90 = fc.reduce((a, b) => b.p90 > a.p90 ? b : a, fc[0]);
  const peakEt = fmtHM(peak.ts);
  /* 偏差：最近 6 个已发生小时，实际 vs 昨日起点预测 */
  let dev: number | null = null, wSum = 0;
  for (let h = 6; h >= 1; h--) {
    const ts = org - h * HOUR, idx = (ts - (org - 24 * HOUR)) / HOUR;
    if (idx >= 1 && idx <= H_FC && FC_PREV![idx - 1].ts === ts) {
      const d = (loadAt(z, ts) - FC_PREV![idx - 1].p50) / FC_PREV![idx - 1].p50 * 100;
      if (dev == null) dev = 0;
      dev += d / h; wSum += 1 / h;
    }
  }
  if (dev != null) dev /= wSum; /* 加权平均（越近权重越高）——必须除以权重和 Σ(1/h)=2.45 */
  const nowV = loadAt(z, org), yesV = loadAt(z, org - 24 * HOUR);
  const dayPk = preEpoch ? daily[z].find(d => d.di === locDay(org)) : undefined; /* 纪元前档案语义：当日实际峰 */
  const dPct = (nowV - yesV) / yesV * 100;
  const devOk = dev != null && Math.abs(dev) < 1.5;
  const recGap = (peak90.p90 - RECORD[z].v) / RECORD[z].v * 100;
  const mapeShow = live ? mape : replayBT().mape;
  $('sqTip').style.display = 'none'; /* 重渲即关：防悬空 */
  $('statusQuad').innerHTML = `
    <div class="sq" title="${WD_ZH[etP(org).wd]} ${fmtHM(org)}（美东）${live ? '' : ' · 重演中，拖动胶片回放任一天'}">
      <div class="sq-l">${live ? '现在负荷' : '现在 · 重演起点'}${live ? '' : '<span class="rp">↺</span>'}<span class="db-q sq-i" data-sq="0" role="button" tabindex="0">i</span></div>
      <div class="sq-v num">${fmt(nowV)}<small>MW</small></div>
      <div class="sq-s">${live ? `<span class="${dPct >= 0 ? 'up' : 'down'}">${dPct >= 0 ? '▲ +' : '▼ '}${dPct.toFixed(1)}%</span> 较昨日`
      : `${WD_ZH[etP(org).wd]} ${fmtHM(org)} · 拖动胶片回放`}</div>
    </div>
    <div class="sq" title="实际 − 昨日起点预测 · 近 6 小时加权平均（越近越重）· ±1.5% 内为正常">
      <div class="sq-l">预测偏差<span class="db-q sq-i" data-sq="1" role="button" tabindex="0">i</span></div>
      <div class="sq-v num" style="color:${dev == null || preEpoch ? C.ink3 : devOk ? C.ink : C.warn}">${dev == null || preEpoch ? '—' : (dev >= 0 ? '+' : '') + dev.toFixed(2) + '%'}</div>
      <div class="sq-s">${dev == null || preEpoch ? (preEpoch ? '模型纪元前无预测' : '重演模式无昨日预测') : `<span class="badge ${devOk ? 'ok' : 'warn'}">${devOk ? '正常' : '关注'}</span>`}</div>
    </div>
    ${preEpoch ? `
    <div class="sq" title="模型纪元（2016-01）前 · 档案语义：当日实际峰值（无预测层）">
      <div class="sq-l">今日峰值 · 实际<span class="db-q sq-i" data-sq="2" role="button" tabindex="0">i</span></div>
      <div class="sq-v num">${dayPk ? `${fmt(dayPk.peak)}<small>MW</small><small class="at">@${fmtHM(dayPk.ts)}</small>` : '—'}</div>
      <div class="sq-s">档案 · 模型纪元前</div>
    </div>
    <div class="sq" title="模型纪元（2016-01）前无生产预测，误差指标不适用">
      <div class="sq-l">预测误差 · 纪元前<span class="db-q sq-i" data-sq="3" role="button" tabindex="0">i</span></div>
      <div class="sq-v num" style="color:${C.ink3}">—</div>
      <div class="sq-s">2016-01 起模型纪元</div>
    </div>` : `
    <div class="sq" title="未来 24h 预测日峰（P50）· 最坏 P90 距历史纪录 ${recGap >= 0 ? '+' : ''}${recGap.toFixed(1)}% · 预备窗 ${fmtHM(peak.ts - 3 * HOUR)}–${peakEt}">
      <div class="sq-l">今日峰值 · 预测<span class="db-q sq-i" data-sq="2" role="button" tabindex="0">i</span></div>
      <div class="sq-v num" style="color:${C.fcHi}">${fmt(peak.p50)}<small>MW</small><small class="at">@${peakEt}</small></div>
      <div class="sq-s">最坏 P90 <b class="num">${fmt(peak90.p90)}</b></div>
    </div>
    <div class="sq" title="MAPE = 日前 24h 预测平均绝对百分比误差 · 行业优良 &lt;3% · ${live ? '近 28 起点回测' : '本段重演 · 24h'}">
      <div class="sq-l">预测误差${live ? '' : ' · 本段重演'}<span class="db-q sq-i" data-sq="3" role="button" tabindex="0">i</span></div>
      <div class="sq-v num">${mapeShow.toFixed(2)}<small>%</small></div>
           <div class="sq-s">${mapeShow < 3 ? '<span class="badge ok">✓ 优于 3%</span>' : '<span class="badge warn">劣于 3%</span>'} P90 命中 <b class="num">${cov90.toFixed(1)}%</b></div>
    </div>`}
  `;
}

/* =====================================================================
   渲染 · 时光机
   ===================================================================== */
function renderFilm() {
  const arr = daily[state.zone];
  const data = arr.map(d => [d.ts, d.peak]);
  filmC.setOption({
    animationDuration: 500,
    grid: { left: 10, right: 10, top: 10, bottom: 20 }, /* bottom 留足轴标签空间（margin8+字高≈18px），否则年份下缘被裁 */
    tooltip: { trigger: 'axis', appendToBody: true, backgroundColor: C.tipBg, borderColor: C.tipLine, textStyle: { color: C.ink, fontSize: 11.5 },
      extraCssText: 'box-shadow:0 6px 20px rgba(15,23,42,.12);z-index:1000;',
      formatter: (ps: TipParam[]) => `${fmtFull(ps[0].value[0])}<br/>日峰值 <b style="font-family:JetBrains Mono">${fmt(ps[0].value[1])}</b> MW` },
    xAxis: { type: 'time', min: T_MIN, max: T_MAX, axisLine: { lineStyle: { color: C.axisLine } }, axisTick: { show: false },
      axisLabel: { color: C.ink3, fontSize: 9.5, fontFamily: 'JetBrains Mono', formatter: (v: number) => '' + LOC(v).getUTCFullYear() },
      splitLine: { show: false } },
    yAxis: { type: 'value', axisLabel: { show: false }, axisLine: { show: false }, splitLine: { show: false } },
    series: [{ type: 'line', data, showSymbol: false,
      lineStyle: { color: C.zone[state.zone], width: 1.2, opacity: .9 }, itemStyle: { color: C.zone[state.zone] },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
        { offset: 0, color: rgba(C.zone[state.zone], .18) }, { offset: 1, color: rgba(C.zone[state.zone], 0) }] } } }],
  }, true);
  renderFilmEvents(); positionHandle(false);
}
function renderFilmEvents() {
  const box = $('filmEvents'); box.innerHTML = '';
  for (const e of EVENTS) {
    const pct = (e.c - T_MIN) / (T_MAX - T_MIN) * 100;
    const el = document.createElement('button');
    el.className = 'filmEvt'; el.textContent = e.label; el.style.left = pct + '%';
    el.title = '回放 ' + e.label;
    el.onclick = ev => { ev.stopPropagation(); jumpTo(e.c) };
    box.appendChild(el);
  }
  /* 预测纪元分割线（feat-020 用户裁决）：2016-01-01 起有预测层，左侧为负荷档案 */
  const ep = document.createElement('div');
  ep.className = 'filmEpoch';
  ep.style.left = clamp((PRED_EPOCH - T_MIN) / (T_MAX - T_MIN) * 100, 0.5, 99.5) + '%';
  ep.title = '预测纪元 · 2016-01 起：此前为负荷档案（无预测层），此后静态→持续学习双模型对照';
  ep.innerHTML = '<span>预测纪元 2016 ▸</span>';
  box.appendChild(ep);
}
function positionHandle(animate: boolean) {
  const h = $('filmHandle');
  const pct = (state.origin - T_MIN) / (T_MAX - T_MIN) * 100;
  h.style.transition = animate ? 'left .45s cubic-bezier(.2,.8,.2,1)' : 'none';
  h.style.left = clamp(pct, 0.4, 99.6) + '%';
}
function renderOriginDate() {
  $('originDate').textContent = fmtFull(state.origin);
  const mc = $('modeChip');
  mc.textContent = state.mode === 'live' ? '实时' : '重演 ✕'; /* ✕ 提示可点击回到实时 */
  mc.classList.toggle('replay', state.mode !== 'live');
}

/* =====================================================================
   渲染 · ⓪ 决策层（最顶层结论：建议 · 峰值 · 置信）
   ===================================================================== */
function renderDecision() {
  const z = state.zone, org = state.origin;
  $('basisPopover').style.display = 'none'; /* 重渲即关：弹层锚点随 innerHTML 更换，防止悬空/陈旧 */
  const bn = $('decisionBanner');
  if (state.mode !== 'live') {
    bn.className = 'replay';
    bn.innerHTML = `
      <div class="db-strip">
        <span class="db-tag">↺ 时光机 · 重演</span>
        <span class="db-msg">起点 <b class="win">${fmtFull(org)}</b>——${org < PRED_EPOCH
          ? '模型纪元（2016-01）前 · 无生产预测，回放实际负荷档案'
          : '此刻之后的预测，正与真实历史对质'}</span>
        <span class="sevTag" style="background:#E0F2FE;color:#0E7490">上帝视角 ${state.opts.god ? '开' : '关'}</span>
        <button type="button" class="sevTag" id="bnBackLive" style="background:var(--chipOkBg);color:var(--okInk);border:1px solid var(--chipOkBd);cursor:pointer">↩ 回到实时</button>
      </div>`;
    $('bnBackLive').onclick = () => setOrigin(NOW_DEFAULT, 'live');
    return;
  }
  const fc = forecastAt(z, org).filter(p => p.ts <= org + 24 * HOUR);
  const peak = fc.reduce((a, b) => b.p50 > a.p50 ? b : a, fc[0]);
  const peak90 = fc.reduce((a, b) => b.p90 > a.p90 ? b : a, fc[0]);
  const peakEt = fmtHM(peak.ts);
  const winFrom = fmtHM(peak.ts - 3 * HOUR);
  const arr = daily[z], d0 = locDay(org);
  const last30 = arr.filter(d => d.di < d0 && d.di >= d0 - 30);
  const m30 = last30.reduce((s, d) => s + d.peak, 0) / last30.length;
  const anom = (peak.p50 - m30) / m30 * 100;
  const recGap = (peak90.p90 - RECORD[z].v) / RECORD[z].v * 100;
  const bt = BT[z]!;
  const cov90 = bt.reduce((s, d) => s + d.cov90, 0) / bt.length;
  const sev = anom > 8 ? 'high' : anom > 3 ? 'mid' : 'low';
  const rampNeed = Math.max(...fc.slice(1).map((p, i) => Math.max(0, p.p50 - fc[i].p50)));
  const prepMW = Math.ceil((peak90.p90 - peak.p50 * 0.97) / 50) * 50;
  const calOk = Math.abs(cov90 - 90) <= 6;
  bn.className = 'sev-' + sev;
  bn.innerHTML = `
    <div class="db-strip">
      <span class="db-tag">⚡ 建议动作 · 未来 24h</span>
      <span class="db-msg">预备窗 <b class="win">${winFrom}–${peakEt}</b> 内，预备 <span class="num">${fmt(prepMW)}</span><small>MW</small> 调峰资源<span class="db-q" id="dbQMark" title="建议依据" role="button" tabindex="0">i</span></span>
      <span class="sevTag sev-${sev}-bg">${sev === 'high' ? '⚠ 高风险' : sev === 'mid' ? '⚠ 关注' : '✓ 平稳'}</span>
    </div>`;
  $('basisPopover').innerHTML = `<h3>建议依据</h3>
    <div>${WD_ZH[etP(peak.ts).wd]} ${peakEt} 日峰 P50 <b class="num">${fmt(peak.p50)}</b>（最可能）→ P90 <b class="num">${fmt(peak90.p90)}</b>（最坏情形）MW · 距纪录 ${recGap >= 0 ? '+' : ''}${recGap.toFixed(1)}%</div>
    <div>较 30 日均值 <b class="num">${anom >= 0 ? '+' : ''}${anom.toFixed(1)}%</b> · 爬坡需求 <b class="num">${fmt(rampNeed)}</b> MW/h · 区间校准 <b style="color:${calOk ? 'var(--ok)' : 'var(--warn)'}">${calOk ? '✓ 通过' : '⚠ 偏离'}</b></div>
    <div>建议容量 = P90 上界 − 97%×P50，向上取整至 50 MW；预备窗 = 峰前 3 小时</div>
    <div style="margin-top:4px"><span class="db-link" id="dbAuditLink">查看完整审计 ↗</span>　<span style="color:var(--ink3)">完整口径见主图右上 ⓘ</span></div>`;
  $('dbQMark').onclick = e => {
    e.stopPropagation();
    $('calPopover').style.display = 'none'; $('optPopover').style.display = 'none'; $('sqTip').style.display = 'none';
    $('chatLayer').classList.remove('on');
    const p = $('basisPopover');
    if (p.style.display === 'none') togglePop(p, $('dbQMark'), 'left'); else p.style.display = 'none';
  };
  $('dbAuditLink').onclick = () => {
    $('basisPopover').style.display = 'none';
    const c = $('railCred');
    c.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlight(c);
  };
}
/* =====================================================================
   渲染 · ③ 证据层（归因 / 审计）
   ===================================================================== */
/* 归因：今日 vs 昨日（全部可复算，不虚构精度） */
function renderAttrib() {
  const z = state.zone, org = state.origin, c = ZONES[z];
  const L1 = loadAt(z, org), L0 = loadAt(z, org - 24 * HOUR);
  const T1 = tempAt(org, c.tOff), T0 = tempAt(org - 24 * HOUR, c.tOff);
  const dT = T1 - T0, dL = L1 - L0;
  const tempC = dT * sensAt(z, org);
  const other = dL - tempC;
  const maxAbs = Math.max(Math.abs(tempC), Math.abs(other), 1);
  const pctOf = (v: number) => Math.abs(dL) < 1 ? '—' : Math.round(v / dL * 100) + '%';
  const bar = (v: number) => {
    const w = Math.abs(v) / maxAbs * 50;
    return v >= 0 ? `<i class="pos" style="left:50%;width:${w}%"></i>` : `<i class="neg" style="right:50%;width:${w}%"></i>`;
  };
  const sigma = CAL[z] ? CAL[z]!.reduce((s, x) => s + x.z90, 0) / CAL[z]!.length * 100 : 0;
  $('attribRows').innerHTML = `
    <div class="attTotal"><span style="font-size:11.5px;color:var(--ink2)">过去 24h 负荷变化</span>
      <span class="v num" style="color:${dL >= 0 ? 'var(--danger)' : 'var(--ok)'}">${dL >= 0 ? '+' : ''}${fmt(dL)}</span>
      <span class="hint">MW（${dT >= 0 ? '+' : ''}${dT.toFixed(1)}°C）</span></div>
    <div class="attRow"><span class="nm">温度贡献</span><span class="bar">${bar(tempC)}</span>
      <span class="vl">${tempC >= 0 ? '+' : ''}${fmt(tempC)} MW · ${pctOf(tempC)}</span></div>
    <div class="attRow"><span class="nm">日历与其他</span><span class="bar">${bar(other)}</span>
      <span class="vl">${other >= 0 ? '+' : ''}${fmt(other)} MW · ${pctOf(other)}</span></div>
    <div class="attNote">温度贡献 = Δ温度 × 当前灵敏度（<span class="num">${Math.round(sensAt(z, org))}</span> MW/°C）；余项不拆分、不虚构精度。同类日离散 ±<span class="num">${sigma.toFixed(1)}</span>%。</div>`;
  let hum: number, wind: number, prec: number;
  const wp = packAt(z, org);
  if (wp) { hum = wp.H[etP(org).h] ?? 0; wind = wp.W[etP(org).h] ?? 0; prec = wp.P[etP(org).h] ?? 0 }
  else { hum = 58 + Math.round(rnd2('h', org) * 30); wind = 6 + Math.round(rnd2('w', org) * 16); prec = rnd2('p', org) < .75 ? 0 : Math.round(rnd2('p2', org) * 40) / 10 }
  $('wxGrid').innerHTML = [
    ['气温', T1.toFixed(1) + '°C'], ['湿度', hum + '%'], ['风速', wind + 'km/h'], ['降水', prec + 'mm'],
  ].map(([l, v]) => `<div class="wx"><div class="gl">${l}</div><div class="gv">${v}</div></div>`).join('');
}
/* 可信度（全局回测 or 本段重演） */
function renderCred() {
  const z = state.zone;
  let per = BT[z]!, scope = '近 28 个起点回测';
  if (state.mode !== 'live') { per = [replayBT()]; scope = '本段重演 · 24h' }
  const n = per.length;
  const c50 = per.reduce((s, d) => s + d.cov50, 0) / n, c90 = per.reduce((s, d) => s + d.cov90, 0) / n;
  const mape = per.reduce((s, d) => s + d.mape, 0) / n;
  $('credScope').textContent = scope;
  $('cov90v').textContent = c90.toFixed(1) + '%';
  $('cov50v').textContent = c50.toFixed(1) + '%';
  setBar('cov90bar', c90, 90, 6); setBar('cov50bar', c50, 50, 8);
  function setBar(id: string, v: number, nom: number, tol: number) {
    const b = $(id); const f = b.querySelector<HTMLElement>('.fill')!;
    f.style.width = clamp(v, 0, 100) + '%';
    f.style.background = Math.abs(v - nom) <= tol ? C.ok : C.fc;
  }
  $('mapeVal').innerHTML = mape.toFixed(2) + '<small>%</small>';
  mapeC.setOption({
    grid: { left: 0, right: 0, top: 2, bottom: 0 }, animation: false,
    xAxis: { type: 'category', show: false, data: per.map((_, i) => i) },
    yAxis: { type: 'value', show: false, min: Math.min(...per.map(d => d.mape)) * .85 },
    series: [{ type: 'line', data: per.map(d => d.mape), showSymbol: false,
      lineStyle: { color: C.actual, width: 1.5 }, itemStyle: { color: C.actual },
      areaStyle: { color: 'rgba(8,145,178,.1)' } }] });
  const okC90 = Math.abs(c90 - 90) <= 6, okC50 = Math.abs(c50 - 50) <= 8;
  $('credBadge').innerHTML = `<span class="${okC90 && okC50 ? 'okBadge' : ''}" style="${okC90 && okC50 ? '' : 'color:var(--warn);font-size:10.5px;font-weight:700'}">${
    okC90 && okC50 ? '✓ 区间校准通过：实际命中率与标称一致，P90 可作调度底线'
      : '⚠ 区间' + (c90 < 84 ? '偏窄' : '偏宽') + '：已按回测自动修正张开系数'}</span>`;
  /* 基线对比：持久性（昨日同时 = 预测）vs 本模型——页面内实时复算 */
  const pers = state.mode === 'live' ? PERS[z]! : (() => {
    let se = 0, n2 = 0;
    for (const p of forecastAt(z, state.origin)) { const a = loadAt(z, p.ts), pp = loadAt(z, p.ts - 24 * HOUR); se += Math.abs(pp - a) / a; n2++ }
    return se / n2 * 100;
  })();
  const impr = Math.round((pers - mape) / pers * 100);
  /* 纪元前重演（如极涡 2014-01）：对照的是相似日基线而非生产模型——改标签讲「接入持续学习」的故事（feat-020） */
  const preEpochReplay = state.mode !== 'live' && state.origin < PRED_EPOCH;
  const mName = preEpochReplay ? '相似日基线' : '本模型';
  $('basisCmp').innerHTML = impr > 0
    ? `基线对比：持久性（昨日同时）MAPE <b class="num">${pers.toFixed(2)}%</b> → ${mName} <b class="num">${mape.toFixed(2)}%</b> <b style="color:var(--ok)">误差 ↓${impr}%</b>`
    : `基线对比：持久性（昨日同时）MAPE <b class="num">${pers.toFixed(2)}%</b> → ${mName} <b class="num">${mape.toFixed(2)}%</b> <b style="color:var(--warn)">天气突变段落后于基线</b>（${preEpochReplay ? '模型纪元前无生产模型·相似日盲区——2016 起接入持续学习模型的论据' : '相似日盲区，正是接入气象预报的论据，见口径'}）`;
  /* 生产模型行（真数据模式）：来自训练管道的独立验证 */
  const M = store.model, mz = M && M.zones && M.zones[z];
  $('modelLine').innerHTML = (M && M.modelId && mz) ? `
    <span class="hint">生产模型</span> <b class="num">${M.modelId.slice(0, 20)}</b> · ${M.trials.length} 组试验 · 本区验证 WAPE <b class="num">${mz.wape}%</b>
    <span class="hint">vs 昨日基线</span> <b class="num">${mz.lastDayWape}%</b> <b style="color:var(--ok)">↓${Math.round((1 - mz.wape / mz.lastDayWape) * 100)}%</b>` : '';
}
/* 口径（仅 ⓘ 弹层，无展开卡——彻底避免展开改变布局） */
function renderCaliber() {
  const real = SRC !== 'sim';
  const rows = [
    ['负荷', real
      ? 'PJM 负荷区小时级<b>估算平均功率</b>（MW）；小时区间内数值上 ≈ MWh。<b>2004-10 至 2018-08 真值</b>（真实历史 + 模拟未来流）。页面内嵌快照实现秒开；<b>查看任一历史段时按视窗实时查询生产库校准（SWR）</b>，断网时保持快照可用。'
      : 'PJM 负荷区小时级<b>估算平均功率</b>（MW）；小时区间内数值上 ≈ MWh。原型阶段为形态校准的仿真数据，接入 Supabase 后为真值。'],
    ['气象', real
      ? 'ERA5 再分析区域加权<b>真值</b>（气温/湿度/降水/风速），非单站实测。'
      : 'ERA5 再分析区域加权（Open-Meteo），非单站实测：气温/湿度/降水/风速。'],
    ['时间', '入库统一 UTC（interval_end，区间右端）；展示统一为美东标准时间 EST（UTC−5）。2004-10 至 2018-08' + (real ? '（DOM 区自 2005-05 起）' : '') + '。'],
    ['预测', real
      ? '<b>0–24h：生产模型</b>（梯度提升回归，Supabase model_versions 注册；pred_static/pred_dynamic 双轨注入——运营推送值优先、回测值兜底，分位带由 pred_static 残差标定）；<b>25–48h：相似日分位数基线</b>（按目标日同星期、k=10）＋残差经验分位标定。无未来信息泄露。'
      : '相似日分位数基线（按目标日同星期、就近 70 天、k=10）＋残差经验分位标定；无未来信息泄露。正式模型交付后按 p10–p90 契约替换。'],
    ['建议', '建议容量 = P90 上界 − 97%×P50（向上取整至 50 MW）：按「最坏情形超出预期的部分」预留调峰资源；预备窗 = 峰前 3 小时。P90 上界取逐时分位数的包络（跨时刻拼接，结果偏保守）；正式版按日峰值分布的分位数计算。'],
    ['气象输入', real
      ? '当前模型不直接消费气象预报，天气突变日（如 2014 极涡，见重演）误差如实放大——这正是接入气象预报的改进论据；接入后区间与精度将同步改善。'
      : '相似日基线不直接消费气象预报，天气突变日（如 2014 极涡，见重演）误差如实放大；正式模型接入气象预报后，区间与精度将同步改善。当前湿度/风速/降水为演示占位（未与季节模型耦合），接入后为 ERA5 真值。'],
    ['归因', '温度贡献 = Δ温度 × 当前温度段灵敏度（MW/°C，由区域冷/热负荷系数导出）；「日历与其他」为总变化减温度贡献的余项，不虚构精度。'],
    ['区域', 'AEP / DAYTON / DOM 为 PJM 负荷区，非单一城市或变电站。换省级电网分区即可迁移。'],
    ['回测', real
      ? '页面内滚动 28 起点 × 24h 复算（模型契约视界）；另嵌入训练管道独立回测 pred_static（579 日起点）双轨互证。25–48h 为相似日基线延伸，不入审计。'
      : '滚动 28 起点 × 24h；MAPE 与 P50/P90 覆盖率由真实（仿真）后续计算，非预设数字。'],
  ];
  $('calPopoverBody').innerHTML = rows.map(([k, v]) => `<div><b>${k}</b>：${v}</div>`).join('')
    + `<div style="margin-top:6px;color:var(--ink3)">演示模式中的每一个数字，均可由页面内数据复算。</div>`;
}

/* =====================================================================
   渲染 · 底部抽屉
   ===================================================================== */
function renderSM() {
  if (!mounted) return;
  const grid = $('smGrid');
  if (!grid.children.length) {
    for (const z of ZONE_KEYS) {
      const cell = document.createElement('div'); cell.className = 'smCell'; cell.id = 'sm_' + z;
      cell.innerHTML = `<div class="smH"><b style="color:${C.zone[z]}">${z}</b><span></span></div><div class="smChart"></div>`;
      cell.onclick = () => setZone(z);
      grid.appendChild(cell);
      smC[z] = echarts.init(cell.querySelector('.smChart') as HTMLElement); smC[z]!.group = 'sm';
    }
    echarts.connect(Object.values(smC) as echarts.ECharts[]);
  }
  const org = state.mode === 'live' ? NOW_DEFAULT : state.origin;
  for (const z of ZONE_KEYS) {
    const hist: [number, number][] = [], fc: [number, number][] = [];
    for (let h = -72; h <= 0; h++) hist.push([org + h * HOUR, loadAt(z, org + h * HOUR)]);
    const f = forecastAt(z, org); for (let h = 0; h < 24; h++) fc.push([f[h].ts, f[h].p50]);
    smC[z]!.setOption({
      animation: false,
      grid: { left: 46, right: 6, top: 6, bottom: 16 },
      tooltip: { trigger: 'axis', appendToBody: true, backgroundColor: C.tipBg, borderColor: C.tipLine, textStyle: { color: C.ink, fontSize: 11 },
        extraCssText: 'box-shadow:0 6px 20px rgba(15,23,42,.12);z-index:1000;',
        formatter: (ps: TipParam[]) => `${fmtMDH(ps[0].value[0])}<br/>${z} <b style="font-family:JetBrains Mono">${fmt(ps[0].value[1])}</b> MW` },
      xAxis: { type: 'time', axisLine: { lineStyle: { color: C.axisLine } }, axisTick: { show: false },
        axisLabel: { color: C.ink3, fontSize: 9, fontFamily: 'JetBrains Mono', formatter: (v: number) => fmtHM(v) }, splitLine: { show: false } },
      yAxis: { type: 'value', scale: true, splitLine: { show: false },
        axisLabel: { color: C.ink3, fontSize: 9, fontFamily: 'JetBrains Mono', formatter: (v: number) => (v / 1000).toFixed(1) + 'k' } },
      series: [
        { type: 'line', data: hist, showSymbol: false, lineStyle: { color: C.zone[z], width: 1.7 }, itemStyle: { color: C.zone[z] },
          areaStyle: { color: 'rgba(148,163,184,.06)' } },
        { type: 'line', data: fc, showSymbol: false, lineStyle: { color: C.zone[z], width: 1.4, type: 'dashed', opacity: .85 }, itemStyle: { color: C.zone[z] } },
      ] }, true);
    document.querySelector<HTMLElement>('#sm_' + z + ' .smH span')!.textContent = '当前 ' + fmt(hist[hist.length - 1][1]) + ' MW';
    $('sm_' + z).classList.toggle('cur', z === state.zone);
  }
}
function renderHeat() {
  if (!heatC) heatC = echarts.init($('heatChart')); // 惰性初始化：抽屉 pane 可见时才有尺寸（坑 #1）
  heatC.resize(); // 实例在抽屉隐藏时以 0×0 初始化，面板可见后必须重新量尺寸
  const arr = daily[state.zone];
  const years: Record<string, { y: number; w: number; v: number }> = {}, weeks = 53;
  let yMin = 1e9, yMax = -1e9;
  const cells: [number, number, string][] = [];
  for (const d of arr) {
    const dt = LOC(d.ts), y = dt.getUTCFullYear();
    const w = Math.floor(doyOf(d.ts) / 7);
    const k = y + '-' + w;
    if (!years[k]) years[k] = { y, w, v: 0 };
    years[k].v = Math.max(years[k].v, d.peak);
    yMin = Math.min(yMin, y); yMax = Math.max(yMax, y);
  }
  const yList: number[] = []; for (let y = yMax; y >= yMin; y--) yList.push(y);
  const yIdx: Record<number, number> = {}; yList.forEach((y, i) => yIdx[y] = i);
  const yearMax: Record<number, number> = {}; for (const k in years) { const y = years[k].y; yearMax[y] = Math.max(yearMax[y] || 0, years[k].v) }
  for (const k in years) { const o = years[k]; cells.push([o.w, yIdx[o.y], (o.v / yearMax[o.y]).toFixed(3)]) }
  heatC.setOption({
    animation: false,
    grid: { left: 34, right: 6, top: 4, bottom: 18 },
    tooltip: { appendToBody: true, backgroundColor: C.tipBg, borderColor: C.tipLine, textStyle: { color: C.ink, fontSize: 11 },
      extraCssText: 'box-shadow:0 6px 20px rgba(15,23,42,.12);z-index:1000;',
      formatter: (p: HeatTipParam) => `${Number(p.data[2]) > 0 ? `<b>${yList[p.data[1]]}</b> 年第 <b>${p.data[0] + 1}</b> 周<br/>周峰 <b style="font-family:JetBrains Mono">${fmt(years[yList[p.data[1]] + '-' + p.data[0]].v)}</b> MW` : ''}` },
    xAxis: { type: 'category', data: Array.from({ length: weeks }, (_, i) => i),
      axisLine: { show: false }, axisTick: { show: false }, splitArea: { show: false },
      axisLabel: { color: C.ink3, fontSize: 8.5, interval: 12, formatter: (v: number) => 'W' + (v + 1) } },
    yAxis: { type: 'category', data: yList.map(String), axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: C.ink3, fontSize: 9, fontFamily: 'JetBrains Mono' } },
    visualMap: { show: false, min: 0, max: 1, calculable: false, orient: 'horizontal',
      inRange: { color: C.heat } },
    series: [{ type: 'heatmap', data: cells,
      itemStyle: { borderColor: C.cellBd, borderWidth: 1, borderRadius: 1 },
      emphasis: { itemStyle: { borderColor: C.actual, borderWidth: 1 } } }], }, true);
  heatC.off('click'); heatC.on('click', (evt: { data: unknown }) => {
    const p = evt.data as [number, number, string];
    const k = yList[p[1]] + '-' + p[0];
    if (years[k] && years[k].v > 0) {
      let best: typeof arr[0] | null = null; for (const d of arr) { const dt = LOC(d.ts);
        if (dt.getUTCFullYear() === yList[p[1]] && Math.floor(doyOf(d.ts) / 7) === p[0] && (!best || d.peak > best.peak)) best = d }
      if (best) jumpTo(best.ts - best.ph * HOUR + 12 * HOUR);
    }
  });
}
function renderExtremes() {
  const arr = [...daily[state.zone]].sort((a, b) => b.peak - a.peak).slice(0, 8);
  const box = $('extList'); box.innerHTML = '';
  arr.forEach(d => {
    const d0 = locDay(d.ts);
    const last30 = daily[state.zone].filter(x => x.di < d0 && x.di >= d0 - 30);
    const m30 = last30.reduce((s, x) => s + x.peak, 0) / last30.length;
    const an = (d.peak - m30) / m30 * 100;
    const evt = EVENTS.find(e => Math.abs(d.ts - e.c) < 4 * DAY);
    const b = document.createElement('button'); b.className = 'extRow';
    b.innerHTML = `<span class="d">${fmtFull(d.ts)}</span>
      <span class="p">${fmt(d.peak)} MW</span>
      <span class="an up">+${an.toFixed(1)}%</span>
      ${evt ? `<span class="tag">${evt.label.replace(/^\S+\s/, '')}</span>` : '<span class="tag">—</span>'}
      <span class="go">点击回放 →</span>`;
    b.onclick = () => jumpTo(Math.max(d.ts - 6 * HOUR, T_MIN + 72 * HOUR));
    box.appendChild(b);
  });
}

/* =====================================================================
   汇总渲染
   ===================================================================== */
function renderAll() {
  if (!mounted) return;
  try {
    renderMain(); renderDecision(); renderStatusQuad(); renderAttrib(); renderCred();
    renderFilm(); renderOriginDate();
    renderSM();
    if (state.drawerTab === 'heat') renderHeat();
    if (state.drawerTab === 'ext') renderExtremes();
    renderExtChips();
    $('zoneCap').textContent = ZONES[state.zone].label;
  } catch (e) { console.error('[renderAll]', state.zone, state.origin, e); zlWindow().__renderLog?.push({ z: state.zone, err: '' + e }) }
}
function renderExtChips() {
  const box = $('extChips'); box.innerHTML = '';
  const mk = (label: string, fn: () => void, cur?: boolean) => {
    const b = document.createElement('button'); b.textContent = label;
    if (cur) b.className = 'cur'; b.onclick = fn; box.appendChild(b);
  };
  mk('回到当前', () => setOrigin(NOW_DEFAULT, 'live'), state.mode === 'live');
  mk('❄ 极地涡旋 2014-01', () => jumpTo(EVENTS[0].c), state.mode !== 'live' && Math.abs(state.origin - EVENTS[0].c) < 5 * DAY);
  mk('♨ 热浪 2012-07', () => jumpTo(EVENTS[1].c), state.mode !== 'live' && Math.abs(state.origin - EVENTS[1].c) < 5 * DAY);
}
function renderLegendTable() {
  $('legendTable').innerHTML = [
    ['<span class="sw"></span>', '实际负荷', '截至 NOW'],
    ['<span class="sw band"></span>', 'P10–P90 区间', '90% 可能落入'],
    ['<span class="sw dash"></span>', '持续学习 P50', '中位路径 · 学习模型'],
    ['<span class="sw thin"></span>', '静态预测', '初始模型对照；与学习线重合处=持续学习尚未覆盖该段'],
    ['<span class="sw dot"></span>', '实际 · 后续', '上帝视角'],
  ].map(([sw, nm, d]) => `<span class="lg" title="${nm} · ${d}">${sw}<span>${nm}</span></span>`).join('');
}

/* =====================================================================
   交互
   ===================================================================== */
async function setZone(z: Zone) {
  if (z === state.zone) return;
  state.zone = z;
  document.querySelectorAll('#zoneSeg button').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.zone === z));
  const tok = nextToken();
  if (SRC !== 'sim') await ensureWindow(z, state.origin); /* 快照/在线都实时校准视窗；仅仿真不查 */
  if (tok !== curToken()) return;
  renderAll(); dbgHook();
}
async function setOrigin(ts: number, mode?: 'live' | 'replay') {
  state.origin = clamp(Math.floor(ts / HOUR) * HOUR, T_MIN + 72 * HOUR, T_MAX - 48 * HOUR); /* 对齐整点：拖拽松手的小数时戳会打碎 tooltip 轴匹配（feat-022） */
  ts = state.origin;
  state.mode = mode || (state.origin === NOW_DEFAULT ? 'live' : 'replay');
  const tok = nextToken();
  if (SRC !== 'sim') await ensureWindow(state.zone, state.origin);
  if (tok !== curToken()) return;
  renderAll(); dbgHook();
}
function jumpTo(ts: number) { setOrigin(ts, 'replay'); positionHandle(true) }
/* 弹层开合（anchor='left' 时以按钮左缘对齐——供页面左侧的入口用） */
function togglePop(pop: HTMLElement, btn: HTMLElement, anchor?: string) {
  const r = btn.getBoundingClientRect();
  pop.style.display = 'block';
  pop.style.left = Math.max(8, Math.min(
    anchor === 'left' ? r.left : r.right - pop.offsetWidth - 8,
    window.innerWidth - pop.offsetWidth - 10)) + 'px';
  pop.style.top = (r.bottom + 8) + 'px';
}
/* CSV 导出 */
function exportCsv() {
  const { hist, god, fc, temps } = stageData();
  const rows: (string | number)[][] = [['time_et', 'actual_mw', 'actual_after_mw', 'temp_c', 'p10_mw', 'p25_mw', 'p50_mw', 'p75_mw', 'p90_mw']];
  const map = new Map<number, CsvCell>(); hist.forEach(p => map.set(p[0], { a: p[1] })); god.forEach(p => map.set(p[0], { g: p[1] }));
  fc.forEach(p => map.set(p.ts, { f: p })); temps.forEach(p => map.set(p[0], { t: p[1] }));
  [...map.keys()].sort((a, b) => a - b).forEach(ts => {
    const o = map.get(ts) || {};
    rows.push([fmtFull(ts), o.a ?? '', o.g ?? '', o.t != null ? o.t.toFixed(1) : '',
      o.f ? Math.round(o.f.p10) : '', o.f ? Math.round(o.f.p25) : '', o.f ? Math.round(o.f.p50) : '', o.f ? Math.round(o.f.p75) : '', o.f ? Math.round(o.f.p90) : '']);
  });
  const csv = '﻿' + rows.map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `zhulong_${state.zone}_${new Date(state.origin).toISOString().slice(0, 10)}.csv`; a.click();
}

/* =====================================================================
   演示模式（六幕）
   ===================================================================== */
const DEMO = [
  { t: '纵　深', s: '14 年 · 3 个负荷区 · 358,800 个小时——先看见负荷的呼吸', run: () => switchTab('heat') },
  { t: '节　律', s: '昼夜双峰、周末低谷、夏冬双峰——三区各有性格', run: () => { switchTab('sm'); setOrigin(NOW_DEFAULT, 'live') } },
  { t: '推　演', s: '每个数字都有参照：昨日、历史极值、概率区间', run: () => { foldDrawer(true); renderMain() } },
  { t: '验　证', s: '把时间拨回 2014 年 1 月——极地涡旋那一周，预测与真实对质', run: () => { state.opts.god = true; ($('optGod') as HTMLInputElement).checked = true; jumpTo(EVENTS[0].c) } },
  { t: '自　证', s: '每一次预测都接受覆盖率审计：P90 命中 90% 方可信', run: () => { highlight($('railCred')) } },
  { t: '落　地', s: '换上省级电网分区数据——这就是生产系统的样子。烛龙：睁眼为昼，闭眼为夜', run: () => { highlight($('decisionBanner')) } },
];
let demoOn = false, demoIdx = 0, demoTimer: ReturnType<typeof setTimeout> | null = null;
function switchTab(t: string) { (document.querySelector(`#drawerTabs button[data-t="${t}"]`) as HTMLElement).click() }
function foldDrawer(f: boolean) { $('drawer').classList.toggle('folded', f) }
function highlight(el: HTMLElement) { el.classList.remove('pulseRing'); void el.offsetWidth; el.classList.add('pulseRing') }
function demoShow(i: number) {
  demoIdx = (i + DEMO.length) % DEMO.length;
  const a = DEMO[demoIdx];
  $('demoCap').querySelector('.eyebrow')!.textContent = `第 ${['一', '二', '三', '四', '五', '六'][demoIdx]} 幕`;
  $('demoCap').querySelector('h1')!.textContent = a.t;
  $('demoCap').querySelector('p')!.textContent = a.s;
  [...$('demoDots').children].forEach((d, k) => d.classList.toggle('cur', k === demoIdx));
  a.run();
  if (demoTimer) clearTimeout(demoTimer);
  demoTimer = setTimeout(() => { if (demoOn) demoShow(demoIdx + 1) }, 9000);
  onMount(() => demoTimer && clearTimeout(demoTimer));
}
function demoToggle(on?: boolean) {
  demoOn = on ?? !demoOn;
  $('demoLayer').classList.toggle('on', demoOn);
  if (demoOn) {
    $('demoDots').innerHTML = DEMO.map(() => '<span class="dot"></span>').join('');
    demoShow(0);
  } else if (demoTimer) { clearTimeout(demoTimer) }
}

/* =====================================================================
   主题切换（CSS 令牌 + 图表调色板整体换装）
   ===================================================================== */
function setTheme(t: 'light' | 'dark') {
  C = THEMES[t];
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('zl-theme', t) } catch { /* ignore */ }
  renderAll(); // 图表颜色全部来自 C，重渲即换装
}

/* =====================================================================
   启动：三级数据源异步解析（在线 Supabase → 内嵌快照 → 仿真）
   ===================================================================== */
function startEngine(src: string) {
  buildDaily();
  for (const z of ZONE_KEYS) {
    buildCal(z);
    FC_CACHE.clear(); /* buildCal 期间缓存的是未标定结果，backtest 前必须作废 */
    BT[z] = backtest(z);
    buildPers(z);
  }
  renderLegendTable();
  renderCaliber();
  renderAll();
  $('srcText').textContent = src === 'live' ? '在线 · Supabase' : src === 'snapshot' ? '真数据 · 快照' : '演示数据 · 仿真';
  $('srcBadge').title = src === 'live' ? '秒开 + 实时校准（SWR）：内嵌快照先行渲染，近窗与日峰已实时同步，查看任一历史段时按视窗实时查询生产库（energy_hourly ∪ energy_hourly_future + pred_static ∪ pred_dynamic 运营推送）'
    : src === 'snapshot' ? 'PJM 负荷 + ERA5 天气真值快照（2004-10 → 2018-08），内嵌本页、断网可用；查看历史段时仍会实时查询生产库校准'
      : '形态校准的仿真数据';
}
async function boot() {
  const t0 = performance.now();
  zlWindow().__renderLog = [{ z: 'boot' }];
  /* 快路径：内嵌真数据快照秒开（全量 14 年，~1s）→ 后台静默同步生产库（stale-while-revalidate） */
  let fastBoot = false;
  try {
    const sub = document.querySelector('#loader .ld-sub');
    if (sub) sub.textContent = '载入内嵌真数据快照（14 年 · 3 区 · 秒开）';
    const zd = await loadSnapshot();
    storeFromSnapshot(zd); setSrc('snapshot'); fastBoot = true;
  } catch {
    /* 快照缺失 → 慢路径：在线 Layer-1（保留 4s 跳过按钮，原型行为） */
    const sub = document.querySelector('#loader .ld-sub');
    if (sub) sub.textContent = '正在实时查询生产数据库（Supabase）';
    const skipT = setTimeout(() => { const b = $('ldSkip'); if (b) b.style.visibility = 'visible' }, 4000);
    onMount(() => clearTimeout(skipT));
    const skipBtn = $('ldSkip');
    if (skipBtn) skipBtn.onclick = () => { ldAbort() };
    try { await bootLayer1(); setSrc('live') } catch (e) {
      console.warn('在线拉取未完成：', (e as Error).message);
      ldReset(); setSrc('sim');
    }
  }
  const loader = document.getElementById('loader');
  loader?.classList.add('off');
  setTimeout(() => { const l = document.getElementById('loader'); l?.remove() }, 500);
  applyAnchors();
  try { startEngine(SRC) } catch (e) { console.error('[startEngine]', e) }
  dbgHook();
  console.info(`[烛龙] 数据源=${SRC} · 启动 ${(performance.now() - t0) / 1000 | 0}s`);
  if (!fastBoot) {
    if (SRC === 'live') { ensureWindow('AEP', EVENTS[0].c); ensureWindow('AEP', EVENTS[1].c) } /* 演示事件窗预热（慢路径） */
    return;
  }
  /* 后台同步：成功 → live 模式重算指标（对齐 §5 在线基线）；失败 → 保持快照（页面已可用） */
  $('srcText').textContent = '同步生产库…';
  ldReset();
  bootLayer1(true /* preserveView：不打断用户当前浏览位置 */).then(() => {
    setSrc('live');
    try { startEngine('live') } catch (e) { console.error('[startEngine-sync]', e) }
    dbgHook();
    console.info('[烛龙] 后台同步完成 → 在线模式');
  }).catch(e => {
    console.warn('[烛龙] 后台同步失败，保持快照：', (e as Error).message);
    $('srcText').textContent = '真数据 · 快照';
  });
}

/* =====================================================================
   挂载 / 卸载（React 骨架上的命令式引擎）
   ===================================================================== */
export function mountEngine(): () => void {
  mounted = true;
  cleanups.length = 0;
  /* 主题调色板：按持久化主题选定（layout 已在首帧前设好 data-theme） */
  C = THEMES[(document.documentElement.dataset.theme as 'light' | 'dark') || 'light'] || THEMES.light;

  mainC = echarts.init($('mainChart'));
  tempC = echarts.init($('tempChart'));
  devC = echarts.init($('devChart'));
  filmC = echarts.init($('filmChart'));
  mapeC = echarts.init($('mapeSpark'));
  mainC.group = 'stage'; tempC.group = 'stage'; devC.group = 'stage';
  echarts.connect([mainC, tempC, devC]);
  zlWindow().__zlCharts = { mainC }; /* 断言钩子：npm 版 echarts 不挂 window.echarts */

  bindInteractions();
  startClock();
  /* feat-011：历史视窗实时校准——生产库数据回来后清预测缓存并重渲（数字同源通常不变） */
  setLiveMergeHook(() => {
    FC_CACHE.clear();
    if (mounted) { renderAll(); dbgHook() }
  });

  if (!bootStarted) {
    bootStarted = true;
    boot();
  } else if (store.daily.get('AEP')?.length) {
    renderAll(); dbgHook(); /* 重挂载（如 StrictMode 二次挂载）：数据已在，直接重渲 */
  }
  return dispose;
}
function dispose() {
  mounted = false;
  setLiveMergeHook(null);
  cleanups.forEach(fn => { try { fn() } catch { /* ignore */ } });
  cleanups.length = 0;
  dragging = false;
  if (dragRaf) cancelAnimationFrame(dragRaf);
  [mainC, tempC, devC, filmC, mapeC, heatC, ...Object.values(smC)].forEach(c => { try { c?.dispose() } catch { /* ignore */ } });
  heatC = null;
  for (const k of Object.keys(smC)) delete smC[k as Zone];
}

function startClock() {
  const upd = () => { const c = $('clock'); if (c) c.textContent = '美东 ' + fmtNow(Date.now()) + ' EST' };
  upd();
  const t = setInterval(upd, 1000);
  onMount(() => clearInterval(t));
}

function bindInteractions() {
  /* 四格 ⓘ 解释（共用 sqTip 弹层） */
  const sqClick = (e: Event) => {
    const ic = (e.target as HTMLElement).closest('.sq-i') as HTMLElement | null; if (!ic) return;
    e.stopPropagation();
    (['calPopover', 'optPopover', 'basisPopover'] as const).forEach(id => $(id).style.display = 'none');
    $('chatLayer').classList.remove('on');
    const tip = $('sqTip');
    if (tip.style.display === 'block' && tip.dataset.sq === ic.dataset.sq) { tip.style.display = 'none'; return }
    tip.innerHTML = SQ_TIPS[+ic.dataset.sq!]; tip.dataset.sq = ic.dataset.sq!;
    togglePop(tip, ic, 'left');
  };
  $('statusQuad').addEventListener('click', sqClick);
  onMount(() => $('statusQuad')?.removeEventListener('click', sqClick));

  const zoneClick = (e: Event) => { const b = (e.target as HTMLElement).closest('button'); if (b) setZone((b as HTMLElement).dataset.zone as Zone) };
  $('zoneSeg').addEventListener('click', zoneClick);
  onMount(() => $('zoneSeg')?.removeEventListener('click', zoneClick));

  document.querySelectorAll<HTMLButtonElement>('#rangeSeg button').forEach(b => {
    const fn = () => {
      state.range = b.dataset.r as typeof state.range;
      document.querySelectorAll('#rangeSeg button').forEach(x => x.classList.toggle('on', x === b));
      renderMain();
    };
    b.addEventListener('click', fn);
    onMount(() => b.removeEventListener('click', fn));
  });

  (['optTemp', 'optYday', 'optGod', 'optPeak'] as const).forEach(id => {
    const el = $(id) as HTMLInputElement;
    const fn = () => {
      state.opts[id.slice(3).toLowerCase() as keyof typeof state.opts] = el.checked;
      renderAll(); /* 坑 11：状态切换一律走 renderAll 标准路径，手工罗列渲染函数必漏 */
    };
    el.addEventListener('change', fn);
    onMount(() => el.removeEventListener('change', fn));
  });

  const calBtnFn = (e: Event) => {
    e.stopPropagation();
    $('optPopover').style.display = 'none'; $('basisPopover').style.display = 'none'; $('sqTip').style.display = 'none';
    $('chatLayer').classList.remove('on');
    const p = $('calPopover');
    if (p.style.display === 'none') togglePop(p, $('calBtn')); else p.style.display = 'none';
  };
  $('calBtn').addEventListener('click', calBtnFn);
  onMount(() => $('calBtn')?.removeEventListener('click', calBtnFn));

  const optBtnFn = (e: Event) => {
    e.stopPropagation();
    $('calPopover').style.display = 'none'; $('basisPopover').style.display = 'none'; $('sqTip').style.display = 'none';
    $('chatLayer').classList.remove('on');
    const p = $('optPopover');
    if (p.style.display === 'none') togglePop(p, $('optBtn')); else p.style.display = 'none';
  };
  $('optBtn').addEventListener('click', optBtnFn);
  onMount(() => $('optBtn')?.removeEventListener('click', optBtnFn));

  const docClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (!t.closest('#calPopover') && !t.closest('#calBtn')) $('calPopover').style.display = 'none';
    if (!t.closest('#optPopover') && !t.closest('#optBtn')) $('optPopover').style.display = 'none';
    if (!t.closest('#basisPopover') && !t.closest('#dbQMark')) $('basisPopover').style.display = 'none';
    if (!t.closest('#sqTip') && !t.closest('.sq-i')) $('sqTip').style.display = 'none';
  };
  document.addEventListener('click', docClick);
  onMount(() => document.removeEventListener('click', docClick));

  const csvFn = () => exportCsv();
  $('csvBtn').addEventListener('click', csvFn);
  onMount(() => $('csvBtn')?.removeEventListener('click', csvFn));

  const stepPrevFn = () => setOrigin(state.origin - DAY);
  $('stepPrev').addEventListener('click', stepPrevFn);
  onMount(() => $('stepPrev')?.removeEventListener('click', stepPrevFn));
  const stepNextFn = () => setOrigin(state.origin + DAY);
  $('stepNext').addEventListener('click', stepNextFn);
  onMount(() => $('stepNext')?.removeEventListener('click', stepNextFn));

  /* 重演 chip 可点击回到实时（关闭上帝视角的显式入口之一） */
  const modeChipFn = () => { if (state.mode !== 'live') setOrigin(NOW_DEFAULT, 'live') };
  $('modeChip').addEventListener('click', modeChipFn);
  onMount(() => $('modeChip')?.removeEventListener('click', modeChipFn));

  /* 胶片拖拽：rAF 轻量刷新——已加载区实时预览；未加载区冻结主图（补钉：防空洞），松手统一 setOrigin */
  const filmWrap = $('filmWrap');
  const pd = (e: PointerEvent) => {
    dragging = true; filmWrap.setPointerCapture(e.pointerId);
    state.origin = clamp(filmXToTs(e.clientX), T_MIN + 72 * HOUR, T_MAX - 48 * HOUR);
    state.mode = 'replay'; positionHandle(false);
  };
  const pm = (e: PointerEvent) => {
    if (!dragging) return;
    const ts = clamp(filmXToTs(e.clientX), T_MIN + 72 * HOUR, T_MAX - 48 * HOUR);
    if (dragRaf) return;
    dragRaf = requestAnimationFrame(() => {
      dragRaf = 0; state.origin = ts;
      positionHandle(false); renderOriginDate();
      if (SRC !== 'live' || windowReady(state.zone, state.origin, RANGES[state.range].back)) {
        sbToast(false);
        renderMain();
      } else {
        sbToast(true, '松手加载这段历史 · ' + fmtMD(state.origin));
      }
    });
  };
  const pu = () => {
    if (!dragging) return; dragging = false;
    /* 磁吸：拖到时间轴最右段（NOW 前 5 天内；轴右端=T_MAX≈NOW+4.2 天）松手 → 回到实时。
       拖到「最右边」的自然语义就是「回到现在」，免像素级对位 */
    if (state.origin >= NOW_DEFAULT - 5 * DAY) setOrigin(NOW_DEFAULT, 'live');
    else setOrigin(state.origin);
  };
  filmWrap.addEventListener('pointerdown', pd);
  filmWrap.addEventListener('pointermove', pm);
  filmWrap.addEventListener('pointerup', pu);
  onMount(() => {
    filmWrap.removeEventListener('pointerdown', pd);
    filmWrap.removeEventListener('pointermove', pm);
    filmWrap.removeEventListener('pointerup', pu);
  });

  /* 抽屉 */
  document.querySelectorAll<HTMLButtonElement>('#drawerTabs button[data-t]').forEach(b => {
    const fn = () => {
      state.drawerTab = b.dataset.t!;
      document.querySelectorAll('#drawerTabs button').forEach(x => x.classList.toggle('on', x === b));
      document.querySelectorAll('.drawerPane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + state.drawerTab));
      if (b.dataset.t === 'sm' && SRC === 'live') { /* 区域对比：确保三区在当前起点都有数据 */
        for (const z of ZONE_KEYS) if (z !== state.zone)
          ensureWindow(z, state.mode === 'live' ? NOW_DEFAULT : state.origin).then(() => renderSM());
      }
      $('drawer').classList.remove('folded');
      if (state.drawerTab === 'heat') renderHeat();
      if (state.drawerTab === 'ext') renderExtremes();
      if (state.drawerTab === 'sm') renderSM();
    };
    b.addEventListener('click', fn);
    onMount(() => b.removeEventListener('click', fn));
  });
  const foldFn = () => {
    $('drawer').classList.toggle('folded');
    setTimeout(() => heatC?.resize(), 320); // 等高度过渡结束后重新量尺寸
  };
  $('drawerFold').addEventListener('click', foldFn);
  onMount(() => $('drawerFold')?.removeEventListener('click', foldFn));

  /* 演示模式 */
  const demoBtnFn = () => demoToggle();
  $('demoBtn').addEventListener('click', demoBtnFn);
  onMount(() => $('demoBtn')?.removeEventListener('click', demoBtnFn));
  const demoExitFn = () => demoToggle(false);
  $('demoExit').addEventListener('click', demoExitFn);
  onMount(() => $('demoExit')?.removeEventListener('click', demoExitFn));
  const keyFn = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && demoOn) return demoToggle(false);
    if (e.key.toLowerCase() === 'd' && !e.metaKey && !e.ctrlKey && (e.target as HTMLElement)?.tagName !== 'INPUT') demoToggle();
    if (!demoOn) return;
    if (e.key === 'ArrowRight') demoShow(demoIdx + 1);
    if (e.key === 'ArrowLeft') demoShow(demoIdx - 1);
  };
  document.addEventListener('keydown', keyFn);
  onMount(() => document.removeEventListener('keydown', keyFn));

  const themeBtnFn = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  $('themeBtn').addEventListener('click', themeBtnFn);
  onMount(() => $('themeBtn')?.removeEventListener('click', themeBtnFn));

  /* ===== feat-023 ChatBI 数据问答（互斥家族第五件） ===== */
  let chatSessionId = '';
  const closeChatLayer = () => $('chatLayer').classList.remove('on');
  const openChat = () => {
    (['calPopover', 'optPopover', 'basisPopover', 'sqTip'] as const).forEach(id => $(id).style.display = 'none');
    if (!chatSessionId) chatSessionId = crypto.randomUUID(); /* 面板生命周期一个会话，上下文 QwenPaw 按 session 自管 */
    $('chatLayer').classList.add('on');
    $('chatInput').focus();
  };
  const chatBtnFn = () => ($('chatLayer').classList.contains('on') ? closeChatLayer() : openChat());
  $('chatBtn').addEventListener('click', chatBtnFn);
  onMount(() => $('chatBtn')?.removeEventListener('click', chatBtnFn));
  $('chatClose').addEventListener('click', closeChatLayer);
  onMount(() => $('chatClose')?.removeEventListener('click', closeChatLayer));
  const chatVeil = $('chatLayer').querySelector('.veil') as HTMLElement;
  chatVeil.addEventListener('click', closeChatLayer);
  onMount(() => chatVeil.removeEventListener('click', closeChatLayer));

  const chatSend = async (raw: string) => {
    const text = raw.trim(); if (!text) return;
    const log = $('chatLog');
    /* 上下文注入：Agent 回答对齐当前区域/视图（只读 state） */
    const ctx = `[页面上下文] 区域=${state.zone}; 视图=${state.mode === 'live' ? '实时' : '重演@' + new Date(state.origin).toISOString().slice(0, 10)}\n`;
    const u = document.createElement('div');
    u.className = 'chat-msg user'; u.textContent = text; log.appendChild(u);
    const typing = document.createElement('div');
    typing.className = 'chat-typing'; typing.innerHTML = '<span class="spin"></span>正在查询数据、执行分析…';
    log.appendChild(typing);
    const bubble = document.createElement('div');
    bubble.className = 'chat-msg bot'; bubble.style.display = 'none';
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
    ($('chatSend') as HTMLButtonElement).disabled = true;
    ($('chatInput') as HTMLInputElement).value = '';
    const r = await streamChat(ctx + text, chatSessionId, {
      onText: full => {
        typing.remove(); bubble.style.display = ''; bubble.textContent = full;
        log.scrollTop = log.scrollHeight;
      },
      onStatus: s => {
        if (s === 'error' && !bubble.textContent) {
          typing.remove(); bubble.style.display = ''; bubble.classList.add('err');
          bubble.textContent = 'Agent 服务未连接（QWENPAW_URL 未配置或不可达）。本地演示请先启动 QwenPaw；线上部署后自动可用。';
        }
      },
    });
    if (!r.ok && bubble.textContent && !bubble.classList.contains('err')) {
      bubble.classList.add('err'); bubble.textContent += '\n[中断：' + (r.error ?? '未知') + ']';
    }
    typing.remove();
    ($('chatSend') as HTMLButtonElement).disabled = false;
    $('chatInput').focus();
  };
  const chipsFn = (e: Event) => { const q = (e.target as HTMLElement).closest('button')?.dataset.q; if (q) chatSend(q); };
  $('chatChips').addEventListener('click', chipsFn);
  onMount(() => $('chatChips')?.removeEventListener('click', chipsFn));
  const chatSendFn = () => chatSend(($('chatInput') as HTMLInputElement).value);
  $('chatSend').addEventListener('click', chatSendFn);
  onMount(() => $('chatSend')?.removeEventListener('click', chatSendFn));
  const chatKeyFn = (e: KeyboardEvent) => {
    if (!$('chatLayer').classList.contains('on')) return;
    if (e.key === 'Escape') closeChatLayer();
    if (e.key === 'Enter' && document.activeElement === $('chatInput')) chatSendFn();
  };
  document.addEventListener('keydown', chatKeyFn);
  onMount(() => document.removeEventListener('keydown', chatKeyFn));

  const resizeFn = () => {
    [mainC, tempC, devC, filmC, mapeC, heatC, ...Object.values(smC)].forEach(c => c?.resize());
  };

  window.addEventListener('resize', resizeFn);
  onMount(() => window.removeEventListener('resize', resizeFn));
}

/* 胶片拖拽：clientX → 时间戳 */
let dragging = false, dragRaf = 0;
function filmXToTs(clientX: number) {
  const r = $('filmWrap').getBoundingClientRect();
  const pct = clamp((clientX - r.left) / r.width, 0, 1);
  return T_MIN + pct * (T_MAX - T_MIN);
}
