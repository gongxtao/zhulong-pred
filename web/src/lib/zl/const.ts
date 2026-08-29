/* =====================================================================
   烛龙 ZHULONG · 常量（区域 / 极端事件 / 双主题调色板——两套均通过 CVD 六项验证）
   照抄 docs/prototype/zhulong.html，TS 化。
   ===================================================================== */

export type Zone = 'AEP' | 'DAYTON' | 'DOM';
export const ZONE_KEYS: Zone[] = ['AEP', 'DAYTON', 'DOM'];

export interface ZoneCfg {
  label: string;
  base: number;
  amp: number;
  seas: number;
  wtr: number;
  cool: number;
  heat: number;
  wknd: number;
  tOff: number;
}
export const ZONES: Record<Zone, ZoneCfg> = {
  AEP: { label: 'AEP · 美国电力（俄亥俄河谷）', base: 13400, amp: 3600, seas: 0.16, wtr: 0.09, cool: 46, heat: 130, wknd: 0.905, tOff: 0 },
  DAYTON: { label: 'DAYTON · 代顿（俄亥俄）', base: 2080, amp: 610, seas: 0.15, wtr: 0.10, cool: 7, heat: 21, wknd: 0.88, tOff: -0.4 },
  DOM: { label: 'DOM · 多米尼恩（弗吉尼亚）', base: 11900, amp: 3300, seas: 0.15, wtr: 0.10, cool: 40, heat: 120, wknd: 0.92, tOff: 0.6 },
};

export const H_FC = 48;

/* 极端事件（真实历史：2014-01 极地涡旋 / 2012-07 热浪） */
export interface ZLEvent {
  key: string;
  label: string;
  c: number;
  tAnom: number;
  mult: number;
}
export const EVENTS: ZLEvent[] = [
  { key: 'vortex', label: '❄ 极地涡旋 2014-01', c: Date.UTC(2014, 0, 6, 12), tAnom: -8, mult: 1.12 },
  { key: 'heat12', label: '♨ 热浪 2012-07', c: Date.UTC(2012, 6, 5, 12), tAnom: 4.5, mult: 1.07 },
];
/* 预测纪元：首个日前预测起点（pred_static/pred_dynamic 首行 origin）。
   此前视窗=负荷档案模式（无任何预测层），胶片画纪元分割线（feat-020 用户裁决） */
export const PRED_EPOCH = Date.UTC(2016, 0, 1, 4);

/* ---------- 双主题调色板（两套均通过 CVD 六项验证） ---------- */
export interface Theme {
  actual: string;
  actualHi: string;
  fc: string;
  fcHi: string;
  b90: string;
  b50: string;
  yday: string;
  rec: string;
  ink: string;
  ink2: string;
  ink3: string;
  split: string;
  axisLine: string;
  ok: string;
  danger: string;
  warn: string;
  zone: Record<Zone, string>;
  tipBg: string;
  tipLine: string;
  cellBd: string;
  prepC: string;
  heat: string[];
}
export const THEMES: Record<'light' | 'dark', Theme> = {
  light: {
    actual: '#0891B2', actualHi: '#0E7490',
    fc: '#C2620A', fcHi: '#B45309', b90: 'rgba(194,98,10,.10)', b50: 'rgba(194,98,10,.22)',
    yday: '#94A3B8', rec: '#94A3B8',
    ink: '#0F172A', ink2: '#475569', ink3: '#7C8DA6',
    split: '#EDF2F7', axisLine: '#E2E8F0',
    ok: '#059669', danger: '#DC2626', warn: '#B45309',
    zone: { AEP: '#0891B2', DAYTON: '#7C3AED', DOM: '#DB2777' },
    tipBg: '#FFFFFF', tipLine: '#CBD5E1', cellBd: '#FFFFFF', prepC: 'rgba(194,98,10,.055)',
    heat: ['#EDF4F8', '#7CC3D6', '#0891B2', '#0E5E73'],
  },
  dark: {
    actual: '#0891B2', actualHi: '#22D3EE',
    fc: '#D97706', fcHi: '#F5A623', b90: 'rgba(217,119,6,.10)', b50: 'rgba(217,119,6,.22)',
    yday: '#5A6C8C', rec: '#5B6B85',
    ink: '#E9F0FB', ink2: '#9DB0CC', ink3: '#8CA0B8',
    split: 'rgba(148,166,197,.09)', axisLine: 'rgba(148,166,197,.16)',
    ok: '#34D399', danger: '#F87171', warn: '#F5A623',
    zone: { AEP: '#0891B2', DAYTON: '#8B5CF6', DOM: '#EC4899' },
    tipBg: '#111A2C', tipLine: 'rgba(148,166,197,.3)', cellBd: '#0C1322', prepC: 'rgba(217,119,6,.08)',
    heat: ['#0D1830', '#0E7490', '#22D3EE', '#67E8F9'],
  },
};

export const RANGES: Record<string, { back: number }> = { '24h': { back: 22 }, '3d': { back: 70 }, '7d': { back: 166 } };

/* 四格 ⓘ 解释（共用 sqTip 弹层） */
export const SQ_TIPS = [
  '<h3>现在负荷</h3>当前小时的实际负荷（估算平均功率，MW）。子行为与昨日同一时刻的涨跌幅。',
  '<h3>预测偏差</h3>实际 − 昨日起点的日前预测，近 6 小时加权平均（越近权重越大）；±1.5% 内为正常。',
  '<h3>今日峰值 · 预测</h3>未来 24 小时预测日峰（P50 最可能路径），@ 为预计达到时刻；最坏 P90 = 90% 分位上界。距历史纪录与预备窗见格子悬停。',
  '<h3>预测误差（MAPE）</h3>日前 24h 预测的平均绝对百分比误差，近 28 个滚动起点回测；行业优良 &lt;3%。P90 命中率标称 90%。',
];
