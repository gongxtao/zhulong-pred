#!/usr/bin/env node
/**
 * build-snapshot.mjs — 生成 docs/prototype/data/zhulong-data.js（window.ZL_DATA）
 *
 * 数据源：Supabase energy_hourly（真实 2004-10→2016-01）∪ energy_hourly_future（模拟 →2018-08-03）
 * 附加：model_versions + training_trials（模型元数据/基线）、pred_static（579 日起点 × 24h 真模型回测）
 *
 * 用法：ZL_SKEY=<service_role> node scripts/build-snapshot.mjs   （或 ZL_AKEY=<anon>）
 * 密钥只经环境变量传入，绝不写入产物。
 */
const KEY = process.env.ZL_SKEY || process.env.ZL_AKEY;
if (!KEY) { console.error('需要 ZL_SKEY 或 ZL_AKEY 环境变量'); process.exit(1); }
const BASE = 'https://guhooxzoitrexucnxvew.supabase.co/rest/v1';
const HOUR = 3600e3;
const ZONES = ['AEP', 'DAYTON', 'DOM'];

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function fetchAll(table, filter, select) {
  const rows = [];
  let offset = 0;
  for (;;) {
    const q = new URLSearchParams({ select, order: 'interval_end_utc.asc', ...filter });
    const r = await fetch(`${BASE}/${table}?${q}`, { headers: { ...H, Range: `${offset}-${offset + 999}` } });
    if (!r.ok) throw new Error(`${table} HTTP ${r.status}: ${await r.text()}`);
    const page = await r.json();
    rows.push(...page);
    process.stdout.write(`\r  ${table}${filter.zone ? ':' + filter.zone : ''} ${rows.length}`);
    if (page.length < 1000) break;
    offset += 1000;
  }
  process.stdout.write('\n');
  return rows;
}

/* 列式网格 + 线性插值（缺测填补），返回 {t0,n,cols:{name:Float64Array},gaps} */
function toGrid(map /* ts -> row */) {
  const tss = [...map.keys()].sort((a, b) => a - b);
  const t0 = tss[0], n = Math.round((tss[tss.length - 1] - t0) / HOUR) + 1;
  const cols = {};
  for (const f of ['load_mw', 'temperature_2m_c', 'relative_humidity_2m_pct', 'wind_speed_10m_kmh', 'precipitation_mm']) {
    const a = new Float64Array(n).fill(NaN);
    for (const ts of tss) a[Math.round((ts - t0) / HOUR)] = map.get(ts)[f];
    // 线性插值缺测
    let gapRun = 0, gaps = 0, maxRun = 0;
    for (let i = 0; i < n; i++) {
      if (!Number.isFinite(a[i])) { gapRun++; gaps++; continue; }
      if (gapRun > 0 && i - gapRun - 1 >= 0) {
        const L = a[i - gapRun - 1], R = a[i];
        for (let k = 1; k <= gapRun; k++) a[i - gapRun - 1 + k] = L + (R - L) * k / (gapRun + 1);
        maxRun = Math.max(maxRun, gapRun);
      }
      gapRun = 0;
    }
    // 首尾缺测：用最近有效值填充
    let first = a.findIndex(Number.isFinite); let last = n - 1 - [...a].reverse().findIndex(Number.isFinite);
    for (let i = 0; i < first; i++) a[i] = a[first];
    for (let i = last + 1; i < n; i++) a[i] = a[last];
    if (f === 'load_mw') cols.loads = a; else if (f === 'temperature_2m_c') cols.temps = a;
    else if (f === 'relative_humidity_2m_pct') cols.hum = a; else if (f === 'wind_speed_10m_kmh') cols.wind = a;
    else cols.prec = a;
    if (f === 'load_mw') cols._gapStat = { gaps, maxRun };
  }
  return { t0, n, ...cols };
}

