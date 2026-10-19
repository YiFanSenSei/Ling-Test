/**
 * 全站截图（CDP 驱动，一次性出齐主要页面与关键状态）
 *
 * 存在的理由：改动量的说法不可信，得看画面。
 * 用 node scripts/shot-all.mjs 一次导出所有页面，便于自己逐张对比。
 *
 * 用法：先起 vite preview（端口 4520），再 node scripts/shot-all.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.TEST_BASE || 'http://localhost:4520/';
const PORT = Number(process.env.PORT || 9375);
const OUT = path.resolve('_shots/all');
fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--hide-scrollbars',
  '--user-data-dir=' + path.resolve('_shots/_chrome-all'),
  'about:blank',
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

async function shot(name, fullPage = false) {
  let params = { format: 'png' };
  if (fullPage) {
    const m = await send('Page.getLayoutMetrics');
    const h = Math.min(Math.ceil(m.cssContentSize.height), 8000);
    params = { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: m.cssContentSize.width, height: h, scale: 1 } };
  }
  const r = await send('Page.captureScreenshot', params);
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
  console.log('  · ' + name + '.png');
}

async function goto(hash, wait = 1800) {
  await send('Page.navigate', { url: BASE + '#' + hash });
  await sleep(wait);
}

const pages = [
  ['01-home', '/'],
  ['02-gallery', '/gallery'],
  ['03-project', '/project/13978'],
  ['04-inheritors', '/inheritors'],
  ['05-ages', '/ages'],
  ['06-simulator', '/simulator'],
  ['07-about', '/about'],
];

async function main() {
  let target = null;
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json());
      target = list.find(t => t.type === 'page');
      if (target) break;
    } catch { /* not ready */ }
    await sleep(250);
  }
  if (!target) throw new Error('Chrome 未就绪');

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

  for (const [w, h, tag] of [[1440, 900, '1440'], [1920, 1080, '1920'], [390, 844, '390']]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
    console.log(`\n=== ${tag} ===`);
    for (const [name, hash] of pages) {
      await goto(hash);
      await shot(`${name}-${tag}`);
    }
  }

  // 首页整页长图（1440）
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  console.log('\n=== 整页 ===');
  await goto('/', 2000);
  await shot('00-home-fullpage-1440', true);

  ws.close();
  chrome.kill();
  console.log(`\n全部截图：${OUT}`);
  process.exit(0);
}
main().catch(e => { console.error(e); try { chrome.kill(); } catch {} process.exit(1); });
