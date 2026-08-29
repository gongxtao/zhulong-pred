/* =====================================================================
   在线拉取器（与 scripts/build-snapshot.mjs 同算法；照抄原型，TS 化）
   boot 近窗（bootLayer1，~40 请求 ≈12s）→ 失败回退内嵌快照 → 再失败仿真。
   按需：ensureWindow（per-zone 串行队列 + toast）；sbFetch 3 次重试；sbPage 分页。
   ===================================================================== */
import { ZONES, ZONE_KEYS, type Zone } from './const';
import {
  applyAnchors, D1, hasLivePredIn, isLiveDay, markLiveDays, markLivePred, sbToast, store,
  type DailyRow, type DayPack,
} from './store';
import { dayTs, etP, fmtMD, HOUR, locDay, quantile } from './util';

/* 所有配置走环境变量（用户裁决 8/29）：URL/KEY 一律 NEXT_PUBLIC_*，代码不落任何真实值；
   未配置时在线查询不可用 → 三级兜底自动降级为快照/仿真，页面仍可用 */
export const SB = {
  URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
};
export const SB_CONFIGURED = !!(SB.URL && SB.KEY);
export let LD_ABORT = false;
export function ldAbort() { LD_ABORT = true; }
export function ldReset() { LD_ABORT = false; }

export function ldSet(pct: number, detail?: string) {
  const f = document.getElementById('ldFill'), d = document.getElementById('ldDetail');
  if (f) (f as HTMLElement).style.width = (pct * 100).toFixed(1) + '%';
  if (d && detail) d.textContent = detail;
}
export async function sbFetch<T>(table: string, q: string): Promise<T[]> { /* 带重试的单页请求（网关瞬时 5xx/断连重试 3 次） */
  if (!SB_CONFIGURED) throw new Error('Supabase env 未配置（NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY）');
  let lastErr: unknown;
  for (let i = 0; i < 3; i++) {
    if (LD_ABORT) throw new Error('用户跳过在线拉取');
    try {
      const r = await fetch(`${SB.URL}/rest/v1/${table}?${q}`, { headers: { apikey: SB.KEY } });
      if (r.ok) return r.json() as Promise<T[]>;
      lastErr = new Error(`${table} HTTP ${r.status}`);
    } catch (e) { lastErr = e }
    await new Promise(rs => setTimeout(rs, 600 * (i + 1)));
  }
  throw lastErr;
}
export async function sbPage<T>(table: string, params: Record<string, string>, onRows?: (n: number) => void): Promise<T[]> {
  const rows: T[] = []; let off = 0;
  for (;;) {
    const page = await sbFetch<T>(table, new URLSearchParams({ limit: '1000', offset: String(off), ...params }).toString());
    rows.push(...page); if (onRows) onRows(rows.length);
    if (page.length < 1000) break;
    off += 1000;
  }
  return rows;
}
const r1 = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

const COLS = 'zone,interval_end_utc,load_mw,temperature_2m_c,relative_humidity_2m_pct,wind_speed_10m_kmh,precipitation_mm';
const PRED_COLS = 'zone,forecast_origin_utc,forecast_horizon_hour,actual_load_mw,predicted_load_mw';

