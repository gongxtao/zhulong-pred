/* =====================================================================
   store · 唯一数据后端（懒加载架构 v3；照抄原型，TS 化）
   hours Map<zone,Map<di,{L,T,H,W,P:F64(24)}>> · daily Map<zone,{ts,peak,ph,di}[]>
   · pred Map<zone,Map<originTs,(number|null)[24]>> + predOrigins · cal · model
   ===================================================================== */
import { RANGES, ZONES, ZONE_KEYS, type Zone } from './const';
import { simLoadAt, simTempAt } from './sim';
import { dayTs, etP, HOUR, locDay, LOC } from './util';

export type Src = 'live' | 'snapshot' | 'sim';
export let SRC: Src = 'sim'; /* 'live' | 'snapshot' | 'sim' */
export function setSrc(s: Src) { SRC = s; }

export interface DayPack { L: Float64Array; T: Float64Array; H: Float64Array; W: Float64Array; P: Float64Array }
export interface DailyRow { ts: number; peak: number; ph: number; di: number }
export interface CalPt { z50: number; z90: number }
export interface ModelZone { wape: number; lastDayWape: number; lastWeekWape: number }
export interface ModelMeta {
  modelId: string | null;
  status: string | null;
  createdAt: string | null;
  trials: { n: number; wape: number; mae: number }[];
  zones: Partial<Record<Zone, ModelZone>>;
}

export const store = {
  hours: new Map<Zone, Map<number, DayPack>>(),
  daily: new Map<Zone, DailyRow[]>(),
  pred: new Map<Zone, Map<number, (number | null)[]>>(),
  predOrigins: new Map<Zone, number[]>(),
  cal: {} as Partial<Record<Zone, CalPt[]>>,
  model: null as ModelMeta | null,
};

export let T_MIN = Date.UTC(2004, 9, 1, 5);
export let T_MAX = Date.UTC(2018, 7, 3, 9);
export let NOW_DEFAULT = Date.UTC(2018, 7, 1, 5); // 演示锚点（仿真口径）
export let D0 = locDay(T_MIN), D1 = locDay(T_MAX - 1);
export function setAnchors(tMin: number, tMax: number, nowDefault: number) { T_MIN = tMin; T_MAX = tMax; NOW_DEFAULT = nowDefault; }
export function setDayRange(d0: number, d1: number) { D0 = d0; D1 = d1; }

export interface ZLState {
  zone: Zone;
  mode: 'live' | 'replay';
  origin: number;
  range: keyof typeof RANGES;
  opts: { temp: boolean; yday: boolean; god: boolean; peak: boolean };
  drawerTab: string;
}
export const state: ZLState = {
  zone: 'AEP', mode: 'live', origin: NOW_DEFAULT, range: '3d',
  opts: { temp: true, yday: true, god: true, peak: true }, drawerTab: 'sm',
};
export let originToken = 0; /* 导航令牌：新跳转使旧异步渲染失效 */
export function nextToken() { return ++originToken; }
export function curToken() { return originToken; }

export function applyAnchors(preserveView = false) { /* T_MIN/T_MAX/NOW/D0/D1 从 store 推导（live/snapshot） */
  const dz = [...store.daily.values()].flat();
  if (dz.length) {
    const tMin = Math.min(...dz.map(d => dayTs(d.di)));
    const tMax = Math.max(...dz.map(d => dayTs(d.di + 1) - HOUR));
    const prevNow = NOW_DEFAULT;
    setAnchors(tMin, tMax, Math.min(Date.UTC(2018, 6, 31, 10), tMax - 49 * HOUR)); /* NOW=2018-07-31 05:00 EST */
    if (!preserveView) { state.origin = NOW_DEFAULT; state.mode = 'live' }
    else if (state.origin === prevNow) { state.origin = NOW_DEFAULT } /* 后台同步数据滚动：仅当用户停在默认锚点时跟随 */
  }
  setDayRange(locDay(T_MIN), locDay(T_MAX - 1));
}
export function dbgHook() { /* window.ZL_DATA 断言钩子（懒加载形态） */
  const n = (z: Zone) => store.hours.get(z)?.size || 0;
  (window as unknown as Record<string, unknown>).ZL_DATA = {
    src: SRC, live: SRC === 'live',
    hours: { AEP: n('AEP'), DAYTON: n('DAYTON'), DOM: n('DOM') },
    daily: { AEP: store.daily.get('AEP')?.length || 0, DAYTON: store.daily.get('DAYTON')?.length || 0, DOM: store.daily.get('DOM')?.length || 0 },
    anchors: { tMin: T_MIN, tMax: T_MAX, nowDefault: NOW_DEFAULT },
    model: store.model,
  };
}

