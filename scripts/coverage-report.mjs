/**
 * 详情覆盖率报告（离线，不联网）
 *
 * 用途：抓取期间随时确认「名录里有多少条点进去真的有正文」，
 * 以及全量补录完成后算最终体积。抓取脚本本身只报新增数量，
 * 这个脚本回答的是「还差多少」。
 *
 * 用法：node scripts/coverage-report.mjs
 */

import { readFile } from 'node:fs/promises';

const projects = JSON.parse(await readFile('public/data/projects.json', 'utf-8'));
const detailsFile = JSON.parse(await readFile('public/data/details.json', 'utf-8'));
const details = detailsFile.details || {};

const num = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : '0.0');

const withDetail = projects.filter(p => details[String(p.id)]);
const withIntro = withDetail.filter(p => details[String(p.id)].intro);
const missing = projects.filter(p => !details[String(p.id)]);

const intros = withIntro.map(p => details[String(p.id)].intro.length);
const sumChars = intros.reduce((a, b) => a + b, 0);

const allInheritors = [];
const seenInheritor = new Set();
for (const k of Object.keys(details)) {
  for (const h of details[k].inheritors || []) {
    allInheritors.push(h);
    seenInheritor.add(`${h.code || ''}|${h.name}`);
  }
}

console.log('【详情覆盖率】');
console.log(`  名录记录          ${num(projects.length)} 条`);
console.log(`  有详情条目        ${num(withDetail.length)} 条（${pct(withDetail.length, projects.length)}%）`);
console.log(`  其中有正文        ${num(withIntro.length)} 条（占全部 ${pct(withIntro.length, projects.length)}%）`);
console.log(`  尚未抓取          ${num(missing.length)} 条`);

// 进度条
const filled = Math.round((withIntro.length / projects.length) * 40);
console.log(`\n  [${'█'.repeat(filled)}${'░'.repeat(40 - filled)}] ${pct(withIntro.length, projects.length)}%`);

if (intros.length) {
  console.log(`\n【正文体量】`);
  console.log(`  平均              ${Math.round(sumChars / intros.length)} 字/条`);
  console.log(`  最短 / 最长       ${Math.min(...intros)} / ${Math.max(...intros)} 字`);
  console.log(`  正文总字数        ${num(sumChars)} 字`);
}

console.log(`\n【传承人】`);
console.log(`  记录数            ${num(allInheritors.length)} 条（去重后 ${num(seenInheritor.size)} 人）`);
console.log(`  有传承人的项目    ${num(withDetail.filter(p => (details[String(p.id)].inheritors || []).length).length)} 条`);

// 按门类
const cats = [...new Set(projects.map(p => p.category))];
console.log(`\n【分门类覆盖】`);
console.log('  门类                    记录    有正文    覆盖率');
for (const c of cats) {
  const tot = projects.filter(p => p.category === c).length;
  const got = withIntro.filter(p => p.category === c).length;
  console.log(
    `  ${String(c).padEnd(20)}  ${String(tot).padStart(5)}  ${String(got).padStart(6)}  ${pct(got, tot).padStart(6)}%`
  );
}

/* 体积（体积方案 B：详情切成按需加载的分片，不再全部内联进首屏）
 *
 * 这里刻意把「首屏」与「分片」分开报：
 * 补录推进时增长的只有分片，首屏是恒定的——这正是选方案 B 的理由。
 * 早期只报「单文件 HTML 预计 13.3 MB」，把这两件事混在一起，
 * 于是每加一条详情都像是在把首屏撑大。
 */
const bytes = Buffer.byteLength(JSON.stringify(detailsFile), 'utf-8');
const projectsBytes = Buffer.byteLength(await readFile('public/data/projects.json'), 'utf-8');
const metaBytes = Buffer.byteLength(await readFile('public/data/meta.json'), 'utf-8');
const shardCount = Math.ceil(projects.length / 200);

console.log(`\n【体积（方案 B：详情分片按需加载）】`);
console.log(`  details.json 现值    ${(bytes / 1048576).toFixed(2)} MB（${num(Object.keys(details).length)} 条，单条均 ${(bytes / Math.max(1, Object.keys(details).length) / 1024).toFixed(2)} KB）`);

if (missing.length) {
  const per = bytes / Math.max(1, Object.keys(details).length);
  console.log(`  全量补录后预估      ≈ ${(per * projects.length / 1048576).toFixed(1)} MB`);
}
console.log(`  首屏 index.html      ≈ ${((projectsBytes + metaBytes) / 1048576 + 1.3).toFixed(2)} MB（与补录进度无关，恒定）`);
console.log(`  分片合计             ≈ ${(bytes / 1048576).toFixed(1)} MB，${shardCount} 片 × 200 条（点进项目才注入）`);
console.log(`  压缩包（zip）        ≈ ${(((bytes + projectsBytes + metaBytes) / 1048576) * 0.25).toFixed(1)} MB（按文本 4:1 粗估）`);

if (missing.length) {
  console.log(`\n【尚未抓取的前 10 条】`);
  for (const p of missing.slice(0, 10)) console.log(`  · ${p.name}（${p.unit}）`);
  console.log(`\n续抓：node scripts/fetch-all-details.mjs`);
} else {
  console.log(`\n✓ 名录全部条目均已抓取。`);
}
