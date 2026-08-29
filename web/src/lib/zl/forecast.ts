/* =====================================================================
   预测与评估（照抄原型，TS 化）
   forecastAt = 真模型注入（≤24h 最近 pred 起点偏移重索引 mh=off+h）+ 相似日基线兜底
   （25–48h/2017 前）+ CAL + FC_CACHE(memo)
   评估：backtest(28起点×24h，审计=模型契约视界) + buildPers(24h) + replayBT(24h)
   ===================================================================== */
import { H_FC, type Zone } from './const';
import { candsFor, D1, dayMean, loadAt, store, state } from './store';
import { dayTs, HOUR, locDay, LOC, quantile } from './util';

export interface ForecastPt { ts: number; p50: number; p10: number; p90: number; p25: number; p75: number }
export interface BTRes { origin?: number; mape: number; cov50: number; cov90: number; peakErr?: number }

/* 预测缓存：同一 (zone, origin) 的结果确定性一致，避免 renderAll 内重复计算 */
export const FC_CACHE = new Map<string, ForecastPt[]>();
/* 残差标定表：CAL[zone] = 逐 horizon（1..48h）的残差分位（相对误差，±2h 池化平滑） */
export const CAL: Partial<Record<Zone, { z50: number; z90: number }[]>> = {};

export function forecastAt(zone: Zone, originTs: number): ForecastPt[] {
  const key = zone + '@' + originTs;
  if (FC_CACHE.has(key)) return FC_CACHE.get(key)!;
  const d0 = locDay(originTs);
  const out: ForecastPt[] = [];
  for (let h = 1; h <= H_FC; h++) {
    const ts = originTs + h * HOUR, dt = locDay(ts);
    const wdT = LOC(dayTs(dt)).getUTCDay();
    const ht = LOC(ts).getUTCHours();
    let cands = candsFor(zone, wdT, Math.min(dt - 2, d0 - 1));
    if (cands.length < 4) cands = candsFor(zone, -1, Math.min(dt - 2, d0 - 1)); // 早期数据兜底：不限星期
    const ref = dayMean(zone, cands[0]);
    const samples = cands.map(di => loadAt(zone, dayTs(di) + ht * HOUR) * ref / dayMean(zone, di)).sort((a, b) => a - b);
    const p50 = quantile(samples, .5);
    let q: { p10: number; p90: number; p25: number; p75: number };
    if (CAL[zone]) { /* 残差标定：带宽 = 近期真实残差的经验分位数（GEFCom 冠军范式：点预测 + 残差模拟） */
      const s = CAL[zone]![h - 1];
      q = { p10: p50 * (1 - s.z90), p90: p50 * (1 + s.z90), p25: p50 * (1 - s.z50), p75: p50 * (1 + s.z50) };
    } else { /* 未标定兜底：相似日经验分位 × 时距张开 */
      const widen = 1 + 0.30 * Math.sqrt(h / H_FC);
      q = {
        p10: p50 + (quantile(samples, .1) - p50) * widen, p90: p50 + (quantile(samples, .9) - p50) * widen,
        p25: p50 + (quantile(samples, .25) - p50) * widen, p75: p50 + (quantile(samples, .75) - p50) * widen,
      };
    }
    out.push({ ts, p50, p10: q.p10, p90: q.p90, p25: q.p25, p75: q.p75 });
  }
  /* 真模型注入：取 ≤24h 内最近的 pred_static 日起点，按偏移重索引（mh = 起点偏移 + 页面 horizon）→
     生产模型 p50 + 真残差分位带；超出模型 24h 视界的部分回退相似日基线（口径注明）。
     审计卡回测因此审计的正是页面展示的预测路径。 */
  {
    const O = store.predOrigins.get(zone);
    if (O && O.length) {
      let lo = 0, hi = O.length - 1, best = -1;
      while (lo <= hi) { const m = (lo + hi) >> 1; if (O[m] <= originTs) { best = m; lo = m + 1 } else hi = m - 1 }
      if (best >= 0 && originTs - O[best] < 24 * HOUR) {
        const off = Math.round((originTs - O[best]) / HOUR);
        const row = store.pred.get(zone)!.get(O[best]);
        const cal = store.cal[zone]!;
        for (let h = 1; h <= H_FC; h++) {
          const mh = off + h;
          if (mh < 1 || mh > 24) continue;
          const p = out[h - 1], mp = row && row[mh - 1];
          if (mp != null && mp > 0) {
            p.p50 = mp;
            const c = cal[mh - 1];
            p.p10 = mp * (1 - c.z90); p.p90 = mp * (1 + c.z90); p.p25 = mp * (1 - c.z50); p.p75 = mp * (1 + c.z50);
          }
        }
      }
    }
  }
  FC_CACHE.set(key, out);
  return out;
}
/* 静态对照线（feat-022 缝纫式）：对预测窗每小时，取「当时生效」的日前预测（最近一个覆盖该小时的
   静态起点）——日起点×h1-24 无缝平铺，故每小时都有归属；无静态起点的段留空（对照线不造数） */
