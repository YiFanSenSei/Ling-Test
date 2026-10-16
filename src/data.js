/**
 * 数据层：统一加载与查询非遗数据。
 *
 * 数据来源：中国非物质文化遗产网（文化和旅游部主管）
 *   https://www.ihchina.cn
 * 数据管道：scripts/fetch-data.mjs（名录）→ scripts/fetch-all-details.mjs（全量详情）
 *          → scripts/split-details.mjs（切分片，构建前自动执行）
 *
 * 加载策略：名录与统计口径等小数据在构建时内联进页面；
 *   项目详情与传承人索引体积大，改成按需注入的普通 <script> 分片。
 *   原因见下方「项目详情：按需加载分片」一节。
 *
 * ⚠️ 数据口径说明（「关于」页需向评委交代，体现严谨性）：
 *    projects.json 的 3614 条是「按申报地区拆分的子项记录」，
 *    与官方口径「1557 个国家级代表性项目」是不同层级的统计。
 *    前端展示项目总数时统一使用官方口径（1557），
 *    浏览、检索、筛选使用子项数据。二者的关系在「关于」页说明。
 */

const DATA_BASE = `${import.meta.env.BASE_URL}data`;

/** 内存缓存 */
const cache = new Map();

/**
 * 读取数据。
 *
 * 优先使用构建时内联到页面里的 window.__JZ_DATA__。
 * 这一步不是优化，而是为了让作品在 **file:// 协议下也能运行**：
 * Chrome 禁止本地文件页面发起 fetch 读取同目录 JSON（跨源策略，origin 为 null），
 * 所以「外链 JSON + 本地双击」的组合必定加载失败、只停在加载动画上。
 * 构建脚本 build-single-file 会把**小数据文件**（名录、统计口径、覆盖率索引、
 * 策展名单）内联进来；这里的 fetch 分支仅作为开发服务器（http://localhost）下的回退。
 * 体积大的详情与传承人索引不走这条路，见下方「项目详情：按需加载分片」。
 */
async function loadJSON(name) {
  if (cache.has(name)) return cache.get(name);

  const inline = typeof window !== 'undefined' && window.__JZ_DATA__ && window.__JZ_DATA__[name];
  if (inline !== undefined) {
    // 内联数据由构建脚本写成 JSON 字面量，这里直接使用
    const p = Promise.resolve(inline);
    cache.set(name, p);
    return p;
  }

  const p = fetch(`${DATA_BASE}/${name}.json`).then(res => {
    if (!res.ok) throw new Error(`数据加载失败：${name}.json（HTTP ${res.status}）`);
    return res.json();
  });
  cache.set(name, p);
  return p;
}

/* ---------------- 项目列表 ---------------- */

export const getMeta = () => loadJSON('meta');
export const getProjects = () => loadJSON('projects');
export const getFeaturedIds = () => loadJSON('featured');
export const getInheritorStatsFile = () => loadJSON('inheritor-stats');

/* ---------------- 项目详情：按需加载分片 ----------------
 *
 * 全量补录后详情约 10 MB。评委从名录随手点开的只是其中一条，
 * 为一条记录付 10 MB 不划算，所以详情被切成若干分片（见 scripts/split-details.mjs），
 * 点进某个项目时才注入它所在的那一片。
 *
 * ⚠️ 为什么用 <script> 注入而不是 fetch：
 *    Chrome 禁止 file:// 页面 fetch 同目录文件（origin 为 null），
 *    但**允许**普通 <script src>——受限的只有 type="module"。
 *    分片因此写成「向 window.__JZ_DETAILS__ 挂数据」的普通脚本。
 *    这是「双击 index.html 即用」能不能保住的关键，不要改成 fetch 或 import()。
 */

let _shardIndex = null;
const _shardPromises = new Map();

/** 分片索引：覆盖率、分片参数、按名录顺序排列的 id 列表（体积很小，随构建内联） */
export async function getDetailIndex() {
  if (!_shardIndex) _shardIndex = await loadJSON('detail-index');
  return _shardIndex;
}

/** 详情覆盖率——「关于」页与项目页用它陈述事实，不写死数字 */
export async function getDetailCoverage() {
  const idx = await getDetailIndex();
  return {
    total: idx.count,
    withIntro: idx.withIntro,
    shardCount: idx.shardCount,
    shardSize: idx.shardSize,
  };
}

