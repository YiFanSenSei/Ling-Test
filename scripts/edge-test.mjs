/**
 * 边界与异常路径排查。
 *
 * 前面的测试都在验证「正常路径」——点这里、拖那里、页面能出来。
 * 但评委不会按设计的路径使用，他们会输错、会刷新、会直接粘贴一个链接、
 * 会连点两下。这里专门打这些地方。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');

const ROOT = join(import.meta.dirname, '..');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9357;
const BASE = process.env.TEST_BASE || 'http://localhost:4520/';
const PROFILE = join(process.env.TEMP || '/tmp', 'jz_edge');
const SHOTS = join(ROOT, '_shots', 'edge');

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(PROFILE, { recursive: true });
mkdirSync(SHOTS, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--user-data-dir=' + PROFILE,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
  '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
let consoleErrors = [];
function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
}
async function ev(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return 'ERR: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result?.value;
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(r.data, 'base64'));
}
const results = [];
function check(label, pass, detail) {
  results.push({ label, pass, detail });
  console.log(`  ${pass ? '✓' : '✗'} ${label}  → ${typeof detail === 'object' ? JSON.stringify(detail) : detail}`);
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
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      consoleErrors.push('[异常] ' + (d.exception?.description || d.text).split('\n')[0]);
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push('[console.error] ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 160));
    }
  });
  await send('Page.enable');
  await send('Runtime.enable');

  const go = async hash => {
    await send('Page.navigate', { url: BASE + hash });
    await sleep(1400);
  };

  /* ── 1. 直接粘贴深链，不带站点首页 ── */
  console.log('\n[1] 深链直入');
  await go('#/project/13978');
  check('深链直达 #/project/13978', await ev(`document.querySelector('.project-title')?.textContent?.trim()`) === '苏绣',
    await ev(`document.querySelector('.project-title')?.textContent?.trim()`));
  check('深链直入时页面已滚到顶', await ev('scrollY') < 5, await ev('scrollY'));

  await go('#/inheritor/1');
  const inh = await ev(`document.querySelector('main h1, main .inheritor-name')?.textContent?.trim()`);
  check('深链直达 #/inheritor/1', !!inh && !String(inh).startsWith('ERR'), inh);

  /* ── 2. 不存在的 id ── */
  console.log('\n[2] 不存在的记录');
  await go('#/project/99999999');
  check('不存在的项目 id 走 404', await ev(`!!document.querySelector('.empty-state, .notfound')`),
    await ev(`document.querySelector('.empty-state h3, .notfound h1')?.textContent?.trim()`));
  await go('#/inheritor/99999999');
  check('不存在的传承人 id 有兜底', await ev(`!!document.querySelector('.empty-state, .notfound')`),
    await ev(`document.querySelector('.empty-state h3, .notfound h1')?.textContent?.trim()`));

  /* ── 3. 畸形 query ── */
  console.log('\n[3] 畸形参数');
  await go('#/gallery?category=%E4%B8%8D%E5%AD%98%E5%9C%A8');
  check('门类参数不存在时给空态而非崩溃', await ev(`!!document.querySelector('.empty-state')`),
    await ev(`document.querySelector('.empty-state h3')?.textContent?.trim()`));
  check('空态里仍保留筛选区可反悔', await ev(`!!document.querySelector('.filters')`),
    await ev(`!!document.querySelector('.filters')`));

  await go('#/gallery?page=99999');
  const pageTxt = await ev(`document.querySelector('.result-page')?.textContent?.trim()`);
  check('页码越界不显示负数或空白', !!pageTxt && !/-/.test(pageTxt) && !/0\s*\/\s*151/.test(pageTxt), pageTxt);

  await go('#/gallery?page=abc');
  check('页码非数字时能回退', await ev(`document.querySelectorAll('.pcard').length`) > 0,
    await ev(`document.querySelectorAll('.pcard').length`));

  await go('#/gallery?category=%ZZ');
  check('非法百分号编码不抛异常', await ev(`document.querySelectorAll('.pcard').length`) > 0,
    await ev(`document.querySelectorAll('.pcard').length`));

  await go('#/gallery?q=' + encodeURIComponent('<script>alert(1)</script>'));
  const xss = await ev(`document.body.innerHTML.includes('<script>alert(1)</script>')`);
  check('搜索词里的标签被转义而非执行', xss === false, `innerHTML 含裸标签 = ${xss}`);

  /* ── 4. 连点 / 快速切换 ── */
  console.log('\n[4] 连点与快速切换');
  await go('#/simulator');
  await ev(`(async () => {
    for (let i = 0; i < 6; i++) {
      document.getElementById('tab-paper').click();
      document.getElementById('tab-mortise').click();
      document.getElementById('tab-embroidery').click();
    }
    await new Promise(r => setTimeout(r, 900));
  })()`);
  await sleep(600);
  const afterFlail = await ev(`({
    canvases: document.querySelectorAll('canvas').length,
    visible: [...document.querySelectorAll('.sim-panel')].filter(p => !p.hidden).length,
    canvasOk: !!document.getElementById('canvas-embroidery')?.width,
  })`);
  check('狂点三个页签后仍只有一块面板可见', afterFlail.visible === 1, afterFlail);
  check('狂点后画布尺寸正常', afterFlail.canvasOk === true, afterFlail.canvasOk);

  // 连点返回按钮（层层回退）
  await go('#/gallery');
  await ev(`(async () => {
    const btns = [...document.querySelectorAll('.pagination button, .pager button, button')];
    const next = btns.find(b => /下一?页|›|»/.test(b.textContent));
    if (next) { for (let i = 0; i < 5; i++) next.click(); }
    await new Promise(r => setTimeout(r, 700));
  })()`);
  const pagRes = await ev(`document.querySelector('.result-page')?.textContent?.trim()`);
  check('连点下一页不会跳过或错位', !!pagRes && /第\s*\d+\s*\/\s*151\s*页/.test(pagRes), pagRes);

  /* ── 5. 刷新中途状态 ── */
  console.log('\n[5] 刷新与后退');
  await go('#/simulator');
  await sleep(600);
  await send('Page.reload');
  await sleep(1600);
  check('在体验页刷新后仍是体验页', await ev(`location.hash`) === '#/simulator', await ev(`location.hash`));
  check('刷新后画布重新初始化', await ev(`!!document.getElementById('canvas-embroidery')?.width`),
    await ev(`document.getElementById('canvas-embroidery')?.width`));

  await go('#/gallery');
  await ev(`location.hash = '#/about'`); await sleep(900);
  await ev(`history.back()`); await sleep(900);
  check('浏览器后退能回到名录', await ev(`location.hash`) === '#/gallery', await ev(`location.hash`));
  await ev(`history.forward()`); await sleep(900);
  check('浏览器前进能回到关于', await ev(`location.hash`) === '#/about', await ev(`location.hash`));

  /* ── 6. 键盘可达 ── */
  console.log('\n[6] 键盘操作');
  await go('#/');
  await sleep(400);
  const skip = await ev(`(() => {
    const a = document.querySelector('.skip-link');
    if (!a) return 'no skip link';
    a.focus();
    return { focused: document.activeElement === a, text: a.textContent.trim() };
  })()`);
  check('跳转链接可被键盘聚焦', skip?.focused === true, skip);

  const tabOrder = await ev(`(() => {
    const focusables = [...document.querySelectorAll('a[href], button, input, [tabindex]:not([tabindex="-1"])')]
      .filter(e => e.offsetParent !== null);
    const noName = focusables.filter(e => !(e.textContent.trim() || e.getAttribute('aria-label') || e.getAttribute('title')));
    return { total: focusables.length, noName: noName.length,
             samples: noName.slice(0, 3).map(e => e.tagName + '.' + e.className) };
  })()`);
  check('页面上没有「无文字」的可聚焦元素', tabOrder.noName === 0, tabOrder);

  /* ── 7. 无障碍与语义 ── */
  console.log('\n[7] 无障碍');
  const a11y = await ev(`(() => {
    const imgs = [...document.querySelectorAll('img')];
    const noAlt = imgs.filter(i => !i.hasAttribute('alt'));
    const inputs = [...document.querySelectorAll('input')];
    const noLabel = inputs.filter(i => !i.labels?.length && !i.getAttribute('aria-label'));
    const h1 = [...document.querySelectorAll('h1')];
    return { imgs: imgs.length, noAlt: noAlt.length, inputs: inputs.length,
             noLabel: noLabel.length, h1Count: h1.length, h1Text: h1.map(h => h.textContent.trim().slice(0, 20)) };
  })()`);
  check('图片都有 alt（本作品应为 0 张位图）', a11y.noAlt === 0, a11y);
  check('表单控件都有标签', a11y.noLabel === 0, a11y);
  check('每页只有一个 h1', a11y.h1Count === 1, a11y.h1Text);

  /* ── 8. 快速反复进出页面（内存 / 监听泄漏）── */
  console.log('\n[8] 反复进出');
  await ev(`(async () => {
    for (let i = 0; i < 12; i++) {
      location.hash = '#/simulator';
      await new Promise(r => setTimeout(r, 90));
      location.hash = '#/about';
      await new Promise(r => setTimeout(r, 90));
    }
    location.hash = '#/';
    await new Promise(r => setTimeout(r, 500));
  })()`);
  await sleep(1200);
  const leak = await ev(`({
    hash: location.hash,
    canvases: document.querySelectorAll('canvas').length,
    appKids: document.querySelector('#app').children.length,
  })`);
  check('快速反复进出后 DOM 不残留画布', leak.canvases === 0, leak);
  check('快速反复进出后无报错', consoleErrors.length === 0, consoleErrors.slice(0, 3));

  console.log(`\n${'='.repeat(60)}`);
  const failed = results.filter(r => !r.pass);
  console.log(`共 ${results.length} 项，通过 ${results.length - failed.length} 项，失败 ${failed.length} 项`);
  if (failed.length) failed.forEach(f => console.log(`  ✗ ${f.label} → ${JSON.stringify(f.detail)}`));

  ws.close(); chrome.kill();
  process.exit(failed.length ? 1 : 0);
}
main().catch(e => { console.error('失败:', e.message); try { chrome.kill(); } catch {} process.exit(2); });
