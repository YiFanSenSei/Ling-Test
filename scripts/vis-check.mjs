/**
 * 视觉核查截图（CDP 驱动）
 *
 * ⚠️ 这个脚本存在的理由：本项目出过至少三次
 *    「测试全绿、页面照样塌」的事故——
 *    · init* 函数没被调用，画布永远是空白
 *    · .page-title 等 5 个类根本没有 CSS 规则
 *    · 地区折叠只有 JS 没有 CSS，按钮点了没反应
 *    这几类问题断言查 textContent 全都查不出来，只有截图能看见。
 *    所以每次改样式都必须跑一遍这个脚本，人眼过一遍图。
 *
 * 用法：先起 vite preview（端口 4520），再 node scripts/vis-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.TEST_BASE || 'http://localhost:4520/';
const PORT = Number(process.env.PORT || 9371);
const OUT = path.resolve('_shots/vis');
fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--hide-scrollbars',
  '--user-data-dir=' + path.resolve('_shots/_chrome-vis'),
  'about:blank',
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++msgId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});

const evalJS = async expr => {
  const r = await send('Runtime.evaluate', {
    expression: expr, awaitPromise: true, returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + expr.slice(0, 80));
  return r.result.value;
};

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
}

async function goto(hash, wait = 1400) {
  await send('Page.navigate', { url: BASE + '#' + hash });
  await sleep(wait);
}

async function main() {
  // 等 Chrome 起来
  let target = null;
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json());
      target = list.find(t => t.type === 'page');
      if (target) break;
    } catch { /* not ready */ }
    await sleep(250);
  }
  if (!target) throw new Error('Chrome 未就绪');

  ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 512 * 1024 * 1024 });
  await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
  ws.on('message', raw => {
    const m = JSON.parse(raw.toString());
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(JSON.stringify(m.error)));
      else resolve(m.result);
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');

  /* ---------------- 关键断言：样式是否真的落地 ---------------- */
  const results = [];

  // 1) 页面头：传承人页 / 年龄页曾经完全没有样式
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  await goto('/inheritors', 1800);
  const inh = await evalJS(`(() => {
    const t = document.querySelector('.page-title');
    const idx = document.querySelector('.page-idx');
    if (!t) return { ok: false, why: 'no .page-title' };
    const cs = getComputedStyle(t);
    const ci = idx ? getComputedStyle(idx) : null;
    return {
      title: t.textContent.trim(),
      fontFamily: cs.fontFamily.split(',')[0],
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      isSerif: cs.fontFamily.includes('Serif') || cs.fontFamily.includes('Song') || cs.fontFamily.includes('SimSun'),
      idxColor: ci ? ci.color : null,
      idxOpacity: ci ? ci.opacity : null,
    };
  })()`);
  results.push(['传承人页 .page-title 有衬线样式', inh.isSerif === true, inh]);
  await shot('01-inheritors-1440');

  // 2) 序号与标题基线对齐（.section-title 改成 baseline）
  await goto('/gallery', 1600);
  const base = await evalJS(`(() => {
    const n = document.querySelector('.section-num');
    const h = document.querySelector('.section-head h2');
    if (!n || !h) return null;
    const rn = n.getBoundingClientRect();
    const rh = h.getBoundingClientRect();
    return { numBottom: Math.round(rn.bottom), headBottom: Math.round(rh.bottom),
             delta: Math.round(rh.bottom - rn.bottom), align: getComputedStyle(n.parentElement).alignItems };
  })()`);
  results.push(['序号标题基线对齐 align-items=baseline', base && base.align === 'baseline', base]);

  // 3) 地区折叠：默认折叠、点开展开、高度变化
  const fold = await evalJS(`(() => {
    const box = document.getElementById('region-chips');
    const more = document.getElementById('region-more');
    if (!box || !more) return { ok: false, why: 'no region-chips/region-more' };
    const extra = box.querySelectorAll('.tag-btn--extra');
    const visibleBefore = [...extra].filter(e => getComputedStyle(e).display !== 'none').length;
    const hBefore = box.getBoundingClientRect().height;
    const btnStyle = getComputedStyle(more);
    return {
      collapsed: box.classList.contains('is-collapsed'),
      extraCount: extra.length,
      visibleBefore,
      heightBefore: Math.round(hBefore),
      btnDisplay: btnStyle.display,
      btnRadius: btnStyle.borderRadius,
      btnBg: btnStyle.backgroundColor,
      btnCursor: btnStyle.cursor,
    };
  })()`);
  results.push(['地区默认折叠，多余项不显示', fold.collapsed === true && fold.visibleBefore === 0, fold]);
  // 注意：带 gap 的按钮会被浏览器算成 flex 而非 inline-flex，别拿 display 的精确值断言。
  // 该查的是「它到底长成什么样」：圆角是不是胶囊、底色是不是被显式设定过、有没有指针光标。
  results.push(['「展开全部」是胶囊按钮不是浏览器默认灰钮',
    !!fold && fold.btnRadius === '100px' && fold.btnCursor === 'pointer' && fold.btnBg !== '',
    fold && { radius: fold.btnRadius, cursor: fold.btnCursor, bg: fold.btnBg }]);
  await shot('02-gallery-collapsed');

  // 点开
  await evalJS(`document.getElementById('region-more').click()`);
  await sleep(400);
  const expanded = await evalJS(`(() => {
    const box = document.getElementById('region-chips');
    const extra = box.querySelectorAll('.tag-btn--extra');
    return {
      collapsed: box.classList.contains('is-collapsed'),
      visible: [...extra].filter(e => getComputedStyle(e).display !== 'none').length,
      height: Math.round(box.getBoundingClientRect().height),
      label: document.querySelector('.filter-more-label').textContent.trim(),
      ariaExpanded: document.getElementById('region-more').getAttribute('aria-expanded'),
    };
  })()`);
  results.push(['点「展开全部」后地区真的展开', expanded.collapsed === false && expanded.visible > 0, expanded]);
  await shot('03-gallery-expanded');

  // 4) 对比度修复：--ink-faint 是否真的变成 #6B655C
  const token = await evalJS(`(() => {
    const v = getComputedStyle(document.documentElement);
    return { faint: v.getPropertyValue('--ink-faint').trim(),
             goldInk: v.getPropertyValue('--gold-ink').trim(),
             decor: v.getPropertyValue('--ink-decor').trim() };
  })()`);
  results.push(['--ink-faint 已改为 #6B655C', token.faint.toLowerCase() === '#6b655c', token]);

  // 5) 大屏断点：1920 下卡片 5 列
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false,
  });
  await goto('/gallery', 1600);
  const wide = await evalJS(`(() => {
    const g = document.querySelector('.card-grid');
    const c = document.querySelector('.container');
    const cs = g ? getComputedStyle(g) : null;
    return {
      cols: cs ? cs.gridTemplateColumns.split(' ').length : 0,
      gridCols: cs ? cs.gridTemplateColumns : null,
      maxw: c ? getComputedStyle(c).maxWidth : null,
    };
  })()`);
  results.push(['1920 下卡片栅格 5 列', wide.cols === 5, wide]);
  results.push(['1920 下内容框放宽到 1440', wide.maxw === '1440px', wide]);
  await shot('04-gallery-1920');

  // 6) 首页三规格
  for (const [w, h, tag] of [[1440, 900, '05-home-1440'], [1920, 1080, '06-home-1920']]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: w, height: h, deviceScaleFactor: 1, mobile: false,
    });
    await goto('/', 1800);
    await shot(tag);
  }

  // 7) 手机 390：hero-facts 应三列并排而不是竖排
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
  });
  await goto('/', 1800);
  const m = await evalJS(`(() => {
    const f = document.querySelector('.hero-facts');
    if (!f) return null;
    const cs = getComputedStyle(f);
    return { cols: cs.gridTemplateColumns.split(' ').length, height: Math.round(f.getBoundingClientRect().height),
             scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth };
  })()`);
  results.push(['390 下首屏三列统计并排', m && m.cols === 3, m]);
  results.push(['390 无横向溢出', m && m.scrollW <= m.clientW + 1, m]);
  await shot('07-home-390');

  // 8) 年龄页与关于页
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  await goto('/ages', 1800);
  await shot('08-ages-1440');
  await goto('/about', 1600);
  await shot('09-about-1440');

  // 9) 模拟器选中态（朱砂而非墨块）
  await goto('/simulator', 2000);
  const active = await evalJS(`(() => {
    const o = document.querySelector('.tool-opt.is-active');
    if (!o) return null;
    const cs = getComputedStyle(o);
    return { bg: cs.backgroundColor, border: cs.borderColor, shadow: cs.boxShadow };
  })()`);
  results.push(['模拟器选中项是朱砂描边而非墨块', !!(active && active.border.includes('178, 58, 46')), active]);
  await shot('10-simulator-1440');

  // 10) 404
  await goto('/no-such-page', 1200);
  await shot('11-404');

  /* ---------------- 输出 ---------------- */
  console.log('\n=== 视觉核查 ===');
  let pass = 0;
  for (const [name, ok, detail] of results) {
    console.log(`${ok ? '✓' : '✗'} ${name}`);
    if (detail) console.log('    ' + JSON.stringify(detail));
    if (ok) pass++;
  }
  console.log(`\n${pass}/${results.length} 通过`);
  console.log(`截图：${OUT}`);

  ws.close();
  chrome.kill();
  process.exit(pass === results.length ? 0 : 1);
}

main().catch(e => { console.error(e); try { chrome.kill(); } catch {} process.exit(1); });