/* 查表（store 为唯一后端；live/snapshot 缺数据=NaN——禁止仿真填充，防假数据；sim 模式走公式） */
export function packAt(zone: Zone, ts: number): DayPack | null {
  const m = store.hours.get(zone); if (!m) return null;
  return m.get(locDay(ts)) || null;
}
export function tempAt(ts: number, tOff = 0): number { /* 真模式下 tOff 无效（真温度即区域加权实测）；所有调用方均针对当前区 */
  if (SRC !== 'sim') { const p = packAt(state.zone, ts); if (p) { const v = p.T[etP(ts).h]; if (Number.isFinite(v)) return v } }
  return simTempAt(ts, tOff);
}
export function loadAt(zone: Zone, ts: number): number {
  if (SRC !== 'sim') { const p = packAt(zone, ts); if (p) { const v = p.L[etP(ts).h]; if (Number.isFinite(v)) return v } return NaN }
  return simLoadAt(zone, ts);
}
/* 当前温度段的负荷灵敏度（MW/°C），由区域冷/热负荷系数导出 */
export function sensAt(zone: Zone, ts: number): number {
  const c = ZONES[zone], t = tempAt(ts, c.tOff);
  if (t > 24) return c.cool * 1.3 * Math.pow(t - 24, 0.3);
  if (t < 16) return c.heat * 1.2 * Math.pow(16 - t, 0.2);
  return 0;
}
/* 日峰值序列（时光机胶片 / 热力图 / 极端日）：live/snapshot 直接用 store.daily（视图/快照），
   sim 用公式逐日扫 */
export const daily: Record<string, DailyRow[]> = {}; // zone → [{ts,peak,ph,di}]
export const RECORD: Record<string, { v: number; ts: number }> = {}; // zone → {v,ts} 历史峰值
export function buildDaily() {
  for (const z of ZONE_KEYS) {
    const arr = [...(store.daily.get(z) || [])].sort((a, b) => a.di - b.di);
    if (!arr.length) { /* sim：逐日扫 */
      for (let di = D0; di <= D1; di++) {
        const t0 = dayTs(di); let pk = -1, ph = 0;
        for (let h = 0; h < 24; h++) { const v = loadAt(z, t0 + h * HOUR); if (v > pk) { pk = v; ph = h } }
        arr.push({ ts: t0 + ph * HOUR, peak: pk, ph, di });
      }
    }
    let rec = { v: -1, ts: 0 };
    for (const d of arr) if (d.peak > rec.v) rec = { v: d.peak, ts: d.ts };
    daily[z] = arr; RECORD[z] = rec;
  }
}
/* 日均值缓存（供相似日均位校正） */
const _dMean: Record<string, number> = {};
export function dayMean(zone: Zone, di: number): number {
  const k = zone + ':' + di;
  if (_dMean[k] == null) { let s = 0; for (let h = 0; h < 24; h++) s += loadAt(zone, dayTs(di) + h * HOUR); _dMean[k] = s / 24 }
  return _dMean[k];
}
/* 相似日候选：与「目标日」同星期、就近取 10 个、且不晚于 dLimit（防未来信息泄露）；
   live 模式仅取已加载日（ensureWindow 保证候选窗），并按各区实际起始日设下界 */
export function candsFor(zone: Zone, wdT: number, dLimit: number): number[] {
  const c: number[] = [];
  const first = store.daily.get(zone)?.[0];
  const dFloor = first ? first.di + 2 : D0 + 2;
  const have = SRC === 'sim' ? () => true : (di: number) => !!store.hours.get(zone)?.has(di);
  for (let di = dLimit; di >= dLimit - 70 && c.length < 10; di--) {
    if (di < dFloor) break;
    if (have(di) && (wdT < 0 || LOC(dayTs(di)).getUTCDay() === wdT)) c.push(di);
  }
  return c;
}

/* 按需查询 toast（DOM 小助手，供 supabase.ts 使用） */
export function sbToast(on: boolean, text?: string) {
  const t = document.getElementById('sbToast'); if (!t) return;
  if (on) { document.getElementById('sbToastText')!.textContent = text ?? ''; t.classList.add('on') } else t.classList.remove('on');
}
