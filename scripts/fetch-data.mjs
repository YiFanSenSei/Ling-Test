/**
 * 非遗数据抓取脚本
 * 数据源：中国非物质文化遗产网（文化和旅游部主管）
 *   https://www.ihchina.cn/Article/Index/getProject.html
 *
 * 用法：node scripts/fetch-data.mjs
 * 输出：public/data/projects.json   全量项目数据
 *       public/data/meta.json       统计元数据（用于首页数据看板）
 *
 * ⚠️ 接口的两个反直觉行为（实测确认）：
 *   1. 分页参数 page 在 query 中无效，必须用伪静态 path：
 *        ❌ /getProject.html?limit=100&page=2      → 永远返回第一页
 *        ✅ /getProject/limit/100/page/1/p/2.html  → 正确翻页
 *   2. province / cate / tid 筛选参数在服务端全部无效，必须全量抓取后本地过滤。
 *
 * 数据规模：约 4240 条 / 43 页（limit=100）
 */

import { writeFile as wf, mkdir as mk } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const ORIGIN = 'https://www.ihchina.cn';
const LIST_PATH = '/Article/Index/getProject';
const LIMIT = 100;          // 每页条数
const CONCURRENCY = 4;      // 并发数，避免给官方站点压力
const RETRY = 3;
const PAGE_DELAY = 150;     // 页间隔（毫秒），礼貌抓取

/** 门类定义：罗马数字编码 → 名称。用于按 project_num 首位编码归类 */
const CATEGORIES = [
  { code: 'Ⅰ',  name: '民间文学' },
  { code: 'Ⅱ',  name: '传统音乐' },
  { code: 'Ⅲ',  name: '传统舞蹈' },
  { code: 'Ⅳ',  name: '传统戏剧' },
  { code: 'Ⅴ',  name: '曲艺' },
  { code: 'Ⅵ',  name: '传统体育、游艺与杂技' },
  { code: 'Ⅶ',  name: '传统美术' },
  { code: 'Ⅷ',  name: '传统技艺' },
  { code: 'Ⅸ',  name: '传统医药' },
  { code: 'Ⅹ',  name: '民俗' },
];

/** 批次定义 */
const BATCHES = [
  { year: 2006, batch: 1 },
  { year: 2008, batch: 2 },
  { year: 2011, batch: 3 },
  { year: 2014, batch: 4 },
  { year: 2021, batch: 5 },
];

/**
 * 构造抓取 URL。
 * 分页必须走伪静态 path，query 会被忽略。
 */
function buildURL(page) {
  return `${ORIGIN}${LIST_PATH}/limit/${LIMIT}/page/1/p/${page}.html`;
}

async function fetchJSON(url, attempt = 1) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': `${ORIGIN}/project.html`,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt < RETRY) {
      await sleep(600 * attempt);
      return fetchJSON(url, attempt + 1);
    }
    throw new Error(`抓取失败 ${url}: ${err.message}`);
  }
}

/** 从 project_num 解析门类。形如 "Ⅷ-FRZX-12"，首段是罗马数字门类码 */
function parseCategory(projectNum) {
  const seg = (projectNum || '').split('-')[0].trim();
  return CATEGORIES.find(c => c.code === seg) || null;
}

/**
 * 判定记录是否属于「国家级非物质文化遗产代表性项目名录」。
 *
 * ⚠️ 关键发现：该接口混装了多套目录，实测确认的编码规律：
 *
 *   ✅ 属于非遗名录：`Ⅷ-001_01_320282`
 *      标准编码 = 门类码-项目序号_子项序号_地区码，可带 a/b/c 后缀。
 *
 *   ❌ 不属于非遗名录：`Ⅰ-FRZX-1` 这类「门类码-字母代码-序号」格式。
 *      实测其详情页标题为「第一批国家传统工艺振兴目录」等其他目录，
 *      项目编号/公布时间/类别字段均为空，属另一套统计体系。
 *
 *      已确认的字母代码：FRZX(传统工艺振兴) / JZKH / DKSZ / TCSZ / BZZZ
 *      / WFZZ / FSZZ / QJZZ / JJJZ / QQXS / JSJG / ZYPZ / SPZZ / YSZB
 *
 *   ⚠️ 关于 FSZZ：曾误判为「非遗扩展项目」而加入白名单（依据是该批记录
 *      reg_type=2）。复核后发现 23 条 FSZZ 记录的 category 全被解析为
 *      「民间文学」、batchYear 全为 null，且内容为剧装戏具、蒙古族服饰、
 *      龙凤旗袍等，实为传统工艺振兴目录数据。**reg_type 不足以证明归属**，
 *      判断目录归属必须看详情页标题，不能只看单个字段。
 */
