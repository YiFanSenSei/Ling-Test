/**
 * 诊断 2：键盘处理函数为什么没生效
 * 直接往画布上派发合成 keydown，看它是否被我们的监听器吃掉；
 * 再用 CDP 真按键对比，区分「监听器没挂上」与「CDP 按键没送到 canvas」。
 */
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:4520/';
const PORT = 9399;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
  '--user-data-dir=' + path.resolve('_shots/_chrome-kbd3'), 'about:blank',
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const send = (m, p = {}) => new Promise((res, rej) => {
  const id = ++msgId; pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method: m, params: p }));
});
const evalJS = async e => {
  const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' | ' + JSON.stringify(r.exceptionDetails.exception));
  return r.result.value;
};

let target = null;
for (let i = 0; i < 40; i++) {
  try {
    const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json());
    target = list.find(t => t.type === 'page'); if (target) break;
  } catch {}
  await sleep(250);
}
ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 512 * 1024 * 1024 });
await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
ws.on('message', raw => {
  const m = JSON.parse(raw.toString());
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id); pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  } else if (m.method === 'Runtime.consoleAPICalled') {
    console.log('[console]', m.params.args.map(a => a.value ?? a.description).join(' '));
  } else if (m.method === 'Runtime.exceptionThrown') {
    console.log('[exception]', m.params.exceptionDetails.text,
      m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description);
  }
});
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: BASE + '#/simulator' });
await sleep(2400);

// A: 合成事件直接派发到 canvas（绕开 CDP）
const synth = await evalJS(`(() => {
  const c = document.getElementById('canvas-embroidery');
  c.focus();
  const before = document.getElementById('stitch-count').textContent;
  const ev = new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true });
  const dispatched = c.dispatchEvent(ev);
  const ev2 = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true });
  const dispatched2 = c.dispatchEvent(ev2);
  return { before, after: document.getElementById('stitch-count').textContent,
           preventedArrow: !dispatched, preventedSpace: !dispatched2,
           active: document.activeElement.id };
})()`);
console.log('A 合成事件：', JSON.stringify(synth));

// B: CDP 真按键
const k = async (key, code, vk) => {
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await sleep(150);
};
await evalJS(`(() => { window.__probe = []; document.addEventListener('keydown', e => {
  window.__probe.push({ key: e.key, target: e.target.id || e.target.tagName, prevented: e.defaultPrevented });
}, false); return true; })()`);
await evalJS(`document.getElementById('canvas-embroidery').focus()`);
const beforeB = await evalJS(`document.getElementById('stitch-count').textContent`);
await k('ArrowRight', 'ArrowRight', 39);
await k(' ', 'Space', 32);
const afterB = await evalJS(`(() => ({ count: document.getElementById('stitch-count').textContent,
  probe: window.__probe, scrollY: window.scrollY, active: document.activeElement.id }))()`);
console.log('B CDP 真按键：', JSON.stringify({ beforeB, ...afterB }));

ws.close(); chrome.kill(); process.exit(0);
