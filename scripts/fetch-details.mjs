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
 *
 * 组织原则：按中国传统工艺的「体系」成组铺开，而不是零散点名。
 * 这样详情页之间能通过同门类/同地区导航连成网络，而不是十几个孤岛。
 * 目标覆盖率：100+ 个项目（约占 3,614 条子项的 3%），
 * 但覆盖的是每个门类里最有代表性的那几件——这才是「展馆」的选法。
 */
const CORE_PROJECTS = [
  // ══ 模拟器题材（必抓，页面直接依赖） ══
  { kw: '苏绣', prefer: '苏州市' },
  { kw: '苏绣（无锡精微绣）' },
  { kw: '苏绣（南通仿真绣）' },
  { kw: '苏绣（扬州刺绣）' },
  { kw: '宣纸制作技艺', prefer: '泾县' },

  // ══ 织绣印染：四大名绣 + 名锦 + 蓝印花布 ══
  { kw: '蜀绣' },
  { kw: '粤绣（广绣）' },
  { kw: '粤绣（潮绣）' },
  { kw: '湘绣' },
  { kw: '汴绣' },
  { kw: '瓯绣' },
  { kw: '汉绣' },
  { kw: '羌族刺绣' },
  { kw: '苗绣', prefer: '贵州' },
  { kw: '土族盘绣' },
  { kw: '鲁绣' },
  { kw: '南京云锦木机妆花手工织造技艺' },
  { kw: '蜀锦织造技艺' },
  { kw: '宋锦织造技艺' },
  { kw: '壮族织锦技艺' },
  { kw: '土家族织锦技艺' },
  { kw: '黎族传统纺染织绣技艺' },
  { kw: '蓝印花布印染技艺', prefer: '南通' },
  { kw: '蜡染技艺', prefer: '贵州' },
  { kw: '扎染技艺' },
  { kw: '香云纱染整技艺' },
  { kw: '夏布织造技艺' },

  // ══ 陶瓷：五大名窑 + 名陶 ══
  { kw: '宜兴紫砂陶制作技艺' },
  { kw: '龙泉青瓷烧制技艺' },
  { kw: '汝瓷烧制技艺' },
  { kw: '钧瓷烧制技艺' },
  { kw: '定瓷烧制技艺' },
  { kw: '耀州窑陶瓷烧制技艺' },
  { kw: '磁州窑烧制技艺' },
  { kw: '德化瓷烧制技艺' },
  { kw: '景德镇手工制瓷技艺' },
  { kw: '建窑建盏烧制技艺' },
  { kw: '长沙窑铜官陶瓷烧制技艺' },
  { kw: '淄博陶瓷烧制技艺' },
  { kw: '唐三彩烧制技艺' },
  { kw: '陶器烧制技艺（藏族黑陶烧制技艺）', prefer: '囊谦' },
  { kw: '黎族原始制陶技艺' },
  { kw: '傣族慢轮制陶技艺' },

  // ══ 漆器与髹饰 ══
  { kw: '扬州漆器髹饰技艺' },
  { kw: '福州脱胎漆器髹饰技艺' },
  { kw: '成都漆艺' },
  { kw: '平遥推光漆器髹饰技艺' },
  { kw: '徽州漆器髹饰技艺' },
  { kw: '宁波泥金彩漆' },

  // ══ 雕刻：石雕 / 木雕 / 竹刻 / 玉雕 ══
  { kw: '青田石雕' },
  { kw: '寿山石雕' },
  { kw: '石雕（鸡血石雕）' },
  { kw: '曲阳石雕' },
  { kw: '菊花石雕' },
  { kw: '东阳木雕' },
  { kw: '乐清黄杨木雕' },
  { kw: '潮州木雕', prefer: '潮州市' },
  { kw: '剑川木雕' },
  { kw: '宁波朱金漆木雕' },
  { kw: '嘉定竹刻' },
  { kw: '宝庆竹刻' },
  { kw: '苏州玉雕' },
  { kw: '扬州玉雕' },
  { kw: '岫岩玉雕' },
  { kw: '阜新玛瑙雕' },
  { kw: '煤精雕刻' },
  { kw: '砖雕', prefer: '山西' },
  { kw: '核雕', prefer: '苏州' },

  // ══ 金属工艺 ══
  { kw: '景泰蓝制作技艺', prefer: '崇文' },
  { kw: '金银细工制作技艺' },
  { kw: '银铜器制作及鎏金技艺' },
  { kw: '苗族银饰锻制技艺' },
  { kw: '藏族金属锻造技艺' },
  { kw: '铁画', prefer: '芜湖' },
  { kw: '龙泉宝剑锻制技艺' },
  { kw: '张小泉剪刀锻制技艺' },
  { kw: '铜雕技艺', prefer: '杭州' },

  // ══ 文房四宝与印刷 ══
  { kw: '湖笔制作技艺' },
  { kw: '徽墨制作技艺' },
  { kw: '歙砚制作技艺' },
  { kw: '端砚制作技艺' },
  { kw: '洮砚制作技艺' },
  { kw: '澄泥砚制作技艺' },
  { kw: '贺兰砚制作技艺' },
  { kw: '木版水印技艺', prefer: '荣宝斋' },
  { kw: '木版水印技艺', prefer: '上海书画出版社' },
  { kw: '雕版印刷技艺', prefer: '扬州' },
  { kw: '金陵刻经印刷技艺' },
  { kw: '德格印经院藏族雕版印刷技艺' },
  { kw: '木活字印刷技术' },
  { kw: '铅山连四纸制作技艺' },
  { kw: '竹纸制作技艺', prefer: '夹江' },

  // ══ 建筑营造与木作 ══
  { kw: '香山帮传统建筑营造技艺' },
  { kw: '徽派传统民居营造技艺' },
  { kw: '客家土楼营造技艺' },
  { kw: '侗族木构建筑营造技艺' },
  { kw: '苗寨吊脚楼营造技艺' },
  { kw: '闽南传统民居营造技艺' },
  { kw: '北京四合院传统营造技艺' },

  // ══ 家具与竹藤编织 ══
  { kw: '明式家具制作技艺' },
  { kw: '家具制作技艺（京作硬木家具制作技艺）' },
  { kw: '家具制作技艺（晋作家具制作技艺）' },
  { kw: '嵊州竹编' },
  { kw: '竹编（青神竹编）' },
  { kw: '竹编（东阳竹编）' },
  { kw: '竹编（益阳小郁竹艺）' },
  { kw: '藤编（怀远藤编）' },

  // ══ 剪纸、年画、皮影、唐卡 ══
  { kw: '剪纸', prefer: '蔚县' },
  { kw: '剪纸', prefer: '扬州' },
  { kw: '剪纸', prefer: '丰宁' },
  { kw: '剪纸', prefer: '广灵' },
  { kw: '剪纸', prefer: '中阳' },
  { kw: '剪纸', prefer: '庄河' },
  { kw: '剪纸', prefer: '乐清' },
  { kw: '杨柳青木版年画' },
  { kw: '桃花坞木版年画' },
  { kw: '杨家埠木版年画' },
  { kw: '朱仙镇木版年画' },
  { kw: '绵竹木版年画' },
  { kw: '凤翔木版年画' },
  { kw: '高密扑灰年画' },
  { kw: '皮影戏', prefer: '唐山' },
  { kw: '皮影戏', prefer: '华县' },
  { kw: '皮影戏', prefer: '泰山' },
  { kw: '皮影戏', prefer: '陆丰' },
  { kw: '皮影戏', prefer: '环县' },
  { kw: '藏族唐卡', prefer: '拉萨' },
  { kw: '热贡艺术' },

  // ══ 戏曲曲艺（门类里的「听着」的那一半） ══
  { kw: '昆曲', prefer: '江苏省' },
  { kw: '京剧' },
  { kw: '越剧', prefer: '浙江省' },
  { kw: '川剧' },
  { kw: '粤剧' },
  { kw: '黄梅戏' },
  { kw: '秦腔' },
  { kw: '豫剧' },
  { kw: '藏戏', prefer: '西藏' },
  { kw: '侗戏' },
  { kw: '傩戏', prefer: '贵州' },
  { kw: '苏州评弹' },
  { kw: '山东大鼓' },
  { kw: '京韵大鼓' },
  { kw: '相声' },

  // ══ 传统医药与民俗 ══
  { kw: '针灸', prefer: '中医科学院' },
  { kw: '同仁堂中医药文化' },
  { kw: '中药炮制技术', prefer: '中药协会' },
  { kw: '藏医药', prefer: '西藏' },
  { kw: '二十四节气' },
  { kw: '端午节', prefer: '湖北' },
  { kw: '春节', prefer: '山西' },
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

import { parseDetail } from './lib/parse-detail.mjs';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(dryRun ? '预演模式：只校验关键词能匹配到什么，不发起网络请求\n' : '抓取核心项目详情页…\n');

  // 读取已抓取的名录数据，用于名称 → 记录映射
  const raw = await readFile('public/data/projects.json', 'utf-8');
  const projects = JSON.parse(raw);

  // ── 预演：先把匹配结果全部算出来并打印，便于人工核对关键词是否写准 ──
  const planned = [];
  const unmatched = [];
  const preferMissed = [];   // prefer 写了但没筛出任何候选 —— 会静默退化成「取第一个」，必须报警
  for (const spec of CORE_PROJECTS) {
    let candidates = projects.filter(p => p.name.includes(spec.kw));
    if (spec.prefer) {
      // ⚠ prefer 必须同时匹配 province / unit / **name**。
      // 只匹配前两者会漏掉大量情况：非遗项目名常把地区写进括号里，
      // 例如「皮影戏（华县皮影戏）」的 province 是「陕西省渭南市华州区」，
      // 根本没有「华县」二字，只在 name 里出现。漏掉 name 会导致 prefer 静默失效。
      const preferred = candidates.filter(
        p => p.province.includes(spec.prefer)
          || p.unit.includes(spec.prefer)
          || p.name.includes(spec.prefer)
      );
      if (preferred.length) {
        candidates = preferred;
      } else if (candidates.length > 1) {
        // 关键词命中多条、但 prefer 一条都没筛中 → 说明 prefer 写错了（地区/单位名对不上）。
        // 此时若默默退回 candidates[0]，会抓到一个语义上错误的地区版本，而且看不出问题。
        preferMissed.push({ spec, sample: candidates.slice(0, 3).map(c => `${c.name}（${c.province}）`) });
      }
    }
    if (!candidates.length) {
      unmatched.push(spec);
      continue;
    }
    planned.push({ spec, proj: candidates[0], hits: candidates.length });
  }

  if (dryRun) {
    const seen = new Set();
    console.log(`关键词 ${CORE_PROJECTS.length} 条 → 命中 ${planned.length} 条，未命中 ${unmatched.length} 条\n`);
    for (const { spec, proj, hits } of planned) {
      const dup = seen.has(proj.id) ? '  ← 与前面重复，只会抓一次' : '';
      seen.add(proj.id);
      console.log(`  ${proj.name}  [${proj.province}]  ${hits} 个候选  ${proj.projectNo}${dup}`);
    }
    if (unmatched.length) {
      console.log('\n⚠ 以下关键词在名录里找不到，需要修正：');
      for (const s of unmatched) console.log(`    ${s.kw}${s.prefer ? '  prefer=' + s.prefer : ''}`);
    }
    if (preferMissed.length) {
      console.log('\n⚠ 以下条目的 prefer 没筛中任何候选（已退化为取第一个匹配）：');
      for (const { spec, sample } of preferMissed) {
        console.log(`    ${spec.kw}  prefer=${spec.prefer}`);
        for (const s of sample) console.log(`       候选：${s}`);
      }
    }
    const unique = new Set(planned.map(x => x.proj.id));
    console.log(`\n去重后实际可抓：${unique.size} 个项目`);
    return;
  }

  const details = {};
  const missing = [];

  for (const { spec, proj } of planned) {
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
  console.log('输出：public/data/details.json');}

main().catch(err => {
  console.error('\n失败：', err.message);
  process.exit(1);
});
