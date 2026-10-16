/**
 * 全量项目详情抓取
 *
 * 背景：`fetch-details.mjs` 是按关键词挑 151 个「策展级」项目抓的，
 * 于是名录里另外 3,464 条记录点进去只有表格、没有正文——
 * 实测抽样 30 条（每门类首/中/末各一条）**30/30 都有 400–1,200 字正文**，
 * 并非官网缺内容，纯粹是我们没请求过那些页面。
 *
 * 本脚本按 id 抓**全部**记录，把名录的每一个条目都填上正文。
 *
 * 特性：
 *   - 断点续抓：已有的 details.json 条目直接复用，重跑只补缺的
 *   - 并发 4 + 每请求 500ms 间隔，对官网保持礼貌
 *   - 每 SAVE_EVERY 条落盘一次，中断不丢进度
 *   - 紧凑 JSON（2 空格缩进的版本会平白多出约 15% 体积）
 *
 * 用法：
 *   node scripts/fetch-all-details.mjs              全量抓（跳过已有）
 *   node scripts/fetch-all-details.mjs --limit 50   只抓 50 条（试跑）
 *   node scripts/fetch-all-details.mjs --refetch    忽略已有，全部重抓
 *
 * 输出：public/data/details.json
 */

import { readFile, writeFile, rename } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseDetail } from './lib/parse-detail.mjs';

const ORIGIN = 'https://www.ihchina.cn';
const RETRY = 3;
const CONCURRENCY = 4;
const DELAY = 500;        // 每个 worker 两次请求之间的间隔
const SAVE_EVERY = 250;   // 每抓这么多条落一次盘

const args = process.argv.slice(2);
const LIMIT = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
const REFETCH = args.includes('--refetch');

async function fetchHTML(url, attempt = 1) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    if (attempt < RETRY) {
      await sleep(800 * attempt);
      return fetchHTML(url, attempt + 1);
    }
    throw new Error(err.message);
  }
}

const projects = JSON.parse(await readFile('public/data/projects.json', 'utf-8'));

let prev = { details: {} };
try {
  prev = JSON.parse(await readFile('public/data/details.json', 'utf-8'));
} catch { /* 首次运行没有旧文件 */ }

const details = REFETCH ? {} : { ...(prev.details || {}) };
const reused = Object.keys(details).length;

const todo = projects.filter(p => !details[String(p.id)]).slice(0, LIMIT);

console.log(`名录 ${projects.length} 条 / 已有详情 ${reused} 条 / 本次待抓 ${todo.length} 条`);
console.log(`并发 ${CONCURRENCY}，每请求间隔 ${DELAY}ms\n`);
if (!todo.length) {
  console.log('没有需要抓的记录。');
  process.exit(0);
}

const stats = {
  ok: 0, fail: 0, noIntro: 0, noInheritors: 0,
  introChars: 0, inheritors: 0, withImages: 0, imageCount: 0,
};
const failures = [];
let done = 0;
let cursor = 0;
const t0 = Date.now();

const writeOut = async () => {
  const output = {
    generatedAt: new Date().toISOString(),
    source: ORIGIN,
    count: Object.keys(details).length,
    details,
  };
  // 先写临时文件再改名：中途被杀不会留下半截 JSON
  await writeFile('public/data/details.json.tmp', JSON.stringify(output), 'utf-8');
  await rename('public/data/details.json.tmp', 'public/data/details.json');
};

const worker = async () => {
  while (cursor < todo.length) {
    const proj = todo[cursor++];
    const url = `${ORIGIN}/project_details/${proj.id}.html`;
    try {
      const html = await fetchHTML(url);
      const d = parseDetail(html);
      details[String(proj.id)] = {
        id: proj.id,
        name: proj.name,
        projectNo: proj.projectNo,
        category: proj.category,
        province: proj.province,
        batch: proj.batch,
        ...d,
        sourceUrl: url,
      };
      stats.ok++;
      if (d.intro) stats.introChars += d.intro.length; else stats.noIntro++;
      if (d.inheritors && d.inheritors.length) stats.inheritors += d.inheritors.length;
      else stats.noInheritors++;
      if (d.images && d.images.length) { stats.withImages++; stats.imageCount += d.images.length; }
    } catch (err) {
      stats.fail++;
      failures.push(`${proj.name}(id=${proj.id}): ${err.message}`);
    }
    done++;

    if (done % 25 === 0 || done === todo.length) {
      const secs = (Date.now() - t0) / 1000;
      const rate = done / secs;
      const left = (todo.length - done) / rate;
      process.stdout.write(
        `\r  ${String(done).padStart(5)}/${todo.length}  ` +
        `成功 ${stats.ok}  失败 ${stats.fail}  ` +
        `正文均 ${stats.ok ? Math.round(stats.introChars / stats.ok) : 0} 字  ` +
        `${rate.toFixed(1)} 条/秒  剩余 ${Math.ceil(left / 60)} 分   `
      );
    }
    if (done % SAVE_EVERY === 0) { await writeOut(); process.stdout.write(' [已落盘]'); }

    await sleep(DELAY);
  }
};

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
await writeOut();

const secs = (Date.now() - t0) / 1000;
console.log(`\n\n完成：新增 ${stats.ok} 条，失败 ${stats.fail} 条，用时 ${(secs / 60).toFixed(1)} 分`);
console.log(`details.json 共 ${Object.keys(details).length} 条`);
console.log(`  有正文        ${stats.ok - stats.noIntro} 条（平均 ${stats.ok ? Math.round(stats.introChars / stats.ok) : 0} 字）`);
console.log(`  无正文        ${stats.noIntro} 条`);
console.log(`  传承人合计    ${stats.inheritors} 位，${stats.ok - stats.noInheritors} 条记录有传承人`);
console.log(`  带配图记录    ${stats.withImages} 条 / 图片共 ${stats.imageCount} 张`);
if (failures.length) {
  console.log(`\n失败清单（前 20 条）：`);
  for (const f of failures.slice(0, 20)) console.log(`  ✗ ${f}`);
}
