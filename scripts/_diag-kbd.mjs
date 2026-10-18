/**
 * 诊断：方向键为什么没反应
 * 探针挂在 document 捕获阶段，看按键到底落在哪个元素上。
 */
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:4520/';
const PORT = 9398;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
  '--user-data-dir=' + path.resolve('_shots/_chrome-kbd2'), 'about:blank',
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const send = (m, p = {}) => new Promise((res, rej) => {
  const id = ++msgId; pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method: m, params: p }));
});
const evalJS = async e => {
  const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
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
    console.log('[console]', m.params.args.map(a => a.value).join(' '));
  } else if (m.method === 'Runtime.exceptionThrown') {
    console.log('[exception]', JSON.stringify(m.params.exceptionDetails.text));
  }
});
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: BASE + '#/simulator' });
await sleep(2200);

// 装探针
await evalJS(`(() => {
  window.__log = [];
  document.addEventListener('keydown', e => {
    window.__log.push({ target: e.target.id || e.target.tagName, key: e.key,
                        defaultPrevented: e.defaultPrevented, active: document.activeElement.id || document.activeElement.tagName });
  }, true);
  return true;
})()`);

const info1 = await evalJS(`(() => {
  const c = document.getElementById('canvas-embroidery');
  c.focus();
  const r = c.getBoundingClientRect();
  return { active: document.activeElement.id, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
           scrollY: window.scrollY, docH: document.documentElement.scrollHeight };
})()`);
console.log('聚焦后：', JSON.stringify(info1));

const k = async (key, code, vk) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await sleep(120);
};

await k('ArrowRight', 'ArrowRight', 39);
await k('ArrowRight', 'ArrowRight', 39);
await k(' ', 'Space', 32);

const info2 = await evalJS(`(() => ({
  log: window.__log,
  scrollY: window.scrollY,
  count: document.getElementById('stitch-count').textContent,
  active: document.activeElement.id || document.activeElement.tagName,
}))()`);
console.log('按键后：', JSON.stringify(info2, null, 2));

ws.close(); chrome.kill(); process.exit(0);
