/**
 * 材质质感截图：苏绣丝线反光、宣纸纤维透光
 *
 * 用法：构建后运行，输出到 _shots/material/
 *   node scripts/material-shot.mjs
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const ROOT = join(import.meta.dirname, '..');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = join(process.env.TEMP || '/tmp', 'jz_mat');
const PORT = 9396;
const OUT = join(ROOT, '_shots', 'material');
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`, '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });

let ws; let seq = 0; const pending = new Map();
async function json(p) {
  for (let i = 0; i < 40; i += 1) {
    try { return await (await fetch(`http://127.0.0.1:${PORT}${p}`)).json(); }
    catch { await sleep(250); }
  }
  throw new Error('CDP not ready');
}
function send(method, params = {}) {
  const id = ++seq; ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result?.value;
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
  console.log(`  saved ${name}.png`);
}

async function main() {
  const t = (await json('/json/list')).find(x => x.type === 'page');
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    }
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: pathToFileURL(join(ROOT, 'dist', 'index.html')).href });
  await sleep(1800);

  await evaluate(`location.hash = '#/simulator'`);
  await sleep(1600);

  // 绣满一小片，让丝线反光有东西可看
  await evaluate(`(async () => {
    const c = document.getElementById('canvas-embroidery');
    c.scrollIntoView({ block: 'center' });
    await new Promise(r => setTimeout(r, 300));
    const g = c.getContext('2d');
    const cx = c.width / 2, cy = c.height / 2;
    // 直接调内部的 stitchCell 不可达，改用模拟指针事件拖一片
    const rect = c.getBoundingClientRect();
    const fire = (type, x, y) => c.dispatchEvent(new PointerEvent(type, {
      clientX: rect.left + x, clientY: rect.top + y, bubbles: true, cancelable: true,
      pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 1,
    }));
    fire('pointerdown', cx * 0.55, cy * 0.7);
    for (let i = 0; i <= 30; i++) {
      fire('pointermove', cx * 0.55 + i * 6, cy * 0.7 + Math.sin(i / 4) * 22);
      await new Promise(r => setTimeout(r, 12));
    }
    fire('pointerup', cx * 0.55 + 180, cy * 0.7);
    await new Promise(r => setTimeout(r, 400));
  })()`);
  await sleep(500);
  const st = await evaluate(`document.getElementById('stitch-count')?.textContent`);
  console.log(`  已绣：${st}`);
  await shot('1-embroidery-thread');

  // 切宣纸，捞一张
  await evaluate(`document.getElementById('tab-paper').click()`);
  await sleep(1600);
  await evaluate(`(async () => {
    const c = document.getElementById('canvas-paper');
    c.scrollIntoView({ block: 'center' });
    await new Promise(r => setTimeout(r, 300));
    const rect = c.getBoundingClientRect();
    const fire = (type, x, y) => c.dispatchEvent(new PointerEvent(type, {
      clientX: rect.left + x, clientY: rect.top + y, bubbles: true, cancelable: true,
      pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 1,
    }));
    fire('pointerdown', rect.width * 0.4, rect.height * 0.5);
    for (let i = 0; i < 40; i++) {
      fire('pointermove', rect.width * 0.4 + Math.sin(i / 3) * 70, rect.height * 0.5);
      await new Promise(r => setTimeout(r, 22));
    }
    fire('pointerup', rect.width * 0.4, rect.height * 0.5);
    await new Promise(r => setTimeout(r, 1200));
  })()`);
  await sleep(1200);
  await shot('2-paper-fiber');

  const info = await evaluate(`({
    step: document.querySelector('.step.is-active .step-name')?.textContent.trim(),
    grade: document.getElementById('grade-rank')?.textContent.trim(),
  })`);
  console.log(`  宣纸状态：${JSON.stringify(info)}`);

  ws.close(); chrome.kill(); await sleep(400); process.exit(0);
}
main().catch(e => { console.error('failed:', e.message); try { chrome.kill(); } catch {} process.exit(1); });
