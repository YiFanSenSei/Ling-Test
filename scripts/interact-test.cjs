/**
 * 交互自测脚本
 *
 * 用 CDP 驱动 headless Chrome，真实模拟「鼠标拖拽刺绣 / 荡帘 / 拖木块」
 * 以及「点页签、点筛选、提交搜索」这些交互，再把结果报回来。
 *
 * 为什么必须做这一步：静态截图只能证明「页面能看」，
 * 不能证明「页面能用」。本站曾出现 init* 函数从未被调用的问题——
 * 页面全部正常渲染，但画布空白、筛选无效，截图完全看不出来。
 *
 * 运行：先 `vite preview --port 4520`，再 `node scripts/interact-test.cjs`
 */

const http = require('http');
const { spawn } = require('child_process');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const BASE = process.env.TEST_BASE || 'http://localhost:4520/';

function get(path) {
  return new Promise((res, rej) => {
    http.get(`http://127.0.0.1:${PORT}${path}`, r => {
      let b = '';
      r.on('data', d => (b += d));
      r.on('end', () => {
        try { res(JSON.parse(b || '{}')); } catch (e) { rej(e); }
      });
    }).on('error', rej);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-crashpad',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${process.env.TEMP}\\cr-cdp`,
    '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore' });

  for (let i = 0; i < 60; i++) {
    try { await get('/json/version'); break; } catch { await sleep(200); }
  }

  const targets = await get('/json/list');
  const page = targets.find(t => t.type === 'page');
  const WebSocket = (await import('ws')).default;
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0;
  const pending = new Map();

  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise(res => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await new Promise(r => ws.on('open', r));

  const evalJS = async expr => {
    const r = await send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true,
    });
    if (r.result?.exceptionDetails) return `ERR: ${r.result.exceptionDetails.text}`;
    return r.result?.result?.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');

  const R = {};

  /* ══════════ 苏绣 ══════════ */
  await send('Page.navigate', { url: BASE + '#/simulator' });
  await sleep(2600);

  // ⚠️ 必须先把画布滚进视口：headless 窗口 innerHeight 只有 746
  //    （不是 --window-size 里的 900），画布初始在 y=586~1248，
  //    直接按 rect 坐标派发鼠标事件会全部落在视口外，
  //    elementFromPoint 返回 null，探针捕获 0 个事件——看起来像程序坏了，
  //    其实是测试脚本自己在点空气。
  await evalJS(`document.getElementById('canvas-embroidery')?.scrollIntoView({block:'center'})`);
  await sleep(800);

  R.canvasSized = await evalJS(`(() => {
    const c = document.getElementById('canvas-embroidery');
    return c ? { w: c.width, h: c.height, cssW: c.dataset.w } : null;
  })()`);

  const box = await evalJS(`(() => {
    const c = document.getElementById('canvas-embroidery');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  })()`);

  if (box) {
    const x0 = box.x + box.w * 0.28, y0 = box.y + box.h * 0.38;
    const x1 = box.x + box.w * 0.72, y1 = box.y + box.h * 0.62;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1 });
    for (let i = 1; i <= 14; i++) {
      await send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: x0 + (x1 - x0) * i / 14,
        y: y0 + (y1 - y0) * i / 14,
        button: 'left', buttons: 1,
      });
      await sleep(16);
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', clickCount: 1 });
    await sleep(500);
  }

  R.stitchCount = await evalJS(`document.getElementById('stitch-count')?.textContent`);
  R.hintHidden = await evalJS(`document.getElementById('hint-embroidery')?.classList.contains('is-hidden')`);

  // 采样画布像素：底色是暖白，丝线明显更暗/更红
  R.inkRatio = await evalJS(`(() => {
    const c = document.getElementById('canvas-embroidery');
    if (!c) return null;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let ink = 0, total = 0;
    for (let i = 0; i < d.length; i += 4 * 97) {
      total++;
      if (d[i] < 190 || d[i+1] < 150 || d[i+2] < 120) ink++;
    }
    return +(ink / total).toFixed(4);
  })()`);

  await evalJS(`document.getElementById('undo-embroidery')?.click()`);
  await sleep(350);
  R.afterUndo = await evalJS(`document.getElementById('stitch-count')?.textContent`);

  await evalJS(`document.querySelector('[data-stitch="seed"]')?.click()`);
  await sleep(200);
  R.seedActive = await evalJS(`document.querySelector('[data-stitch="seed"]')?.classList.contains('is-active')`);

  // 换丝线颜色
  await evalJS(`document.querySelector('[data-thread="jade"]')?.click()`);
  await sleep(150);
  R.threadActive = await evalJS(`document.querySelector('[data-thread="jade"]')?.classList.contains('is-active')`);

  /* ══════════ 宣纸 ══════════ */
  await evalJS(`document.querySelector('[data-sim="paper"]')?.click()`);
  await sleep(1400);
  R.paperVisible = await evalJS(`!document.getElementById('panel-paper').hidden`);
  R.paperCanvas = await evalJS(`(() => {
    const c = document.getElementById('canvas-paper');
    return c ? { w: c.width, cssW: c.dataset.w } : null;
  })()`);
  R.paperStep = await evalJS(`document.querySelector('#paper-steps .step.is-active')?.dataset.step`);

  await evalJS(`document.getElementById('canvas-paper')?.scrollIntoView({block:'center'})`);
  await sleep(800);

  const pbox = await evalJS(`(() => {
    const c = document.getElementById('canvas-paper');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  })()`);

  if (pbox) {
    const cy = pbox.y + pbox.h / 2;
    const cx = pbox.x + pbox.w / 2;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
    for (let i = 0; i < 30; i++) {
      await send('Input.dispatchMouseEvent', {
        type: 'mouseMoved', x: cx + Math.sin(i / 2.4) * 140, y: cy,
        button: 'left', buttons: 1,
      });
      await sleep(16);
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
    await sleep(600);
  }
  R.paperGradeRank = await evalJS(`document.getElementById('grade-rank')?.textContent`);
  R.paperEven = await evalJS(`document.getElementById('grade-even')?.textContent`);

  /* ══════════ 榫卯 ══════════ */
  await evalJS(`document.querySelector('[data-sim="mortise"]')?.click()`);
  await sleep(1400);
  R.mortiseVisible = await evalJS(`!document.getElementById('panel-mortise').hidden`);
  R.mortiseCanvas = await evalJS(`(() => {
    const c = document.getElementById('canvas-mortise');
    return c ? { w: c.width, cssW: c.dataset.w } : null;
  })()`);

  await evalJS(`document.getElementById('auto-mortise')?.click()`);
  await sleep(2600);
  R.jointState = await evalJS(`document.getElementById('joint-state')?.textContent?.trim()`);
  R.jointOk = await evalJS(`document.getElementById('joint-state')?.classList.contains('is-ok')`);
  R.progress = await evalJS(`document.getElementById('joint-progress')?.style.width`);

  /* ══════════ 名录页 ══════════ */
  await send('Page.navigate', { url: BASE + '#/gallery' });
  await sleep(2600);
  R.galleryCount = await evalJS(`document.querySelector('.result-count strong')?.textContent`);
  R.galleryPage = await evalJS(`document.querySelector('.result-page')?.textContent?.trim()`);
  R.galleryCards = await evalJS(`document.querySelectorAll('.pcard').length`);

  await evalJS(`[...document.querySelectorAll('.filter-chips a')].find(a => a.textContent.trim() === '传统美术')?.click()`);
  await sleep(1600);
  R.filteredCount = await evalJS(`document.querySelector('.result-count strong')?.textContent`);
  R.filteredHash = await evalJS(`location.hash`);
  R.filteredCards = await evalJS(`document.querySelectorAll('.pcard').length`);

  await evalJS(`(() => {
    const f = document.getElementById('gallery-filters');
    if (!f) return;
    f.querySelector('#f-q').value = '苏绣';
    f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  })()`);
  await sleep(1600);
  R.searchCount = await evalJS(`document.querySelector('.result-count strong')?.textContent`);
  R.searchNames = await evalJS(`[...document.querySelectorAll('.pcard-name')].slice(0,5).map(e=>e.textContent)`);

  // 分页：点下一页
  await send('Page.navigate', { url: BASE + '#/gallery' });
  await sleep(2200);
  R.paginationExists = await evalJS(`!!document.querySelector('.pagination')`);
  await evalJS(`document.querySelector('.page-next')?.click()`);
  await sleep(1600);
  R.pageAfterNext = await evalJS(`document.querySelector('.result-page')?.textContent?.trim()`);

  /* ══════════ 项目详情页 ══════════ */
  await send('Page.navigate', { url: BASE + '#/project/13978' });
  await sleep(2200);
  R.projectTitle = await evalJS(`document.querySelector('.project-title')?.textContent`);
  R.projectInheritors = await evalJS(`document.querySelectorAll('.inheritor').length`);
  R.projectBirths = await evalJS(`[...document.querySelectorAll('.inheritor-birth')].slice(0,3).map(e=>e.textContent)`);
  R.projectArchive = await evalJS(`[...document.querySelectorAll('.archive-row dt')].map(e=>e.textContent)`);

  /* ══════════ 关于页目录 ══════════ */
  await send('Page.navigate', { url: BASE + '#/about' });
  await sleep(2200);
  R.tocButtons = await evalJS(`document.querySelectorAll('.toc-link').length`);
  R.tocHashBefore = await evalJS(`location.hash`);
  await evalJS(`document.querySelector('[data-toc="about-tech"]')?.click()`);
  await sleep(900);
  R.tocHashAfter = await evalJS(`location.hash`);
  R.tocScrolled = await evalJS(`window.scrollY > 200`);

  /* ══════════ 404 ══════════ */
  await send('Page.navigate', { url: BASE + '#/no-such-page' });
  await sleep(1800);
  R.notFound = await evalJS(`document.querySelector('.empty-state h3, .notfound h1')?.textContent`);
  R.notFoundHasHeader = await evalJS(`!!document.querySelector('.site-header')`);

  console.log(JSON.stringify(R, null, 2));

  ws.close();
  chrome.kill();
  process.exit(0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
