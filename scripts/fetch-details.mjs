/**
 * 核心项目详情页抓取脚本
 *
 * 用途：列表接口只有基础字段，详情页提供丰富的：
 *   - 项目介绍正文（数百字，讲源流/工艺/特点/传承现状）
 *   - 传承人列表（编号、姓名、性别、出生年月）
 *   - 保护单位
 *
 * 策略：只抓精选的核心项目（模拟器题材 + 展馆重点展示），
 *       避免对官网造成压力，也控制数据体积。
 *
 * 用法：node scripts/fetch-details.mjs
 * 输出：public/data/details.json
 */

import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const ORIGIN = 'https://www.ihchina.cn';
const RETRY = 3;
const DELAY = 400;   // 请求间隔，礼貌抓取

/**
 * 精选核心项目。
 * 用「项目名称关键词 + 优先地区」定位，避免硬编码编号出错。
 * 每个条目取第一个匹配的记录作为主记录。
 */
const CORE_PROJECTS = [
  // ── 模拟器题材（必抓） ──
  { kw: '苏绣', prefer: '苏州市' },
  { kw: '苏绣（无锡精微绣）' },
  { kw: '苏绣（南通仿真绣）' },
  { kw: '苏绣（扬州刺绣）' },
  { kw: '宣纸制作技艺', prefer: '泾县' },

  // ── 展馆重点门类代表 ──
  { kw: '宜兴紫砂陶制作技艺' },
  { kw: '龙泉青瓷烧制技艺' },
  { kw: '木版水印技艺', prefer: '荣宝斋' },
  { kw: '木版水印技艺', prefer: '朵云轩' },
  { kw: '京绣', prefer: '房山' },
  { kw: '京绣（北京绢绣）', prefer: '东城' },
  { kw: '南京云锦木机妆花手工织造技艺' },
  { kw: '景泰蓝制作技艺', prefer: '崇文' },
  { kw: '香山帮传统建筑营造技艺' },
  { kw: '藏族唐卡', prefer: '拉萨' },
  { kw: '剪纸', prefer: '蔚县' },
  { kw: '皮影戏', prefer: '唐山' },
  { kw: '昆曲', prefer: '江苏省' },
];

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
    throw new Error(`抓取失败 ${url}: ${err.message}`);
  }
}

/** 解码 HTML 实体 */
function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&mdash;/g, '—');
}

/**
 * 解析一个 <td>：其内部结构为 `<div class="name">标签</div>值`。
 * 返回 { label, value }。
 */
