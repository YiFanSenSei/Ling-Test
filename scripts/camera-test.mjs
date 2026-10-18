/**
 * 开场推镜验证
 *
 * 这类动画最容易「假通过」：只看动画结束后的截图，和没加动画一模一样。
 * 所以必须测真正有区分度的东西。
 *
 * 本版判据的由来（吃过两次亏，写下来免得下次重犯）：
 *
 *   第一版测「角落亮度」，判据写反了——素绸底色是暖白，透明区是黑的，
 *   我当时以为「透明该更亮」。
 *
 *   第二版测「画面内容包围盒」，两次都是 0.998。根因是当时整幅画面（含底料）
 *   一起缩放，四周露出的是残留像素，alpha 仍为 255，包围盒永远满幅。
 *   这暴露了更本质的问题：整体缩放根本不叫「镜头推近」，叫「把图缩小」。
 *   已经改成分层——环境层不缩放，内容层缩放。
 *
 *   现在测的是内容层的特征物是否会移动：苏绣的绣绷木框。
 *   这才是镜头推近时真正该动的部分，测它才有意义。
 */

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const ROOT = join(import.meta.dirname, '..');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = join(process.env.TEMP || '/tmp', 'jz_cam');
const PORT = 9391;
const OUT = join(ROOT, '_shots', 'camera');
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
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
  return r.result?.value;
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
}
async function mouse(type, x, y) {
  await send('Input.dispatchMouseEvent', {
    type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1,
  });
}

