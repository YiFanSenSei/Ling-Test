/**
 * 数据层单测：直接对 public/data/projects.json 跑 queryProjects 的等价逻辑，
 * 用来区分「数据/筛选逻辑错了」还是「UI 绑定错了」。
 */
import { readFile } from 'node:fs/promises';

const raw = await readFile(new URL('../public/data/projects.json', import.meta.url), 'utf8');
const all = JSON.parse(raw).projects || JSON.parse(raw);
console.log('总条数:', all.length);
console.log('第一条:', JSON.stringify(all[0], null, 2));

const cats = {};
for (const p of all) cats[p.category] = (cats[p.category] || 0) + 1;
console.log('\n门类分布:', JSON.stringify(cats, null, 2));

// 精确字面量匹配测试
const target = '传统美术';
const hit = all.filter(p => p.category === target);
console.log(`\ncategory === "${target}" → ${hit.length} 条`);

// 逐字符对比第一个分类的字符码，排查不可见字符
const sample = Object.keys(cats)[0];
console.log(`\n门类字段码点样例 "${sample}":`, [...sample].map(c => c.codePointAt(0).toString(16)));
console.log(`目标串码点 "${target}":`, [...target].map(c => c.codePointAt(0).toString(16)));

// region 字段检查
const regions = new Set(all.map(p => p.region));
console.log(`\nregion 取值个数: ${regions.size}`);
console.log('前 8 个 region:', [...regions].slice(0, 8));

// 搜索测试
const kw = '苏绣';
const s = all.filter(p => p.name.toLowerCase().includes(kw.toLowerCase()));
console.log(`\nname 含 "${kw}" → ${s.length} 条`);
console.log('前 5:', s.slice(0, 5).map(p => p.name));