interface HRow {
  zone: Zone; interval_end_utc: string; load_mw: number | null;
  temperature_2m_c: number | null; relative_humidity_2m_pct: number | null;
  wind_speed_10m_kmh: number | null; precipitation_mm: number | null;
}
interface PredRow {
  zone: Zone; forecast_origin_utc: string; forecast_horizon_hour: number;
  actual_load_mw: number; predicted_load_mw: number;
}
interface DailyViewRow { zone: Zone; est_day: string; peak_mw: number; peak_ts_utc: string }
interface ModelVersionRow { model_id: string; status: string; created_at: string }
interface TrialValMetrics { overall: { wape: number }; last_day_same_hour_baseline: { wape: number }; last_week_same_hour_baseline: { wape: number } }
interface TrialRow { trial_number: number; mean_zone_wape: number; mean_zone_mae_mw: number; validation_metrics?: { zones?: Record<string, TrialValMetrics> } }
/* 内嵌快照（build-snapshot.mjs 产物 window.ZL_DATA 的结构） */
interface SnapZone { n: number; t0: number; loads: ArrayLike<number>; temps: ArrayLike<number>; hum: ArrayLike<number>; wind: ArrayLike<number>; prec: ArrayLike<number> }
export interface Snapshot {
  zones: Record<string, SnapZone>;
  pred?: Record<string, { origins: number[]; preds: (number | null)[][]; cal: { z50: number; z90: number }[] }>;
  model: import('./store').ModelMeta | null;
}
export function putHours(rows: HRow[]) {
  for (const r of rows) {
    if (!store.hours.has(r.zone)) store.hours.set(r.zone, new Map());
    const m = store.hours.get(r.zone)!;
    const ts = Date.parse(r.interval_end_utc), di = locDay(ts), h = etP(ts).h;
    let p = m.get(di);
    if (!p) {
      p = { L: new Float64Array(24).fill(NaN), T: new Float64Array(24).fill(NaN), H: new Float64Array(24).fill(NaN), W: new Float64Array(24).fill(NaN), P: new Float64Array(24).fill(NaN) };
      m.set(di, p);
    }
    if (r.load_mw != null) p.L[h] = r.load_mw;
    if (r.temperature_2m_c != null) p.T[h] = r.temperature_2m_c;
    if (r.relative_humidity_2m_pct != null) p.H[h] = r.relative_humidity_2m_pct;
    if (r.wind_speed_10m_kmh != null) p.W[h] = r.wind_speed_10m_kmh;
    if (r.precipitation_mm != null) p.P[h] = r.precipitation_mm;
  }
}
export async function fetchHoursRange(zone: Zone, diLo: number, diHi: number, onRows?: (n: number) => void) {
  const and = `(interval_end_utc.gte.${new Date(dayTs(diLo)).toISOString()},interval_end_utc.lt.${new Date(dayTs(diHi + 1)).toISOString()})`;
  const params = { zone: `eq.${zone}`, and, order: 'interval_end_utc.asc', select: COLS };
  const [a, b] = await Promise.all([sbPage<HRow>('energy_hourly', params, onRows), sbPage<HRow>('energy_hourly_future', params, onRows)]);
  putHours(a); putHours(b);
  markLiveDays(zone, diLo, diHi); /* 该窗小时已实时查询校准（含空窗=核实为空） */
}
export function ingestPred(rows: PredRow[], track: 'static' | 'dyn') { /* feat-016 双轨：原始值入各自轨；展示轨 pred 同起点重算（dyn 优先、static 填充） */
  const byZO: Record<string, Record<string, PredRow[]>> = {};
  for (const r of rows) { (byZO[r.zone] ??= {})[r.forecast_origin_utc] ??= []; byZO[r.zone][r.forecast_origin_utc].push(r) }
  for (const z in byZO) {
    const Z = z as Zone;
    if (!store.predStatic.has(Z)) store.predStatic.set(Z, new Map());
    if (!store.predDyn.has(Z)) store.predDyn.set(Z, new Map());
    if (!store.pred.has(Z)) store.pred.set(Z, new Map());
    const st = store.predStatic.get(Z)!, dy = store.predDyn.get(Z)!, pm = store.pred.get(Z)!;
    const liveOrigins: number[] = [];
    for (const o in byZO[z]) {
      const ts = Date.parse(o);
      liveOrigins.push(ts);
      const row: (number | null)[] = new Array(24).fill(null);
      for (const rr of byZO[z][o]) row[rr.forecast_horizon_hour - 1] = r1(rr.predicted_load_mw, 1);
      (track === 'static' ? st : dy).set(ts, row); /* 同轨重写 = 幂等（重放/重查安全） */
      pm.set(ts, (dy.get(ts) ?? st.get(ts))!); /* 展示轨：该起点取 dyn，缺则 static 填充 */
    }
    markLivePred(Z, liveOrigins); /* 实时查询到的 pred 起点已校准 */
    store.predOrigins.set(Z, [...pm.keys()].sort((x, y) => x - y));
  }
}
export function calFrom(rows: PredRow[]) { /* 近期残差分位（boot 尾窗计算；全局共用） */
  const byZH: Record<string, Record<number, number[]>> = {};
  for (const r of rows) {
    const h = r.forecast_horizon_hour; if (h > 24) continue;
    const rel = (r.predicted_load_mw - r.actual_load_mw) / r.actual_load_mw;
    ((byZH[r.zone] ??= {})[h] ??= []).push(rel);
  }
  for (const z in byZH) {
    store.cal[z as Zone] = [];
    for (let h = 1; h <= 24; h++) {
      const arr = (byZH[z][h] || []).slice().sort((a, b) => a - b);
      const mean = arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
      const abs = arr.map(v => Math.abs(v - mean)).sort((a, b) => a - b);
      store.cal[z as Zone]!.push({
        z50: abs.length ? r1(quantile(abs, .50), 4) : .08,
        z90: abs.length ? r1(quantile(abs, .90), 4) : .16,
      });
    }
  }
}
export async function bootLayer1(preserveView = false) {
  const counts: Record<string, number> = {}; const EXPECT = 28100;
  const prog = (k: string) => (n: number) => {
    counts[k] = n; const t = Object.values(counts).reduce((s, v) => s + v, 0);
    ldSet(Math.min(t / EXPECT, .98), `已查询 ${t.toLocaleString('en-US')} 行 · 近窗 + 14 年日峰 + 模型回测`);
  };
  /* 1) 日峰视图（三区全量，胶片/热力图/极值/纪录；排序含 zone 保证分页稳定） */
  const dv = await sbPage<DailyViewRow>('energy_daily', { order: 'zone.asc,est_day.asc', select: 'zone,est_day,peak_mw,peak_ts_utc' }, prog('dv'));
  const fresh: Partial<Record<Zone, DailyRow[]>> = {};
  for (const r of dv) {
    const ts = Date.parse(r.peak_ts_utc) - HOUR; /* 视图为区间右端 → 现有口径 = 小时起点 */
    (fresh[r.zone] ??= []).push({ ts, peak: r.peak_mw, ph: etP(ts).h, di: locDay(ts) });
  }
  for (const z of ZONE_KEYS) if (fresh[z]) store.daily.set(z, fresh[z]!); /* 替换而非追加：同步路径防重复行 */
  applyAnchors(preserveView); /* 视图就位即可定 D1，供近窗边界 */
  /* 2) 近 120 天小时 ×3 区（并发；决策/四格/回测/相似日候选全覆盖） */
  const lo = D1 - 119;
  await Promise.all(ZONE_KEYS.map(z => fetchHoursRange(z, lo, D1 + 1, prog('h' + z))));
  ldSet(.99, '模型回测与元数据…');
  /* 3) 近 70 天 pred_static（模型注入 + 近期残差分位）＋ 同窗 pred_dynamic（运营推送值，失败/空静默回退 static） */
  const predWin = { order: 'zone.asc,forecast_origin_utc.asc', select: PRED_COLS, forecast_origin_utc: `gte.${new Date(dayTs(D1 - 70)).toISOString()}` };
  const [psRows, pdRows] = await Promise.all([
    sbPage<PredRow>('pred_static', predWin, prog('ps')),
    sbPage<PredRow>('pred_dynamic', predWin).catch(() => [] as PredRow[]),
  ]);
  ingestPred(psRows, 'static'); calFrom(psRows); /* 分位标定保持 static-only（dynamic 真值滞后且混模型污染残差带） */
  ingestPred(pdRows, 'dyn'); /* 展示轨 dyn 优先、static 填充（持续学习模型） */
  /* 4) 模型元数据 */
  const H = { apikey: SB.KEY };
  const [mv, tt] = await Promise.all([
    fetch(`${SB.URL}/rest/v1/model_versions?select=model_id,status,created_at&status=eq.active`, { headers: H }).then(r => r.ok ? r.json() as Promise<ModelVersionRow[]> : []),
    fetch(`${SB.URL}/rest/v1/training_trials?select=trial_number,mean_zone_wape,mean_zone_mae_mw,validation_metrics`, { headers: H }).then(r => r.ok ? r.json() as Promise<TrialRow[]> : []),
  ]);
  const winner = tt[0], vm = (winner && winner.validation_metrics && winner.validation_metrics.zones) || {};
  store.model = {
    modelId: (mv[0] && mv[0].model_id) || null, status: (mv[0] && mv[0].status) || null, createdAt: (mv[0] && mv[0].created_at) || null,
    trials: tt.map(t => ({ n: t.trial_number, wape: r1(t.mean_zone_wape * 100, 2), mae: Math.round(t.mean_zone_mae_mw) })),
    zones: Object.fromEntries(Object.entries(vm).map(([z, v]) => [z, {
      wape: r1(v.overall.wape * 100, 2),
      lastDayWape: r1(v.last_day_same_hour_baseline.wape * 100, 2),
      lastWeekWape: r1(v.last_week_same_hour_baseline.wape * 100, 2),
    }])),
  };
}
/* 实时合并钩子：数据从生产库回来后由 engine 清 FC_CACHE 并重渲（feat-011 SWR per view） */
let onLiveMerge: (() => void) | null = null;
export function setLiveMergeHook(fn: (() => void) | null) { onLiveMerge = fn; }
function notifyLiveMerge() { try { onLiveMerge?.() } catch { /* ignore */ } }

