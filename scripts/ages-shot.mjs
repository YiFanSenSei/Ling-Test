/**
 * 年龄结构页截图
 *
 * 只做一件事：把 #/ages 在桌面与手机两档渲染出来，人工核对。
 * 判断「对不对」不能只看断言数字——柱状图的最高柱有没有截断、
 * 表格在 390 宽下有没有塌掉，只有看图才知道。
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = join(import.meta.dirname, '..');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = join(process.env.TEMP || '/tmp', 'jz_ages_shot');
const PORT = 9388;
const OUT = join(ROOT, '_shots', 'ages');
mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`, '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });

async function json(path) {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
      return await res.json();
    } catch { await sleep(250); }
  }
  throw new Error('CDP 未就绪');
}

let ws; let seq = 0;
const pending = new Map();
function send(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}

async function evaluate(expr) {
  const r = await send('Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'eval 失败');
  return r.result?.value;
}

async function shot(name, fullPage = false) {
  const params = { format: 'png' };
  if (fullPage) {
    const m = await send('Page.getLayoutMetrics');
    const h = Math.ceil(m.cssContentSize?.height || 900);
    params.captureBeyondViewport = true;
    params.clip = { x: 0, y: 0, width: 1440, height: h, scale: 1 };
  }
  const r = await send('Page.captureScreenshot', params);
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
  console.log(`  已存 ${name}.png`);
}

async function setViewport(width, height, mobile = false) {
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: mobile ? 3 : 1, mobile,
  });
}

async function main() {
  const targets = await json('/json/list');
  const page = targets.find(t => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    }
  };

  await send('Page.enable');
  await send('Runtime.enable');

  const url = pathToFileURL(join(ROOT, 'dist', 'index.html')).href;
  await send('Page.navigate', { url });
  await sleep(2200);
  await evaluate(`location.hash = '#/ages'`);
  await sleep(1600);

  const info = await evaluate(`(() => ({
    title: document.querySelector('.page-title')?.textContent,
    bars: document.querySelectorAll('.age-bar').length,
    figures: [...document.querySelectorAll('.age-figure-num')].map(x => x.textContent.trim()),
    batchRows: document.querySelectorAll('.age-table tbody tr').length,
    extRows: document.querySelectorAll('.ext-row').length,
    topBarH: Math.max(...[...document.querySelectorAll('.age-bar-fill')].map(x => x.getBoundingClientRect().height)),
    chartH: document.querySelector('.age-chart')?.getBoundingClientRect().height,
    docH: document.documentElement.scrollHeight,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    errors: window.__errs || [],
  }))()`);
  console.log('  页面自检：', JSON.stringify(info, null, 0));

  await shot('1-ages-full', true);

  await setViewport(390, 844, true);
  await sleep(900);
  await evaluate(`window.scrollTo(0, 0)`);
  await sleep(400);
  const m = await evaluate(`({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth })`);
  console.log('  手机 390 横向溢出：', m.overflow);
  await shot('2-ages-mobile', true);

  const errs = await evaluate(`(window.__pageErrors || []).length`);
  console.log('  页面异常数：', errs);

  ws.close();
  chrome.kill();
  await sleep(400);
  process.exit(0);
}

main().catch((e) => {
  console.error('截图失败：', e.message);
  try { chrome.kill(); } catch {}
  process.exit(1);
});
