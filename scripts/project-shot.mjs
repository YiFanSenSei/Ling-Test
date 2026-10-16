/**
 * 项目详情页截图
 *
 * 重点拍「同一项目的其他申报地区」这一节：它覆盖全站 71% 的记录，
 * 但形态差异很大——苏绣只有 4 条，剪纸有 55 条，苗族古歌一条都没有。
 * 三种形态都要看，不能只测最漂亮的那个。
 *
 * 静态截图只能证明「页面能看」，交互正确性由 file-full-test.mjs 负责。
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
const PORT = 9376;
const PROFILE = join(process.env.TEMP || '/tmp', 'jz_project_shot');
const OUT = join(ROOT, '_shots', 'project');
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

const VIEWPORTS = {
  desktop: null,
  mobile: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
};

async function setViewport(name) {
  const v = VIEWPORTS[name];
  if (!v) {
    await send('Emulation.clearDeviceMetricsOverride');
    return;
  }
  await send('Emulation.setDeviceMetricsOverride', v);
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

  // 每个用例都滚到「同一项目的其他申报地区」这一节，否则截图里根本看不到它
  const gotoVariant = async (hash) => {
    await send('Runtime.evaluate', { expression: `location.hash = ${JSON.stringify(hash)}` });
    await sleep(1500);
    await evalJS(`
      const secs = [...document.querySelectorAll('.project-section')];
      const target = secs.find(s => s.querySelector('.variant-list'));
      if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
      window.scrollBy(0, -70);
      return true;
    `);
    await sleep(500);
  };

  console.log('桌面端 1440：');
  // 苏绣：4 条，看得清每一行
  await gotoVariant('#/project/13978');
  await shoot('1-suxiu-variants');

  // 剪纸：55 条，考验长列表
  await gotoVariant('#/project/13924');
  await shoot('2-jianzhi-variants');

  // 苗族古歌：无详情 + 无同组兄弟以外的内容，看空态文案
  await send('Runtime.evaluate', { expression: `location.hash = '#/project/12178'` });
  await sleep(1500);
  await shoot('3-no-detail-empty');

  // 苗族古歌整页（截图长图看整体结构）
  await shoot('4-no-detail-full', { full: true });

  // 苏绣整页：详情页的完整形态
  await send('Runtime.evaluate', { expression: `location.hash = '#/project/13978'` });
  await sleep(1500);
  await shoot('5-suxiu-full', { full: true });

  // 关于页「为什么会看到两个不同的数字」——新加了编号归并的论证
  await send('Runtime.evaluate', { expression: `location.hash = '#/about'` });
  await sleep(1500);
  await evalJS(`
    const p = document.querySelector('.about-note-inline');
    if (p) p.scrollIntoView({ block: 'center', behavior: 'instant' });
    return true;
  `);
  await sleep(500);
  await shoot('8-about-prefix');

  console.log('移动端 390：');
  await send('Emulation.setDeviceMetricsOverride', VIEWPORTS.mobile);
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await sleep(600);

  await gotoVariant('#/project/13978');
  await shoot('6-mobile-variants');

  await gotoVariant('#/project/13924');
  await shoot('7-mobile-jianzhi');

  ws.close();
  chrome.kill();
  console.log(`\n输出目录：_shots/project/`);
}

main().catch(e => { console.error('失败:', e.message); chrome.kill(); process.exit(1); });
