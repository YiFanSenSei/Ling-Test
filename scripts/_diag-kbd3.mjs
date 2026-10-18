/**
 * 键盘帧诊断：鼠标交互会不会让画布失去焦点？
 * 用法：先起 vite preview（端口 4520），再 node scripts/_diag-kbd3.mjs
 */
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.TEST_BASE || 'http://localhost:4520/';
const PORT = 9398;

const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
  '--user-data-dir=' + path.resolve('_shots/_chrome-kbd3'), 'about:blank',
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++msgId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evalJS = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + expr.slice(0, 80));
  return r.result.value;
};
async function key(k, code, vk) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await sleep(80);
}

async function main() {
  let target = null;
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json());
      target = list.find(t => t.type === 'page');
      if (target) break;
    } catch {}
    await sleep(250);
  }
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE + '#/simulator' });
  await sleep(2400);

  // 在 document 捕获阶段记录所有 keydown/pointerdown/focusin
  await evalJS(`
    window.__log = [];
    document.addEventListener('keydown', e => window.__log.push({ t: 'key', key: e.key,
      active: document.activeElement && document.activeElement.id,
      prevented: e.defaultPrevented }), true);
    document.addEventListener('pointerdown', e => window.__log.push({ t: 'pointer',
      target: e.target && (e.target.id || e.target.className) }), true);
    document.addEventListener('focusin', e => window.__log.push({ t: 'focusin',
      id: e.target && e.target.id }), true);
    document.addEventListener('focusout', e => window.__log.push({ t: 'focusout',
      id: e.target && e.target.id }), true);
  `);

  // 复刻 kbd-test 的完整前置：切 deviceMetricsOverride → navigate → 模拟一次真实点击
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 20, y: 100, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 20, y: 100, button: 'left', clickCount: 1 });
  await sleep(300);
  console.log('E 真实点击后：', JSON.stringify(await evalJS(`({ scrollY: window.scrollY, log: window.__log.slice(-4) })`)));

  const r1 = await evalJS(`(() => {
    const c = document.getElementById('canvas-embroidery');
    c.focus();
    return { active: document.activeElement.id, count: document.getElementById('stitch-count').textContent };
  })()`);
  console.log('A 聚焦后：', JSON.stringify(r1));

  await key('ArrowRight', 'ArrowRight', 39);
  await key('ArrowRight', 'ArrowRight', 39);
  const r2 = await evalJS(`({ active: document.activeElement.id,
    count: document.getElementById('stitch-count').textContent,
    scrollY: window.scrollY,
    log: window.__log.slice(-6) })`);
  console.log('B 两次右方向键后：', JSON.stringify(r2));

  await key(' ', 'Space', 32);
  const r3 = await evalJS(`({ active: document.activeElement.id,
    count: document.getElementById('stitch-count').textContent,
    sr: document.getElementById('sr-stitch').textContent,
    scrollY: window.scrollY,
    log: window.__log.slice(-6) })`);
  console.log('C 空格后：', JSON.stringify(r3));

  // 画布是否还挂在文档上、事件监听是否还在
  const r4 = await evalJS(`(() => {
    const c = document.getElementById('canvas-embroidery');
    return { inDoc: !!c && document.body.contains(c), cls: c && c.className,
             visible: c && c.getBoundingClientRect().height > 0,
             activeTag: document.activeElement.tagName };
  })()`);
  console.log('D 画布状态：', JSON.stringify(r4));

  ws.close(); chrome.kill(); process.exit(0);
}
main().catch(e => { console.error(e); try { chrome.kill(); } catch {} process.exit(1); });
