/* =====================================================================
   DataHub · 仿真数据层（最终兜底；照抄原型，TS 化）
   ===================================================================== */
import { EVENTS, ZONES, type Zone } from './const';
import { DAY, doyOf, gauss, LOC, rnd2 } from './util';

export function eventW(ts: number) { // 事件影响权重 0..1
  let w = 0;
  for (const e of EVENTS) {
    const dd = Math.abs(ts - e.c) / DAY;
    w = Math.max(w, Math.exp(-(dd * dd) / (2 * 2.2 * 2.2)));
  }
  return w;
}
export function simTempAt(ts: number, tOff = 0) {
  const d = LOC(ts), h = d.getUTCHours();
  let t = 12.8 + 11.2 * Math.cos((doyOf(ts) - 197) / 365 * 2 * Math.PI) + 5.4 * Math.sin((h - 9) / 24 * 2 * Math.PI);
  for (const e of EVENTS) { const dd = Math.abs(ts - e.c) / DAY; const w = Math.exp(-(dd * dd) / (2 * 2.2 * 2.2)); t += e.tAnom * w }
  t += (rnd2('t', ts) - .5) * 1.4 + tOff;
  return t;
}
export function simLoadAt(zone: Zone, ts: number) {
  const c = ZONES[zone], d = LOC(ts), h = d.getUTCHours(), wd = d.getUTCDay();
  const wk = (wd === 0 || wd === 6) ? c.wknd : 1;
  const t = simTempAt(ts, c.tOff);
  const doy = doyOf(ts);
  const season = c.base * (1 + c.seas * Math.cos((doy - 197) / 365 * 2 * Math.PI) + c.wtr * Math.cos((doy - 15) / 365 * 2 * Math.PI));
  const diurnal = c.amp * (0.52 * gauss(h, 9.2, 2.7) + 0.9 * gauss(h, 19, 3.1));
  const cool = c.cool * Math.pow(Math.max(0, t - 24), 1.3);
  const heat = c.heat * Math.pow(Math.max(0, 16 - t), 1.2);
  const trend = 1 + 0.011 * (d.getUTCFullYear() + (d.getUTCMonth() + .5) / 12 - 2006.5);
  let L = (season + diurnal + cool + heat) * trend * wk;
  for (const e of EVENTS) { const dd = Math.abs(ts - e.c) / DAY; const w = Math.exp(-(dd * dd) / (2 * 2.2 * 2.2)); L *= 1 + (e.mult - 1) * w }
  L *= 1 + (rnd2(zone, ts) - .5) * 0.045;
  return L;
}
