/**
 * 苏绣拖拽专项诊断：确认 pointer 事件是否到达画布、
 * 每次 move 的坐标与 addStitch 的判定结果。
 */
const http = require('http');
const { spawn } = require('child_process');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9336;
const BASE = 'http://localhost:4520/';

function get(p) {
  return new Promise((res, rej) => {
    http.get(`http://127.0.0.1:${PORT}${p}`, r => {
      let b = ''; r.on('data', d => b += d);
      r.on('end', () => { try { res(JSON.parse(b || '{}')); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-crashpad',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${process.env.TEMP}\\cr-emb`,
    '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { await get('/json/version'); break; } catch { await sleep(200); } }
  const page = (await get('/json/list')).find(t => t.type === 'page');
  const WebSocket = (await import('ws')).default;
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0; const pending = new Map();
  ws.on('message', raw => { const m = JSON.parse(raw); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await new Promise(r => ws.on('open', r));
  const evalJS = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;

  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: BASE + '#/simulator' });
  await sleep(2800);

  // 在画布上装探针，记录收到的 pointer 事件
  console.log('装探针:', await evalJS(`(() => {
    const c = document.getElementById('canvas-embroidery');
    if (!c) return 'no canvas';
    window.__probe = [];
    ['pointerdown','pointermove','pointerup','mousedown','mousemove'].forEach(t => {
      c.addEventListener(t, e => { window.__probe.push(t + '@' + Math.round(e.clientX) + ',' + Math.round(e.clientY)); }, true);
    });
    const r = c.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  })()`));

  // 先把画布滚到视口中部，否则 rect 里的 y 可能落在窗口外，elementFromPoint 返回 null
  await evalJS(`document.getElementById('canvas-embroidery').scrollIntoView({block:'center'})`);
  await sleep(900);
  console.log('视口信息:', await evalJS(`JSON.stringify({iw: innerWidth, ih: innerHeight, sx: scrollX, sy: scrollY, dpr: devicePixelRatio})`));

  const box = await evalJS(`(() => { const r = document.getElementById('canvas-embroidery').getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })()`);
  console.log('滚动后 rect:', JSON.stringify(box));
  const x0 = box.x + box.w * 0.3, y0 = box.y + box.h * 0.4;
  const x1 = box.x + box.w * 0.7, y1 = box.y + box.h * 0.6;
  console.log('拖拽 from', Math.round(x0), Math.round(y0), 'to', Math.round(x1), Math.round(y1));

  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1 });
  for (let i = 1; i <= 14; i++) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1-x0)*i/14, y: y0 + (y1-y0)*i/14, button: 'left', buttons: 1 });
    await sleep(20);
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', clickCount: 1 });
  await sleep(600);

  console.log('\n探针捕获事件数:', await evalJS(`window.__probe.length`));
  console.log('前 6 个:', await evalJS(`JSON.stringify(window.__probe.slice(0,6))`));
  console.log('事件类型统计:', await evalJS(`JSON.stringify(window.__probe.reduce((a,e)=>{const t=e.split('@')[0];a[t]=(a[t]||0)+1;return a;},{}))`));
  console.log('已绣针数:', await evalJS(`document.getElementById('stitch-count')?.textContent`));
  console.log('hint 隐藏?', await evalJS(`document.getElementById('hint-embroidery')?.classList.contains('is-hidden')`));

  // 检查指针捕获目标
  console.log('elementFromPoint at start:', await evalJS(`(() => { const e = document.elementFromPoint(${Math.round(x0)}, ${Math.round(y0)}); return e ? e.tagName + '.' + e.className + '#' + e.id : 'null'; })()`));
  console.log('canvas 是否在 tabpanel 内且未 hidden:', await evalJS(`(() => { const c = document.getElementById('canvas-embroidery'); const p = c.closest('[role=tabpanel]'); return { panelHidden: p ? p.hidden : 'no-panel', panelId: p ? p.id : null, canvasVisible: c.offsetParent !== null, canvasRectH: Math.round(c.getBoundingClientRect().height) }; })()`));

  ws.close(); chrome.kill(); process.exit(0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
