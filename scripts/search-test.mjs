/**
 * 检索质量验证
 *
 * 为什么需要这个脚本：
 *   检索的正确性无法靠截图判断——页面看起来一样，返回 0 条还是 400 条
 *   只有断言数字才知道。这里逐词核对命中数，防止「优化检索」把结果改坏。
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
const PORT = 9374;
const PROFILE = join(process.env.TEMP || '/tmp', 'jz_search_test');
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

  // 通过地址栏检索最可靠：直接驱动 UI 的搜索框会受渲染时序影响
  const cases = [
    ['瓷器', '同义词应命中陶瓷类'],
    ['丝绸', '同义词应命中丝锦类'],
    ['戏曲', '同义词应命中戏类'],
    ['玉器', '应命中玉雕类'],
    ['蜡染', '应命中染类'],
    ['中医', '应命中医药类'],
    ['苏绣', '精确词不应被同义词改坏'],
    ['香山帮', '精确词'],
    ['昆曲', '精确词'],
    ['景德镇', '地名在名称中'],
    ['zy', '无意义输入应为 0'],
  ];

  console.log('=== 检索质量验证 ===\n');
  const rows = [];
  for (const [kw, note] of cases) {
    await send('Runtime.evaluate', {
      expression: `location.hash = '#/gallery?q=' + encodeURIComponent(${JSON.stringify(kw)})`,
    });
    await sleep(1100);
    const n = await evalJS(`
      const el = document.querySelector('.result-count strong');
      return el ? el.textContent.trim() : '0';
    `);
    rows.push([kw, n, note]);
  }

  const w = 12;
  for (const [kw, n, note] of rows) {
    console.log(`  ${kw.padEnd(w, '　')} ${String(n).padStart(6)}   ${note}`);
  }

  ws.close();
  chrome.kill();
}

main().catch(e => { console.error('失败:', e.message); chrome.kill(); process.exit(1); });
