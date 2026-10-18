/**
 * 键盘操作实测（CDP 驱动）
 *
 * ⚠️ 这个脚本存在的理由：键盘操作是「加了几行 addEventListener」就能自称
 *    完成的那类功能——代码在那里，但按下去到底有没有反应，只有真按一次才知道。
 *    尤其 canvas 上的 keydown 很容易被 body 抢走（需要 tabindex + 焦点），
 *    或者被空格键的默认滚动行为顶掉。这些都必须用真实的 Input.dispatchKeyEvent 验证。
 *
 * 用法：先起 vite preview（端口 4520），再 node scripts/kbd-test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.TEST_BASE || 'http://localhost:4520/';
const PORT = Number(process.env.PORT || 9397);
const OUT = path.resolve('_shots/kbd');
fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-features=FocusedPageExemption',
  `--remote-debugging-port=${PORT}`,
  '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--hide-scrollbars',
  '--user-data-dir=' + path.resolve('_shots/_chrome-kbd'),
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

/** 发一次真实按键（按下 + 抬起）。code/key 都要给，页面里两种写法才都能命中 */
async function key(key, code, vk) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await sleep(60);
}

async function main() {
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
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
  });

  const results = [];

  await send('Page.navigate', { url: BASE + '#/simulator' });
  await sleep(2200);

  // CDP 驱动时 Chrome 认为「用户还没跟这个页面互动过」，
  // 于是把方向键/空格交给滚动而不是交给画布。
  // 先真实点一下页面空白处，把它转成「已交互」。
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 20, y: 100, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 20, y: 100, button: 'left', clickCount: 1 });
  await sleep(300);

  // 1) 画布可聚焦
  const focusable = await evalJS(`(() => {
    const c = document.getElementById('canvas-embroidery');
    if (!c) return null;
    c.focus();
    return { tabindex: c.getAttribute('tabindex'), role: c.getAttribute('role'),
             hasFocus: document.activeElement === c,
             outline: getComputedStyle(c).outlineWidth };
  })()`);
  results.push(['绣布画布可被 Tab 聚焦且拿到了焦点',
    !!focusable && focusable.tabindex === '0' && focusable.hasFocus === true, focusable]);

  // 2) 方向键移动光标不应报错、不应滚动页面
  const scrollBefore = await evalJS(`window.scrollY`);
  for (let i = 0; i < 4; i++) await key('ArrowRight', 'ArrowRight', 39);
  for (let i = 0; i < 3; i++) await key('ArrowDown', 'ArrowDown', 40);
  const scrollAfterKeys = await evalJS(`window.scrollY`);
  results.push(['方向键移动光标不带动页面滚动',
    scrollBefore === scrollAfterKeys, { before: scrollBefore, after: scrollAfterKeys }]);

  // 3) 空格落针
  await evalJS(`document.getElementById('canvas-embroidery').focus()`);
  const before = await evalJS(`document.getElementById('stitch-count').textContent`);
  await key(' ', 'Space', 32);
  const after = await evalJS(`document.getElementById('stitch-count').textContent`);
  results.push(['空格键能落一针',
    Number(after) === Number(before) + 1, { before, after }]);

  // 4) 连按空格绣出一片
  for (let i = 0; i < 6; i++) await key(' ', 'Space', 32);
  for (let i = 0; i < 6; i++) await key('ArrowRight', 'ArrowRight', 39);
  for (let i = 0; i < 3; i++) await key(' ', 'Space', 32);
  const many = await evalJS(`document.getElementById('stitch-count').textContent`);
  results.push(['连按空格与方向键可连续绣制',
    Number(many) >= 8, { count: many }]);

  await shot('01-kbd-stitched');

  // 5) aria-live 播报
  const live = await evalJS(`(() => {
    const el = document.getElementById('sr-stitch');
    if (!el) return null;
    return { text: el.textContent, role: el.getAttribute('role'), live: el.getAttribute('aria-live') };
  })()`);
  results.push(['屏幕阅读器收到进度播报',
    !!live && live.live === 'polite' && /已绣/.test(live.text), live]);

  // 6) Delete 撤销一针
  await key('Delete', 'Delete', 46);
  const afterDel = await evalJS(`document.getElementById('stitch-count').textContent`);
  results.push(['Delete 键能撤销一针',
    Number(afterDel) === Number(many) - 1, { before: many, after: afterDel }]);

  // 7) 键盘光标真的画出来了（画布上应出现朱砂色像素）
  const crimson = await evalJS(`(() => {
    const c = document.getElementById('canvas-embroidery');
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (r > 140 && r < 215 && g < 110 && b < 105) n++;
    }
    return n;
  })()`);
  results.push(['画布上有朱砂色像素（针脚或键盘光标）', crimson > 100, { crimsonPixels: crimson }]);

  // 8) 切到自由绣后方向键不报错（该模式下图纸为空）
  await evalJS(`document.querySelector('[data-template="free"]').click()`);
  await sleep(300);
  await evalJS(`document.getElementById('canvas-embroidery').focus()`);
  await key('ArrowRight', 'ArrowRight', 39);
  await key(' ', 'Space', 32);
  const freeOk = await evalJS(`!!document.getElementById('canvas-embroidery')`);
  results.push(['自由绣模式下按键不崩', freeOk === true, { alive: freeOk }]);

  // 9) 宣纸与榫卯画布也进了 Tab 顺序
  const others = await evalJS(`(() => {
    const p = document.getElementById('canvas-paper');
    const m = document.getElementById('canvas-mortise');
    return { paper: p && p.getAttribute('tabindex'), mortise: m && m.getAttribute('tabindex'),
             paperRole: p && p.getAttribute('role'), mortiseRole: m && m.getAttribute('role') };
  })()`);
  results.push(['宣纸与榫卯画布也可聚焦',
    others.paper === '0' && others.mortise === '0', others]);

  // 10) 全程无控制台异常
  const errs = await evalJS(`window.__kbdErrors ? window.__kbdErrors : []`);
  results.push(['无脚本异常', Array.isArray(errs) && errs.length === 0, errs]);

  console.log('\n=== 键盘操作实测 ===');
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
