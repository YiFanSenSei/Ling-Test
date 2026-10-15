/**
 * 名录页筛选诊断：抓取筛选后页面的实际 DOM，看是渲染空、还是报错。
 */
const http = require('http');
const { spawn } = require('child_process');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9334;
const BASE = 'http://localhost:4520/';

function get(path) {
  return new Promise((res, rej) => {
    http.get(`http://127.0.0.1:${PORT}${path}`, r => {
      let b = ''; r.on('data', d => b += d);
      r.on('end', () => { try { res(JSON.parse(b || '{}')); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-crashpad',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${process.env.TEMP}\\cr-diag`,
    '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore' });

  for (let i = 0; i < 60; i++) { try { await get('/json/version'); break; } catch { await sleep(200); } }
  const page = (await get('/json/list')).find(t => t.type === 'page');
  const WebSocket = (await import('ws')).default;
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0; const pending = new Map();
  const logs = [];

  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.method === 'Runtime.consoleAPICalled') {
      logs.push('[console.' + m.params.type + '] ' + (m.params.args || []).map(a => a.value ?? a.description ?? JSON.stringify(a.preview?.properties)).join(' '));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      logs.push('[EXCEPTION] ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
    }
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise(res => {
    const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params }));
  });
  await new Promise(r => ws.on('open', r));
  const evalJS = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;

  await send('Page.enable'); await send('Runtime.enable');

  await send('Page.navigate', { url: BASE + '#/gallery' });
  await sleep(2600);
  console.log('初始 hash:', await evalJS('location.hash'));
  console.log('初始条数:', await evalJS(`document.querySelector('.result-count strong')?.textContent`));
  console.log('初始卡片:', await evalJS(`document.querySelectorAll('.pcard').length`));

  console.log('\n--- 点击「传统美术」---');
  await evalJS(`[...document.querySelectorAll('.filter-chips a')].find(a => a.textContent.trim() === '传统美术')?.click()`);
  await sleep(2000);
  console.log('hash:', await evalJS('location.hash'));
  console.log('条数:', await evalJS(`document.querySelector('.result-count strong')?.textContent`));
  console.log('卡片:', await evalJS(`document.querySelectorAll('.pcard').length`));
  console.log('main 内容长度:', await evalJS(`document.getElementById('main')?.innerHTML?.length`));
  console.log('main 前 700 字:', (await evalJS(`document.getElementById('main')?.innerHTML?.slice(0,700)`))?.replace(/\s+/g, ' '));
  console.log('有 empty-state?', await evalJS(`!!document.querySelector('.empty-state')`));
  console.log('empty 文案:', await evalJS(`document.querySelector('.empty-state h3')?.textContent`));
  console.log('result-count 元素存在?', await evalJS(`!!document.querySelector('.result-count')`));
  console.log('result-count 全文:', await evalJS(`document.querySelector('.result-count')?.textContent?.trim()`));

  console.log('\n--- 控制台日志 ---');
  logs.slice(0, 30).forEach(l => console.log(l));

  ws.close(); chrome.kill(); process.exit(0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
