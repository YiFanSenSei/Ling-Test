/**
 * 适配验证：比赛要求的三档界面规格 + 移动端
 *
 * 按手册，评委展示时会随机改浏览器规格，自适应是加分项。
 * 这里逐档截图并检查是否出现横向滚动条（变形的直接判据）。
 *
 * 运行：先 vite preview --port 4520，再 node scripts/adapt-test.cjs
 */

const http = require('http');
const { spawn } = require('child_process');
const { mkdirSync } = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9337;
const BASE = 'http://localhost:4520/';
const OUT = path.join(__dirname, '..', '_shots', 'adapt');

const SIZES = [
  { key: '1920', w: 1920, h: 1080, label: '1920×1080（比赛规格之一）' },
  { key: '1440', w: 1440, h: 900, label: '1440×900（本站申报规格）' },
  { key: '720', w: 720, h: 1280, label: '720（比赛规格之一）' },
  { key: 'mobile-390', w: 390, h: 844, label: '390×844（移动端加分项）' },
  { key: 'tablet-834', w: 834, h: 1112, label: '834×1112（平板）' },
];

const PAGES = [
  { key: 'home', hash: '#/' },
  { key: 'gallery', hash: '#/gallery' },
  { key: 'project', hash: '#/project/13978' },
  { key: 'inheritors', hash: '#/inheritors' },
  { key: 'inheritor', hash: '#/inheritor/13978-0' },
  { key: 'simulator', hash: '#/simulator' },
  { key: 'about', hash: '#/about' },
];

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
  mkdirSync(OUT, { recursive: true });

  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-crashpad',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${process.env.TEMP}\\cr-adapt`,
    'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { await get('/json/version'); break; } catch { await sleep(200); } }

  const page = (await get('/json/list')).find(t => t.type === 'page');
  const WebSocket = (await import('ws')).default;
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0; const pending = new Map();
  ws.on('message', raw => { const m = JSON.parse(raw); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await new Promise(r => ws.on('open', r));
  const evalJS = async e => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) return 'ERR: ' + r.result.exceptionDetails.text;
    return r.result?.result?.value;
  };

  await send('Page.enable'); await send('Runtime.enable');

  const report = [];

  for (const size of SIZES) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: size.w, height: size.h, deviceScaleFactor: 1, mobile: size.w < 800,
    });

    for (const pg of PAGES) {
      await send('Page.navigate', { url: BASE + pg.hash });
      await sleep(2200);

      // 横向溢出检测：文档宽度超过视口即有横向滚动条
      const m = await evalJS(`(() => {
        const de = document.documentElement;
        let worst = null, worstOver = 0;
        for (const el of document.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          const over = r.right - de.clientWidth;
          if (over > worstOver + 1) {
            worstOver = over;
            worst = { tag: el.tagName, cls: String(el.className).slice(0, 60), right: Math.round(r.right) };
          }
        }
        return {
          scrollW: de.scrollWidth,
          clientW: de.clientWidth,
          hOverflow: de.scrollWidth - de.clientWidth,
          docH: de.scrollHeight,
          worst,
        };
      })()`);

      const shot = path.join(OUT, `${size.key}-${pg.key}.png`);
      const cap = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      if (cap.result?.data) {
        require('fs').writeFileSync(shot, Buffer.from(cap.result.data, 'base64'));
      }

      report.push({ size: size.key, page: pg.key, ...m, shot });
    }
  }

  await send('Emulation.clearDeviceMetricsOverride');

  // 打印简洁表格
  console.log('\n规格      页面        横向溢出  文档宽/视口   最高溢出元素');
  console.log('-'.repeat(78));
  for (const r of report) {
    const flag = r.hOverflow > 1 ? '  ✗' : '  ✓';
    const worst = r.worst ? `${r.worst.tag}.${r.worst.cls} (右${r.worst.right})` : '—';
    console.log(
      `${r.size.padEnd(10)}${r.page.padEnd(12)}${String(r.hOverflow).padStart(6)}${flag}  ` +
      `${r.scrollW}/${r.clientW}`.padEnd(14) + worst
    );
  }

  const bad = report.filter(r => r.hOverflow > 1);
  console.log(`\n共 ${report.length} 个组合，横向溢出 ${bad.length} 个。`);
  if (bad.length) {
    console.log('需要修的组合：');
    bad.forEach(b => console.log(`  ${b.size} / ${b.page}: 溢出 ${b.hOverflow}px — ${b.worst ? b.worst.tag + '.' + b.worst.cls : '未知'}`));
  }

  ws.close(); chrome.kill(); process.exit(bad.length ? 2 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
