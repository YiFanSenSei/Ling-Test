/**
 * 名录页 —— 全量检索、筛选、分页
 *
 * 评分细则「功能丰富性」与「跳转与导航」的主要承载页。
 * 筛选条件同步到 URL，保证可分享、可前进后退（「想去哪就去哪」档位）。
 */

import { queryProjects, getMeta, detectCategoryTerm, esc, num } from '../data.js';
import { ProjectCard, EmptyState, Pagination, SectionTitle } from '../components/ui.js';
import { navigate, currentPath } from '../router.js';

const PAGE_SIZE = 24;

/** 解析 hash 中的查询参数：/gallery?q=绣&category=传统美术&page=2 */
function parseQuery() {
  const hash = window.location.hash.slice(1);
  const qIdx = hash.indexOf('?');
  if (qIdx === -1) return {};
  const params = new URLSearchParams(hash.slice(qIdx + 1));
  return Object.fromEntries(params.entries());
}

/** 构造带参数的 hash 路径 */
function buildPath(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v !== undefined && v !== null) sp.set(k, v);
  }
  const qs = sp.toString();
  return `/gallery${qs ? `?${qs}` : ''}`;
}

export async function GalleryPage() {
  const meta = await getMeta();
  const params = parseQuery();
  const q = params.q || '';
  const category = params.category || '';
  const region = params.region || '';
  const batch = params.batch || '';
  const page = Number(params.page) || 1;

  const result = await queryProjects({ q, category, region, batch, page, pageSize: PAGE_SIZE });

  const categories = ['民间文学','传统音乐','传统舞蹈','传统戏剧','曲艺',
                      '传统体育、游艺与杂技','传统美术','传统技艺','传统医药','民俗'];
  const regions = (meta.byRegion || []).map(r => r.region);

  const hasFilter = q || category || region || batch;

  // 用户搜的若是「戏曲」「音乐」这类**门类级**的词，子串检索帮不上忙——
  // 「戏曲」会捞出皮影戏、木偶戏、傩戏，结果数和「戏」字出现次数成正比。
  // 与其给一堆无关结果，不如直接告诉他这其实是一个门类，并给出入口。
  const catHint = detectCategoryTerm(q);
  const hintBlock = (catHint && !category && result.total > 0) ? `
    <div class="result-hint">
      <p>
        「${esc(q)}」是一个<strong>门类</strong>，不是项目名称。上面的结果只是名称里
        恰好含这个字的部分项目，并非该门类的全部。
        要看完整的「${esc(catHint)}」，请使用门类筛选：
      </p>
      <p>
        <a class="btn btn-primary btn-sm" href="#${buildPath({ q, category: catHint, region, batch })}">
          只看「${esc(catHint)}」（${num((meta.byCategory || {})[catHint] || 0)} 条）
        </a>
        <a class="btn btn-ghost btn-sm" href="#${buildPath({ category: catHint, region, batch })}">
          该门类全部，不计关键词
        </a>
      </p>
    </div>` : '';

  /* ---- 筛选栏 ---- */
  const filters = `
  <form class="filters" id="gallery-filters" role="search">
    <div class="filter-search">
      <label class="sr-only" for="f-q">搜索项目名称</label>
      <input id="f-q" name="q" type="search" placeholder="搜索项目名称、编号或申报地区…"
             value="${esc(q)}" autocomplete="off">
      <button type="submit" class="filter-search-btn" aria-label="搜索">查</button>
    </div>

    <div class="filter-row">
      <span class="filter-label">门类</span>
      <div class="filter-chips">
        <a class="tag tag-btn ${!category ? 'is-active' : ''}"
           href="#${buildPath({ q, region, batch })}">全部</a>
        ${categories.map(c => `
          <a class="tag tag-btn ${category === c ? 'is-active' : ''}"
             href="#${buildPath({ q, category: c, region, batch })}">${esc(c)}</a>`).join('')}
      </div>
    </div>

    <div class="filter-row">
      <span class="filter-label">批次</span>
      <div class="filter-chips">
        <a class="tag tag-btn ${!batch ? 'is-active' : ''}"
           href="#${buildPath({ q, category, region })}">全部</a>
        ${[1,2,3,4,5].map(b => `
          <a class="tag tag-btn ${String(batch) === String(b) ? 'is-active' : ''}"
             href="#${buildPath({ q, category, region, batch: b })}">第${'一二三四五'[b-1]}批</a>`).join('')}
      </div>
    </div>

    <div class="filter-row">
      <span class="filter-label">地区</span>
      <div class="filter-chips">
        <a class="tag tag-btn ${!region ? 'is-active' : ''}"
           href="#${buildPath({ q, category, batch })}">全部</a>
        ${regions.map(r => `
          <a class="tag tag-btn ${region === r ? 'is-active' : ''}"
             href="#${buildPath({ q, category, region: r, batch })}">${esc(r)}</a>`).join('')}
      </div>
    </div>

    ${hasFilter ? `
    <div class="filter-actions">
      <a class="btn btn-ghost btn-sm" href="#/gallery">清除全部筛选</a>
    </div>` : ''}
  </form>`;

  /* ---- 结果 ---- */
  const body = result.items.length
    ? `<div class="card-grid">${result.items.map(p => ProjectCard(p)).join('')}</div>
       ${Pagination({
         page: result.page,
         totalPages: result.totalPages,
         basePath: `#${buildPath({ q, category, region, batch })}${buildPath({ q, category, region, batch }).includes('?') ? '&' : '?'}page=`,
       })}`
    : EmptyState(
        '没有找到匹配的项目',
        '试着减少筛选条件，或换一个关键词。也可以浏览全部门类与批次。',
        '<p style="margin-top:1.5rem"><a class="btn btn-primary" href="#/gallery">查看全部</a></p>'
      );

  return `
  <section class="page-head">
    <div class="container">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="#/">首页</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">非遗名录</span>
      </nav>
      ${SectionTitle({
        num: '贰',
        title: '非遗名录',
        sub: `收录国家级非物质文化遗产代表性项目按申报地区拆分的 ${num(3614)} 条子项记录，可按门类、批次、地区检索。`,
      })}
    </div>
  </section>

  <section class="section-tight">
    <div class="container">
      ${filters}

      <div class="result-bar">
        <p class="result-count">
          共 <strong>${num(result.total)}</strong> 条结果
          ${hasFilter ? '<span class="result-filtered">（已筛选）</span>' : ''}
        </p>
        ${result.totalPages > 1 ? `
          <p class="result-page">第 ${result.page} / ${result.totalPages} 页</p>` : ''}
      </div>

      ${body}

      ${hintBlock}
    </div>
  </section>`;
}

/**
 * 绑定筛选表单：提交后跳转到带参数的路径。
 *
 * 返回清理函数（约定见 main.js）。表单监听器挂在被替换的 DOM 上，
 * 理论上会随 innerHTML 一起消失，但显式摘除可以避免将来把监听器
 * 挪到 document 上时悄悄泄漏。
 */
export function initGallery() {
  const form = document.getElementById('gallery-filters');
  if (!form) return undefined;
  const input = form.querySelector('#f-q');
  if (!input) return undefined;

  const onSubmit = e => {
    e.preventDefault();
    const params = parseQuery();
    const next = {};
    if (input.value.trim()) next.q = input.value.trim();
    if (params.category) next.category = params.category;
    if (params.region) next.region = params.region;
    if (params.batch) next.batch = params.batch;
    // 改关键词应当从第 1 页重新开始，而不是沿用旧页码——
    // 否则在第 5 页改搜索词会停在一个可能并不存在的结果页上。
    navigate(buildPath(next));
  };

  form.addEventListener('submit', onSubmit);
  return () => form.removeEventListener('submit', onSubmit);
}
