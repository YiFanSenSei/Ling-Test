/**
 * 移动端触摸实测
 *
 * 为什么需要它：
 *   adapt-test.cjs 只测「有没有横向滚动条」，那是静态布局的判据。
 *   移动端加分项考的是**能不能用手操作**——三个模拟器都是 Canvas 拖拽，
 *   鼠标测试通过不等于手指能画。而且触屏有几个鼠标上没有的陷阱：
 *     1. touch-action 设错 → 手指划过去页面跟着滚，画不出线
 *     2. touch-action: none 设过头 → 手指在画布上划不出页面，被「困」住
 *     3. 多指同时落下 → 单例 dragging 状态被第二根手指改写，图形乱跳
 *     4. 点击目标太小 → 手指点不中
 *
 * 这里用 CDP 派发**真实 touch 事件**（不是模拟 mouse），逐项验证。
 * 目标不是「能拖动」，而是「用手指能做完这门手艺」。
 *
 * 运行：node scripts/mobile-test.mjs
 * 依赖：dist/index.html 已构建（走 file://，与评委双击一致）
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');

const ROOT = join(import.meta.dirname, '..');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.env.PORT || 9397);
const PROFILE = join(process.env.TEMP || '/tmp', 'jz_mobile');
const OUT = join(ROOT, '_shots', 'mobile');
const BASE = pathToFileURL(join(ROOT, 'dist', 'index.html')).href;

const DEVICE = { width: 390, height: 844, dpr: 3, label: '390×844 @3x（iPhone 12/13）' };

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(PROFILE, { recursive: true });
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--no-first-run', '--no-default-browser-check', '--disable-crashpad',
  '--allow-file-access-from-files', 'about:blank',
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  → ' + detail : ''}`);
};
const note = t => console.log(`     ${t}`);

async function main() {
  let target = null;
  for (let i = 0; i < 60; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json());
      target = list.find(t => t.type === 'page');
      if (target) break;
    } catch { /* 浏览器还没起来 */ }
    await sleep(300);
  }
  if (!target) throw new Error('找不到可调试的页面');

  ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  ws.on('message', raw => {
    const m = JSON.parse(raw.toString());
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    }
  });

  const evalJS = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return 'ERR: ' + r.exceptionDetails.text;
    return r.result?.value;
  };
  const shot = async name => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    if (r.data) writeFileSync(join(OUT, name + '.png'), Buffer.from(r.data, 'base64'));
  };
  const numOf = async sel => {
    const t = await evalJS(`String(document.querySelector(${JSON.stringify(sel)})?.textContent || '0').replace(/\\D/g, '')`);
    return Number(t) || 0;
  };
  const rectOf = async sel => JSON.parse(await evalJS(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return 'null';
    el.scrollIntoView({ block: 'center' });
    const b = el.getBoundingClientRect();
    return JSON.stringify({ x: b.x, y: b.y, w: b.width, h: b.height });
  })()`) || 'null');
  /** 画布像素签名：用来独立于任何 UI 文案判断「画面变没变」 */
  const canvasSig = async sel => evalJS(`(() => {
    const c = document.querySelector(${JSON.stringify(sel)});
    if (!c) return '';
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 400) h = (h * 31 + d[i]) >>> 0;
    return String(h);
  })()`);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: DEVICE.width, height: DEVICE.height, deviceScaleFactor: DEVICE.dpr, mobile: true,
  });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  console.log(`\n=== 移动端触摸实测：${DEVICE.label} ===\n`);

  /** 真实触摸拖拽：按住 → 分步移动 → 抬起 */
  const touchDrag = async (from, to, steps = 12, holdMs = 30) => {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, id: 1 }] });
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, id: 1 }],
      });
      await sleep(holdMs);
    }
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(250);
  };

  /**
   * 真实手指点按。
   *
   * 为什么要单独写一个而不是用 touchDrag(from, from)：
   * 浏览器给「点按」和「拖拽」派发的事件序列不同——
   * click 只有在 touchStart 与 touchEnd 之间**没有移动**时才会合成出来。
   * 用拖拽函数点按钮，touchMove 会把 click 吃掉，按钮看起来点不动。
   */
  const tapAt = async (x, y) => {
    const pt = { x: Math.round(x), y: Math.round(y), id: 1 };
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] });
    await sleep(60);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(120);
  };

  await send('Page.navigate', { url: BASE });
  await sleep(4000);

  /* ---------- 1. 苏绣：手指能不能真的绣出东西 ----------------------------- */
  console.log('[1] 苏绣 · 平针');
  await evalJS(`location.hash = "#/simulator?tool=embroidery"`);
  await sleep(1800);
  const emb = await rectOf('#canvas-embroidery');
  console.log(`  画布 ${Math.round(emb.w)}×${Math.round(emb.h)} CSS px`);
  const embSig0 = await canvasSig('#canvas-embroidery');
  await touchDrag(
    { x: emb.x + emb.w * 0.22, y: emb.y + emb.h * 0.38 },
    { x: emb.x + emb.w * 0.72, y: emb.y + emb.h * 0.55 },
    14
  );
  const stitched = await numOf('#stitch-count');
  const embSig1 = await canvasSig('#canvas-embroidery');
  check('苏绣：手指拖拽能落针', stitched > 0, `已绣 ${stitched} 针`);
  check('苏绣：画面确实被改动', embSig0 !== embSig1);
  await shot('1-embroidery-touch');

  // 撤销按钮也要能点
  await evalJS(`document.getElementById('undo-embroidery')?.click()`);
  await sleep(400);
  const afterUndo = await numOf('#stitch-count');
  check('苏绣：撤销按钮可用', afterUndo < stitched, `${stitched} → ${afterUndo} 针`);

  /* ---------- 2. 宣纸：手指能不能荡帘并拿到品级 --------------------------- */
  console.log('\n[2] 宣纸 · 荡帘');
  await evalJS(`location.hash = "#/simulator?tool=paper"`);
  await sleep(1800);
  const ppr = await rectOf('#canvas-paper');
  console.log(`  画布 ${Math.round(ppr.w)}×${Math.round(ppr.h)} CSS px`);
  // 横向来回荡：起点在左，先荡到右再荡回左
  await touchDrag(
    { x: ppr.x + ppr.w * 0.15, y: ppr.y + ppr.h * 0.55 },
    { x: ppr.x + ppr.w * 0.85, y: ppr.y + ppr.h * 0.55 },
    10, 45
  );
  await touchDrag(
    { x: ppr.x + ppr.w * 0.85, y: ppr.y + ppr.h * 0.55 },
    { x: ppr.x + ppr.w * 0.15, y: ppr.y + ppr.h * 0.55 },
    10, 45
  );
  const even = await evalJS(`document.getElementById('grade-even')?.textContent?.trim() || ''`);
  const evenScore = Number(String(even).replace(/\D/g, '')) || 0;
  check('宣纸：手指拖拽能荡帘并评分', evenScore > 0, `匀度 ${even || '（空）'}`);
  await shot('2-paper-touch');

  /* ---------- 3. 榫卯：手指能不能把构件装到位 ----------------------------- */
  console.log('\n[3] 榫卯 · 燕尾榫');
  await evalJS(`location.hash = "#/simulator?tool=mortise"`);
  await sleep(1800);
  const mor = await rectOf('#canvas-mortise');
  console.log(`  画布 ${Math.round(mor.w)}×${Math.round(mor.h)} CSS px`);

  // 构件初始偏移是 (0.3W, 0.06H)，相对目标位。要装进去就得反向拖同样距离。
  const seatDx = -mor.w * 0.30;
  const seatDy = -mor.h * 0.06;
  const morSig0 = await canvasSig('#canvas-mortise');
  await touchDrag(
    { x: mor.x + mor.w * 0.62, y: mor.y + mor.h * 0.42 },
    { x: mor.x + mor.w * 0.62 + seatDx, y: mor.y + mor.h * 0.42 + seatDy },
    16, 35
  );
  const morSig1 = await canvasSig('#canvas-mortise');
  check('榫卯：手指拖拽能移动构件', morSig0 !== morSig1);
  const jState = await evalJS(`document.getElementById('joint-state')?.textContent?.trim() || ''`);
  const jProg = await evalJS(`document.getElementById('joint-progress')?.style?.width || '0%'`);
  check('榫卯：手指能把构件装到位', /咬合/.test(jState), `状态「${jState}」完成度 ${jProg}`);
  await shot('3-mortise-touch');

  /* ---------- 4. 触摸陷阱：画布会不会「困住」页面滚动 -------------------- */
  console.log('\n[4] 滚动行为');
  await evalJS(`window.scrollTo(0, 0)`);
  await sleep(400);
  const docH = await evalJS(`document.documentElement.scrollHeight`);
  const viewH = await evalJS(`window.innerHeight`);
  check('体验页在手机上可竖向滚动', docH > viewH, `文档高 ${docH} / 视口 ${viewH}`);

  // 注意：上面的 mor 是在 scrollTo(0,0) 之前量的，位置已经变了，必须重量。
  // 而且要先滚进视口、再用 elementFromPoint 确认落点真的在画布上，
  // 否则 elementFromPoint 会返回 null（点落在视口外），测的是空气。
  await evalJS(`document.getElementById('canvas-mortise')?.scrollIntoView({block:'center'})`);
  await sleep(700);
  const morNow = JSON.parse(await evalJS(`(() => {
    const c = document.querySelector('#canvas-mortise');
    if (!c) return 'null';
    const b = c.getBoundingClientRect();
    const cx = b.x + b.width * 0.5;
    const cy = b.y + b.height * 0.7;
    const hit = document.elementFromPoint(cx, cy);
    return JSON.stringify({ x: cx, y: cy, w: b.width, h: b.height, hit: hit ? (hit.id || hit.className) : null });
  })()`) || 'null');

  if (morNow && morNow.hit === 'canvas-mortise') {
    const sBefore = await evalJS(`window.scrollY`);
    await touchDrag({ x: morNow.x, y: morNow.y }, { x: morNow.x, y: morNow.y - 160 }, 8, 35);
    const sCanvas = await evalJS(`window.scrollY`);
    check('画布上的手势用于绘画，不劫持页面滚动',
      Math.abs(sCanvas - sBefore) < 8, `scrollY ${sBefore} → ${sCanvas}`);
  } else {
    check('画布上的手势用于绘画，不劫持页面滚动', false,
      `落点不在画布上（命中 ${morNow ? morNow.hit : '无'}），本项未能测得`);
  }

  // 关键：画布之外的区域必须能滚出去，否则用户会被画布困住。
  // 滚到知识卡区域取点——那里确定没有被画布覆盖。
  const outside = JSON.parse(await evalJS(`(() => {
    const el = document.querySelector('.knowledge-grid') || document.querySelector('.sim-knowledge');
    if (!el) return 'null';
    el.scrollIntoView({ block: 'center' });
    const b = el.getBoundingClientRect();
    const x = b.x + b.width * 0.5;
    const y = b.y + b.height * 0.5;
    const hit = document.elementFromPoint(x, y);
    return JSON.stringify({ x, y, hit: hit ? (hit.id || hit.className || hit.tagName) : null });
  })()`) || 'null');

  if (outside && outside.hit && outside.hit !== 'canvas-mortise' && !/canvas/.test(outside.hit)) {
    const sb = await evalJS(`window.scrollY`);
    await touchDrag({ x: outside.x, y: outside.y }, { x: outside.x, y: outside.y - 300 }, 10, 30);
    await sleep(500);
    const sa = await evalJS(`window.scrollY`);
    check('画布之外可以正常滚动页面（不会被画布困住）', sa !== sb, `scrollY ${sb} → ${sa}`);
  } else {
    check('画布之外可以正常滚动页面（不会被画布困住）', false,
      `找不到确定在画布外的落点（命中 ${outside ? outside.hit : '无'}）`);
  }

  /* ---------- 5. 多指：第二根手指不应接管画线 ---------------------------- */
  console.log('\n[5] 多指误触');
  await evalJS(`location.hash = "#/simulator?tool=embroidery"`);
  await sleep(1800);
  const e2 = await rectOf('#canvas-embroidery');
  // 先只有一根手指，画一小段
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: e2.x + e2.w * 0.3, y: e2.y + e2.h * 0.6, id: 1 }] });
  for (let i = 1; i <= 6; i++) {
    await send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: e2.x + e2.w * 0.3 + i * 12, y: e2.y + e2.h * 0.6 + i * 3, id: 1 }],
    });
    await sleep(45);
  }
  const sigSingle = await canvasSig('#canvas-embroidery');
  // 第二根手指落在画布右上角远处，并拖动它
  await send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: e2.x + e2.w * 0.3 + 72, y: e2.y + e2.h * 0.6 + 18, id: 1 },
      { x: e2.x + e2.w * 0.85, y: e2.y + e2.h * 0.12, id: 2 },
    ],
  });
  await sleep(120);
  for (let i = 1; i <= 6; i++) {
    await send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: e2.x + e2.w * 0.3 + 72, y: e2.y + e2.h * 0.6 + 18, id: 1 },   // 手指 1 不动
        { x: e2.x + e2.w * 0.85 - i * 6, y: e2.y + e2.h * 0.12 + i * 5, id: 2 }, // 手指 2 在动
      ],
    });
    await sleep(45);
  }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(400);
  const sigMulti = await canvasSig('#canvas-embroidery');

  // 判断依据：手指 2 的轨迹在画布右上角，手指 1 的线在中偏左。
  // 若第二根手指接管了，画布右上角会出现针脚。
  const cornerInk = await evalJS(`(() => {
    const c = document.querySelector('#canvas-embroidery');
    const g = c.getContext('2d');
    // 取画布右上角 1/4 区域
    const w = Math.round(c.width * 0.25), h = Math.round(c.height * 0.25);
    const d = g.getImageData(c.width - w, 0, w, h).data;
    let ink = 0;
    for (let i = 0; i < d.length; i += 40) if (d[i + 3] > 0 && d[i] < 150) ink++;
    return ink;
  })()`);
  check('多指：第二根手指未把针脚画到远处', cornerInk === 0,
    cornerInk === 0 ? '画布右上角无针脚' : `右上角出现 ${cornerInk} 处针脚（被第二根手指接管）`);
  if (cornerInk !== 0) note('这是单例 dragging 状态未按 pointerId 区分的典型症状');
  await shot('4-multitouch');

  /* ---------- 6. 点击目标尺寸（44px 是通用下限，这里放宽到 36） ----------- */
  console.log('\n[6] 触摸目标');
  const tapRaw = await evalJS(`(() => {
    const bad = [];
    const sel = 'button, a.btn, .tag-btn, .sim-tab, .tool-opt, .thread, [data-tool], [data-joint], .toc-link';
    const all = [...document.querySelectorAll(sel)];
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 36) bad.push({ c: String(el.className).slice(0, 36) || el.tagName, h: Math.round(r.height), t: (el.textContent || '').trim().slice(0, 12) });
    }
    return JSON.stringify({ total: all.length, bad });
  })()`);
  const tap = JSON.parse(tapRaw);
  check('可点元素的触摸高度 ≥ 36px', tap.bad.length === 0,
    tap.bad.length ? `${tap.bad.length}/${tap.total} 个偏小：` + tap.bad.map(b => `${b.c}"${b.t}"(${b.h}px)`).join(' ') : `${tap.total} 个全部达标`);

  /* ---------- 7. 各页面移动端横向溢出复查 -------------------------------- */
  console.log('\n[7] 横向溢出');
  for (const pg of [
    { k: '首页', h: '#/' }, { k: '名录', h: '#/gallery' },
    { k: '传承人', h: '#/inheritors' }, { k: '档案', h: '#/project/13978' },
    { k: '关于', h: '#/about' }, { k: '体验', h: '#/simulator' },
  ]) {
    await evalJS(`location.hash = "${pg.h}"`);
    await sleep(1500);
    const o = JSON.parse(await evalJS(`(() => {
      const de = document.documentElement;
      return JSON.stringify({ over: de.scrollWidth - de.clientWidth, sw: de.scrollWidth, cw: de.clientWidth });
    })()`));
    check(`移动端横向溢出：${pg.k}`, o.over <= 1, `${o.sw}/${o.cw}`);
  }
  await evalJS(`location.hash = "#/"`);
  await sleep(1600);
  await shot('5-home-mobile');

  /* ---------- 8. 汉堡菜单：手机上唯一能用的导航 ---------------------------
   *
   * 桌面端靠横向导航栏，390 宽下被 CSS 隐藏，只剩这个按钮。
   * 它一旦点不开，手机上除了直接改地址就哪儿也去不了。
   * 前面 1–7 组测的全是「页面内容」，这一组测「能不能到达页面」，
   * 是最该测也最容易漏的一项。
   */
  console.log('\n[8] 汉堡菜单');
  await evalJS(`location.hash = "#/"`);
  await sleep(1500);

  const initial = JSON.parse(await evalJS(`(() => {
    const t = document.querySelector('#nav-toggle');
    const d = document.querySelector('#site-nav-drawer');
    if (!t || !d) return JSON.stringify({ missing: true });
    const r = t.getBoundingClientRect();
    return JSON.stringify({
      w: Math.round(r.width), h: Math.round(r.height),
      x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
      hidden: d.hidden, expanded: t.getAttribute('aria-expanded'),
    });
  })()`));

  check('菜单按钮存在且可见', !initial.missing && initial.w > 0 && initial.h > 0,
    initial.missing ? '找不到 #nav-toggle / #site-nav-drawer' : `${initial.w}×${initial.h}`);
  // 手机上它是唯一导航入口，按 44px 标准要求（其余元素的门槛是 36px）
  check('菜单按钮达到 44px 标准', initial.w >= 44 && initial.h >= 44, `${initial.w}×${initial.h}`);
  check('菜单初始是收起的', initial.hidden === true && initial.expanded === 'false',
    `hidden=${initial.hidden} aria-expanded=${initial.expanded}`);

  await tapAt(initial.x, initial.y);
  await sleep(700);

  const opened = JSON.parse(await evalJS(`(() => {
    const t = document.querySelector('#nav-toggle');
    const d = document.querySelector('#site-nav-drawer');
    const links = [...d.querySelectorAll('a')];
    return JSON.stringify({
      hidden: d.hidden, expanded: t.getAttribute('aria-expanded'),
      locked: document.body.classList.contains('nav-open'),
      n: links.length,
      labels: links.map(a => a.textContent.trim().replace(/\\s+/g, '')),
      minH: links.length ? Math.min(...links.map(a => Math.round(a.getBoundingClientRect().height))) : 0,
    });
  })()`));

  check('手指点一下能展开', opened.hidden === false && opened.expanded === 'true',
    `hidden=${opened.hidden} aria-expanded=${opened.expanded}`);
  check('展开时锁住页面滚动', opened.locked === true, `body.nav-open=${opened.locked}`);
  check('菜单项齐全', opened.n >= 5, `${opened.n} 项：${opened.labels.join(' / ')}`);
  check('菜单项触摸目标达标', opened.minH >= 36, `最小 ${opened.minH}px`);

  await shot('6-drawer-open');

  // 点「传承人」应该真的跳过去，并且菜单自己收起来
  const link = await evalJS(`(() => {
    const d = document.querySelector('#site-nav-drawer');
    const a = [...d.querySelectorAll('a')].find(x => (x.getAttribute('href') || '').includes('/inheritors'));
    if (!a) return null;
    const r = a.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
  })()`);

  if (link) {
    const lp = JSON.parse(link);
    await tapAt(lp.x, lp.y);
    await sleep(1800);
    const after = JSON.parse(await evalJS(`(() => {
      const d = document.querySelector('#site-nav-drawer');
      return JSON.stringify({
        hash: location.hash, hidden: d.hidden,
        locked: document.body.classList.contains('nav-open'),
        count: (document.querySelector('.result-count') || {}).textContent || '',
      });
    })()`));
    check('点菜单项真的跳转', after.hash.includes('/inheritors'), `hash=${after.hash}`);
    check('跳转后菜单自动收起', after.hidden === true, `hidden=${after.hidden}`);
    // 若跳走了但 body 还留着 nav-open，整页会滚不动——看起来像卡死
    check('跳转后不残留滚动锁', after.locked === false, `body.nav-open=${after.locked}`);
    check('跳转后页面内容正确', after.count.includes('传承人'), after.count.replace(/\s+/g, ''));
  } else {
    check('点菜单项真的跳转', false, '菜单里没找到传承人链接');
  }

  /* ---------- 汇总 ------------------------------------------------------ */
  console.log('\n' + '='.repeat(62));
  const failed = results.filter(r => !r.ok);
  console.log(`共 ${results.length} 项，通过 ${results.length - failed.length} 项，失败 ${failed.length} 项`);
  if (failed.length) {
    console.log('\n失败项：');
    failed.forEach(f => console.log(`  ✗ ${f.name}${f.detail ? ' → ' + f.detail : ''}`));
  }
  console.log(`截图目录：${OUT}`);

  ws.close();
  chrome.kill();
  process.exit(failed.length ? 2 : 0);
}

main().catch(e => { console.error('FAIL', e); try { chrome.kill(); } catch {} process.exit(1); });
