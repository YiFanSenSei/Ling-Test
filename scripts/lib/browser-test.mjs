import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket } from 'ws';

/** 新测试复用仓库已有的 Chrome/CDP 和 ws，不增加运行依赖。 */
export async function openTestBrowser() {
  const profile = mkdtempSync(join(tmpdir(), 'jz-experience-'));
  const chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--force-prefers-reduced-motion', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  let ws, next = 0;
  const pending = new Map();
  const errors = [];
  const close = () => {
    ws?.close(); chrome.kill();
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('浏览器已关闭')); }
    pending.clear();
    // profile 只由本函数的 mkdtemp 创建，且清理目标须仍位于临时目录内。
    if (resolve(profile).startsWith(resolve(tmpdir()) + sep)) {
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome 退出时可能仍持有文件 */ }
    }
  };
  try {
    const endpoint = await new Promise((resolveEndpoint, reject) => {
      const timer = setTimeout(() => reject(new Error('Chrome 启动超时')), 15000);
      chrome.once('error', error => { clearTimeout(timer); reject(error); });
      let stderr = '';
      chrome.stderr.on('data', data => {
        stderr += data;
        const found = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (found) { clearTimeout(timer); resolveEndpoint(found[1]); }
      });
    });
    const origin = new URL(endpoint).origin.replace('ws:', 'http:');
    const targets = await fetch(`${origin}/json/list`).then(r => r.json());
    ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((yes, no) => { ws.once('open', yes); ws.once('error', no); });
    let interceptor = null;
    const send = (method, params = {}) => new Promise((resolveCommand, reject) => {
      const id = ++next;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP 超时：${method}`)); }, 20000);
      pending.set(id, { resolve: resolveCommand, reject, timer });
      ws.send(JSON.stringify({ id, method, params }));
    });
    ws.on('message', raw => {
      const message = JSON.parse(raw);
      if (message.id && pending.has(message.id)) {
        const item = pending.get(message.id); pending.delete(message.id); clearTimeout(item.timer);
        if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result);
      }
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
      if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error' && !message.params.entry.text.includes('net::ERR_FAILED')) errors.push(message.params.entry.text);
      if (message.method === 'Fetch.requestPaused') {
        Promise.resolve(interceptor?.(message.params, send) || send('Fetch.continueRequest', { requestId: message.params.requestId }))
          .catch(error => errors.push(error.message));
      }
    });
    const evaluate = async expression => {
      const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
      return response.result.value;
    };
    const wait = async expression => {
      for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await sleep(100); }
      throw new Error(`等待失败：${expression}`);
    };
    await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    return { send, evaluate, wait, close, errors,
      intercept: async fn => { interceptor = fn; await send('Fetch.enable', { patterns: [{ urlPattern: '*data/*.js' }] }); },
      go: async (url, ready) => { await send('Page.navigate', { url }); await wait(ready); },
      click: selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`),
      space: async () => {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
      },
    };
  } catch (error) { close(); throw error; }
}
