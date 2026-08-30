// 使用: node 易拉宝/scripts/extract-data.mjs
// 从本地快照 + 在线 Supabase 提取易拉宝主视觉真数据:
//   ① AEP 14 年日峰序列（顶部曲线纹理）
//   ② NOW 窗（origin=2018-08-02T03:00Z）：前 48h 实际 + h1-24 预测带（快照静态轨）
//      + 持续学习轨（在线 pred_static 表，双表对调语义换读；失败则置 null）
//   ③ 决策告示复算：预备窗 13:00–16:00 EST（=18:00–21:00Z）P90 上界 − 97%×P50
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
globalThis.window = {};
require('../../web/public/data/zhulong-data.js');
const Z = window.ZL_DATA;
const AEP = Z.zones.AEP;
const HOUR = 3600_000;
const t0 = AEP.t0;
const at = (ts) => AEP.loads[Math.round((ts - t0) / HOUR)];
const idx = (ts) => Math.round((ts - t0) / HOUR);

// ---- ① 14 年日峰纹理 ----
const daily = [];
for (let i = 0; i < AEP.n; i += 24) {
  const chunk = AEP.loads.slice(i, i + 24).filter((v) => v != null);
  if (chunk.length) daily.push(Math.max(...chunk));
}

// ---- ② NOW 窗 ----
const P = Z.pred.AEP;
const nowTs = P.origins[P.origins.length - 1]; // 2018-08-02T03:00Z（末起点）
const nowIdx = P.origins.length - 1;
if (new Date(nowTs).toISOString() !== '2018-08-02T03:00:00.000Z') {
  console.error('!! 末起点不是 2018-08-02T03:00Z，窗口需重选:', new Date(nowTs).toISOString());
}
const BACK = 48;
const hours = [], actual = [];
for (let h = BACK; h >= 1; h--) { hours.push(nowTs - h * HOUR); actual.push(at(nowTs - h * HOUR)); }
const p50 = P.preds[nowIdx].slice();                       // h1..h24 静态轨
const cal = P.cal;                                          // 残差分位按 horizon 聚合：h1..h24 {z50,z90}
const fTs = (h) => nowTs + h * HOUR;
const p90 = p50.map((v, i) => +(v * (1 + cal[i].z90)).toFixed(1));
const p10 = p50.map((v, i) => +(v * (1 - cal[i].z90)).toFixed(1));

// ---- ③ 决策告示复算：13:00–16:00 EST = 18:00–21:00Z（产品固定 UTC−5）----
// origin 03:00Z → h15..h18 即 18:00..21:00Z
const RES_WIN = [15, 16, 17, 18];
let reserve = 0, reserveH = 15, reserveP90 = 0;
for (const h of RES_WIN) {
  const need = p50[h - 1] * (1 + cal[h - 1].z90) - 0.97 * p50[h - 1];
  if (need > reserve) { reserve = need; reserveH = h; reserveP90 = p50[h - 1] * (1 + cal[h - 1].z90); }
}

// ---- 持续学习轨（在线，换读语义：内容在 pred_static 表）----
let dynP50 = null;
try {
  const env = readFileSync(new URL('../../web/.env.local', import.meta.url), 'utf8');
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)[1];
  const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(\S+)/)[1];
  const q = new URLSearchParams({
    zone: 'eq.AEP',
    forecast_origin_utc: `eq.${new Date(nowTs).toISOString()}`,
    order: 'forecast_horizon_hour.asc',
    select: 'forecast_horizon_hour,predicted_load_mw',
  });
  const r = await fetch(`${url}/rest/v1/pred_static?${q}`, { headers: { apikey: key } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const rows = await r.json();
  if (rows.length === 24) dynP50 = rows.map((x) => x.predicted_load_mw);
} catch (e) { console.error('持续学习轨在线拉取失败（降级为单线）:', e.message); }

const out = {
  generated: new Date().toISOString(),
  zone: 'AEP',
  nowTs, nowIso: new Date(nowTs).toISOString(),
  daily14y: daily,
  hero: { hours, fTs: fTs(1), actual, p50, p10, p90, dynP50 },
  reserve: { mw: Math.round(reserve), p90Peak: Math.round(reserveP90), hourEst: (reserveH + 2) - 5 - 12 + 13 }, // h→EST 时: (03:00Z+h)−5h
};
out.reserve.hourEst = 13 + (reserveH - 15); // 15→13:00 … 18→16:00
mkdirSync(new URL('../assets/', import.meta.url), { recursive: true });
writeFileSync(new URL('../assets/banner-data.json', import.meta.url), JSON.stringify(out));
const mm = (a) => `${Math.min(...a).toFixed(0)}~${Math.max(...a).toFixed(0)}`;
console.log(`✓ 日纹理 ${daily.length} 天（峰 ${mm(daily)} MW）`);
console.log(`✓ NOW=${out.nowIso} 实际 ${actual.length}h ${mm(actual)} MW；p50 ${mm(p50)}；带 ${mm(p10)}~${mm(p90)}`);
console.log(`✓ 持续学习轨: ${dynP50 ? `在线取到 24h ${mm(dynP50)}` : '降级为单线'}`);
console.log(`✓ 预备复算: ${out.reserve.mw} MW（P90 上界 ${out.reserve.p90Peak} @EST ${out.reserve.hourEst}:00）`);