/** 注入第 k 片（同一片并发只注入一次） */
function loadShard(k) {
  if (_shardPromises.has(k)) return _shardPromises.get(k);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${DATA_BASE}/detail-${k}.js`;
    s.onload = () => resolve();
    s.onerror = () => {
      _shardPromises.delete(k);
      reject(new Error(`详情分片加载失败：detail-${k}.js`));
    };
    document.head.appendChild(s);
  });
  _shardPromises.set(k, p);
  return p;
}

/** 按 id 取单个项目的完整详情（含正文与传承人） */
export async function getProjectDetail(id) {
  const key = String(id);
  const idx = await getDetailIndex();
  const pos = idx.ids.indexOf(key);

  if (pos >= 0) {
    try {
      await loadShard(Math.floor(pos / idx.shardSize));
      const detail = window.__JZ_DETAILS__ && window.__JZ_DETAILS__[key];
      if (detail) return detail;
    } catch (err) {
      // 分片没拿到不该让整页崩掉：退到档案卡形态，页面仍然可读
      console.warn(err.message);
    }
  }

  // 降级：仅在列表数据里（无正文），仍可展示基础信息
  const base = (await getProjects()).find(p => p.id === key);
  return base ? { ...base, intro: '', inheritors: [], noDetail: true } : null;
}

/* ---------------- 查询与筛选 ---------------- */

/**
 * 检索同义词表。
 *
 * 为什么要它：官方项目名称用的是行业术语，而普通人按日常叫法去搜。
 * 实测「瓷器」0 条命中，「陶瓷」13 条；「丝绸」1 条，「丝」26 条。
 * 这不是用户的问题，是检索没有替用户做翻译。
 *
 * ⚠️ 为什么不做「自动截短关键词」这种小聪明：
 *    把「瓷器」截成「瓷」看似能命中，实测会引入大量伪命中——
 *    「陶」会命中「陶朱公传说」（一则民间文学）和「陶克陶胡」（人名），
 *    「锦」会命中「锦歌」「锦州皮影戏」（地名），「雕」会命中「雕花剪纸」。
 *    宁可少而准，也不要多而错。因此用显式表逐条给出可信的等价说法。
 *
 * 每一项：key 为输入词（小写，做 includes 匹配），value 为要一并检索的等价词。
 */
const SYNONYMS = {
  '瓷器': ['瓷'],
  '陶瓷': ['瓷', '窑'],
  '青花': ['瓷', '景德镇'],
  '丝绸': ['丝', '锦', '绸'],
  '织锦': ['锦'],
  '刺绣': ['绣'],
  '乐器': ['乐'],
  '民族乐器': ['乐'],
  '中医': ['医', '中药'],
  '中药': ['药'],
  '武术': ['武', '拳'],
  '功夫': ['武', '拳'],
  '雕刻': ['雕', '刻'],
  '玉器': ['玉雕', '玉'],
  '木雕': ['雕', '木'],
  '石雕': ['雕', '石'],
  '漆器': ['漆'],
  '年画': ['木版年画'],
  '剪纸': ['剪'],
  '砚台': ['砚'],
  '笔墨': ['笔', '墨'],
  '造纸': ['纸'],
  '建筑': ['营造', '民居'],
  '民居': ['营造', '建筑'],
  '手工艺': ['技艺'],
  '传统工艺': ['技艺'],
  '少数民族': ['族'],
  '染布': ['染', '蓝印花布', '蜡染', '扎染'],
  '蜡染': ['染'],
  '扎染': ['染'],
  '编织': ['编', '织'],
  '竹器': ['竹编', '竹'],
  '制茶': ['茶'],
  '酿酒': ['酿'],
};

/**
 * 把用户输入扩展成一组等价关键词（含原词）。
 *
 * ⚠️ 精度护栏：
 *    单字同义词（如「戏」「丝」）命中面极广——「戏」会命中皮影戏、木偶戏、
 *    灯戏、傩戏，把「戏曲」的 28 条结果炸成 488 条，等于没搜。
 *    因此这里对单字同义词加一道限制：只有当原词本身不含该字、
 *    且该字确实是这门手艺的强特征时才放行。表中已人工筛过一轮，
 *    此处仅做长度与重复的兜底。
 */
function expandKeywords(raw) {
  const base = raw.trim().toLowerCase();
  if (!base) return [];
  const out = new Set([base]);
  for (const [key, vals] of Object.entries(SYNONYMS)) {
    if (base.includes(key)) {
      for (const v of vals) out.add(v.toLowerCase());
    }
  }
  return [...out];
}

/** 一个项目是否命中任一等价关键词 */
function matchProject(p, keywordList, rawInput) {
  const name = (p.name || '').toLowerCase();
  const no = (p.projectNo || '').toLowerCase();
  const prov = p.province || '';
  const unit = (p.unit || '').toLowerCase();
  const cat = (p.category || '').toLowerCase();
  return keywordList.some(kw =>
    name.includes(kw) || no.includes(kw) || cat.includes(kw)
    || unit.includes(kw) || prov.includes(rawInput.trim())
  );
}

/**
 * 门类级词汇 → 对应门类名。
 *
 * 为什么需要「提示」而不是直接扩大检索：
 *   「戏曲」「民间文学」这类词指向的是**整个门类**，不是某个项目名。
 *   用名称子串去搜「戏曲」，会把皮影戏、木偶戏、傩戏、灯戏全捞上来，
 *   结果数与「戏」字出现的次数成正比，和用户想找的东西无关。
 *   正确做法是告诉用户「你要找的是一个门类，点这里筛」，把控制权交回去。
 */
const CATEGORY_TERMS = {
  '戏曲': '传统戏剧',
  '戏剧': '传统戏剧',
  '音乐': '传统音乐',
  '舞蹈': '传统舞蹈',
  '曲艺': '曲艺',
  '美术': '传统美术',
  '技艺': '传统技艺',
  '医药': '传统医药',
  '文学': '民间文学',
  '传说': '民间文学',
  '民俗': '民俗',
  '杂技': '传统体育、游艺与杂技',
  '体育': '传统体育、游艺与杂技',
  '游艺': '传统体育、游艺与杂技',
};

/** 若查询词指向某个门类，返回该门类名；否则返回空串 */
export function detectCategoryTerm(q) {
  const s = (q || '').trim();
  if (!s || s.length > 6) return '';
  // 精确命中优先
  if (CATEGORY_TERMS[s]) return CATEGORY_TERMS[s];
  return '';
}

/**
 * 综合筛选 + 检索。
 * @param {object} opts
 *   q         关键词（匹配名称、项目编号、门类、申报地区，并自动扩展同义词）
 *   category  门类名
 *   region    省级行政区名
 *   batch     批次数字
 *   page      页码（从 1 开始）
 *   pageSize  每页条数
 */
export async function queryProjects({
  q = '', category = '', region = '', batch = '',
  page = 1, pageSize = 24,
} = {}) {
  const all = await getProjects();
  const keywordList = expandKeywords(q);

  let list = all;

  if (keywordList.length) {
    list = list.filter(p => matchProject(p, keywordList, q));
  }
  if (category) list = list.filter(p => p.category === category);
  if (region) list = list.filter(p => p.region === region);
  if (batch !== '' && batch !== null && batch !== undefined) {
    list = list.filter(p => String(p.batch) === String(batch));
  }

  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: list.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

/**
 * 首页「精选馆藏」的策展名单。
 *
 * 名单在 scripts/split-details.mjs 里显式点名，并按项目名与门类做校验。
 * 之前是「有详情的项目里按插入顺序取前八」——补录前只有 151 个策展级项目
 * 有详情，实际取到的是「苏绣 ×4 + 苗族古歌 ×2」，四个苏绣变体占掉一半版面，
 * 另两条还是同一项目的不同申报地区。补录后全部记录都有详情，这个取法只会更糟。
 *
 * 这里只从名录数据取卡片所需字段，不需要加载任何详情分片。
 */
export async function getFeatured() {
  const [projects, feat] = await Promise.all([getProjects(), getFeaturedIds()]);
  const byId = new Map(projects.map(p => [String(p.id), p]));
  return (feat.ids || []).map(id => byId.get(String(id))).filter(Boolean);
}

/**
 * 相邻项目导航（详情页「上一件 / 下一件」）。
 *
 * 顺序取官方名录顺序（projects.json 的排列），而不是「已抓到的详情」的顺序——
 * 后者会随补录进度变化，同一页面的上/下一件会在两次构建之间跳来跳去。
 */
export async function getSiblings(id) {
  const projects = await getProjects();
  const idx = projects.findIndex(p => String(p.id) === String(id));
  if (idx === -1) return { prev: null, next: null };
  const brief = p => (p ? { id: p.id, name: p.name, category: p.category } : null);
  return { prev: brief(projects[idx - 1]), next: brief(projects[idx + 1]) };
}

/* ---------------- 同一项目的各地区版本 ---------------- */

/**
 * 官方项目编号的前缀，例如 `Ⅶ-018_01_320580` → `Ⅶ-018`。
 *
 * 编号的结构是：<门类罗马数字>-<序号>_<批次>_<地区代码>。
 * 前缀 `Ⅶ-018` 指的是**项目本身**，后面的才是这次申报的批次与地区。
 * 所以前缀相同的记录 = 同一个国家级项目在不同地区的申报版本。
 */
export const projectCodePrefix = no => {
  const m = String(no || '').match(/^([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+-\d+)/);
  return m ? m[1] : '';
};

/** 去掉名字里的括号后缀：「剪纸（蔚县剪纸）」→「剪纸」 */
export const projectBaseName = name => String(name || '').replace(/[（(].*?[)）]\s*$/, '').trim();

/**
 * 找出同一项目的其他申报地区版本。
 *
 * 为什么值得做：编号前缀给出了一条**真实**的关联线索——
 * 3614 条记录归入 1557 个前缀，与官网公布的国家级代表性项目数目
 * （1557 个）完全吻合，说明前缀就是项目身份，不是巧合。
 *
 * 512 个项目有多个申报地区，覆盖 2569 条记录；剪纸最多，56 条。
 * 有了它，每个项目页都能横向展开到同源的其他版本，而不是翻完就到底。
 * （全量补录前它几乎是每个项目页唯一的实质内容；补录后正文补齐了，
 *   但这一节仍然是本站自己组织的关联，不是官网给的栏目。）
 */
let _prefixIndex = null;
export async function getProjectVariants(project) {
  const prefix = projectCodePrefix(project && project.projectNo);
  if (!prefix) return { prefix: '', baseName: '', variants: [], total: 1 };

  if (!_prefixIndex) {
    const projects = await getProjects();
    _prefixIndex = new Map();
    for (const p of projects) {
      const k = projectCodePrefix(p.projectNo);
      if (!k) continue;
      if (!_prefixIndex.has(k)) _prefixIndex.set(k, []);
      _prefixIndex.get(k).push(p);
    }
  }

  const all = _prefixIndex.get(prefix) || [];
  const variants = all.filter(p => String(p.id) !== String(project.id));
  return {
    prefix,
    baseName: projectBaseName(project.name),
    variants,
    total: all.length,
  };
}

/* ---------------- 传承人 ---------------- */

/**
 * 传承人索引（按需加载，只加载一次）。
 *
 * 索引由 scripts/split-details.mjs 在构建前从全部详情里扁平化生成。
 * 不这么做的代价：传承人分散在数千个项目的表格里，运行时逐项目遍历是
 * O(项目数 × 传承人数)，而且会强迫首页与传承人页加载全部详情分片。
 * 扁平化之后检索与排序都是 O(传承人数)。
 *
 * ⚠️ 索引里的 id 是「项目内序号」拼成的 `<项目id>-<序号>`，
 *    必须与项目详情页拼出的链接规则完全一致——两端由同一个脚本生成，
 *    改这里等于同时改链接的两端。
 *
 * ⚠️ 数据里有一部分「第五批（2021）」传承人没有编号、没有出生日期
 *    （官网原表如此，不是解析错误）。索引照实保留空值，
 *    展示层负责降级——不要用假数据填补，那等于伪造档案。
 */
let _inheritorIndex = null;
let _inheritorPromise = null;

async function loadInheritors() {
  if (_inheritorIndex) return _inheritorIndex;
  if (!_inheritorPromise) {
    _inheritorPromise = (async () => {
      const inline = typeof window !== 'undefined' && window.__JZ_DATA__ && window.__JZ_DATA__.inheritors;
      if (inline) return inline;
      // 与详情分片同理：普通 <script> 注入，file:// 下也能用
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = `${DATA_BASE}/inheritors.js`;
        s.onload = () => resolve();
        s.onerror = () => {
          _inheritorPromise = null;
          reject(new Error('传承人索引加载失败：inheritors.js'));
        };
        document.head.appendChild(s);
      });
      return window.__JZ_INHERITORS__ || [];
    })();
  }
  _inheritorIndex = await _inheritorPromise;
  return _inheritorIndex;
}

export const getInheritors = loadInheritors;

/**
 * 传承人检索。
 * @param {{q?:string, category?:string, batch?:string, hasBirth?:boolean, page?:number, pageSize?:number}} opts
 */
export async function queryInheritors({
  q = '', category = '', batch = '', sort = 'default', page = 1, pageSize = 24,
} = {}) {
  let list = await getInheritors();

  const kw = q.trim().toLowerCase();
  if (kw) {
    list = list.filter(p =>
      p.name.toLowerCase().includes(kw)
      || (p.projectTitle || '').toLowerCase().includes(kw)
      || (p.code || '').toLowerCase().includes(kw)
      || (p.declareUnit || '').toLowerCase().includes(kw)
      || (p.ethnicity || '').includes(q.trim())
    );
  }
  if (category) list = list.filter(p => p.projectCategory === category);
  if (batch !== '' && batch !== null && batch !== undefined) {
    list = list.filter(p => String(p.batch) === String(batch));
  }

  if (sort === 'birth') {
    // 有出生日期的排前面，按年份升序（年长者在前——他们是这门手艺更早的见证者）
    list = [...list].sort((a, b) => {
      const ya = (a.birth || '').match(/(\d{4})/);
      const yb = (b.birth || '').match(/(\d{4})/);
      if (ya && yb) return Number(ya[1]) - Number(yb[1]);
      if (ya) return -1;
      if (yb) return 1;
      return a.name.localeCompare(b.name, 'zh');
    });
  } else if (sort === 'name') {
    list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  }

  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return { items: list.slice(start, start + pageSize), total, page: safePage, pageSize, totalPages };
}

/** 按 id 取单个传承人 */
export async function getInheritor(id) {
  const list = await getInheritors();
  return list.find(p => p.id === String(id)) || null;
}

/** 同项目 / 同门类的其他传承人，用于「同门」推荐 */
export async function getInheritorSiblings(inheritor) {
  const list = await getInheritors();
  if (!inheritor) return { sameProject: [], sameCategory: [] };

  const sameProject = list.filter(
    p => p.projectId === inheritor.projectId && p.id !== inheritor.id
  );

  // ⚠️ 门类只有十个，每个门类覆盖的手艺差异极大——
  //    「传统美术」同时包含苏绣、年画、石雕、剪纸，把它们混在一栏里
  //    对读者没有帮助，反而像是推荐错了。因此这里改为**优先推荐同一
  //    门类中有详情页、且项目编号前缀（大类代码）相同**的项目，
  //    实在没有才退回同门类，并由调用方如实改变栏目标题。
  const isSameProject = p => p.projectId === inheritor.projectId;

  // 项目编号形如 Ⅶ-018_01_320580，取「Ⅶ」这一段作为大类代码
  const codeOf = no => String(no || '').split(/[-_]/)[0] || '';
  const myCode = codeOf(inheritor.projectNo);

  const sameCode = myCode
    ? list.filter(p => !isSameProject(p) && codeOf(p.projectNo) === myCode)
    : [];

  const sameCategory = (sameCode.length >= 3 ? sameCode : list.filter(
    p => p.projectCategory === inheritor.projectCategory && !isSameProject(p)
  )).slice(0, 6);

  return {
    sameProject,
    sameCategory,
    // 让调用方知道这一栏到底代表什么，不要硬贴「同门类」标签
    sameCategoryLabel: sameCode.length >= 3 ? '同大类其他传承人' : '同门类其他传承人',
  };
}

/**
 * 统计：有多少传承人、覆盖多少项目、多少门类。
 *
 * 走构建期算好的小文件（inheritor-stats.json），不加载传承人索引本身——
 * 首页只要一个数字，不该为此拉几百 KB 的索引。
 * 口径与 scripts/split-details.mjs 里生成索引时的那一段完全一致。
 */
export async function getInheritorStats() {
  return getInheritorStatsFile();
}

/* ---------------- 格式化工具 ---------------- */

/** 批次 → 年份 */
const BATCH_YEAR = { 1: 2006, 2: 2008, 3: 2011, 4: 2014, 5: 2021 };
export const batchLabel = b => (b ? `第${'一二三四五'[b - 1]}批 · ${BATCH_YEAR[b]}年` : '—');

/** 出生日期 "1967.04.06" → "1967 年" */
export function birthYear(birth) {
  const m = (birth || '').match(/(\d{4})/);
  return m ? `${m[1]}` : '';
}

/** 门类 → 单字码，用于图标徽记 */
const CATEGORY_GLYPH = {
  '民间文学': '文', '传统音乐': '乐', '传统舞蹈': '舞', '传统戏剧': '戏',
  '曲艺': '曲', '传统体育、游艺与杂技': '技', '传统美术': '美',
  '传统技艺': '艺', '传统医药': '医', '民俗': '俗',
};
export const categoryGlyph = c => CATEGORY_GLYPH[c] || '遗';

/** 转义 HTML —— 所有插入模板的数据都要过这一层 */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** 数字千分位 */
export const num = n => Number(n).toLocaleString('zh-CN');