const r1 = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const quantile = (sorted, q) => { const p = (sorted.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return sorted[lo] + (sorted[hi] - sorted[lo]) * (p - lo); };

async function main() {
  console.log('== 拉取小时数据（6 流并发）==');
  const jobs = [];
  for (const z of ZONES) {
    jobs.push(fetchAll('energy_hourly', { zone: `eq.${z}` }, 'interval_end_utc,load_mw,temperature_2m_c,relative_humidity_2m_pct,wind_speed_10m_kmh,precipitation_mm'));
    jobs.push(fetchAll('energy_hourly_future', { zone: `eq.${z}` }, 'interval_end_utc,load_mw,temperature_2m_c,relative_humidity_2m_pct,wind_speed_10m_kmh,precipitation_mm'));
  }
  const all = await Promise.all(jobs);

  console.log('== 建网格（去重∪插值）==');
  const zones = {}, gaps = {};
  // 按任务顺序重排：每区 2 个结果（hourly 在前、future 在后）
  ZONES.forEach((z, zi) => {
    const [hist, fut] = [all[zi * 2], all[zi * 2 + 1]];
    const map = new Map();
    for (const row of hist) map.set(Date.parse(row.interval_end_utc), row);
    for (const row of fut) { const ts = Date.parse(row.interval_end_utc); if (!map.has(ts)) map.set(ts, row); }
    const g = toGrid(map);
    zones[z] = {
      t0: g.t0, n: g.n,
      loads: [...g.loads].map(v => r1(v, 1)),
      temps: [...g.temps].map(v => r1(v, 1)),
      hum: [...g.hum].map(v => Math.round(v)),
      wind: [...g.wind].map(v => r1(v, 1)),
      prec: [...g.prec].map(v => r1(v, 1)),
    };
    gaps[z] = g._gapStat;
    console.log(`  ${z}: n=${g.n} 缺测=${g._gapStat.gaps} 最长=${g._gapStat.maxRun}h 范围 ${new Date(g.t0).toISOString().slice(0, 10)}→${new Date(g.t0 + (g.n - 1) * HOUR).toISOString().slice(0, 10)}`);
  });

  console.log('== 模型元数据 ==');
  const [mv, tt, ps] = await Promise.all([
    fetch(`${BASE}/model_versions?select=model_id,status,created_at,winner_trial_id&status=eq.active`, { headers: H }).then(r => r.json()),
    fetch(`${BASE}/training_trials?select=trial_number,status,mean_zone_wape,mean_zone_mae_mw,validation_metrics`, { headers: H }).then(r => r.json()),
    fetchAll('pred_static', {}, 'zone,forecast_origin_utc,interval_end_utc,forecast_horizon_hour,actual_load_mw,predicted_load_mw'),
  ]);
  const winner = tt.find(t => mv[0] && t.trial_number !== undefined) || tt[0];
  const vm = (winner?.validation_metrics?.zones) || {};
  const model = {
    modelId: mv[0]?.model_id || null, status: mv[0]?.status || null, createdAt: mv[0]?.created_at || null,
    trials: tt.map(t => ({ n: t.trial_number, wape: r1(t.mean_zone_wape * 100, 2), mae: Math.round(t.mean_zone_mae_mw) })),
    zones: Object.fromEntries(Object.entries(vm).map(([z, v]) => [z, {
      wape: r1(v.overall.wape * 100, 2),
      lastDayWape: r1(v.last_day_same_hour_baseline.wape * 100, 2),
      lastWeekWape: r1(v.last_week_same_hour_baseline.wape * 100, 2),
    }])),
  };

  console.log('== pred_static 聚合（真模型 p50 + 残差分位）==');
  const pred = {};
  for (const z of ZONES) pred[z] = { origins: [], preds: [], cal: [], mape: null, n: 0 };
  const byZoneOrigin = {};
  for (const r of ps) {
    (byZoneOrigin[r.zone] ||= {})[r.forecast_origin_utc] ||= [];
    byZoneOrigin[r.zone][r.forecast_origin_utc].push(r);
  }
  for (const z of ZONES) {
    const orgs = Object.keys(byZoneOrigin[z] || {}).sort();
    const relByH = Array.from({ length: 24 }, () => []);
    let se = 0, n = 0;
    for (const o of orgs) {
      const rows = byZoneOrigin[z][o].sort((a, b) => a.forecast_horizon_hour - b.forecast_horizon_hour);
      const originTs = Date.parse(o);
      pred[z].origins.push(originTs);
      const row = [];
      for (const rr of rows) {
        row.push(r1(rr.predicted_load_mw, 1));
        const rel = (rr.predicted_load_mw - rr.actual_load_mw) / rr.actual_load_mw;
        relByH[rr.forecast_horizon_hour - 1].push(rel);
        se += Math.abs(rel); n++;
      }
      while (row.length < 24) row.push(null);
      pred[z].preds.push(row);
    }
    for (let h = 0; h < 24; h++) {
      const arr = relByH[h].sort((a, b) => a - b);
      const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
      const abs = arr.map(v => Math.abs(v - mean)).sort((a, b) => a - b);
      pred[z].cal.push({ z50: r1(quantile(abs, .50), 4), z90: r1(quantile(abs, .90), 4) });
    }
    pred[z].mape = r1(se / n * 100, 2); pred[z].n = n;
    console.log(`  ${z}: origins=${orgs.length} 回测对=${n} MAPE=${pred[z].mape}%`);
  }

  const out = {
    v: 1, generated: new Date().toISOString(),
    source: { url: BASE, tables: ['energy_hourly', 'energy_hourly_future', 'pred_static', 'model_versions', 'training_trials'] },
    zones, gaps, model, pred,
  };
  const js = `/* 烛龙真数据快照（generated ${out.generated}）——由 scripts/build-snapshot.mjs 生成，勿手改 */\nwindow.ZL_DATA=${JSON.stringify(out)};\n`;
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync('docs/prototype/data', { recursive: true });
  writeFileSync('docs/prototype/data/zhulong-data.js', js);
  console.log(`== 写出 ${(js.length / 1048576).toFixed(1)}MB → docs/prototype/data/zhulong-data.js ==`);
}
main().catch(e => { console.error(e); process.exit(1); });
