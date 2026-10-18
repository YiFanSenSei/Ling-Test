/**
 * 验证「中直单位及机构」地区筛选已修复。
 *
 * 修复前：名录页地区筛选只有 33 项，京剧、昆曲、古琴艺术、格萨（斯）尔
 * 这 78 个中直单位申报的项目，按地区永远筛不出来。
 * 本脚本确认：筛选项存在、点得动、筛得到 78 条、首例是格萨（斯）尔这类。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const ROOT = join(import.meta.dirname, '..');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9358;
const BASE = process.env.TEST_BASE || 'http://localhost:4520/';
const PROFILE = join(process.env.TEMP || '/tmp', 'jz_region');
const SHOTS = join(ROOT, '_shots', 'region');

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(PROFILE, { recursive: true });
mkdirSync(SHOTS, { recursive: true });

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  '--user-data-dir=' + PROFILE, '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });

let ws, msgId = 0; const pending = new Map(); const errs = [];
function send(m, p = {}) { const id = ++msgId; return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })); }); }
async function ev(e) { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return 'ERR: ' + (r.exceptionDetails.exception?.description || '').split('\n')[0]; return r.result?.value; }
async function shot(n) { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(SHOTS, n + '.png'), Buffer.from(r.data, 'base64')); }

const res = []; const check = (l, p, d) => { res.push({ l, p }); console.log(`  ${p ? '✓' : '✗'} ${l}  → ${JSON.stringify(d)}`); };

async function main() {
  let t = null;
  for (let i = 0; i < 60; i++) { try { const L = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json()); t = L.find(x => x.type === 'page'); if (t) break; } catch {} await sleep(300); }
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise(r => { ws.on('open', r); });
  ws.on('message', raw => { const m = JSON.parse(raw.toString()); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); return; } if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text); });
  await send('Page.enable'); await send('Runtime.enable');

  await send('Page.navigate', { url: BASE + '#/gallery' });
  await sleep(2000);

  /*
   * 顺带钉住副标题：它曾经写的是 ${num(result.total)}，即筛选后的结果数。
   * 筛到 78 条时，副标题就成了「收录…拆分的 78 条子项记录」，
   * 读起来像本站只收了 78 条。这类错误页面不报错、测试不失败，只能靠断言守住。
   */
  const sub = await ev(`document.querySelector('.page-head p, .page-head .page-sub, main p')?.textContent?.replace(/\\s+/g, ' ').trim()`);
  check('副标题恒为全站 3,614 条，不随筛选变化', /3,?614/.test(sub || ''), sub);

  // 注意：.filter-chips 这个类在门类、批次、地区三轮筛选里都用了一次，
  // 直接取会把 52 个 chips 全选中。地区那一轮得靠 filter-row 里的 label 定位。
  const chips = await ev(`(() => {
    const rows = [...document.querySelectorAll('.filter-row')];
    const row = rows.find(r => r.querySelector('.filter-label')?.textContent.includes('地区'));
    if (!row) return 'no region row';
    return [...row.querySelectorAll('.tag-btn')].map(a => a.textContent.trim());
  })()`);
  // 行首还有一个「全部」按钮，所以是 34 个地区 + 1 个全部
  const regionOnly = Array.isArray(chips) ? chips.filter(c => c !== '全部') : chips;
  check('地区筛选项达到 34 个（外加「全部」）', Array.isArray(chips) && regionOnly.length === 34,
    { total: Array.isArray(chips) ? chips.length : chips, regions: Array.isArray(regionOnly) ? regionOnly.length : regionOnly });
  check('筛选里有「中直单位及机构」', Array.isArray(chips) && chips.includes('中直单位及机构'), Array.isArray(chips) ? chips.slice(-3) : chips);

  // 点它
  await ev(`(() => {
    const a = [...document.querySelectorAll('.filter-chips .tag-btn')].find(x => x.textContent.trim() === '中直单位及机构');
    if (a) a.click();
  })()`);
  await sleep(1500);

  const out = await ev(`({
    hash: location.hash,
    count: document.querySelector('.result-count')?.textContent?.trim(),
    cards: document.querySelectorAll('.pcard').length,
    page: document.querySelector('.result-page')?.textContent?.trim(),
    names: [...document.querySelectorAll('.pcard .pcard-name, .pcard h3, .pcard-title')].slice(0, 6).map(e => e.textContent.trim()),
  })`);
  check('点后 hash 带上了中直参数', String(out.hash).includes('region'), out.hash);
  check('筛出 78 条', String(out.count).includes('78'), out.count);
  check('第一页出卡 24 张', out.cards === 24, out.cards);
  check('首例是格萨（斯）尔或同类', out.names.some(n => /格萨|古琴|昆曲|京剧|评剧|梆子|木偶/.test(n)), out.names);
  await shot('1-gallery-institution');

  // 前进到第 4 页，应能看到 78 条的最后一批
  await ev(`document.querySelector('.result-page') && [...document.querySelectorAll('button, a')].find(b => /下一页|下页|›|»/.test(b.textContent))?.click()`);
  await sleep(1200);
  const p2 = await ev(`({ page: document.querySelector('.result-page')?.textContent?.trim(), n: document.querySelectorAll('.pcard').length })`);
  check('翻页后仍有内容', p2.n > 0, p2);
  await shot('2-gallery-institution-p2');

  // 首页柱状图仍只画省份
  await send('Page.navigate', { url: BASE + '#/' });
  await sleep(1800);
  const home = await ev(`(() => {
    // 首页有两个 .data-note：一个属于数据看板，一个属于地区分布区块。
    // 要的是地区那个 —— 它紧跟在 .region-list 后面。
    const list = document.querySelector('.region-list');
    const note = list ? (list.parentElement.querySelector('.data-note')
                      || list.nextElementSibling) : null;
    return {
      rows: [...document.querySelectorAll('.region-row .region-name')].map(e => e.textContent.trim()),
      note: note?.textContent?.replace(/\\s+/g, ' ').trim().slice(0, 140),
      regionStat: [...document.querySelectorAll('.stat')].map(s => s.textContent.replace(/\\s+/g, ' ').trim()).find(t => /中直/.test(t)),
    };
  })()`);
  check('首页柱状图不含中直项', !home.rows.includes('中直单位及机构'), home.rows.length);
  check('首页柱状图仍是 12 条', home.rows.length === 12, home.rows);
  check('首页说明仍提到 78 条', /78/.test(home.note || ''), home.note);
  check('首页覆盖区数显示 34', /34/.test(home.regionStat || ''), home.regionStat);
  await shot('3-home-region');

  console.log(`\n${'='.repeat(56)}`);
  const f = res.filter(r => !r.p);
  console.log(`共 ${res.length} 项，通过 ${res.length - f.length} 项，失败 ${f.length} 项`);
  if (errs.length) console.log('异常:', errs);
  ws.close(); chrome.kill();
  process.exit(f.length || errs.length ? 1 : 0);
}
main().catch(e => { console.error('失败:', e.message); try { chrome.kill(); } catch {} process.exit(2); });
