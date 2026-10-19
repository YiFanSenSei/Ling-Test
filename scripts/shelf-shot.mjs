/**
 * 十方书阁截图
 *
 * 只做一件事：打开名录页，把书阁拍下来，并用 CDP 实测投影是否真的成立。
 *
 * ⚠️ 纯 CSS 3D 的最大风险是「静默塌成平面」——
 *    如果 .shelf-rail 的 transform-style 被某条规则覆盖成 flat，
 *    页面照样渲染、控制台一声不响，只是书脊变成十张贴纸。
 *    所以这里必须量 getComputedStyle 的实际值，不能只看截图。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9401;
const BASE = 'http://localhost:4520/';
const OUT = path.resolve('_shots/shelf');
fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 每次用独立 profile，避免连到上一次残留的 Chrome 实例 */
const profile = path.resolve('_shots/_chrome-shelf-' + Date.now());
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--window-size=1440,900',
  '--hide-scrollbars',
  '--force-device-scale-factor=2',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
], { stdio: 'ignore' });

async function getWsUrl() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await res.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch { /* 还没起来 */ }
    await sleep(250);
  }
  throw new Error('Chrome 调试端口未就绪');
}

let id = 0;
const pending = new Map();
const consoleErrors = [];

function main() {
  return new Promise(async (resolve, reject) => {
    const wsUrl = await getWsUrl();
    const ws = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
    const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
      const msgId = ++id;
      pending.set(msgId, { res, rej });
      ws.send(JSON.stringify({ id: msgId, method, params, sessionId }));
    });

    ws.on('message', raw => {
      const msg = JSON.parse(raw.toString());
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
        return;
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        consoleErrors.push(msg.params.args.map(a => a.value ?? a.description).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        consoleErrors.push('EXCEPTION ' + (msg.params.exceptionDetails?.exception?.description || ''));
      }
    });

    ws.on('open', async () => {
      try {
        const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
        const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

        const S = (m, p) => send(m, p, sessionId);
        await S('Page.enable');
        await S('Runtime.enable');
        await S('Network.enable');
        await S('Network.setCacheDisabled', { cacheDisabled: true });
        await S('Emulation.setDeviceMetricsOverride', {
          width: 1440, height: 1200, deviceScaleFactor: 2, mobile: false,
        });

        await S('Page.navigate', { url: BASE + '#/gallery' });
        await sleep(2200);
        await S('Page.reload', { ignoreCache: true });
        await sleep(2600);

        const evalJS = async expr => {
          const r = await S('Runtime.evaluate', {
            expression: expr, returnByValue: true, awaitPromise: true,
          });
          if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + expr);
          return r.result.value;
        };

        const R = {};

        /* ---- 1. 书阁是否存在、十本书是否都渲染了 ---- */
        R.bookCount = await evalJS(`document.querySelectorAll('.shelf-book').length`);
        R.hasStage = await evalJS(`!!document.getElementById('shelf-stage')`);

        /* ---- 2. 3D 上下文是否真的保住了（最关键的一条） ---- */
        R.railTransformStyle = await evalJS(
          `getComputedStyle(document.getElementById('shelf-rail')).transformStyle`);
        R.viewportPerspective = await evalJS(
          `getComputedStyle(document.getElementById('shelf-viewport')).perspective`);

        /* ---- 3. 十本书的 transform 是否真的带 rotateY 与 translate3d ---- */
        R.firstTransform = await evalJS(
          `getComputedStyle(document.querySelector('.shelf-book')).transform`);

        /* ---- 4. 每本书的实际屏幕位置（判断有没有全部叠在一起或跑出房间） ---- */
        R.rects = await evalJS(`
          JSON.stringify(Array.from(document.querySelectorAll('.shelf-book')).map(el => {
            const r = el.getBoundingClientRect();
            return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
          }))`);

        /* ---- 5. 书是否落在房间范围内（跑出去就是适配问题） ---- */
        R.roomBox = await evalJS(`
          JSON.stringify((() => {
            const r = document.querySelector('.shelf-room').getBoundingClientRect();
            return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
          })())`);

        /* ---- 6. 书脊文字是否溢出（竖排书名超出书脊高度会被裁） ---- */
        R.overflowTitles = await evalJS(`
          JSON.stringify(Array.from(document.querySelectorAll('.shelf-book__title'))
            .filter(el => el.scrollHeight > el.clientHeight + 1)
            .map(el => el.textContent.trim()))`);

        /* ---- 7. 横向溢出（比赛硬指标） ---- */
        R.hScroll = await evalJS(
          `document.documentElement.scrollWidth - document.documentElement.clientWidth`);

        /* ---- 截图：整个书阁 ---- */
        const stageBox = await evalJS(`
          JSON.stringify((() => {
            const r = document.getElementById('shelf-stage').getBoundingClientRect();
            return { x: r.x, y: r.y + window.scrollY, w: r.width, h: r.height };
          })())`);
        const sb = JSON.parse(stageBox);

        const shot = async (name, clip) => {
          const p = await S('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: true,
            clip: { ...clip, scale: 1 },
          });
          fs.writeFileSync(path.join(OUT, name), Buffer.from(p.data, 'base64'));
        };

        await shot('1-shelf.png', {
          x: Math.max(0, sb.x - 20), y: Math.max(0, sb.y - 20),
          width: Math.min(1480, sb.w + 40), height: sb.h + 40,
        });

        /* ---- 8. 拖动后书架是否真的转了 ---- */
        const before = await evalJS(
          `getComputedStyle(document.getElementById('shelf-rail')).transform`);
        const vpBox = JSON.parse(await evalJS(`
          JSON.stringify((() => {
            const r = document.getElementById('shelf-viewport').getBoundingClientRect();
            return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
          })())`));
        await S('Input.dispatchMouseEvent', {
          type: 'mousePressed', x: vpBox.cx, y: vpBox.cy, button: 'left', clickCount: 1,
        });
        await S('Input.dispatchMouseEvent', {
          type: 'mouseMoved', x: vpBox.cx - 90, y: vpBox.cy, button: 'left',
        });
        await sleep(400);
        await S('Input.dispatchMouseEvent', {
          type: 'mouseReleased', x: vpBox.cx - 90, y: vpBox.cy, button: 'left',
        });
        await sleep(500);
        const after = await evalJS(
          `getComputedStyle(document.getElementById('shelf-rail')).transform`);
        R.draggedChanged = before !== after;
        R.beforeTransform = before;
        R.afterTransform = after;

        await shot('2-dragged.png', {
          x: Math.max(0, sb.x - 20), y: Math.max(0, sb.y - 20),
          width: Math.min(1480, sb.w + 40), height: sb.h + 40,
        });

        /* ---- 9. 点书脊是否跳到对应门类 ---- */
        await S('Input.dispatchMouseEvent', {
          type: 'mousePressed', x: vpBox.cx, y: vpBox.cy, button: 'left', clickCount: 1,
        });
        await S('Input.dispatchMouseEvent', {
          type: 'mouseReleased', x: vpBox.cx, y: vpBox.cy, button: 'left', clickCount: 1,
        });
        await sleep(1200);
        R.afterClickHash = await evalJS(`window.location.hash`);

        R.consoleErrors = consoleErrors;

        fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(R, null, 2));
        console.log(JSON.stringify(R, null, 2));

        resolve();
      } catch (err) {
        reject(err);
      } finally {
        try { ws.close(); } catch { /* ignore */ }
      }
    });
    ws.on('error', reject);
  });
}

main()
  .then(() => { chrome.kill(); process.exit(0); })
  .catch(err => { console.error(err); chrome.kill(); process.exit(1); });
