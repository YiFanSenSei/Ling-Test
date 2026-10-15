/**
 * 导航往返测试：检查离开页面后是否留下未清理的资源
 *
 * 为什么需要它：
 *   单次访问看不出问题——页面正常、动画正常。只有在反复进出之后，
 *   残留的 requestAnimationFrame 循环与事件监听才会累积。
 *   评测时评委来回切页是很自然的操作，因此这个泄漏必须量出来。
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
const CHROME = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9381;
const PROFILE = join(process.env.TEMP || '/tmp', 'jz_leak_test');
const BASE = pathToFileURL(join(ROOT, 'dist', 'index.html')).href;

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(PROFILE, { recursive: true });

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=' + PROFILE,
  '--no-first-run', '--no-default-browser-check',
  '--window-size=1440,900',
  'about:blank',
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();

function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalJS(expr) {
  const r = await send('Runtime.evaluate', {
    expression: `(() => { ${expr} })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) return `错误: ${r.exceptionDetails.text}`;
  return r.result.value;
}

/** 统计一段时间内 rAF 回调被调用的次数——残留循环越多，这个数越大 */
async function countRafCalls(ms) {
  return evalJS(`
    window.__rafCount = 0;
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = function (cb) {
      return orig(function (t) { window.__rafCount++; return cb(t); });
    };
    return new Promise(resolve => {
      setTimeout(() => {
        window.requestAnimationFrame = orig;
        resolve(window.__rafCount);
      }, ${ms});
    });
  `);
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
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: BASE });
  await sleep(4000);

  console.log('=== 导航往返后的残留资源 ===\n');
  console.log('  说明：每次访问「技艺体验」页都会启动宣纸模拟器的动画循环。');
  console.log('  若离开时未取消，循环会一直跑下去，访问 N 次就有 N 个循环。\n');

  console.log('  基线（停在首页，无模拟器）：');
  const base = await countRafCalls(1000);
  console.log(`    rAF 调用 ${base} 次/秒\n`);

  for (const rounds of [1, 3, 6]) {
    // 先回到首页，再从零开始累计
    await send('Runtime.evaluate', { expression: `location.hash = '#/'` });
    await sleep(900);

    for (let i = 0; i < rounds; i++) {
      await send('Runtime.evaluate', { expression: `location.hash = '#/simulator'` });
      await sleep(1100);
      await send('Runtime.evaluate', { expression: `location.hash = '#/'` });
      await sleep(900);
    }
    const n = await countRafCalls(1000);
    console.log(`  进出模拟器 ${rounds} 次后，停在首页：rAF 调用 ${String(n).padStart(4)} 次/秒`);
  }

  ws.close();
  chrome.kill();
}

main().catch(e => { console.error('失败:', e.message); chrome.kill(); process.exit(1); });