function parseCell(tdHtml) {
  const labelMatch = tdHtml.match(/<div class="name">([\s\S]*?)<\/div>/);
  const label = labelMatch ? decodeEntities(labelMatch[1].replace(/<[^>]+>/g, '')).trim() : '';
  const valueHtml = labelMatch ? tdHtml.slice(labelMatch.index + labelMatch[0].length) : tdHtml;
  const value = decodeEntities(valueHtml.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')).trim();
  return { label, value };
}

/** 解析表格，返回行数组（每行是 {表头: 值} 对象） */
function parseTable(tableHtml) {
  const headers = [...tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
    .map(m => decodeEntities(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim());
  const rows = [];
  for (const tr of tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const tds = [...tr[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => parseCell(m[1]));
    if (!tds.length) continue;
    const obj = {};
    tds.forEach((cell, i) => {
      // 优先用 <div class="name"> 的标签作为键，回退到表头
      const key = cell.label || headers[i] || `col${i}`;
      obj[key] = cell.value;
    });
    rows.push(obj);
  }
  return { headers, rows };
}

/** 从详情页 HTML 解析结构化数据 */
function parseDetail(html) {
  const out = {};

  // ── 基础表格字段 ──
  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map(m => m[0]);
  if (tables[0]) {
    const cells = [...tables[0].matchAll(/<div class="p">([\s\S]*?)<\/div>/gi)]
      .map(m => decodeEntities(m[1].replace(/<[^>]+>/g, '')).trim())
      .filter(Boolean);
    for (const c of cells) {
      const m = c.match(/^([^：:]+)[：:](.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      const val = m[2].trim();
      if (/项目序号/.test(key)) out.projectIndex = val;
      else if (/项目编号/.test(key)) out.projectCode = val;
      else if (/公布时间/.test(key)) out.publishTime = val;
      else if (/^类别/.test(key)) out.category = val;
      else if (/所属地区/.test(key)) out.region = val;
      else if (/^类型/.test(key)) out.projectType = val;
      else if (/申报地区或单位/.test(key)) out.declareUnit = val;
      else if (/保护单位/.test(key)) out.protectUnit = val;
    }
  }

  // ── 传承人表格：表头含「姓名」，且数据行含「性别」 ──
  for (const t of tables) {
    if (!/姓名/.test(t) || !/性别/.test(t)) continue;
    const { rows } = parseTable(t);
    const inheritors = rows
      .filter(r => {
        const name = r['姓名'] || r[Object.keys(r)[1]] || '';
        return name && !/姓名/.test(name);
      })
      .map(r => ({
        code: (r['编号'] || '').trim(),
        name: (r['姓名'] || '').trim(),
        gender: (r['性别'] || '').trim(),
        // ⚠️ 官网表头为「出生日期」（非「出生年月」），此处兼容两种写法
        birth: (r['出生日期'] || r['出生年月'] || '').trim(),
        ethnicity: (r['民族'] || '').trim(),
        category: (r['类别'] || '').trim(),
        projectCode: (r['项目编号'] || '').trim(),
        projectName: (r['项目名称'] || '').trim(),
        declareUnit: (r['申报地区或单位'] || '').trim(),
      }))
      .filter(x => x.name);
    if (inheritors.length) {
      out.inheritors = inheritors;
      // 传承人详情链接
      const links = [...t.matchAll(/href="(\/ccr_detail\/\d+\.html)"/gi)].map(m => m[1]);
      if (links.length) out.inheritorLinks = [...new Set(links)];
      break;
    }
  }

  // ── 项目介绍正文：第一个 table 之后到「相关传承人」之前 ──
  const afterTable = html.split('</table>')[1] || '';
  let body = afterTable.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  let cut = body.length;
  for (const mk of ['相关传承人', '<table', '相关资讯']) {
    const idx = body.indexOf(mk);
    if (idx > 50 && idx < cut) cut = idx;
  }
  body = body.slice(0, cut);
  const introText = decodeEntities(body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  if (introText.length > 30) out.intro = introText;

  // ── 图片（排除导航图标） ──
  const imgs = [...html.matchAll(/<img[^>]+src="([^"]+)"/gi)]
    .map(m => m[1])
    .filter(src => /Uploads\/Picture\/20(1[7-9]|2[0-9])/.test(src))
    .filter(src => !/s5bdabd|s5bdabda|s5bdabdb|s5bebd17|s5bef8f3|s5bdabe1|s5bf3825|s5d9be0/.test(src));
  if (imgs.length) out.images = [...new Set(imgs)];

  return out;
}

async function main() {
  console.log('抓取核心项目详情页…\n');

  // 读取已抓取的名录数据，用于名称 → 记录映射
  const raw = await readFile('public/data/projects.json', 'utf-8');
  const projects = JSON.parse(raw);

  const details = {};
  const missing = [];

  for (const spec of CORE_PROJECTS) {
    // 按关键词匹配名称
    let candidates = projects.filter(p => p.name.includes(spec.kw));
    // 用 prefer 进一步筛选地区/单位
    if (spec.prefer && candidates.length > 1) {
      const preferred = candidates.filter(
        p => p.province.includes(spec.prefer) || p.unit.includes(spec.prefer)
      );
      if (preferred.length) candidates = preferred;
    }
    if (!candidates.length) {
      missing.push(spec.kw);
      console.log(`  ⚠ 未找到「${spec.kw}」`);
      continue;
    }
    const proj = candidates[0];
    // 用 id 作键，避免同名项目（如木版水印的荣宝斋/朵云轩两支）互相覆盖
    if (details[proj.id]) {
      console.log(`  – 跳过重复 id ${proj.id}（${proj.name}）`);
      continue;
    }
    try {
      const html = await fetchHTML(`${ORIGIN}/project_details/${proj.id}.html`);
      const d = parseDetail(html);
      details[proj.id] = {
        id: proj.id,
        name: proj.name,
        projectNo: proj.projectNo,
        category: proj.category,
        province: proj.province,
        batch: proj.batch,
        ...d,
        sourceUrl: `${ORIGIN}/project_details/${proj.id}.html`,
      };
      const introLen = d.intro ? d.intro.length : 0;
      const inhCount = d.inheritors ? d.inheritors.length : 0;
      console.log(
        `  ✓ ${proj.name} — 正文 ${introLen} 字 / 传承人 ${inhCount} 条 / 图 ${(d.images || []).length}`
      );
    } catch (err) {
      missing.push(spec.kw);
      console.log(`  ✗ ${proj.name}: ${err.message}`);
    }
    await sleep(DELAY);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    source: 'https://www.ihchina.cn',
    count: Object.keys(details).length,
    details,
  };

  await writeFile('public/data/details.json', JSON.stringify(output, null, 2), 'utf-8');

  console.log(`\n完成：${Object.keys(details).length} 个项目详情`);
  if (missing.length) console.log(`未获取：${missing.join('、')}`);
  console.log('输出：public/data/details.json');
}

main().catch(err => {
  console.error('\n失败：', err.message);
  process.exit(1);
});
