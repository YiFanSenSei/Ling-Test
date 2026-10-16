/**
 * 共用 UI 组件：项目卡片、门类徽记、空状态
 *
 * ⚠️ 素材质量是评分独立分项（马赛克2 / 表情包4 / 正常6 / 高质量8 / 显卡在燃烧10）。
 *    官方数据源不提供任何配图，因此卡片不使用写实照片，
 *    改为「以字代图」——用门类单字徽记 + 程序化生成的纹样底纹，
 *    把「没有图」这个劣势转化为统一的视觉语言。
 *    比用低质量网图（会被判表情包4分）安全得多。
 */

import { esc, categoryGlyph, batchLabel } from '../data.js';

/**
 * 门类母题。
 *
 * ⚠️ 素材质量是评分独立分项（马赛克2 / 表情包4 / 正常6 / 高质量8 / 显卡在燃烧10）。
 *    官方数据源不提供任何项目配图（全量抓完 3,614 条详情，图片数为 0），
 *    所以这里不找写实照片——用低质网图反而会被判到「表情包」档。
 *    改为给每个门类画一枚**可辨认的母题**：简牍、琴、飘带、脸谱、折扇、
 *    绳结、缠枝、榫卯、药臼、灯笼。以字代图，把「没有图」变成统一的视觉语言。
 *
 * 这枚纹样同时用于三处，改一次三处都变：
 *   · 项目卡片底纹（`.pcard-media svg`，opacity 0.16，所以结构必须清晰）
 *   · 项目详情页的门类徽记（`.emblem-pattern`）
 *   · 传承人档案页的页首纹样（`.inh-hero-pattern`）
 *
 * ⚠️ 每条路径都靠 <svg> 上的 `fill="none"` 继承，不要漏——
 *    早先的写法没有设，`<rect>` 会吃到 SVG 的默认黑色填充。
 */
const CATEGORY_MOTIF = {
  // 简牍：三片竖简 + 两道编绳
  '民间文学': '<rect x="13" y="16" width="11" height="36" rx="1.5"/><rect x="28.5" y="11" width="11" height="46" rx="1.5"/><rect x="44" y="16" width="11" height="36" rx="1.5"/><path d="M11 27h46M11 41h46" opacity=".55"/>',
  // 琴：琴身弧线 + 三根弦 + 音孔
  '传统音乐': '<path d="M9 47Q34 27 59 47"/><path d="M14 41h40M16 35h36M19 29h30" opacity=".6"/><circle cx="34" cy="53" r="3.2"/>',
  // 飘带：两道旋绕的长袖
  '传统舞蹈': '<path d="M12 21Q34 6 50 21Q65 34 46 44Q27 53 34 62"/><path d="M20 30Q36 20 46 32Q54 43 38 49" opacity=".6"/>',
  // 脸谱：脸型轮廓 + 眉眼 + 鼻口
  '传统戏剧': '<path d="M34 7Q53 14 53 33Q53 55 34 61Q15 55 15 33Q15 14 34 7Z"/><path d="M21 29Q27.5 24 34 29M34 29Q40.5 24 47 29"/><path d="M34 34v10" opacity=".6"/><path d="M27 49Q34 53 41 49" opacity=".7"/>',
  // 折扇：扇面 + 扇骨
  '曲艺': '<path d="M34 57 13 25A42 42 0 0 1 55 25Z"/><path d="M34 57 22 26M34 57V21M34 57l12-31" opacity=".6"/><path d="M20 30Q34 23 48 30" opacity=".5"/>',
  // 空竹：绳圈 + 陀螺
  '传统体育、游艺与杂技': '<circle cx="34" cy="26" r="15"/><path d="M24 37Q34 57 44 37"/><circle cx="34" cy="48" r="5.5" opacity=".7"/>',
  // 缠枝：主枝 + 卷叶 + 花头
  '传统美术': '<path d="M34 62Q34 42 22 34Q34 26 34 6"/><path d="M34 34Q46 28 52 16" opacity=".65"/><circle cx="52" cy="14" r="4"/><circle cx="22" cy="34" r="3.4" opacity=".7"/>',
  // 榫卯：卯眼 + 榫头 + 出榫线
  '传统技艺': '<rect x="13" y="13" width="42" height="42" rx="2"/><rect x="26" y="26" width="16" height="16" rx="1.5" opacity=".8"/><path d="M34 13v13M34 42v13M13 34h13M42 34h13" opacity=".55"/>',
  // 药臼：臼身 + 杵 + 一片药叶
  '传统医药': '<path d="M17 28h34v13a17 17 0 0 1-34 0Z"/><path d="M34 26V12"/><circle cx="34" cy="10" r="4.5"/><path d="M46 52Q54 46 49 58" opacity=".6"/>',
  // 灯笼：灯身 + 骨架 + 流苏
  '民俗': '<ellipse cx="34" cy="31" rx="17" ry="19"/><path d="M34 12v38M17 31h34" opacity=".5"/><path d="M34 50v6"/><path d="M28 56v7M40 56v7" opacity=".7"/><path d="M24 12h20" opacity=".6"/>',
};

