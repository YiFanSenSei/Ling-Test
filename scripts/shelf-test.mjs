/**
 * 书阁交互回归：拖动 vs 点击的边界
 *
 * `_dbg-click.mjs` 证明点击修好了，但那正是「拖动」最容易被改坏的时刻——
 * 阈值加错一点，拖动就失效；吞 click 的范围大一点，点书就失效。
 * 所以这里把四种情形一起测：
 *
 *   ① 微抖 3px 后松手  → 应视为「点击」，跳转生效
 *   ② 横拖 90px 后松手 → 应视为「拖动」，书架转了，且**不跳转**
 *   ③ 横拖 90px 且松手在某本书上 → 仍不跳转（吞 click 生效）
 *   ④ 键盘方向键        → 书架可转
 */
import path from 'node:path';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9407;
const BASE = 'http://localhost:4520/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.resolve('_shots/_chrome-reg-' + Date.now())}`,
  '--window-size=1440,1000', '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' });

async function wsurl() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await r.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chrome 调试端口未就绪');
}

const ws = new WebSocket(await wsurl(), { perMessageDeflate: false, maxPayload: 2e8 });
let id = 0;
const pend = new Map();
const send = (m, p = {}, sid) => new Promise((res, rej) => {
  const i = ++id;
  pend.set(i, { res, rej });
  ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId: sid }));
});
ws.on('message', raw => {
  const m = JSON.parse(raw.toString());
  if (m.id && pend.has(m.id)) {
    const { res, rej } = pend.get(m.id);
    pend.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  }
});
await new Promise(r => ws.on('open', r));

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await S('Page.enable');
await S('Runtime.enable');
await S('Network.enable');
await S('Network.setCacheDisabled', { cacheDisabled: true });
await S('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
});

const GALLERY = BASE + '#/gallery';
const gotoGallery = async () => {
  await S('Page.navigate', { url: GALLERY });
  await sleep(1600);
  await S('Page.navigate', { url: GALLERY });
  await sleep(1400);
};
await gotoGallery();

const ev = async e => {
  const r = await S('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + e);
  return r.result.value;
};

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✓' : '✗'} ${name}${detail === undefined ? '' : ' → ' + JSON.stringify(detail)}`);
};

const boxOf = async idx => JSON.parse(await ev(`
  JSON.stringify((() => {
    const el = document.querySelectorAll('.shelf-book')[${idx}];
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })())`));

const railTransform = () => ev(`getComputedStyle(document.getElementById('shelf-rail')).transform`);
const hash = () => ev(`window.location.hash`);

/* ---------- ① 微抖 3px，应视为点击 ---------- */
{
  await gotoGallery();
  const b = await boxOf(6);
  await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y });
  await S('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.x, y: b.y, button: 'left', clickCount: 1 });
  await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x + 3, y: b.y, button: 'left' });
  await S('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x + 3, y: b.y, button: 'left', clickCount: 1 });
  await sleep(1200);
  const h = await hash();
  check('① 微抖 3px 仍算点击并跳转', h.includes('category='), h);
}

/* ---------- ② 横拖 90px，书架应转、且不跳转 ---------- */
{
  await gotoGallery();
  const b = await boxOf(6);
  const t0 = await railTransform();
  await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y });
  await S('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.x, y: b.y, button: 'left', clickCount: 1 });
  for (let i = 1; i <= 6; i += 1) {
    await S('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x: b.x - i * 15, y: b.y, button: 'left',
    });
    await sleep(30);
  }
  await S('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x - 90, y: b.y, button: 'left', clickCount: 1 });
  await sleep(700);
  const t1 = await railTransform();
  const h = await hash();
  check('② 横拖后书架转动', t0 !== t1, { from: t0.slice(0, 34), to: t1.slice(0, 34) });
  check('② 横拖后不误跳转', !h.includes('category='), h);
}

/* ---------- ③ 拖动前先 hover 到书脊上，确认拖完不跳 ---------- */
{
  await gotoGallery();
  const b = await boxOf(3);
  await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y });
  await S('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.x, y: b.y, button: 'left', clickCount: 1 });
  await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x + 80, y: b.y + 2, button: 'left' });
  await sleep(60);
  await S('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x + 80, y: b.y + 2, button: 'left', clickCount: 1 });
  await sleep(900);
  const h = await hash();
  check('③ 从书脊上起手拖动不跳转', !h.includes('category='), h);
}

/* ---------- ④ 键盘方向键转动 ---------- */
{
  await gotoGallery();
  await ev(`document.getElementById('shelf-viewport').focus(); true;`);
  const t0 = await railTransform();
  await S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await S('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await sleep(700);
  const t1 = await railTransform();
  check('④ 方向键可转动书架', t0 !== t1, { from: t0.slice(0, 30), to: t1.slice(0, 30) });
}

/* ---------- ⑤ 回到名录页后再点，仍能跳（手柄没被吞状态卡死） ---------- */
{
  /*
   * 这里必须真的离开名录页再回来，不能只 Page.navigate 到同一个 #/gallery ——
   * 同一 URL 的 hash 导航不会重载文档，书架是上一轮那份 DOM，
   * 上一轮拖动留下的 suppressClick 与焦点也还在，测出来的失败是假的。
   */
  await S('Page.navigate', { url: BASE + '#/about' });
  await sleep(900);
  await gotoGallery();
  const b = await boxOf(1);
  await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y });
  await S('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.x, y: b.y, button: 'left', clickCount: 1 });
  await S('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', clickCount: 1 });
  await sleep(1200);
  const h = await hash();
  check('⑤ 重新进入后点击仍生效', h.includes('category='), h);
}

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
ws.close();
chrome.kill();
process.exit(failed.length ? 1 : 0);
