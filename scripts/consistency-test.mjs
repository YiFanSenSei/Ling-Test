/**
 * 数据一致性排查。
 *
 * 页面渲染、交互、适配都已测过，但没人验证过「页面上的数字彼此对不对得上」。
 * 评委翻到某一页看到一个数，翻到另一页看到另一个数，那就是硬伤。
 * 这里把所有对外展示的统计口径交叉核一遍。
 *
 * ⚠️ 字段名不统一，是这类 bug 的最大藏身处：
 *    inheritor-stats.json 里顶层叫 withBirth / withCode / projects / withCode，
 *    而 age 子对象里又叫 counted。任何页面取错名字都只会静默显示 undefined，
 *    不会报错。所以这里一律从原始数据重算，再和发布的统计值比对。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const D = p => JSON.parse(readFileSync(join(ROOT, 'public', 'data', p), 'utf8'));
const INH = (() => {
  const t = readFileSync(join(ROOT, 'public', 'data', 'inheritors.js'), 'utf8');
  return JSON.parse(t.slice(t.indexOf('=') + 1).replace(/;\s*$/, ''));
})();

const meta = D('meta.json');
const stats = D('inheritor-stats.json');
const projects = D('projects.json');
const featured = D('featured.json');

const results = [];
function check(label, pass, detail) {
  results.push({ label, pass, detail });
  console.log(`  ${pass ? '✓' : '✗'} ${label}  → ${detail === undefined ? '' : JSON.stringify(detail)}`);
}

console.log('\n[1] 项目总数是否处处一致');
const sumCat = Object.values(meta.byCategory).reduce((a, c) => a + (typeof c === 'number' ? c : c.count), 0);
const sumBatch = Object.values(meta.byBatch).reduce((a, c) => a + (typeof c === 'number' ? c : c.count), 0);
const sumRegion = meta.byRegion.reduce((a, b) => a + b.count, 0);
check('byCategory 合计 == projects 长度', sumCat === projects.length, { sumCat, len: projects.length });
check('byBatch 合计 == projects 长度', sumBatch === projects.length, { sumBatch });
check('byRegion 合计 == projects 长度', sumRegion === projects.length, { sumRegion });
check('heritageCount == projects 长度', meta.heritageCount === projects.length, { heritageCount: meta.heritageCount });

console.log('\n[2] 门类与批次是否齐全');
check('恰好 10 个门类', Object.keys(meta.byCategory).length === 10, Object.keys(meta.byCategory).length);
check('categories 表 10 条', meta.categories.length === 10, meta.categories.map(c => c.code));
check('恰好 5 个批次', Object.keys(meta.byBatch).length === 5, Object.keys(meta.byBatch));
check('batches 表 5 条且年份正确', JSON.stringify(meta.batches.map(b => b.year)) === '[2006,2008,2011,2014,2021]',
  meta.batches.map(b => `${b.batch}:${b.year}`));
const batches = new Set(projects.map(p => p.batch));
check('projects 里 batch 取值只有 1..5', [...batches].every(b => b >= 1 && b <= 5), [...batches].sort());

console.log('\n[3] 传承人统计与原始数据是否对得上');
check('stats.total == inheritors 条数', stats.total === INH.length, { statsTotal: stats.total, raw: INH.length });
const withBirth = INH.filter(p => /\d{4}/.test(String(p.birth || ''))).length;
check('stats.withBirth == 真有出生年份的条数', stats.withBirth === withBirth, { stats: stats.withBirth, computed: withBirth });
const withCode = INH.filter(p => String(p.code || '').trim()).length;
check('stats.withCode == 有编号的条数', stats.withCode === withCode, { stats: stats.withCode, computed: withCode });
const eths = new Set(INH.map(p => (p.ethnicity || '').trim()).filter(e => e && e !== '其他'));
check('stats.ethnicities == 真实民族数（已剔除「其他」）', stats.ethnicities === eths.size,
  { stats: stats.ethnicities, computed: eths.size });
const others = INH.filter(p => (p.ethnicity || '').trim() === '其他').length;
check('「其他」只被剔除、未被误算成民族', others === 2, others);
check('民族数不是 54（虚报值）', stats.ethnicities !== 54, stats.ethnicities);
const linkedProjects = new Set(INH.map(p => p.projectId).filter(Boolean));
check('stats.projects == 有传承人的项目数', stats.projects === linkedProjects.size,
  { stats: stats.projects, computed: linkedProjects.size });

console.log('\n[4] 年龄统计自洽');
const a = stats.age;
const histSum = a.histogram.reduce((x, y) => x + y.count, 0);
check('年龄直方图合计 == counted', histSum === a.counted, { histSum, counted: a.counted });
check('counted == withBirth', a.counted === stats.withBirth, { counted: a.counted, withBirth: stats.withBirth });
check('over80 <= over70 <= counted', a.over80 <= a.over70 && a.over70 <= a.counted, { over70: a.over70, over80: a.over80, counted: a.counted });
const pct70 = +(a.over70 / a.counted * 100).toFixed(1);
check('页面展示的 70+ 百分比算得对（应为 81.2%）', Math.abs(pct70 - 81.2) < 0.15, pct70);
const pct80 = +(a.over80 / a.counted * 100).toFixed(1);
check('页面展示的 80+ 百分比算得对（应为 58.7%）', Math.abs(pct80 - 58.7) < 0.15, pct80);
check('min/max 落在合理范围', a.min > 0 && a.max < 130 && a.min <= a.max, { min: a.min, max: a.max });
check('median 在 min 与 max 之间', a.median >= a.min && a.median <= a.max, { median: a.median });
const minYear = Math.min(...INH.map(p => +String(p.birth).match(/(\d{4})/)?.[1] || 9999));
check('2026 - 最老出生年 == max 年龄', 2026 - minYear === a.max, { minYear, expected: 2026 - minYear, actual: a.max });
check('40 岁以下确为 0 人（页面要显示 0，不能空着）',
  a.histogram.find(h => h.key === 'lt40' || h.label?.includes('40岁以下'))?.count === 0,
  a.histogram.map(h => `${h.label || h.key}:${h.count}`));

console.log('\n[5] 批次覆盖率表');
const byBatchRaw = {};
for (const p of INH) {
  const b = p.batch; if (!b) continue;
  byBatchRaw[b] = byBatchRaw[b] || { total: 0, born: 0 };
  byBatchRaw[b].total++;
  if (/\d{4}/.test(String(p.birth || ''))) byBatchRaw[b].born++;
}
let covOk = true; const covDetail = [];
for (const row of a.byBatch) {
  const raw = byBatchRaw[row.batch];
  if (!raw) { covOk = false; covDetail.push(`批${row.batch} 无原始数据`); continue; }
  if (raw.total !== row.total || raw.born !== row.born) covOk = false;
  covDetail.push(`批${row.batch}: ${row.born}/${row.total} (${(row.born / row.total * 100).toFixed(1)}%)`);
}
check('分批次 total/born 与原始数据逐条相符', covOk, covDetail);
check('第 4、5 批确为 0% 覆盖（页面据此说明，不能变）',
  a.byBatch.filter(r => r.batch >= 4).every(r => r.born === 0),
  a.byBatch.filter(r => r.batch >= 4).map(r => `${r.batch}:${r.born}/${r.total}`));

console.log('\n[6] 首页精选与详情可用性');
// featured.json 的结构是 { ids: [...] }，不是数组——又一个字段结构陷阱
const featIds = Array.isArray(featured) ? featured.map(f => f.id) : (featured.ids || []);
check('featured 数量 > 0', featIds.length > 0, featIds.length);
const pIds = new Set(projects.map(p => String(p.id)));
const missFeat = featIds.filter(id => !pIds.has(String(id)));
check('精选项目都能在 projects 里找到', missFeat.length === 0, missFeat);

console.log('\n[7] 项目字段完整性');
const dupId = projects.length - pIds.size;
check('项目 id 无重复', dupId === 0, dupId);
const noNo = projects.filter(p => !p.projectNo);
check('每个项目都有项目编号', noNo.length === 0, noNo.length);
const noRegion = projects.filter(p => !p.region);
check('每个项目都有申报地区', noRegion.length === 0, noRegion.length);
const badCat = projects.filter(p => !Object.keys(meta.byCategory).includes(p.category));
check('每个项目的门类都在十大门类里', badCat.length === 0, badCat.slice(0, 3).map(p => p.category));

console.log('\n[8] 传承人外键');
const badLink = INH.filter(p => p.projectId && !pIds.has(String(p.projectId)));
check('传承人指向的项目都存在', badLink.length === 0, { bad: badLink.length, sample: badLink.slice(0, 3).map(p => p.projectId) });
const noName = INH.filter(p => !String(p.name || '').trim());
check('传承人都有姓名', noName.length === 0, noName.length);

console.log(`\n${'='.repeat(60)}`);
const failed = results.filter(r => !r.pass);
console.log(`共 ${results.length} 项，通过 ${results.length - failed.length} 项，失败 ${failed.length} 项`);
if (failed.length) failed.forEach(f => console.log(`  ✗ ${f.label} → ${JSON.stringify(f.detail)}`));
process.exit(failed.length ? 1 : 0);
