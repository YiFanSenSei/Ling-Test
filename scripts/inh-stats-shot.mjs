/**
 * 传承人页 5 格统计条 + 年龄页入口截图
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = join(import.meta.dirname, '..');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = join(process.env.TEMP || '/tmp', 'jz_inh_shot');
const PORT = 9389;
const OUT = join(ROOT, '_shots', 'ages');
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
  throw new Error('CDP 未就绪');
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
async function shot(name, clip) {
  const r = await send('Page.captureScreenshot', clip
    ? { format: 'png', captureBeyondViewport: true, clip }
    : { format: 'png' });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
  console.log(`  已存 ${name}.png`);
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
  await sleep(2200);

  // 传承人页：确认 5 格统计条
  await evaluate(`location.hash = '#/inheritors'`);
  await sleep(2600);
  const inh = await evaluate(`(() => {
    const stats = document.querySelector('.inh-stats');
    const cells = [...document.querySelectorAll('.inh-stat')];
    const r = stats?.getBoundingClientRect();
    return {
      cells: cells.length,
      widths: cells.map(c => Math.round(c.getBoundingClientRect().width)),
      heights: cells.map(c => Math.round(c.getBoundingClientRect().height)),
      linkText: document.querySelector('.inh-stat-link')?.textContent.replace(/\\s+/g,' ').trim(),
      moreLink: document.querySelector('.result-more')?.textContent.trim(),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      box: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null,
    };
  })()`);
  console.log('  传承人页统计条：', JSON.stringify(inh));
  await shot('3-inheritors-stats', { x: 0, y: 130, width: 1440, height: 620, scale: 1 });

  // 点第五格，确认真的跳到年龄页
  await evaluate(`document.querySelector('.inh-stat-link').click()`);
  await sleep(1600);
  const after = await evaluate(`({ hash: location.hash, title: document.querySelector('.page-title')?.textContent })`);
  console.log('  点第五格后：', JSON.stringify(after));

  // 手机档看统计条
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await evaluate(`location.hash = '#/inheritors'`);
  await sleep(2400);
  const mob = await evaluate(`(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    cells: [...document.querySelectorAll('.inh-stat')].map(c => {
      const r = c.getBoundingClientRect();
      return [Math.round(r.x), Math.round(r.y), Math.round(r.width)];
    }),
  }))()`);
  console.log('  手机统计条：', JSON.stringify(mob));
  await shot('4-inheritors-mobile-stats', { x: 0, y: 0, width: 390, height: 1500, scale: 2 });

  ws.close(); chrome.kill(); await sleep(400); process.exit(0);
}
main().catch(e => { console.error('失败：', e.message); try { chrome.kill(); } catch {} process.exit(1); });
