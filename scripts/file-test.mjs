/**
 * file:// 直开验证
 *
 * 用 CDP 打开 dist/index.html（file:// 协议），捕获控制台消息与网络失败，
 * 确认评委双击 index.html 时作品能否真正跑起来。
 *
 * 起因：--dump-dom 显示页面停在「展馆开启中……」，说明 JS 未执行。
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');

// 路径全部由脚本位置推导，不写死本机绝对路径——换台电脑也能直接跑
const ROOT = join(import.meta.dirname, '..');
const CHROME = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9344;
const FILE_URL = pathToFileURL(join(ROOT, 'dist', 'index.html')).href;

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=' + process.env.TEMP + '\\jz_file_profile',
  '--window-size=1440,900',
  '--allow-file-access-from-files',
  'about:blank',
], { stdio: 'ignore', detached: false });

let ws, msgId = 0;
const pending = new Map();
const logs = [];

function send(method, params = {}, sessionId) {
  const id = ++msgId;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

async function main() {
  // 等 devtools 起来，并取到一个 page target
  // （浏览器级端点不支持 Page.enable，必须连到具体页面 target）
  let pageTarget = null;
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json());
      pageTarget = list.find(t => t.type === 'page');
      if (pageTarget) break;
    } catch { /* 还没起来 */ }
    await sleep(250);
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
    if (m.method === 'Runtime.consoleAPICalled') {
      logs.push('[' + m.params.type + '] ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      logs.push('[exception] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    }
    if (m.method === 'Log.entryAdded') {
      logs.push('[log:' + m.params.entry.level + '] ' + m.params.entry.text);
    }
    if (m.method === 'Network.loadingFailed') {
      logs.push('[net-fail] ' + m.params.errorText + ' :: ' + (m.params.blockedReason || ''));
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');

  await send('Page.navigate', { url: FILE_URL });
  await sleep(5000);

  const probe = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      stillLoading: !!document.querySelector('#app-loading'),
      appHTML: (document.querySelector('#app')?.innerHTML || '').length,
      title: document.title,
      hasHeader: !!document.querySelector('.site-header'),
      cards: document.querySelectorAll('.pcard, .cat-card').length,
      firstText: (document.querySelector('#app')?.textContent || '').trim().slice(0, 80)
    })`,
    returnByValue: true,
  });

  console.log('页面状态:', probe.result.value);
  console.log('\n控制台与网络消息:');
  if (logs.length === 0) console.log('  （无）');
  for (const l of logs) console.log('  ' + l);

  ws.close();
  chrome.kill();
}

main().catch((e) => { console.error('失败:', e.message); chrome.kill(); process.exit(1); });
