/**
 * 诊断：#app 里到底有什么。
 *
 * real-browser-test 报告 appText 只有「匠 匠作 非物质文化遗产数字展馆」，
 * 页面内容像是没渲染；但 file-full-test 说首页正常。两个脚本一个用真实窗口、
 * 一个用 headless，必须把真实窗口下的 DOM 摊开看清楚。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');

const ROOT = join(import.meta.dirname, '..');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9356;
const HEADLESS = process.env.HEADLESS === '1';
const PROFILE = join(process.env.TEMP || '/tmp', 'jz_diag_app');
const FILE_URL = pathToFileURL(join(ROOT, 'dist', 'index.html')).href;

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(PROFILE, { recursive: true });

const args = [`--remote-debugging-port=${PORT}`, '--user-data-dir=' + PROFILE,
  '--no-first-run', '--no-default-browser-check', '--window-size=1440,900', 'about:blank'];
if (HEADLESS) args.unshift('--headless=new');
const chrome = spawn(CHROME, args, { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const logs = [];
function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
}

async function main() {
  let target = null;
  for (let i = 0; i < 60; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json());
      target = list.find(t => t.type === 'page');
      if (target) break;
    } catch { /* 未就绪 */ }
    await sleep(300);
  }
  if (!target) throw new Error('DevTools 未就绪');

  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));
  ws.on('message', raw => {
    const m = JSON.parse(raw.toString());
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      return;
    }
    if (m.method === 'Runtime.consoleAPICalled') {
      logs.push('[' + m.params.type + '] ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    } else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      logs.push('[异常] ' + (d.exception?.description || d.text) + ' @ ' + (d.url || '?') + ':' + d.lineNumber);
    } else if (m.method === 'Log.entryAdded') {
      logs.push('[日志:' + m.params.entry.level + '] ' + m.params.entry.text);
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.navigate', { url: FILE_URL });

  // 分几个时间点采样，看它是「一直空」还是「慢」
  for (const wait of [1500, 3000, 8000]) {
    await sleep(wait === 1500 ? 1500 : wait - (wait === 3000 ? 1500 : 3000));
    const r = await send('Runtime.evaluate', {
      expression: `JSON.stringify({
        t: ${wait},
        loadingPresent: !!document.querySelector('#app-loading'),
        appChildren: document.querySelector('#app')?.children.length ?? -1,
        appHTMLlen: (document.querySelector('#app')?.innerHTML || '').length,
        firstKids: [...(document.querySelector('#app')?.children || [])].map(e => e.tagName + '.' + (e.className || '')).slice(0, 8),
        mainLen: (document.querySelector('#main')?.innerHTML || '').length,
        headerLen: (document.querySelector('.site-header')?.innerHTML || '').length,
        footerLen: (document.querySelector('.site-footer')?.innerHTML || '').length,
        docHeight: document.documentElement.scrollHeight,
      })`,
      returnByValue: true,
    });
    console.log(r.result.value);
  }

  console.log('\n控制台：');
  logs.length ? logs.forEach(l => console.log('  ' + l)) : console.log('  （无）');

  ws.close();
  chrome.kill();
}
main().catch(e => { console.error('失败:', e.message); try { chrome.kill(); } catch {} process.exit(1); });
