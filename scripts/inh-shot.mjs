/**
 * 传承人页面截图
 *
 * 静态截图只能证明「页面能看」，交互正确性由 file-full-test.mjs 负责。
 * 两者都要，缺一不可。
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');

const ROOT = join(import.meta.dirname, '..');
const CHROME = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9371;
const PROFILE = join(process.env.TEMP || '/tmp', 'jz_inh_shot');
const OUT = join(ROOT, '_shots', 'inheritors');
const BASE = pathToFileURL(join(ROOT, 'dist', 'index.html')).href;

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(PROFILE, { recursive: true });
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=' + PROFILE,
  '--no-first-run', '--no-default-browser-check',
  '--window-size=1440,900',
  '--force-device-scale-factor=1',
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

async function shoot(name, { full = false } = {}) {
  const params = { format: 'png' };
  if (full) params.captureBeyondViewport = true;
  const r = await send('Page.captureScreenshot', params);
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
  console.log(`  ✓ ${name}.png`);
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

  const pages = [
    ['inh-list', '#/inheritors', false],
    ['inh-list-full', '#/inheritors', true],
    ['inh-detail', '#/inheritor/13978-0', true],
    ['inh-detail-kunqu', '#/inheritor/13136-0', true],
    ['project-with-links', '#/project/13978', true],
    ['home-with-entry', '#/', false],
  ];

  for (const [name, hash, full] of pages) {
    await send('Runtime.evaluate', { expression: `location.hash = ${JSON.stringify(hash)}` });
    await sleep(1600);
    await shoot(name, { full });
  }

  ws.close();
  chrome.kill();
  console.log(`\n输出目录：_shots/inheritors/`);
}

main().catch(e => { console.error('失败:', e.message); chrome.kill(); process.exit(1); });
