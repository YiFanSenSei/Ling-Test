/** 共用组件：馆藏卡片、详情页门类徽记、空状态与分页。 */
import { esc, batchLabel } from '../data.js';
import { catalogCover } from './catalog-art.js';

/** 详情页与传承人页沿用小型门类徽记；卡片使用独立的图录封面。 */
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

/** 申报单位与同源记录数保留在卡片；完整编号与策展问题在项目详情中阅读。 */
export function ProjectCard(p, { showRegion = true, showVariantBadge = true, curation = null } = {}) {
  const cover = catalogCover(p);
  const where = p.unit || p.region || '';
  const variants = Number(p.variantCount) || 1;
  const label = [p.name, p.category, showRegion && where].filter(Boolean).join(' · ');
  return `
  <a class="pcard" href="#/project/${esc(p.id)}" aria-label="${esc(label)}" style="${cover.style}">
    <div class="pcard-media" data-category="${esc(p.category)}" title="门类与工艺意象插画">
      <span class="pcard-plate">${p.categoryCode ? esc(p.categoryCode) + ' / ' : ''}${esc(p.category || '非遗项目')}</span>
      ${cover.svg}
      <span class="pcard-caption" aria-hidden="true">${cover.caption}</span>
    </div>
    <div class="pcard-body">
      <h3 class="pcard-name">${esc(p.name)}</h3>
      ${curation ? `<p class="pcard-curation">${esc(curation.reason)}</p>` : ''}
      <p class="pcard-meta">
        ${showRegion && where ? `<span class="pcard-region">${esc(where)}</span>` : '<span>查看项目档案</span>'}
        <span class="pcard-arrow" aria-hidden="true">↗</span>
      </p>
      <p class="pcard-sub">
        <span>${p.batch ? esc(batchLabel(p.batch)) : '项目档案'}</span>
        ${showVariantBadge && variants > 1 ? `<span class="pcard-variant" title="同一项目的 ${variants} 条申报记录">同项目 ${variants} 处申报</span>` : ''}
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