function classify(projectNo) {
  const pn = (projectNo || '').trim();
  // 非标准：门类码-字母代码-序号 → 其他目录
  if (/^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]-[A-Za-z]{2,}-/.test(pn)) return 'other-catalog';
  // 标准格式：门类码-数字_数字_地区码（可选字母后缀 a/b/c）→ 非遗名录
  if (/^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]-\d/.test(pn)) return 'heritage';
  return 'unknown';
}

/**
 * 省级行政区归一化。
 *
 * ⚠️ 接口的 province 字段极不规范：实测 3637 条记录里有 1851 个不同的
 *    province 值，既包含「内蒙古自治区呼伦贝尔市」这类省市混合，
 *    也包含「中国艺术研究院」这类申报单位名称。
 *    因此建立 34 个省级行政区词表，用最长前缀匹配归一化，
 *    匹配不到的归入「中直单位及机构」。
 */
const PROVINCES = [
  '北京市', '天津市', '上海市', '重庆市',
  '河北省', '山西省', '辽宁省', '吉林省', '黑龙江省',
  '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省',
  '河南省', '湖北省', '湖南省', '广东省', '海南省',
  '四川省', '贵州省', '云南省', '陕西省', '甘肃省', '青海省', '台湾省',
  '内蒙古自治区', '广西壮族自治区', '西藏自治区',
  '宁夏回族自治区', '新疆维吾尔自治区',
  '香港特别行政区', '澳门特别行政区',
];
// 历史/简称写法
const PROVINCE_ALIAS = {
  '内蒙古': '内蒙古自治区',
  '广西': '广西壮族自治区',
  '西藏': '西藏自治区',
  '宁夏': '宁夏回族自治区',
  '新疆': '新疆维吾尔自治区',
  '香港': '香港特别行政区',
  '澳门': '澳门特别行政区',
};

/** 把任意 province/unit 字段值归一化为省级行政区名，失败返回 null */
function normalizeProvince(raw) {
  const s = (raw || '').trim();
  if (!s) return null;
  for (const p of PROVINCES) if (s.startsWith(p)) return p;
  for (const [alias, full] of Object.entries(PROVINCE_ALIAS)) {
    if (s.startsWith(alias)) return full;
  }
  return null;   // 申报单位为机构名等，计入「中直单位及机构」
}

/** 清洗单条记录 */
function clean(row) {
  // rx_time 形如 "</br>()" 或 "2006</br>(第一批)"，需清洗
  const rawTime = (row.rx_time || '').replace(/<\/?br\s*\/?>/gi, '').trim();
  const yearMatch = rawTime.match(/(\d{4})/);

  // reg_type: 1 = 新增项目, 2 = 扩展项目
  const regType = String(row.reg_type) === '2' ? '扩展项目' : '新增项目';

  // province 可能包含逗号分隔的多地区
  const provinces = (row.province || row.unit || '')
    .split(/[，,]/)
    .map(s => s.trim())
    .filter(Boolean);

  const projectNo = (row.project_num || '').trim();
  const kind = classify(projectNo);
  const cat = kind === 'heritage' ? parseCategory(projectNo) : null;

  return {
    id: String(row.id),
    name: (row.title || '').replace(/\s+/g, ' ').trim(),
    projectNo,
    kind,                                   // heritage | other-catalog | unknown
    category: cat ? cat.name : '',
    categoryCode: cat ? cat.code : '',
    regType,
    batch: yearMatch
      ? (BATCHES.find(b => b.year === Number(yearMatch[1]))?.batch ?? null)
      : null,
    batchYear: yearMatch ? Number(yearMatch[1]) : null,
    // province（原始申报地区文本，用于详情展示）
    province: provinces[0] || '',
    provinces,
    // region（归一化后的省级行政区，用于筛选与统计）
    region: normalizeProvince(provinces[0]) || normalizeProvince(row.unit) || '中直单位及机构',
    unit: (row.unit || '').trim(),
    protectUnit: (row.protect_unit || '').trim(),
    hasImage: Boolean(row.img_group && row.img_group !== 'N;'),
    hasVideo: Boolean(row.video && row.video !== 'N;'),
  };
}