export function staticLineAt(zone: Zone, originTs: number): [number, number][] {
  const pm = store.predStatic.get(zone);
  if (!pm || !pm.size) return [];
  const O = [...pm.keys()].sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let h = 1; h <= H_FC; h++) {
    const ts = originTs + h * HOUR;
    let lo = 0, hi = O.length - 1, best = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (O[m] < ts) { best = m; lo = m + 1 } else hi = m - 1 }
    if (best < 0) continue;
    const mh = Math.round((ts - O[best]) / HOUR);
    if (mh < 1 || mh > 24) continue;
    const v = pm.get(O[best])?.[mh - 1];
    if (v != null && v > 0) out.push([ts, v]);
  }
  return out;
}
/* 残差标定：最近 14 个起点的裸预测残差 → 逐 horizon 经验分位（±2h 邻域池化） */
export function buildCal(zone: Zone) {
  const per = Array.from({ length: H_FC }, () => [] as number[]);
  for (let i = 1; i <= 14; i++) {
    const origin = dayTs(D1 - 6 - i);
    const fc = forecastAt(zone, origin); // CAL 未填 → 走相似日裸分位
    for (let h = 1; h <= H_FC; h++) {
      const p = fc[h - 1], a = loadAt(zone, p.ts);
      per[h - 1].push((p.p50 - a) / a);
    }
  }
  CAL[zone] = per.map((_, i) => {
    const pool: number[] = [];
    for (let j = Math.max(0, i - 2); j <= Math.min(H_FC - 1, i + 2); j++) pool.push(...per[j]);
    const m = pool.reduce((s, v) => s + v, 0) / pool.length;
    const abs = pool.map(v => Math.abs(v - m)).sort((a, b) => a - b);
    return { z90: quantile(abs, .90), z50: quantile(abs, .50) };
  });
}
/* 持久性基线（昨日同时刻 = 预测）的 MAPE：用于「本模型 vs 基线」对比（同视界 24h，公平比较） */
export const PERS: Partial<Record<Zone, number>> = {};
export function buildPers(zone: Zone) {
  let se = 0, n = 0;
  for (let i = 28; i >= 1; i--) {
    const origin = dayTs(D1 - 6 - i);
    for (let h = 1; h <= 24; h++) {
      const ts = origin + h * HOUR, a = loadAt(zone, ts), p = loadAt(zone, ts - 24 * HOUR);
      se += Math.abs(p - a) / a; n++;
    }
  }
  PERS[zone] = se / n * 100;
}
/* 回测：滚动起点 vs 真实（审计口径 = 模型契约视界 24h；25–48h 为基线延伸不纳入） */
export function backtest(zone: Zone, nOrigins = 28): BTRes[] {
  const per: BTRes[] = [];
  for (let i = nOrigins; i >= 1; i--) {
    const origin = dayTs(D1 - 6 - i);
    const fc = forecastAt(zone, origin);
    let se = 0, n = 0, c50 = 0, c90 = 0;
    for (let h = 1; h <= 24; h++) {
      const p = fc[h - 1], a = loadAt(zone, p.ts); if (a == null) continue;
      se += Math.abs(p.p50 - a) / a; n++;
      if (a >= p.p25 && a <= p.p75) c50++;
      if (a >= p.p10 && a <= p.p90) c90++;
    }
    const pkA = Math.max(...fc.slice(0, 24).map(p => loadAt(zone, p.ts))), pkP = Math.max(...fc.slice(0, 24).map(p => p.p50));
    per.push({ origin, mape: se / n * 100, cov50: c50 / n * 100, cov90: c90 / n * 100, peakErr: (pkP - pkA) / pkA * 100 });
  }
  return per;
}
/* 本段重演回测（24h） */
export function replayBT(): BTRes {
  const z = state.zone, fc = forecastAt(z, state.origin);
  let se = 0, n = 0, c50 = 0, c90 = 0;
  for (let h = 1; h <= 24; h++) {
    const p = fc[h - 1], a = loadAt(z, p.ts); se += Math.abs(p.p50 - a) / a; n++;
    if (a >= p.p25 && a <= p.p75) c50++; if (a >= p.p10 && a <= p.p90) c90++;
  }
  return { mape: se / n * 100, cov50: c50 / n * 100, cov90: c90 / n * 100 };
}
export const BT: Partial<Record<Zone, BTRes[]>> = {};