const results = [];
const check = (name, ok, extra) => {
  results.push({ name, ok, extra });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${extra !== undefined ? `  → ${JSON.stringify(extra)}` : ''}`);
};

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
  const errors = [];
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown') {
      errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
    }
  });

  await send('Page.navigate', { url: pathToFileURL(join(ROOT, 'dist', 'index.html')).href });
  await sleep(1800);

  /* -------- 苏绣：绣绷框在推镜期间的位置变化 -------- */
  await evaluate(`location.hash = '#/simulator'`);
  await sleep(110);

  const seq2 = await evaluate(`(async () => {
    const measure = () => {
      const c = document.getElementById('canvas-embroidery');
      if (!c) return null;
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const rowLum = y => {
        let s = 0, n = 0;
        for (let x = 20; x < c.width - 20; x += 3) {
          const i = (y * c.width + x) * 4;
          s += (d[i] + d[i + 1] + d[i + 2]) / 3; n++;
        }
        return s / n;
      };
      const base = rowLum(90);
      for (let y = 0; y < 150; y++) if (rowLum(y) < base - 14) return y;
      return -1;
    };
    const out = [];
    for (let i = 0; i < 16; i++) { out.push(measure()); await new Promise(r => setTimeout(r, 65)); }
    return out;
  })()`);

  console.log('   \u7ee3\u7ef7\u6846 y \u4f4d\u7f6e\u5e8f\u5217\uff1a', JSON.stringify(seq2));
  const valid = seq2.filter(v => typeof v === 'number' && v >= 0);
  const distinctCount = new Set(valid).size;
  const first = valid[0];
  const lastY = valid[valid.length - 1];

  check('\u63a8\u955c\u671f\u95f4\u7ee3\u7ef7\u6846\u4f4d\u7f6e\u5728\u79fb\u52a8', distinctCount >= 3,
    { distinctCount, first, lastY });
  check('\u7ee3\u7ef7\u6846\u6700\u7ec8\u56de\u5230\u753b\u5e03\u8fb9\u7f18\u9644\u8fd1', typeof lastY === 'number' && lastY <= 40, lastY);
  check('\u63a8\u955c\u8ba9\u7ee3\u7ef7\u6846\u4ece\u5916\u90e8\u63a8\u8fdb\u6765',
    typeof first === 'number' && typeof lastY === 'number' && first >= lastY, `${first} -> ${lastY}`);

  /* -------- 动画中按下，是否立刻落定 -------- */
  await evaluate(`location.hash = '#/gallery'`); await sleep(600);
  await evaluate(`location.hash = '#/simulator'`); await sleep(200);
  await evaluate(`document.getElementById('canvas-embroidery').scrollIntoView({ block: 'center' })`);
  await sleep(350);
  const box = await evaluate(`(() => {
    const r = document.getElementById('canvas-embroidery').getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  })()`);
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  await mouse('mousePressed', cx, cy);
  await sleep(50);
  await mouse('mouseMoved', cx + 45, cy + 35);
  await mouse('mouseReleased', cx + 45, cy + 35);
  await sleep(300);
  const pressed = await evaluate(`({
    stitches: document.getElementById('stitch-count')?.textContent,
    hintHidden: document.getElementById('hint-embroidery')?.classList.contains('is-hidden'),
  })`);
  check('\u52a8\u753b\u4e2d\u6309\u4e0b\u4e5f\u80fd\u6b63\u5e38\u843d\u9488', Number(pressed.stitches) > 0, pressed);

  /* -------- 宣纸页签（属性名是 data-sim） -------- */
  await evaluate(`document.getElementById('tab-paper').click()`);
  await sleep(450);
  const paperDuring = await evaluate(`(() => {
    const c = document.getElementById('canvas-paper');
    if (!c) return null;
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i+1] + d[i+2] < 260) dark++;
    return { darkRatio: +(dark / (d.length / 4)).toFixed(4), w: c.dataset.w };
  })()`);
  await sleep(1200);
  const paperAfter = await evaluate(`(() => {
    const c = document.getElementById('canvas-paper');
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i+1] + d[i+2] < 260) dark++;
    return { darkRatio: +(dark / (d.length / 4)).toFixed(4) };
  })()`);
  console.log('  \u5ba3\u7eb8\uff1a\u63a8\u955c\u4e2d', JSON.stringify(paperDuring), ' \u843d\u5b9a\u540e', JSON.stringify(paperAfter));
  check('\u5ba3\u7eb8\u9875\u7b7e\u53ef\u5207\u6362\u4e14\u5df2\u6e32\u67d3', paperAfter.darkRatio > 0.01, paperAfter);
  check('\u5ba3\u7eb8\u63a8\u955c\u671f\u95f4\u753b\u9762\u5360\u6bd4\u4e0d\u540c',
    Math.abs(paperAfter.darkRatio - paperDuring.darkRatio) > 0.008,
    `${paperDuring.darkRatio} -> ${paperAfter.darkRatio}`);

  /* -------- 榫卯页签 -------- */
  await evaluate(`document.getElementById('tab-mortise').click()`);
  await sleep(1500);
  const mort = await evaluate(`(() => {
    const c = document.getElementById('canvas-mortise');
    if (!c) return null;
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let wood = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 110 && d[i] > d[i + 2] + 12) wood++;
    }
    return {
      woodRatio: +(wood / (d.length / 4)).toFixed(4),
      state: document.querySelector('.joint-state')?.textContent.trim(),
      handle: typeof c.mortiseHandle === 'function' ? c.mortiseHandle() : null,
    };
  })()`);
  check('\u69ab\u536f\u6e32\u67d3\u51fa\u6728\u6599', mort && mort.woodRatio > 0.02, mort && mort.woodRatio);
  check('\u69ab\u536f\u6d4b\u8bd5\u63a5\u7f1d\u53ef\u7528', mort && mort.handle !== null, mort && mort.handle);

  await shot('sim-mortise-after-push');
  check('\u63a7\u5236\u53f0\u65e0\u5f02\u5e38', errors.length === 0, errors.slice(0, 3));

  const pass = results.filter(r => r.ok).length;
  console.log(`\n${pass}/${results.length} \u9879\u901a\u8fc7`);
  ws.close(); chrome.kill(); await sleep(400);
  process.exit(pass === results.length ? 0 : 1);
}

main().catch(e => { console.error('失败：', e.message); try { chrome.kill(); } catch {} process.exit(1); });