/* 按需拉取：ensureWindow（per-zone 串行队列 + toast），跳转/切区/松手统一走这里。
   feat-011 语义升级：不只「缺数据才查」——视窗内存在「未实时校准」的日（来自快照）也发起真实查询，
   页面先用快照即时渲染，查询回来后合并重渲（数字同源通常不变，网络面板可见真实请求）。 */
const zoneQueue: Partial<Record<Zone, Promise<void>>> = {};
export function ensureWindow(zone: Zone, originTs: number): Promise<void> {
  const task = async () => {
    const m = store.hours.get(zone) || new Map();
    const d0 = locDay(originTs), lo = d0 - 80, hi = d0 + 2;
    let missing = 0, stale = 0;
    for (let di = lo; di <= hi; di++) {
      if (!m.has(di)) missing++;
      else if (!isLiveDay(zone, di)) stale++;
    }
    if (missing || stale) {
      sbToast(true, `查询生产库 · ${ZONES[zone].label.split(' ·')[0]} ${fmtMD(dayTs(d0))} 前后 ${missing || stale} 天小时值`);
      await fetchHoursRange(zone, lo, hi);
      sbToast(false);
      notifyLiveMerge();
    }
    if (originTs >= Date.UTC(2016, 11, 1)) { /* 模型纪元：该起点（含偏差带用的昨日起点）附近 pred 需实时校准 */
      const og = store.predOrigins.get(zone) || [];
      const has = og.some(o => o > originTs - 48 * HOUR && o <= originTs);
      const hasLive = hasLivePredIn(zone, originTs - 48 * HOUR, originTs);
      if (!has || !hasLive) {
        const and = `(forecast_origin_utc.gte.${new Date(originTs - 48 * HOUR).toISOString()},forecast_origin_utc.lte.${new Date(originTs).toISOString()})`;
        sbToast(true, `查询生产库 · 模型在 ${fmtMD(originTs)} 起点的日前预测`);
        const params = { zone: `eq.${zone}`, and, order: 'forecast_origin_utc.asc', select: PRED_COLS };
        const [sta, dyn] = await Promise.all([
          sbPage<PredRow>('pred_static', params),
          sbPage<PredRow>('pred_dynamic', params).catch(() => [] as PredRow[]), /* 运营表失败/空不阻塞校准 */
        ]);
        ingestPred(sta, 'static'); ingestPred(dyn, 'dyn'); /* 双轨各自保留；展示轨 dyn 优先 */
        sbToast(false);
        notifyLiveMerge();
      }
    }
  };
  zoneQueue[zone] = (zoneQueue[zone] || Promise.resolve()).then(task, task).catch(e => {
    console.warn('[ensureWindow]', zone, e); sbToast(false);
  });
  return zoneQueue[zone]!;
}
export function windowReady(zone: Zone, originTs: number, backHours: number): boolean { /* 拖拽冻结判定：视窗+候选日是否齐 */
  const m = store.hours.get(zone); if (!m) return false;
  const d0 = locDay(originTs), lo = d0 - Math.ceil(backHours / 24) - 1, hi = d0 + 2;
  for (let di = lo; di <= hi; di++) if (!m.has(di)) return false;
  return true;
}
export function storeFromSnapshot(zd: Snapshot) { /* 快照兜底：一次性灌入 store（同构数据） */
  for (const z in zd.zones) {
    const zz = zd.zones[z], m = new Map<number, DayPack>();
    for (let i = 0; i < zz.n; i++) {
      const ts = zz.t0 + i * HOUR, di = locDay(ts), h = etP(ts).h;
      let p = m.get(di);
      if (!p) {
        p = { L: new Float64Array(24).fill(NaN), T: new Float64Array(24).fill(NaN), H: new Float64Array(24).fill(NaN), W: new Float64Array(24).fill(NaN), P: new Float64Array(24).fill(NaN) };
        m.set(di, p);
      }
      p.L[h] = zz.loads[i]; p.T[h] = zz.temps[i]; p.H[h] = zz.hum[i]; p.W[h] = zz.wind[i]; p.P[h] = zz.prec[i];
    }
    store.hours.set(z as Zone, m);
  }
  for (const z of ZONE_KEYS) { /* daily 从小时派生（全量在内存） */
    const m = store.hours.get(z)!, arr: DailyRow[] = [];
    let pk = -1, ph = 0, day = -1;
    const push = () => { if (day >= 0 && pk > 0) arr.push({ ts: dayTs(day) + ph * HOUR, peak: pk, ph, di: day }) };
    for (const di of [...m.keys()].sort((a, b) => a - b)) {
      if (di !== day) { push(); day = di; pk = -1; ph = 0 }
      const p = m.get(di)!;
      for (let h = 0; h < 24; h++) { const v = p.L[h]; if (v > pk) { pk = v; ph = h } }
    }
    push();
    store.daily.set(z, arr);
  }
  const predZones = zd.pred || {};
  for (const z in predZones) {
    const P = predZones[z], pm = new Map<number, (number | null)[]>();
    P.origins.forEach((o: number, i: number) => pm.set(o, P.preds[i]));
    store.predStatic.set(z as Zone, pm); /* 快照只嵌静态轨（2017-01 起）；dyn 轨由在线查询补 */
    store.pred.set(z as Zone, new Map(pm)); /* 展示轨独立副本：起点级 dyn 优先覆盖（不共享对象防串轨） */
    store.predOrigins.set(z as Zone, P.origins.slice());
    store.cal[z as Zone] = P.cal;
  }
  store.model = zd.model || null;
}
export function loadSnapshot(): Promise<Snapshot> {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = '/data/zhulong-data.js';
    s.onload = () => {
      const w = window as unknown as { __snap?: Snapshot | null; ZL_DATA: Snapshot | null };
      w.__snap = w.ZL_DATA; w.ZL_DATA = null; /* 占用让位给 dbgHook */
      if (w.__snap) res(w.__snap); else rej(new Error('快照为空'));
    };
    s.onerror = () => rej(new Error('快照缺失'));
    document.head.appendChild(s);
  });
}
