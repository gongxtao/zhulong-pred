/* =====================================================================
   烛龙 ZHULONG · 工具函数（照抄 docs/prototype/zhulong.html，TS 化）
   ===================================================================== */

export const HOUR = 3600e3;
export const DAY = 86400e3;

export function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export function hash2(a: string, b: number) {
  let h = 2166136261;
  const s = a + ':' + b;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export const rnd2 = (ns: string, ts: number) => lcg(hash2(ns, ts))();
export const gauss = (x: number, mu: number, sig: number) =>
  Math.exp(-((x - mu) ** 2) / (2 * sig * sig));
export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
export const LOC = (ts: number) => new Date(ts - 5 * HOUR); // 美东墙钟（固定 EST 展示基准）
export const locDay = (ts: number) => Math.floor((ts + 5 * HOUR) / DAY); // 美东日序号
export const dayTs = (di: number) => di * DAY + 5 * HOUR; // 美东日序号 → 当日 00:00（EST）对应的 UTC 时刻
export function doyOf(ts: number) {
  const d = LOC(ts);
  return (
    (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
      Date.UTC(d.getUTCFullYear(), 0, 1)) /
      DAY +
    1
  );
}
export function quantile(sorted: number[], q: number) {
  const p = (sorted.length - 1) * q,
    lo = Math.floor(p),
    hi = Math.ceil(p);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (p - lo);
}
export const WD_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/* 美东时间（统一按 EST UTC−5 展示，与生成器口径一致；见「数据口径」） */
export const p2 = (n: number) => String(n).padStart(2, '0');
export const etP = (ts: number) => {
  const d = LOC(ts);
  return {
    y: d.getUTCFullYear(),
    mo: d.getUTCMonth() + 1,
    da: d.getUTCDate(),
    h: d.getUTCHours(),
    m: d.getUTCMinutes(),
    s: d.getUTCSeconds(),
    wd: d.getUTCDay(),
  };
};
export const fmtMD = (ts: number) => {
  const p = etP(ts);
  return `${p2(p.mo)}/${p2(p.da)}`;
};
export const fmtHM = (ts: number) => p2(etP(ts).h) + ':00';
export const fmtMDH = (ts: number) => fmtMD(ts) + ' ' + fmtHM(ts);
export const fmtFull = (ts: number) => {
  const p = etP(ts);
  return `${p.y}/${p2(p.mo)}/${p2(p.da)} ${WD_ZH[p.wd]} ${p2(p.h)}:${p2(p.m)}`;
};
export const fmtNow = (ts: number) => {
  const p = etP(ts);
  return `${p.y}/${p2(p.mo)}/${p2(p.da)} ${WD_ZH[p.wd]} ${p2(p.h)}:${p2(p.m)}:${p2(p.s)}`;
};
