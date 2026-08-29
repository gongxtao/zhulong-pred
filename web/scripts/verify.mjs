/* =====================================================================
   烛龙 web · 无头断言脚本（playwright-core + 系统 Chrome，独立实例，
   与其它会话的浏览器完全隔离）。用法：node scripts/verify.mjs [URL]
   断言口径：handoff §5 在线基线 + 秒开 SWR + 上帝视角退出 + 默认深色
   ===================================================================== */
import { chromium } from 'playwright-core';

const URL = process.argv[2] || 'http://localhost:3100/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  [' + detail + ']' : ''}`);
}

const browser = await chromium.launch({ channel: 'chrome', headless: false }); /* 用户裁决：有头模式直测 */
try {
  const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
  const consoleErrs = [];
  const sbRequests = []; /* feat-011：实时校准查询监听 */
  page.on('request', r => { const u = r.url(); if (u.includes('supabase.co/rest/v1/')) sbRequests.push(u); });
  page.on('console', m => {
    const t = m.text();
    /* supabase 路由拦截测试段的 net::ERR_FAILED 是预期噪声，不计为页面错误；
     feat-023 聊天降级测试产生的 503 资源错误同理（/api/chat 无 QWENPAW_URL 的预期路径） */
    if (m.type() === 'error' && !t.includes('net::ERR_FAILED') && !t.includes('status of 503')) consoleErrs.push(t.slice(0, 120));
  });
  page.on('pageerror', e => consoleErrs.push('PAGEERROR ' + String(e).slice(0, 120)));

  /* ---------- 1. 秒开：loader 消耗 + 快照态首屏 ---------- */
  /* 预热：让 dev server 先完成热重编译，避免首次 goto 撞上编译窗口拿到新旧混合 chunk */
  await page.request.get(URL).catch(() => {});
  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ZL_DATA && !document.getElementById('loader'), null, { timeout: 30000 });
  const paintMs = Date.now() - t0;
  const phase1 = await page.evaluate(() => ({
    src: window.ZL_DATA.src,
    theme: document.documentElement.dataset.theme || '(none)',
    badge: document.getElementById('srcText').textContent,
    quad: [...document.querySelectorAll('#statusQuad .sq-v')].map(e => e.textContent.trim()),
    mape: document.getElementById('mapeVal').textContent,
  }));
  check('秒开：首屏 <3.5s（快照先行）', paintMs < 3500, `${paintMs}ms`);
  check('首屏数据源 snapshot（同步中徽章）', phase1.src === 'snapshot' && phase1.badge.includes('同步'), `${phase1.src}/${phase1.badge}`);
  check('默认深色主题', phase1.theme === 'dark', phase1.theme);
  check('首屏四格就位', phase1.quad[0] === '12,926MW' && phase1.quad[2].startsWith('18,261'), phase1.quad.join(' | '));
  check('首屏 MAPE 3.57', phase1.mape === '3.57%', phase1.mape);

  /* ---------- 2. 后台同步 → live 基线 ---------- */
  /* 等数字真正稳定到基线（startEngine('live') 完成）再采样，避免徽章先于数字切换的瞬态 */
  /* 基线 2026-08-29 17:10 重记录：pred_dynamic 回放推过 boot 窗（2018-05-26）→ dyn 优先轨生效，数字全面变优（handoff 预警的数据升级，非回归） */
  await page.waitForFunction(() =>
    window.ZL_DATA && window.ZL_DATA.src === 'live'
    && document.getElementById('cov90v').textContent === '88.8%'
    && document.getElementById('mapeVal').textContent === '3.39%'
    && document.querySelectorAll('#statusQuad .sq-v')[3]?.textContent.trim() === '3.39%',
  null, { timeout: 45000 });
  const phase2 = await page.evaluate(() => ({
    badge: document.getElementById('srcText').textContent,
    quad: [...document.querySelectorAll('#statusQuad .sq-v')].map(e => e.textContent.trim()),
    mape: document.getElementById('mapeVal').textContent,
    cov: [document.getElementById('cov90v').textContent, document.getElementById('cov50v').textContent],
    banner2450: document.getElementById('decisionBanner').textContent.includes('2,450'),
    legendHasRec: document.getElementById('legendTable').textContent.includes('历史峰值'),
  }));
  check('后台同步完成 → 在线徽章', phase2.badge.includes('在线'), phase2.badge);
  check('boot 双轨预测查询（static ∪ dynamic）',
    sbRequests.some(u => u.includes('pred_static')) && sbRequests.some(u => u.includes('pred_dynamic')),
    `sta ${sbRequests.filter(u => u.includes('pred_static')).length} / dyn ${sbRequests.filter(u => u.includes('pred_dynamic')).length}`);
  check('主图历史峰值线已移除（用户裁决）', phase2.legendHasRec === false);
  const marks = await page.evaluate(() => {
    const opt = window.__zlCharts.mainC.getOption();
    const p50 = opt.series.find(s => s.name === '持续学习 P50');
    const recLine = opt.series.find(s => s.name === '实际负荷');
    return {
      prepArea: p50 && p50.markArea ? p50.markArea.data.length : 0,
      recLine: recLine && recLine.markLine ? JSON.stringify(recLine.markLine.data).includes('历史峰值') : false,
    };
  });
  check('主图预备窗琥珀竖带已移除（用户裁决）', marks.prepArea === 0, `markArea ${marks.prepArea}`);
  check('主图无历史峰值 markLine 残留', marks.recLine === false);
  const bands = await page.evaluate(() => {
    const names = window.__zlCharts.mainC.getOption().series.map(s => s.name);
    return { b90: names.includes('b90'), b50: names.includes('b50') };
  });
  check('概率带：外层 P10–P90 保留', bands.b90 === true);
  check('概率带：内层 P25–P75 窄带已移除（用户裁决）', bands.b50 === false);
  const tri = await page.evaluate(() => {
    const opt = window.__zlCharts.mainC.getOption();
    const stat = opt.series.find(s => s.name === '静态预测');
    const p50 = opt.series.find(s => s.name === '持续学习 P50');
    const legend = document.getElementById('legendTable').textContent;
    return {
      statPts: stat ? stat.data.length : -1,
      p50Pts: p50 ? p50.data.length : -1,
      ydayGone: !opt.series.some(s => s.name === '昨日同时刻'),
      legendOk: legend.includes('静态预测') && legend.includes('持续学习') && !legend.includes('昨日同时刻'),
    };
  });
  /* NOW 锚点：静态线有值（快照 static 轨）；dyn 回放已覆盖 boot 窗后展示轨 dyn 优先，NOW 段两线可分叉（持续学习生效） */
  check('三线：静态对照线就位（predStatic 轨）', tri.statPts > 0, `静态点 ${tri.statPts}`);
  check('三线：持续学习 P50 就位', tri.p50Pts > 0, `P50点 ${tri.p50Pts}`);
  check('三线：昨日同时刻线与图例已移除（用户裁决）', tri.ydayGone && tri.legendOk, JSON.stringify(tri));
  /* feat-021：悬停预测点 → tooltip 含静态预测对照值（重合段也透明展示同源数值） */
  const mbox = await page.locator('#mainChart').boundingBox();
  await page.mouse.move(mbox.x + mbox.width * 0.68, mbox.y + mbox.height * 0.45);
  await sleep(700);
  const tipStatic = await page.evaluate(() => {
    const t = [...document.querySelectorAll('#mainChart div')].map(e => e.textContent).find(t => t && t.includes('静态预测'));
    return t ? t.replace(/\s+/g, ' ').slice(0, 130) : null;
  });
  check('悬停 tooltip 含静态预测对照值', !!tipStatic && /静态预测\s*[\d,]+\s*MW/.test(tipStatic), tipStatic || '(无)');
  check('四格基线 12,926/−2.03%/18,237@16:00/3.39',
    phase2.quad[0] === '12,926MW' && phase2.quad[1].endsWith('2.03%') && phase2.quad[2].startsWith('18,237MW@16:00') && phase2.quad[3] === '3.39%',
    phase2.quad.join(' | '));
  check('cov 基线 88.8/54.2', phase2.cov.join('/') === '88.8%/54.2%', phase2.cov.join('/'));
  check('决策条 预备 2,450 MW', phase2.banner2450);

  /* ---------- 2b. feat-011 历史视窗实时校准：跳历史段必须发真实查询，二次访问不重查 ---------- */
  sbRequests.length = 0;
  const liveBefore = await page.evaluate(() => window.ZL_DATA.liveHours.AEP);
  await page.evaluate(() => [...document.querySelectorAll('#extChips button')].find(b => b.textContent.includes('极地涡旋')).click());
  await page.waitForFunction(() => !document.getElementById('sbToast').classList.contains('on'), null, { timeout: 15000 });
  await sleep(600);
  const vortexQ = sbRequests.filter(u => u.includes('energy_hourly') && u.includes('AEP') && u.includes('2013-10')).length;
  const liveAfter = await page.evaluate(() => window.ZL_DATA.liveHours.AEP);
  check('跳极涡 → 真实查询生产库（2013-10 窗）', vortexQ >= 1, `${vortexQ} 请求`);
  check('实时校准标记增长', liveAfter > liveBefore, `liveHours ${liveBefore}→${liveAfter}`);
  check('极涡话术在实时校准后保持', await page.evaluate(() => document.getElementById('basisCmp').textContent.includes('17.02%') && document.getElementById('basisCmp').textContent.includes('23.14%')));
  /* feat-020 预测纪元分割：极涡窗（2014-01，纪元前）= 档案模式 */
  const preE = await page.evaluate(() => {
    const names = window.__zlCharts.mainC.getOption().series.map(s => s.name);
    const quad = [...document.querySelectorAll('#statusQuad .sq-l')].map(e => e.textContent.trim());
    return {
      noPred: !names.includes('持续学习 P50') && !names.includes('静态预测') && !names.includes('b90'),
      epochMark: !!document.querySelector('.filmEpoch'),
      quadArc: quad.some(t => t.includes('今日峰值 · 实际')),
      banner: document.getElementById('decisionBanner').textContent.includes('模型纪元'),
      basisRelabel: document.getElementById('basisCmp').textContent.includes('相似日基线'),
      godKept: names.includes('实际·后续') || !document.getElementById('godToggle'), /* 上帝视角数据线保留（若开） */
    };
  });
  check('纪元前：预测层全部隐藏（档案模式）', preE.noPred);
  check('胶片预测纪元分割标记（2016-01）', preE.epochMark);
  check('纪元前四格档案语义（今日峰值·实际）', preE.quadArc);
  check('纪元前决策条文案（无预测建议）', preE.banner);
  check('杀手锏话术改标：相似日基线（纪元前）', preE.basisRelabel);
  // 二次访问同一窗：不再重查
  sbRequests.length = 0;
  await page.locator('#bnBackLive').waitFor({ timeout: 5000 }); /* 防与 liveMerge 重渲竞态 */
  await page.evaluate(() => document.getElementById('bnBackLive').click());
  await sleep(900);
  await page.evaluate(() => [...document.querySelectorAll('#extChips button')].find(b => b.textContent.includes('极地涡旋')).click());
  await sleep(1500);
  const refetch = sbRequests.filter(u => u.includes('energy_hourly') && u.includes('AEP') && u.includes('2013-10')).length;
  check('二次访问已校准窗 → 零重查', refetch === 0, `${refetch} 请求`);
  await page.evaluate(() => document.getElementById('bnBackLive').click());
  await sleep(700);

  /* ---------- 3. 上帝视角退出（三入口） ---------- */
  await page.evaluate(() => [...document.querySelectorAll('#extChips button')].find(b => b.textContent.includes('极地涡旋')).click());
  await sleep(1400);
  const replay = await page.evaluate(() => ({
    chip: document.getElementById('modeChip').textContent,
    backBtn: !!document.getElementById('bnBackLive'),
    basis: document.getElementById('basisCmp').textContent.replace(/\s+/g, ' ').slice(0, 60),
  }));
  check('极涡重演 + ↩ 回到实时按钮', replay.chip.includes('重演') && replay.backBtn, replay.chip);
  check('杀手锏话术 17.02→23.14 落后', replay.basis.includes('17.02%') && replay.basis.includes('23.14%') && replay.basis.includes('落后'), replay.basis);
  // 3a. 决策条按钮
  await page.evaluate(() => document.getElementById('bnBackLive').click());
  await sleep(700);
  check('入口a 决策条按钮 → 实时', await page.evaluate(() => document.getElementById('modeChip').textContent) === '实时');
  // 3b. modeChip ✕
  await page.evaluate(() => [...document.querySelectorAll('#extChips button')].find(b => b.textContent.includes('极地涡旋')).click());
  await sleep(1200);
  await page.evaluate(() => document.getElementById('modeChip').click());
  await sleep(700);
  check('入口b 重演chip ✕ → 实时', await page.evaluate(() => document.getElementById('modeChip').textContent) === '实时');
  // 3c. optGod 关闭：主图「实际·后续」系列清空 + 决策条同步「关」
  await page.evaluate(() => [...document.querySelectorAll('#extChips button')].find(b => b.textContent.includes('极地涡旋')).click());
  await sleep(1200);
  const godLens = await page.evaluate(async () => {
    const len = () => {
      const inst = window.__zlCharts.mainC;
      const s = inst.getOption().series.find(x => x.name === '实际·后续');
      return s && s.data ? s.data.length : -1;
    };
    const before = len();
    document.getElementById('optBtn').click();
    await new Promise(r => setTimeout(r, 120));
    const g = document.getElementById('optGod');
    g.checked = false; g.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 500));
    const after = len();
    const banner = document.getElementById('decisionBanner').textContent.includes('上帝视角 关');
    g.checked = true; g.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    return { before, after, banner };
  });
  check('入口c 关上帝视角：点线移除', godLens.before > 0 && godLens.after === 0, `series ${godLens.before}→${godLens.after}`);
  check('入口c 决策条同步「上帝视角 关」', godLens.banner);
  await page.evaluate(() => document.getElementById('bnBackLive').click());
  await sleep(600);

  /* ---------- 4. 胶片磁吸：NOW 附近松手回实时；远处保持重演 ---------- */
  const magnet = await page.evaluate(async () => {
    const fw = document.getElementById('filmWrap');
    const r = fw.getBoundingClientRect();
    const T_MIN = Date.UTC(2004, 9, 1, 5), T_MAX = Date.UTC(2018, 7, 3, 9);
    const ev = (type, x) => fw.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: x, clientY: r.top + 10, isPrimary: true }));
    const raf2 = () => new Promise(rs => requestAnimationFrame(() => requestAnimationFrame(rs)));
    // 拖到最右端（NOW 区）松手
    ev('pointerdown', r.left + r.width * 0.3);
    ev('pointermove', r.right - 2);
    await raf2();
    ev('pointerup', r.right - 2);
    await new Promise(r2 => setTimeout(r2, 800));
    const near = document.getElementById('modeChip').textContent;
    // 拖到 2016 年（远离 NOW）松手
    ev('pointerdown', r.right - 2);
    const x2016 = r.left + (Date.UTC(2016, 5, 15) - T_MIN) / (T_MAX - T_MIN) * r.width;
    ev('pointermove', x2016);
    await raf2();
    ev('pointerup', x2016);
    await new Promise(r2 => setTimeout(r2, 900));
    const far = { chip: document.getElementById('modeChip').textContent, origin: document.getElementById('originDate').textContent.slice(0, 10) };
    document.getElementById('modeChip').click();
    await new Promise(r2 => setTimeout(r2, 500));
    return { near, far };
  });
  check('磁吸：拖到 NOW 区松手 → 实时', magnet.near === '实时', magnet.near);
  check('远处拖拽保持重演', magnet.far.chip.includes('重演') && magnet.far.origin.startsWith('2016/06'), `${magnet.far.chip} @${magnet.far.origin}`);

  /* ---------- 4b. feat-018 纪元门放开 + 持续学习分叉：2016-06 重演窗双轨真预测可见 ---------- */
  await page.evaluate(async () => {
    const fw = document.getElementById('filmWrap');
    const r = fw.getBoundingClientRect();
    const T_MIN = Date.UTC(2004, 9, 1, 5), T_MAX = Date.UTC(2018, 7, 3, 9);
    const ev = (type, x) => fw.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: x, clientY: r.top + 10, isPrimary: true }));
    const raf2 = () => new Promise(rs => requestAnimationFrame(() => requestAnimationFrame(rs)));
    const x = r.left + (Date.UTC(2016, 5, 15) - T_MIN) / (T_MAX - T_MIN) * r.width;
    ev('pointerdown', r.right - 2);
    ev('pointermove', x);
    await raf2();
    ev('pointerup', x);
  });
  await page.waitForFunction(() => !document.getElementById('sbToast').classList.contains('on'), null, { timeout: 20000 });
  await sleep(1200); /* 等 live 合并 → FC_CACHE 清 → 重渲 */
  const duotrack = await page.evaluate(() => {
    const opt = window.__zlCharts.mainC.getOption();
    const st = opt.series.find(s => s.name === '静态预测');
    const p50 = opt.series.find(s => s.name === '持续学习 P50');
    let diff = 0;
    if (st && p50) {
      const pm = new Map(p50.data.map(p => [p[0], p[1]]));
      for (const [ts, v] of st.data) { const pv = pm.get(ts); if (pv != null && Math.abs(pv - v) > 0.51) diff++ }
    }
    return { dyn: window.ZL_DATA.predDyn.AEP, stPts: st ? st.data.length : 0, diffPts: diff };
  });
  /* dyn>0 即门已放开铁证：快照不含 dyn 轨，2016-06（原纪元 2016-12 之前）的 dyn 数据只能来自实时查询；
     diffPts>0 = 静态对照线与学习线分叉，持续学习效果肉眼可见 */
  check('纪元门放开：2016-06 重演窗 dyn 轨入店', duotrack.dyn > 0, `predDyn.AEP=${duotrack.dyn}`);
  check('持续学习分叉：静态线偏离学习线', duotrack.stPts >= 40 && duotrack.diffPts > 0, JSON.stringify(duotrack));
  /* feat-022：整点对齐 + 重演视图 tooltip 必须有数据行（此前小数时戳致只剩时间头） */
  const dbox = await page.locator('#mainChart').boundingBox();
  await page.mouse.move(dbox.x + dbox.width * 0.6, dbox.y + dbox.height * 0.5);
  await sleep(700);
  const replayTip = await page.evaluate(() => ({
    originMin: document.getElementById('originDate').textContent.slice(11, 16),
    tip: ([...document.querySelectorAll('#mainChart div')].map(e => e.textContent).find(t => t && (t.includes('MW') || t.includes('°C'))) || '').replace(/\s+/g, ' ').slice(0, 90),
  }));
  check('重演视图 tooltip 有数据行（整点对齐修复）', replayTip.tip.includes('MW') || replayTip.tip.includes('°C'), replayTip.tip || '(无)');
  await page.evaluate(() => document.getElementById('bnBackLive').click());
  await sleep(600);

  /* ---------- 5. 离线：Supabase 不可达 → 保持快照可用 ---------- */
  await page.route('**supabase.co**', route => route.abort());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ZL_DATA && !document.getElementById('loader'), null, { timeout: 30000 });
  await sleep(9000); /* sbFetch 3 次重试退避 600+1200+1800ms 后才判定失败，等 catch 分支恢复徽章 */
  const offline = await page.evaluate(() => ({
    src: window.ZL_DATA.src,
    badge: document.getElementById('srcText').textContent,
    quad: [...document.querySelectorAll('#statusQuad .sq-v')].map(e => e.textContent.trim()),
  }));
  check('离线：保持快照模式可用', offline.src === 'snapshot' && offline.badge.includes('快照') && offline.quad[0] === '12,926MW', `${offline.src}/${offline.badge}`);
  await page.unrouteAll({ behavior: 'ignoreErrors' });

  /* ---------- 6. 三区 + console ---------- */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ZL_DATA && !document.getElementById('loader'), null, { timeout: 30000 });
  const zones = await page.evaluate(async () => {
    const out = {};
    for (const z of ['DAYTON', 'DOM']) {
      document.querySelector(`#zoneSeg button[data-zone="${z}"]`).click();
      /* 先等 renderAll 真正渲染到该区（zoneCap 由 renderAll 末尾更新），避免把上一区残值判稳 */
      for (let i = 0; i < 60 && !document.getElementById('zoneCap').textContent.startsWith(z); i++) {
        await new Promise(r => setTimeout(r, 200));
      }
      /* dyn 双轨合并异步且分批（切区实测：~2s 部分入店、~6.5s 全量并入 mape 才翻终值）——
         固定等 12s 再读，任何"稳定即读"窗口都会锁死 static 旧值（feat-023 重放完成后实测） */
      await new Promise(r => setTimeout(r, 12000));
      let last = '', stable = 0;
      for (let i = 0; i < 20; i++) {
        const m = document.getElementById('mapeVal').textContent;
        if (m === last && m !== '—') { stable++; if (stable >= 4) break } else stable = 0;
        last = m;
        await new Promise(r => setTimeout(r, 300));
      }
      out[z] = document.getElementById('mapeVal').textContent;
    }
    document.querySelector('#zoneSeg button[data-zone="AEP"]').click();
    await new Promise(r => setTimeout(r, 800));
    return out;
  });
  check('DAYTON MAPE 5.26', zones.DAYTON === '5.26%', zones.DAYTON);
  check('DOM MAPE 5.49', zones.DOM === '5.49%', zones.DOM);
  check('控制台零错误', consoleErrs.length === 0, consoleErrs.slice(0, 3).join(' ;; '));

  /* ---------- 7. feat-023 ChatBI：数据问答 ---------- */
  const chat7 = await page.evaluate(async () => {
    const out = {};
    out.btn = !!document.getElementById('chatBtn');
    document.getElementById('chatBtn').click();
    await new Promise(r => setTimeout(r, 150));
    out.open = document.getElementById('chatLayer').classList.contains('on');
    out.chips = document.querySelectorAll('#chatChips button').length;
    document.getElementById("calBtn").click(); /* 互斥：开口径弹层应关聊天 */
    await new Promise(r => setTimeout(r, 150));
    out.mutex = !document.getElementById('chatLayer').classList.contains('on');
    document.getElementById('chatBtn').click(); /* 重开并发送 → 降级气泡（dev 无 QWENPAW_URL） */
    await new Promise(r => setTimeout(r, 150));
    const inp = document.getElementById('chatInput');
    inp.value = '测试';
    document.getElementById('chatSend').click();
    await new Promise(r => setTimeout(r, 1500));
    out.afterSend = document.querySelectorAll('#chatLog .chat-msg').length >= 2
      && document.getElementById('chatLog').textContent.includes('未连接');
    document.getElementById("chatClose").click();
    await new Promise(r => setTimeout(r, 100));
    out.closed = !document.getElementById('chatLayer').classList.contains('on');
    out.route = await (await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'x', sessionId: 'v' }) })).status;
    return out;
  });
  check('ChatBI：悬浮按钮存在', chat7.btn === true);
  check('ChatBI：弹层可开', chat7.open === true);
  check('ChatBI：预设 chips 3 个', chat7.chips === 3, String(chat7.chips));
  check('ChatBI：与口径弹层互斥', chat7.mutex === true);
  check('ChatBI：发送→降级气泡（未连接）', chat7.afterSend === true);
  check('ChatBI：关闭按钮生效', chat7.closed === true);
  check('ChatBI：/api/chat 无 env 返回 503', chat7.route === 503, String(chat7.route));

  const failed = results.filter(r => !r.ok);
  console.log(`\n==== ${results.length - failed.length}/${results.length} 通过 ====`);
  process.exitCode = failed.length ? 1 : 0;
} finally {
  await browser.close();
}
