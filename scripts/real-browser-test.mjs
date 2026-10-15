/**
 * 真实浏览器（非 headless）file:// 诊断
 *
 * 用户在真实桌面浏览器里打开 dist/index.html 后卡在「展馆开启中……」，
 * 但 headless 下一切正常——说明差异出在真实浏览器的加载条件上。
 * 本脚本用带界面窗口的 Chrome，把控制台、异常、网络失败全部抓出来。
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');

// 路径由脚本位置推导，不写死本机绝对路径
const ROOT = join(import.meta.dirname, '..');
const CHROME = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9355;
const PROFILE = join(process.env.TEMP || '/tmp', 'jz_real_profile');
const FILE_URL = pathToFileURL(join(ROOT, 'dist', 'index.html')).href;

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(PROFILE, { recursive: true });

// 关键：不加 --headless，用真实窗口；不加 --allow-file-access-from-files，
// 以还原用户双击打开时的真实条件。
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=' + PROFILE,
  '--no-first-run',
  '--no-default-browser-check',
  '--window-size=1440,900',
  'about:blank',
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const logs = [];
const netFail = [];

function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  let pageTarget = null;
  for (let i = 0; i < 60; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json());
      pageTarget = list.find(t => t.type === 'page');
      if (pageTarget) break;
    } catch { /* 未就绪 */ }
    await sleep(300);
  }
  if (!pageTarget) throw new Error('Chrome DevTools 未就绪');

  ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      return;
    }
    switch (m.method) {
      case 'Runtime.consoleAPICalled':
        logs.push('[' + m.params.type + '] ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
        break;
      case 'Runtime.exceptionThrown': {
        const d = m.params.exceptionDetails;
        logs.push('[异常] ' + (d.exception?.description || d.text) +
          ' @ ' + (d.url || '?') + ':' + d.lineNumber);
        break;
      }
      case 'Log.entryAdded':
        logs.push('[日志:' + m.params.entry.level + '] ' + m.params.entry.text +
          (m.params.entry.url ? ' @ ' + m.params.entry.url : ''));
        break;
      case 'Network.loadingFailed':
        netFail.push(m.params.errorText + ' :: blocked=' + (m.params.blockedReason || '无') +
          ' :: type=' + m.params.type);
        break;
      case 'Network.responseReceived':
        if (m.params.response.status >= 400 || m.params.response.status === 0) {
          netFail.push('HTTP ' + m.params.response.status + ' ' + m.params.response.url.slice(0, 120));
        }
        break;
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');

  await send('Page.navigate', { url: FILE_URL });
  await sleep(6000);

  const probe = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      stillLoading: !!document.querySelector('#app-loading'),
      appText: (document.querySelector('#app')?.textContent || '').trim().slice(0, 60),
      scriptSrc: [...document.scripts].map(s => s.src),
      linkHref: [...document.styleSheets].length,
      protocol: location.protocol,
      hasFetch: typeof fetch,
      hasModule: typeof HTMLScriptElement.prototype.supports !== 'undefined'
    })`,
    returnByValue: true,
  });

  console.log('最终状态:', probe.result.value);
  console.log('\n控制台 / 异常:');
  logs.length ? logs.forEach(l => console.log('  ' + l)) : console.log('  （无）');
  console.log('\n网络失败:');
  netFail.length ? netFail.forEach(l => console.log('  ' + l)) : console.log('  （无）');

  ws.close();
  chrome.kill();
}

main().catch((e) => { console.error('失败:', e.message); chrome.kill(); process.exit(1); });