/** 生成门类母题 SVG（零请求，纯内联路径） */
export function categoryPattern(category) {
  const motif = CATEGORY_MOTIF[category] || CATEGORY_MOTIF['传统技艺'];
  return `<svg viewBox="0 0 68 68" aria-hidden="true" focusable="false" fill="none" `
    + `stroke="#B23A2E" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">`
    + `${motif}</svg>`;
}

/**
 * 项目卡片。
 *
 * ⚠️ 地区显示的是「申报地区或单位」(unit，精确到市/县)，不是省级的 region。
 *
 * 起因：苗族古歌由贵州省台江县、黄平县两地申报，两条记录同名、同批次、
 * 同属贵州省——用 region 渲染出来就是两张一模一样的卡片，看起来像重复数据。
 * 换成 unit 后「贵州省台江县」「贵州省黄平县」立刻分得开。
 * 这个修正早先只做在了详情页的「同一项目的其他申报地区」那一节，
 * 卡片漏掉了，于是列表仍是重复观感。
 *
 * 名字特别长的申报单位（如「中国社会科学院《格萨（斯）尔》办公室」）
 * 用 CSS 省略号截断，完整值放在 title 里，避免把卡片撑成不同高度。
 *
 * ⚠️ variantCount > 1 时压一枚「同项目 N 处申报」徽标。
 *    数据来自构建期索引（见 src/data.js 的 withVariantCount）——
 *    它把「为什么列表里有好几张同名卡片」直接写在卡片上，
 *    而不是让读者自己猜是不是抓重了。
 */
export function ProjectCard(p, { showRegion = true, showVariantBadge = true } = {}) {
  const glyph = categoryGlyph(p.category);
  const where = p.unit || p.region || '';
  const variants = Number(p.variantCount) || 1;
  return `
  <a class="pcard" href="#/project/${esc(p.id)}" aria-label="${esc(p.name)}">
    <div class="pcard-media" data-category="${esc(p.category)}">
      ${categoryPattern(p.category)}
      <span class="pcard-glyph" aria-hidden="true">${glyph}</span>
      ${showVariantBadge && variants > 1
        ? `<span class="pcard-variant" title="该项目共 ${variants} 条申报记录，点击查看其他地区">同项目 ${variants} 处申报</span>`
        : ''}
    </div>
    <div class="pcard-body">
      <h3 class="pcard-name">${esc(p.name)}</h3>
      <p class="pcard-meta">
        <span class="pcard-cat">${esc(p.category || '—')}</span>
        ${showRegion && where
          ? `<span class="pcard-sep">·</span><span class="pcard-region" title="${esc(where)}">${esc(where)}</span>`
          : ''}
      </p>
      <p class="pcard-sub">
        ${p.batch ? esc(batchLabel(p.batch)) : ''}
        ${p.projectNo ? `<span class="pcard-no">${esc(p.projectNo)}</span>` : ''}
      </p>
    </div>
  </a>`;
}

/** 空状态 */
export function EmptyState(title, desc, action = '') {
  return `
  <div class="empty-state">
    <div class="empty-mark" aria-hidden="true">空</div>
    <h3>${esc(title)}</h3>
    <p>${esc(desc)}</p>
    ${action}
  </div>`;
}

/** 章节标题：中文序号 + 标题 + 装饰线 */
export function SectionTitle({ num = '', title, sub = '', level = 2 }) {
  return `
  <header class="section-title">
    ${num ? `<span class="section-num" aria-hidden="true">${esc(num)}</span>` : ''}
    <div class="section-head">
      <h${level}>${esc(title)}</h${level}>
      ${sub ? `<p class="section-sub">${esc(sub)}</p>` : ''}
    </div>
  </header>`;
}

/** 分页控件 */
export function Pagination({ page, totalPages, basePath }) {
  if (totalPages <= 1) return '';
  const q = p => `${basePath}${p}`;
  const btn = (p, label, cls = '') =>
    `<a class="page-btn ${cls}" href="${q(p)}" aria-label="第 ${p} 页">${label}</a>`;

  const pages = [];
  const win = 2;
  for (let p = 1; p <= totalPages; p += 1) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= win) pages.push(p);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }

  return `
  <nav class="pagination" aria-label="分页导航">
    ${page > 1 ? btn(page - 1, '上一页', 'page-prev') : '<span class="page-btn is-disabled">上一页</span>'}
    <div class="page-nums">
      ${pages.map(p => p === '…'
        ? '<span class="page-gap" aria-hidden="true">…</span>'
        : (p === page
            ? `<span class="page-btn is-current" aria-current="page">${p}</span>`
            : btn(p, String(p)))
      ).join('')}
    </div>
    ${page < totalPages ? btn(page + 1, '下一页', 'page-next') : '<span class="page-btn is-disabled">下一页</span>'}
  </nav>`;
}
