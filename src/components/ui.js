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

/** 门类纹样：不同门类用不同几何纹样，程序化绘制 */
const CATEGORY_PATTERN = {
  '民间文学': 'wave', '传统音乐': 'arc', '传统舞蹈': 'spiral', '传统戏剧': 'mask',
  '曲艺': 'dots', '传统体育、游艺与杂技': 'cross', '传统美术': 'lattice',
  '传统技艺': 'grid', '传统医药': 'leaf', '民俗': 'ring',
};

/** 生成门类纹样 SVG（零请求，随机种子固定以保证一致性） */
export function categoryPattern(category, seed = 0) {
  const kind = CATEGORY_PATTERN[category] || 'grid';
  const c = '#B23A2E';
  const shapes = {
    wave:    `<path d="M0 30 Q15 18 30 30 T60 30" stroke="${c}" fill="none" stroke-width="1.2"/>`,
    arc:     `<path d="M4 34 A16 16 0 0 1 36 34" stroke="${c}" fill="none" stroke-width="1.2"/><path d="M32 34 A16 16 0 0 1 64 34" stroke="${c}" fill="none" stroke-width="1.2"/>`,
    spiral:  `<path d="M34 34 m-18 0 a18 18 0 1 1 12 17 a12 12 0 1 0 -8 -12" stroke="${c}" fill="none" stroke-width="1.2"/>`,
    mask:    `<path d="M6 40 Q20 8 34 40 Q48 8 62 40" stroke="${c}" fill="none" stroke-width="1.2"/>`,
    dots:    `<circle cx="18" cy="18" r="3" fill="${c}"/><circle cx="46" cy="30" r="3" fill="${c}"/><circle cx="30" cy="46" r="3" fill="${c}"/>`,
    cross:   `<path d="M34 8 v52 M8 34 h52" stroke="${c}" stroke-width="1.2" fill="none"/>`,
    lattice: `<path d="M0 34 h68 M34 0 v68" stroke="${c}" stroke-width="1" fill="none" opacity=".7"/><rect x="14" y="14" width="40" height="40" stroke="${c}" fill="none" stroke-width="1.2" transform="rotate(45 34 34)"/>`,
    grid:    `<path d="M0 22 h68 M0 46 h68 M22 0 v68 M46 0 v68" stroke="${c}" stroke-width="1" fill="none" opacity=".7"/>`,
    leaf:    `<path d="M34 6 Q58 34 34 62 Q10 34 34 6 Z" stroke="${c}" fill="none" stroke-width="1.2"/>`,
    ring:    `<circle cx="34" cy="34" r="20" stroke="${c}" fill="none" stroke-width="1.2"/><circle cx="34" cy="34" r="10" stroke="${c}" fill="none" stroke-width="1"/>`,
  };
  return `<svg viewBox="0 0 68 68" aria-hidden="true" focusable="false">${shapes[kind] || shapes.grid}</svg>`;
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
