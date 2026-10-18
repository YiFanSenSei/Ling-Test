/**
 * 详情分片生成（体积方案 B）
 *
 * 背景：全量补录后 details.json 约 10 MB，而评委从名录随手点开的只是其中一条。
 *   若把它整体内联进 index.html，首屏就要吞下 10 MB；若整体外链，一次点击
 *   也要下载 10 MB。都不划算。
 *
 * 做法：把详情按「官方名录顺序」切成固定条数的分片，写成一堆普通脚本；
 *   运行时点进某个项目时只注入它所在的那一片（约 600 KB）。
 *
 * ⚠️ 为什么分片写成 <script> 而不是 .json：
 *   Chrome 自 2021 年起禁止 file:// 页面 fetch 同目录文件（origin 为 null），
 *   但**允许**普通 <script src>（受限的只有 type="module"）。
 *   分片因此写成「向 window.__JZ_DETAILS__ 挂数据」的普通脚本，
 *   这样「双击 index.html 即用」这条底线不会被打破。
 *   详见 vite.config.js 顶部注释与 NOTES.md。
 *
 * 产出（全部落在 public/data/，会被 vite 原样拷进 dist/data/）：
 *   detail-index.json    覆盖率、分片参数、名录顺序的 id 列表（会被内联，体积小）
 *   detail-<k>.js        详情分片，每片 SHARD_SIZE 条
 *   inheritors.js        扁平化的传承人索引（传承人页按需加载）
 *   inheritor-stats.json 传承人统计（首页只要数字，不该为此加载整个索引）
 *   featured.json        首页「精选馆藏」的策展名单
 *
 * 用法：node scripts/split-details.mjs
 * 说明：pnpm dev / pnpm build 前会自动跑（见 package.json 的 predev / prebuild）。
 */

import { readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const DATA = join(ROOT, 'public', 'data');
const SRC = join(DATA, 'details.json');

/** 每片条数。200 条 ≈ 600 KB，一次点击的加载量与「看一条」相称。 */
const SHARD_SIZE = 200;

/**
 * 首页「精选馆藏」的策展名单。
 *
 * 为什么不再用「有详情的项目里排前八个」：
 *   补录之前只有 151 个策展级项目有详情，按插入顺序取前八，
 *   实际出现的是「苏绣 ×4 + 苗族古歌 ×2」——四个苏绣变体占掉一半版面，
 *   另两条还是同一项目的不同申报地区。补录后全部记录都有详情，
 *   这个取法只会更糟，所以改成显式点名。
 *
 * 选法：覆盖尽可能多的门类，且优先本站有对应体验/关联的项目
 *   （苏绣、宣纸、香山帮分别对应三个模拟器）。
 * 第二列是**校验用的项目名**——名字对不上会直接报错，
 *   避免数据更新后 id 漂移却静默换成了别的项目。
 */
const FEATURED = [
  ['13978', '苏绣', '传统美术'],
  ['14376', '宣纸制作技艺', '传统技艺'],
  ['14306', '香山帮传统建筑营造技艺', '传统技艺'],
  ['13133', '昆曲', '传统戏剧'],
  ['12484', '古琴艺术', '传统音乐'],
  ['13581', '苏州评弹（苏州评话、苏州弹词）', '曲艺'],
  ['13794', '太极拳（杨氏太极拳）', '传统体育、游艺与杂技'],
  ['15059', '农历二十四节气', '民俗'],
];

if (!existsSync(SRC)) {
  console.error(`找不到 ${SRC}`);
  console.error('请先跑 node scripts/fetch-all-details.mjs 抓取详情。');
  process.exit(1);
}

const detailsFile = JSON.parse(await readFile(SRC, 'utf8'));
const details = detailsFile.details || {};
const projects = JSON.parse(await readFile(join(DATA, 'projects.json'), 'utf8'));

/** 名录顺序的 id 列表——分片按这个顺序切，与官方名录的编排一致 */
const ids = projects.map(p => String(p.id)).filter(id => details[id]);
const missing = projects.length - ids.length;

const withIntro = ids.filter(id => (details[id].intro || '').trim()).length;

if (!ids.length) {
  console.error('details.json 里没有任何可用条目。');
  process.exit(1);
}

const shardCount = Math.ceil(ids.length / SHARD_SIZE);

/* ---------------- 分片 ---------------- */

const shards = Array.from({ length: shardCount }, () => ({}));
ids.forEach((id, pos) => { shards[Math.floor(pos / SHARD_SIZE)][id] = details[id]; });

// 清掉上一次生成的分片（条数变少时，残留的旧分片会让 shardCount 与文件对不上）
for (const name of await readdir(DATA)) {
  if (/^detail-\d+\.js$/.test(name)) await rm(join(DATA, name), { force: true });
}

/** JSON.stringify 的输出直接当 JS 字面量用；顺手防一手 </script> 序列 */
const lit = v => JSON.stringify(v).replace(/<\/script/gi, '<\\/script');

const sizes = [];
await Promise.all(shards.map(async (shard, k) => {
  const body = Object.entries(shard).map(([id, v]) => `s[${lit(id)}]=${lit(v)};`).join('');
  const js = `(function(g){var s=g.__JZ_DETAILS__||(g.__JZ_DETAILS__={});${body}})(window);\n`;
  const file = join(DATA, `detail-${k}.js`);
  await writeFile(file, js, 'utf8');
  sizes.push({ k, count: Object.keys(shard).length, bytes: Buffer.byteLength(js) });
}));

/* ---------------- 传承人索引 ---------------- */

/*
 * 扁平化的传承人索引。
 *
 * ⚠️ 这里的 id 必须用「项目内序号」（`<项目id>-<序号>`），不能用全局序号：
 *    项目详情页在渲染时直接拼 `#/inheritor/<项目id>-<序号>`，
 *    两边必须由同一套规则生成，否则所有传承人链接都会指向错误的人。
 *
 * ⚠️ 遍历顺序固定为名录顺序（而不是 details 的键顺序），
 *    这样传承人页的默认排序是稳定的，重跑本脚本不会让列表乱跳。
 */
const inheritors = [];
const seen = new Set();
for (const id of ids) {
  const proj = details[id];
  let n = 0;
  for (const p of proj.inheritors || []) {
    const key = `${p.code || 'x'}|${p.name}|${id}`;
    const idx = n;
    n += 1;
    if (seen.has(key)) continue;
    seen.add(key);
    inheritors.push({
      ...p,
      id: `${id}-${idx}`,
      projectId: String(id),
      projectTitle: proj.name,
      projectCategory: proj.category,
      projectNo: proj.projectNo,
      batch: proj.batch,
      province: proj.province,
    });
  }
}

const inheritorJs = `window.__JZ_INHERITORS__=${lit(inheritors)};\n`;
await writeFile(join(DATA, 'inheritors.js'), inheritorJs, 'utf8');

const withBirth = inheritors.filter(p => p.birth).length;
const withCode = inheritors.filter(p => p.code).length;

/*
 * 按批次统计字段空缺。
 *
 * 为什么要算这个：「关于」页要说明「传承人档案里的空缺不是抓取遗漏」。
 * 这句话必须能被数据支撑——实测（逐页核对过官网原文）空缺确实来自官网表格本身：
 * 第五批（2021）259 位传承人的编号与出生日期两栏**整体未填写**，
 * 其余批次也有部分行留空，多集中在出生日期。
 * 把统计写进数据、由页面现算，这样将来数据更新时那句结论会自动跟着变，
 * 不会变成拿一个过期结论去自证。
 */
const byBatch = {};
for (const p of inheritors) {
  const b = String(p.batch || '?');
  const x = byBatch[b] || (byBatch[b] = { total: 0, noCode: 0, noBirth: 0 });
  x.total += 1;
  if (!(p.code || '').trim()) x.noCode += 1;
  if (!(p.birth || '').trim()) x.noBirth += 1;
}

/*
 * 年龄结构（构建期算好，页面不加载继承者索引就能画）。
 *
 * ⚠️ 口径必须写死在这里，不然页面上的每个数字都会变成「不知道哪来的」：
 *  - 基准年取 2026（比赛当年）。官方名单只公布出生年份、不公布生卒，
 *    因此 1908 年出生的第一批传承人在这里显示为 118 岁——那不是脏数据，
 *    是他「若在世」的年龄。文案必须标明这一点，否则等于替官方宣告在世。
 *  - 只统计 birth 非空的记录。第四、五批官网这两栏整体空白，
 *    覆盖率会直接暴露出来，页面要照实呈现，不推测填补。
 */
const AGE_YEAR = 2026;
const AGE_BUCKETS = [
  { key: 'lt40', label: '40 岁以下', min: -Infinity, max: 39 },
  { key: '40s', label: '40–49 岁', min: 40, max: 49 },
  { key: '50s', label: '50–59 岁', min: 50, max: 59 },
  { key: '60s', label: '60–69 岁', min: 60, max: 69 },
  { key: '70s', label: '70–79 岁', min: 70, max: 79 },
  { key: '80plus', label: '80 岁以上', min: 80, max: Infinity },
];

const bornYears = [];
for (const p of inheritors) {
  const m = String(p.birth || '').match(/(\d{4})/);
  if (m) bornYears.push({ year: Number(m[1]), batch: p.batch });
}

const ages = bornYears.map(b => AGE_YEAR - b.year);
const ageHistogram = AGE_BUCKETS.map(b => ({
  key: b.key,
  label: b.label,
  count: ages.filter(a => a >= b.min && a <= b.max).length,
}));
const sortedAges = [...ages].sort((a, b) => a - b);
const ageSummary = {
  year: AGE_YEAR,
  counted: ages.length,
  mean: ages.length ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10 : 0,
  median: sortedAges.length ? sortedAges[Math.floor(sortedAges.length / 2)] : 0,
  min: sortedAges[0] ?? 0,
  max: sortedAges[sortedAges.length - 1] ?? 0,
  over70: ages.filter(a => a >= 70).length,
  over80: ages.filter(a => a >= 80).length,
  histogram: ageHistogram,
};

// 分批次：既要记录数，也要「有出生日期」的覆盖率——后者才是缺口所在
const ageByBatch = {};
for (const p of inheritors) {
  const b = String(p.batch || '?');
  const x = ageByBatch[b] || (ageByBatch[b] = { total: 0, born: 0, ages: [] });
  x.total += 1;
  const m = String(p.birth || '').match(/(\d{4})/);
  if (m) { x.born += 1; x.ages.push(AGE_YEAR - Number(m[1])); }
}
const ageBatchRows = Object.keys(ageByBatch).sort().map(b => {
  const x = ageByBatch[b];
  const s = [...x.ages].sort((p, q) => p - q);
  return {
    batch: b,
    total: x.total,
    born: x.born,
    coverage: x.total ? Math.round((x.born / x.total) * 1000) / 10 : 0,
    median: s.length ? s[Math.floor(s.length / 2)] : null,
  };
});

const inheritorStats = {
  total: inheritors.length,
  projects: new Set(inheritors.map(p => p.projectId)).size,
  categories: new Set(inheritors.map(p => p.projectCategory).filter(Boolean)).size,
  withBirth,
  withCode,
  /*
   * 民族数要剔除「其他」这种兜底取值。
   *
   * 实测 4,032 条里有 2 条的 ethnicity 是「其他」——官网表格里确实这么写，
   * 但它不是一个民族。直接 new Set().size 会把它算进去，对外就成了
   * 「54 个民族」，比实际多一个。数字小，但属于虚报，不能留着。
   */
  ethnicities: new Set(
    inheritors.map(p => (p.ethnicity || '').trim()).filter(e => e && e !== '其他'),
  ).size,
  byBatch,
  age: { ...ageSummary, byBatch: ageBatchRows },
};
await writeFile(join(DATA, 'inheritor-stats.json'),
  `${JSON.stringify(inheritorStats, null, 2)}\n`, 'utf8');

/* ---------------- 精选名单 ---------------- */

const byId = new Map(projects.map(p => [String(p.id), p]));
const featuredIds = [];
const featuredMissed = [];
for (const [id, name, category] of FEATURED) {
  const p = byId.get(id);
  if (!p) { featuredMissed.push(`${id}（名录中不存在）`); continue; }
  if (p.name !== name) { featuredMissed.push(`${id} 期望「${name}」，实际「${p.name}」`); continue; }
  if (category && p.category !== category) { featuredMissed.push(`${id} 门类期望「${category}」，实际「${p.category}」`); continue; }
  if (!details[id]) { featuredMissed.push(`${id}「${name}」没有详情`); continue; }
  featuredIds.push(id);
}
if (featuredMissed.length) {
  console.error('\n✗ 精选名单校验未通过，请修正 scripts/split-details.mjs 的 FEATURED：');
  for (const m of featuredMissed) console.error(`    ${m}`);
  process.exit(1);
}
await writeFile(join(DATA, 'featured.json'),
  `${JSON.stringify({ ids: featuredIds }, null, 2)}\n`, 'utf8');

/* ---------------- 共用简介 / 多申报项目 ----------------
 *
 * 官网为「一个项目」只写一份简介。多申报地区的记录（苗族古歌由台江、黄平、
 * 花垣三地申报就是典型）在官网上各自成页，但正文是同一份。
 *
 * 实测（全量 3614 条）：去掉首行「申报地区或单位：…」并忽略空白后，有 200 组、
 * 共 482 条（13.3%）的正文逐字相同，且**全部落在同一个项目号前缀内**，
 * 跨项目重复 0 组。
 * 也就是说这不是抓取错误，是官方登记方式本身。
 *
 * 但前端原样铺开，读者连点两页就会以为站点在复读——「苗族古歌有三四个」
 * 就是这么来的。所以在这里算好两件事交给展示层：
 *   introShared[id] = { count, index }  本条正文与同项目另外 count-1 条完全相同
 *   prefixCount[前缀] = n               该前缀（= 一个项目）下的申报记录数，只记 n>1
 * 两者都写进会被内联的 detail-index.json，量级只有几百条，体积可控。
 */

/** 去掉首行申报地区、去掉全部空白后的正文——用作「是否同一份简介」的指纹 */
const introBody = t => String(t || '')
  .replace(/^申报地区或单位：\S+\s*/, '')
  .replace(/\s+/g, '')
  .trim();

const bodyGroups = new Map();
for (const id of ids) {
  const body = introBody(details[id].intro);
  if (body.length < 60) continue;   // 过短的片段不参与，避免把「暂无介绍」判成同一份
  const g = bodyGroups.get(body);
  if (g) g.push(id); else bodyGroups.set(body, [id]);
}

const introShared = {};
let sharedGroups = 0;
let sharedRecords = 0;
for (const group of bodyGroups.values()) {
  if (group.length < 2) continue;
  sharedGroups += 1;
  sharedRecords += group.length;
  group.forEach((id, i) => { introShared[id] = { count: group.length, index: i }; });
}

/** 项目号前缀（Ⅶ-018_01_320500 → Ⅶ-018）。前缀即项目身份，见 src/data.js 的说明。 */
const prefixOf = no => (String(no || '').match(/^([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+-\d+)/) || [, ''])[1];

const prefixCountAll = {};
for (const p of projects) {
  const k = prefixOf(p.projectNo);
  if (k) prefixCountAll[k] = (prefixCountAll[k] || 0) + 1;
}
/** 只保留多申报的前缀——单条项目的徽标永远不显示，存进去纯属浪费首屏体积 */
const prefixCount = {};
for (const [k, n] of Object.entries(prefixCountAll)) if (n > 1) prefixCount[k] = n;

/* ---------------- 索引 ---------------- */

const index = {
  generatedAt: new Date().toISOString(),
  source: detailsFile.source || '',
  count: ids.length,
  withIntro,
  shardSize: SHARD_SIZE,
  shardCount,
  ids,
  introShared,
  prefixCount,
};
await writeFile(join(DATA, 'detail-index.json'),
  `${JSON.stringify(index)}\n`, 'utf8');

/* ---------------- 报告 ---------------- */

const mb = n => (n / 1048576).toFixed(2);
const shardBytes = sizes.reduce((s, x) => s + x.bytes, 0);
const minShard = Math.min(...sizes.map(s => s.bytes));
const maxShard = Math.max(...sizes.map(s => s.bytes));

console.log('【详情分片】');
console.log(`  名录 ${projects.length} 条 / 有详情 ${ids.length} 条${missing ? ` / 缺 ${missing} 条` : ''}`);
console.log(`  其中有正文 ${withIntro} 条（${(withIntro / ids.length * 100).toFixed(1)}%）`);
console.log(`  分片 ${shardCount} 片 × ${SHARD_SIZE} 条，单片 ${(minShard / 1024).toFixed(0)}–${(maxShard / 1024).toFixed(0)} KB，合计 ${mb(shardBytes)} MB`);
console.log(`  共用简介 ${sharedGroups} 组 / ${sharedRecords} 条（${(sharedRecords / ids.length * 100).toFixed(1)}%）——同项目多申报地区沿用官网同一份正文`);
console.log(`  多申报项目 ${Object.keys(prefixCount).length} 个（前缀下有 2 条以上记录）`);
console.log(`  传承人 ${inheritorStats.total} 位（${inheritorStats.projects} 个项目，有编号 ${withCode}、有出生日期 ${withBirth}）`);
console.log(`  传承人索引 ${(Buffer.byteLength(inheritorJs) / 1024).toFixed(0)} KB`);
console.log(`  精选馆藏 ${featuredIds.length} 项：${featuredIds.map(i => byId.get(i).name).join('、')}`);
if (missing) console.log(`\n  ⚠️ 还有 ${missing} 条没有详情，先跑 node scripts/fetch-all-details.mjs`);