async function main() {
  console.log('开始抓取中国非物质文化遗产网数据…');
  console.log(`分页方式：伪静态 path（query page 参数无效）\n`);

  // 先取第一页，拿到总页数
  const first = await fetchJSON(buildURL(1));
  const totalPages = first.links?.total_pages ?? 1;
  const total = first.count ?? first.total;
  console.log(`接口返回：total=${total}, total_pages=${totalPages}, limit=${LIMIT}\n`);

  const raw = [...(first.list || [])];

  // 其余页并发抓取
  const pages = [];
  for (let p = 2; p <= totalPages; p += 1) pages.push(p);

  let done = 1;
  for (let i = 0; i < pages.length; i += CONCURRENCY) {
    const batch = pages.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(p => fetchJSON(buildURL(p))));
    for (const r of results) raw.push(...(r.list || []));
    done += batch.length;
    process.stdout.write(`  抓取进度：${done}/${totalPages} 页\r`);
    await sleep(PAGE_DELAY);
  }
  console.log(`\n  抓取完成：共 ${raw.length} 条原始记录`);

  // 按 id 去重
  const seen = new Map();
  for (const r of raw) if (!seen.has(String(r.id))) seen.set(String(r.id), r);
  let cleaned = [...seen.values()].map(clean);

  // 二级去重：接口存在同一项目两条 id 的重复数据（详情页内容完全一致），
  // 保留 id 较小的一条（列表接口的正式序）。
  const byProject = new Map();
  let dupCount = 0;
  for (const r of cleaned) {
    const key = `${r.projectNo}|${r.province}|${r.name}`;
    const prev = byProject.get(key);
    if (!prev) {
      byProject.set(key, r);
    } else {
      dupCount += 1;
      if (Number(r.id) < Number(prev.id)) byProject.set(key, r);
    }
  }
  cleaned = [...byProject.values()];
  if (dupCount) console.log(`  二级去重：移除 ${dupCount} 条重复项目记录`);

  // 拆分：正规非遗名录 vs 混入的其他目录
  const heritage = cleaned.filter(r => r.kind === 'heritage');
  const otherCatalog = cleaned.filter(r => r.kind !== 'heritage');

  console.log(`  去重后：${cleaned.length} 条`);
  console.log(`    ├─ 非遗名录项目：${heritage.length} 条`);
  console.log(`    └─ 混入的其他目录：${otherCatalog.length} 条 (已剔除)\n`);

  // 未被识别出门类的记录（应接近 0，否则说明编码格式有新变体）
  const uncategorized = heritage.filter(r => !r.category);
  if (uncategorized.length) {
    console.log(`  ⚠ 有 ${uncategorized.length} 条名录记录未解析出门类：`);
    for (const r of uncategorized.slice(0, 5)) {
      console.log(`      ${r.projectNo} ${r.name}`);
    }
    console.log();
  }

  // 统计元数据（用于首页数据看板）—— 只统计正规名录
  const byCategory = {};
  for (const cat of CATEGORIES) {
    byCategory[cat.name] = heritage.filter(x => x.category === cat.name).length;
  }
  const byBatch = {};
  for (const b of BATCHES) {
    byBatch[b.batch] = heritage.filter(x => x.batch === b.batch).length;
  }
  const byRegType = {
    // 注意：剔除 FSZZ 等其他目录后，剩余记录全部为「新增项目」。
    // 「扩展项目」那一批（reg_type=2）实际来自传统工艺振兴目录，
    // 不属于本名录体系，故此处统计恒为 3614 / 0，保留字段仅为兼容。
    新增项目: heritage.filter(x => x.regType === '新增项目').length,
    扩展项目: heritage.filter(x => x.regType === '扩展项目').length,
  };
  const provinceCount = {};
  for (const r of heritage) {
    provinceCount[r.region] = (provinceCount[r.region] || 0) + 1;
  }
  /*
   * 地区分布：**保留全部 34 项，含「中直单位及机构」**。
   *
   * 这里原本写着 .filter(([k]) => k !== '中直单位及机构')，用意只是让首页
   * 「地域分布 Top 12」的柱状图不出现中直类的长条。但这个数组同时被
   * Gallery.js 当成**地区筛选选项的唯一来源**，于是那行过滤顺带把
   * 「中直单位及机构」从筛选里删掉了——京剧、昆曲、古琴艺术、格萨（斯）尔
   * 这 78 个项目，就此无法按地区筛出，只能靠关键词碰运气。
   * 首页又恰好写着「机构类申报单位单列为『中直单位及机构』，共 78 条」，
   * 等于承诺了却做不到。
   *
   * 一个数据被两种用途共用时，滤条件要写在**用它的地方**，不能写在产它的地方。
   * 所以这里不再过滤，改由 Home.js 在画柱状图时自己排除中直项。
   */
  const byRegion = Object.entries(provinceCount)
    .sort((a, b) => b[1] - a[1])
    .map(([region, count]) => ({ region, count }));
  const institutionCount = provinceCount['中直单位及机构'] || 0;

  // 有图/有视频的记录数——用于评估素材可得性
  const mediaStats = {
    withImage: heritage.filter(r => r.hasImage).length,
    withVideo: heritage.filter(r => r.hasVideo).length,
  };

  // 官方公开口径（用于展示，区别于接口返回量）
  const OFFICIAL = {
    totalProjects: 1557,   // 国家级非物质文化遗产代表性项目
    totalSubItems: 3610,   // 按申报地区统计的子项
    totalArtisans: 3998,   // 国家级代表性传承人
    unescoItems: 45,       // 列入联合国教科文组织名录项目
    batches: 5,
    categories: 10,
  };

  const meta = {
    generatedAt: new Date().toISOString(),
    source: {
      name: '中国非物质文化遗产网·中国非物质文化遗产数字博物馆',
      url: 'https://www.ihchina.cn',
      operator: '中华人民共和国文化和旅游部主管 · 中国艺术研究院主办',
      statement: '数据来自国务院及国家文化和旅游行政主管部门公开信息，统计截至2025年03月13日。',
    },
    official: OFFICIAL,
    apiTotal: cleaned.length,
    heritageCount: heritage.length,
    otherCatalogCount: otherCatalog.length,
    otherCatalogBreakdown: otherCatalog.reduce((acc, r) => {
      const code = (r.projectNo.split('-')[1] || '?').replace(/[^A-Za-z]/g, '') || '?';
      acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {}),
    // ⚠️ 官网接口（4234）与官方口径（1557/3610）数字不一致，
    //    原因：接口混装了「传统工艺振兴目录」等其他目录，且含子项行。
    //    展示时一律采用官方口径，并在「关于」页说明数据来源与统计口径。
    note: '接口返回量包含非名录数据，前端展示统一使用 official 口径。',
    byCategory,
    byBatch,
    byRegType,
    byRegion,
    institutionCount,
    mediaStats,
    provinceCount,
    categories: CATEGORIES,
    batches: BATCHES,
  };

  await mk('public/data', { recursive: true });
  await wf('public/data/projects.json', JSON.stringify(heritage), 'utf-8');
  await wf('public/data/meta.json', JSON.stringify(meta, null, 2), 'utf-8');

  console.log('输出完成：');
  console.log(`  public/data/projects.json  (${heritage.length} 条，已过滤非名录数据)`);
  console.log('  public/data/meta.json');
  console.log('\n各门类：');
  for (const cat of CATEGORIES) {
    const n = byCategory[cat.name];
    console.log(`  ${cat.code} ${cat.name}: ${n || '⚠ 0'}`);
  }
  console.log('\n各批次：');
  for (const b of BATCHES) console.log(`  第${b.batch}批(${b.year}): ${byBatch[b.batch] || 0}`);
  console.log('\n类型：');
  console.log(`  新增项目: ${byRegType.新增项目}  扩展项目: ${byRegType.扩展项目}`);
  console.log('\n被剔除的其他目录：');
  for (const [code, n] of Object.entries(meta.otherCatalogBreakdown).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${code}: ${n}`);
  }
}

main().catch(err => {
  console.error('\n抓取失败：', err.message);
  process.exit(1);
});

