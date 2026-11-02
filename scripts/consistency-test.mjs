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

console.log('\n[4] 出生年代统计与原始档案一致');
const birth = stats.birth;
const years = INH.map(p => Number(String(p.birth || '').match(/(\d{4})/)?.[1])).filter(y => y >= 1800 && y <= 2026).sort((a, b) => a - b);
check('有效出生年份记录数一致', birth.counted === years.length, birth.counted);
check('缺失数与记录总量相符', birth.missing + birth.counted === INH.length, birth.missing);
check('最早、最晚年份正确', birth.earliest === years[0] && birth.latest === years.at(-1), [birth.earliest, birth.latest]);
check('每个年代计数均与原始数据相符', birth.histogram.every(h => h.count === years.filter(y => y >= h.start && y <= h.end).length));
check('各年代合计等于有效记录数', birth.histogram.reduce((n, h) => n + h.count, 0) === years.length);
check('中位出生年份按偶数样本取平均', birth.median === (years[Math.floor((years.length - 1) / 2)] + years[Math.floor(years.length / 2)]) / 2, birth.median);
console.log('\n[5] 分批次出生信息覆盖率');
check('每批次覆盖率对应原始记录', birth.byBatch.every(row => {
  const group = INH.filter(p => String(p.batch) === row.batch);
  const valid = group.filter(p => { const y = Number(String(p.birth || '').match(/(\d{4})/)?.[1]); return y >= 1800 && y <= 2026; });
  return row.total === group.length && row.born === valid.length && row.coverage === Math.round(valid.length / group.length * 1000) / 10;
}));

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
