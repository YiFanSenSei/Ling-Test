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

// 体积推算
const bytes = Buffer.byteLength(JSON.stringify(detailsFile), 'utf-8');
if (withIntro.length) {
  const perRecord = bytes / Object.keys(details).length;
  const projected = perRecord * projects.length;
  console.log(`\n【体积】`);
  console.log(`  details.json 现值  ${(bytes / 1048576).toFixed(2)} MB（${num(Object.keys(details).length)} 条）`);
  console.log(`  单条平均          ${(perRecord / 1024).toFixed(2)} KB`);
  console.log(`  若全部录入        ≈ ${(projected / 1048576).toFixed(1)} MB（按当前单条均值线性外推）`);
  const projectsJson = Buffer.byteLength(await readFile('public/data/projects.json'), 'utf-8');
  console.log(`  单文件 HTML 预计  ≈ ${((projected + projectsJson) / 1048576 + 1.3).toFixed(1)} MB（含约 1.3 MB 代码与名录）`);
}

if (missing.length) {
  console.log(`\n【尚未抓取的前 10 条】`);
  for (const p of missing.slice(0, 10)) console.log(`  · ${p.name}（${p.unit}）`);
  console.log(`\n续抓：node scripts/fetch-all-details.mjs`);
} else {
  console.log(`\n✓ 名录全部条目均已抓取。`);
}
