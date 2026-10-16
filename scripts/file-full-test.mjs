/**
 * file:// 下的完整功能验证
 *
 * 单文件产物在真实浏览器里能打开首页，不代表能用。
 * 本脚本依次走一遍全部路由与关键交互，全部在 file:// 协议下完成——
 * 这正是评委双击 index.html 时的真实环境。
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');

// 路径由脚本位置推导，不写死本机绝对路径
const ROOT = join(import.meta.dirname, '..');
const CHROME = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9366;
const PROFILE = join(process.env.TEMP || '/tmp', 'jz_file_full');
const BASE = pathToFileURL(join(ROOT, 'dist', 'index.html')).href;

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(PROFILE, { recursive: true });

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=' + PROFILE,
  '--no-first-run', '--no-default-browser-check',
  '--window-size=1440,900',
  'about:blank',
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const errors = [];

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
      return;
    }
    if (m.method === 'Runtime.exceptionThrown') {
      errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] || m.params.exceptionDetails.text);
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      errors.push(m.params.entry.text.slice(0, 150));
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');

  // 必须先导航到文件本体。
  // 从 about:blank 上设 location.hash 只会改空白页的地址，不会加载我们的文件，
  // 结果每个断言都取到 undefined——这个坑很隐蔽。
  await send('Page.navigate', { url: BASE });
  await sleep(4000);

  const routes = [
    ['首页', '#/', `document.querySelector('.hero-title')?.textContent.trim().replace(/\\s+/g,'')`],
    ['名录', '#/gallery', `document.querySelector('.result-count')?.textContent.trim().replace(/\\s+/g,'')`],
    ['筛选', '#/gallery?category=%E4%BC%A0%E7%BB%9F%E7%BE%8E%E6%9C%AF', `String(document.querySelectorAll('.pcard').length)`],
    ['搜索', '#/gallery?q=%E8%8B%8F%E7%BB%A3', `String(document.querySelectorAll('.pcard').length)`],
    // 分片按需加载：体积方案 B 的命门。
    // 这一对断言必须排在**任何项目页被访问之前**——先取基线，再打开一条项目，
    // 看「本次」只新增了多少条。若像早期那样放在路由列表末尾，前面几次项目页
    // 访问已经注入了好几片，报出的累计值（如 414 条）分不清「本次注入一片」
    // 与「一路攒下来」，结论虽仍成立，数字却随测试顺序漂移，不再可复现。
    // 走名录最后一条（最后一个分片，该片只有 14 条）——最坏情况。
    ['分片-基线', '#/gallery', `window.__JZ_PROBE__ = Object.keys(window.__JZ_DETAILS__ || {}).length; return '尚未注入 ' + window.__JZ_PROBE__ + ' 条'`],
    ['分片按需加载', '#/project/23631', `(() => {
      const before = window.__JZ_PROBE__ || 0;
      const loaded = Object.keys(window.__JZ_DETAILS__ || {}).length;
      const total = (window.__JZ_DATA__['detail-index'] || {}).count || 0;
      const title = document.querySelector('.project-title')?.textContent.trim() || '(无标题)';
      const paras = document.querySelectorAll('.project-text').length;
      return title + ' | 本次注入 ' + (loaded - before) + ' 条（一片上限 200）| 累计 ' + loaded + '/' + total + ' | 正文 ' + paras + ' 段';
    })()`],
    ['档案', '#/project/13978', `document.querySelector('.project-title')?.textContent.trim()`],
    // 同一项目的其他申报地区：苏绣组共 5 条记录（Ⅶ-018），本页之外应有 4 条
    ['同项目其他地区', '#/project/13978', `String(document.querySelectorAll('.variant').length)`],
    ['同项目其他地区-首条', '#/project/13978', `document.querySelector('.variant-name')?.textContent.trim()`],
    // 剪纸组 56 条（Ⅶ-016），是所有项目里申报地区最多的一组
    ['剪纸组条数', '#/project/13924', `String(document.querySelectorAll('.variant').length)`],
    // 卡片地区必须精确到市/县（unit），不能用省级 region。
    // 苗族古歌由台江、黄平两地申报，用省级渲染就是两张一模一样的卡片——
    // 「内容重复」的观感正是这么来的。这里要求 4 张卡片的地区各不相同。
    ['卡片地区-市县', '#/gallery?q=%E8%8B%97%E6%97%8F%E5%8F%A4%E6%AD%8C', `(() => {
      const rs = [...document.querySelectorAll('.pcard-region')].map(e => e.textContent.trim());
      return rs.length + ' 张 / 去重 ' + new Set(rs).size + ' 种 | ' + rs.join(' / ');
    })()`],
    // 「同项目 N 处申报」徽标：把「为什么列表里有好几张同名卡片」写在卡片上
    ['同项目徽标', '#/gallery?q=%E8%8B%97%E6%97%8F%E5%8F%A4%E6%AD%8C', `(() => {
      const b = [...document.querySelectorAll('.pcard-variant')].map(e => e.textContent.trim());
      return b.length + ' 枚 | ' + (b[0] || '(无)');
    })()`],
    // 共用简介说明：12178（台江县）与 12177（黄平县）正文逐字相同，
    // 页面必须自己说清楚，否则读者连点两条会以为站点在复读。
    ['共用简介说明', '#/project/12178', `document.querySelector('.intro-shared')?.textContent.trim().replace(/\\s+/g,'').slice(0, 60) || '(无)'`],
    // 反向断言：12179（花垣县）的正文是官网单独写的，不该出现这句说明。
    // 少了这一条，「说明」有可能变成无差别贴在所有页面上而测试照过。
    ['独有正文无说明', '#/project/12179', `document.querySelector('.intro-shared') ? '有说明(不该有)' : '无说明(正确)'`],
    // 详情覆盖率：全量补录的目标是名录每一条都有官方正文。
    // 详情已切成 dist/data/detail-N.js 按需注入，不再内联，
    // 因此这里读的是构建期内联的小索引 detail-index。
    // （早期这里断言的是某条「无正文」记录的说明文案；补录推进后那条记录
    //   随时可能被填上，断言会静默变成 undefined，所以改成覆盖率。）
    ['详情覆盖率', '#/about', `(() => { const d = window.__JZ_DATA__ || {}; const idx = d['detail-index'] || {}; const proj = d.projects || []; return (idx.withIntro || 0) + '/' + proj.length; })()`],
    ['项目传承人', '#/project/13978', `String(document.querySelectorAll('.inheritor').length)`],
    ['传承人名录', '#/inheritors', `document.querySelector('.result-count')?.textContent.trim().replace(/\\s+/g,'')`],
    ['传承人卡', '#/inheritors', `String(document.querySelectorAll('.inh-card').length)`],
    ['传承人档案', '#/inheritor/13978-0', `document.querySelector('.inh-hero-name')?.textContent.trim()`],
    ['档案-同门', '#/inheritor/13978-0', `String(document.querySelectorAll('.inh-grid-compact .inh-card').length)`],
    ['传承人检索', '#/inheritors?q=%E5%A7%9A', `String(document.querySelectorAll('.inh-card').length)`],
    ['体验', '#/simulator', `document.querySelectorAll('.sim-tab').length`],
    ['关于', '#/about', `document.querySelectorAll('.about-block').length`],
    // 关于页声称「3614 条记录按编号前缀归并恰好得到 1557 个编号」——
    // 这句话是拿数据现算的，必须能被断言验证，否则就只是页面上的漂亮话
    ['关于-编号归并', '#/about', `(() => { const p = [...document.querySelectorAll('.about-callout p')].find(x => x.textContent.includes('不同的编号')); return p ? (p.textContent.replace(/\\s+/g,'').match(/([\\d,]+)个不同的编号/) || [])[1] : null; })()`],
    ['404', '#/no-such-page', `document.querySelector('.empty-state h3, .notfound h1')?.textContent.trim()`],
    ['404-传承人', '#/inheritor/999-99', `document.querySelector('.empty-state h3, .notfound h1')?.textContent.trim()`],
  ];

  const results = [];
  for (const [label, hash, expr] of routes) {
    await send('Runtime.evaluate', { expression: `location.hash = ${JSON.stringify(hash)}` });
    await sleep(1200);
    const val = await evalJS(`return ${expr};`);
    results.push([label, val]);
  }

  // 绣布拖拽（评委最可能试的交互）
  await send('Runtime.evaluate', { expression: `location.hash = '#/simulator'` });
  await sleep(1500);
  await evalJS(`
    const c = document.querySelector('#canvas-embroidery');
    if (c) c.scrollIntoView({ block: 'center', behavior: 'instant' });
    return true;
  `);
  await sleep(800);

  const rect = await evalJS(`
    const c = document.querySelector('#canvas-embroidery');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
  `);

  let stitch = '无法取到画布';
  if (rect && rect.startsWith('{')) {
    const p = JSON.parse(rect);
    // 真实鼠标拖拽
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x - 90, y: p.y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' });
    for (let i = 1; i <= 12; i++) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x - 90 + i * 14, y: p.y + Math.sin(i / 2) * 24, button: 'left', buttons: 1, pointerType: 'mouse' });
      await sleep(45);
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x + 78, y: p.y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' });
    await sleep(700);
    stitch = await evalJS(`return document.querySelector('.tool-stat')?.textContent.trim().replace(/\\s+/g,'') || '读不到';`);
  }
  results.push(['苏绣拖拽', stitch]);

  console.log('=== file:// 下功能验证（模拟评委双击打开）===\n');
  for (const [label, val] of results) {
    console.log(`  ${label.padEnd(8, '　')} → ${val}`);
  }
  console.log('\n=== 控制台错误 ===');
  console.log(errors.length ? errors.map(e => '  ✗ ' + e).join('\n') : '  ✓ 无任何错误');

  ws.close();
  chrome.kill();
}

main().catch(e => { console.error('失败:', e.message); chrome.kill(); process.exit(1); });
