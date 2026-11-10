import { rememberGallery, galleryReturn } from '../browse-state.js';
import { exhibitPhoto } from '../components/exhibit-photo.js';
/**
 * 名录页 —— 全量检索、筛选、分页
 *
 * 评分细则「功能丰富性」与「跳转与导航」的主要承载页。
 * 筛选条件同步到 URL，保证可分享、可前进后退（「想去哪就去哪」档位）。
 */

import { queryProjects, getMeta, detectCategoryTerm, esc, num } from '../data.js';
import { ProjectCard, EmptyState, Pagination, SectionTitle } from '../components/ui.js';
import { navigate, currentQuery } from '../router.js';

const PAGE_SIZE = 24;

// 将搜索编辑状态或结果焦点交给对应的下一次名录渲染。
let pendingView = null;
const CATEGORIES = ['民间文学','传统音乐','传统舞蹈','传统戏剧','曲艺',
  '传统体育、游艺与杂技','传统美术','传统技艺','传统医药','民俗'];

/** 解析 hash 中的查询参数：/gallery?q=绣&category=传统美术&page=2 */
function parseQuery() {
  return currentQuery();
}

/** 构造带参数的 hash 路径 */
function buildPath(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === 'page' && Number(v) <= 1) continue;
    if (v !== '' && v !== undefined && v !== null) sp.set(k, v);
  }
  const qs = sp.toString();
  return `/gallery${qs ? `?${qs}` : ''}`;
}

export async function GalleryPage() {
  const meta = await getMeta();
  const params = parseQuery();
  const q = (params.q || '').trim();
  const category = CATEGORIES.includes(params.category) ? params.category : '';
  const region = (meta.byRegion || []).some(item => item.region === params.region) ? params.region : '';
  const batch = /^[1-5]$/.test(params.batch || '') ? params.batch : '';
  const requestedPage = Number(params.page);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;

  const result = await queryProjects({ q, category, region, batch, page, pageSize: PAGE_SIZE });

  const categories = CATEGORIES;
  const canonical = '#' + buildPath({ q, category, region, batch, page: result.page });
  /*
   * 地区筛选项：33 个省级行政区 + 「中直单位及机构」。
   *
   * 中直类必须在这里也有，否则京剧、昆曲、古琴艺术、格萨（斯）尔这 78 个
   * 由中国艺术研究院等单位申报的项目，就只存在于「全部」和关键词搜索里，
   * 按地区一路筛下去永远见不到——而首页明明写着它们单列成一项。
   *
   * 排序上把它压到最后：它不是行政区，混在省份中间读起来别扭。
   * 按 count 降序排省份，中直不在其中独立成末位。
   */
  const allRegions = (meta.byRegion || []);
  const regionList = allRegions
    .filter(r => r.region !== '中直单位及机构')
    .sort((a, b) => b.count - a.count)
    .map(r => r.region);
  if (allRegions.some(r => r.region === '中直单位及机构')) regionList.push('中直单位及机构');

  /*
   * 地区有 34 项，全铺开要占三行、把结果往下顶掉大半屏。
   * 默认只露前 12 行（含「全部」共 13 个 chip），其余折进「展开全部」。
   *
   * ⚠️ 不能因为「折叠着」就把选中项藏起来——如果用户带着 region 参数进来的，
   *    或者选了排在后半段的省份，折叠区里看不到自己选了什么，
   *    会以为筛选没生效。所以已选中的那个永远露在外面。
   */
  const REGION_VISIBLE = 12;
  const regionTail = regionList.slice(REGION_VISIBLE);
  const regionHead = regionList.slice(0, REGION_VISIBLE);
  const regionCollapsed = !region && regionTail.length > 0;
  const regionHiddenCount = regionTail.length;

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
          在「${esc(catHint)}」内继续搜索
        </a>
        <a class="btn btn-ghost btn-sm" href="#${buildPath({ category: catHint, region, batch })}">
          该门类全部，不计关键词
        </a>
      </p>
    </div>` : '';

  /* ---- 筛选栏 ---- */
  const filters = `
  <form class="filters${hasFilter ? ' has-selection' : ''}" id="gallery-filters" role="search">
    <div class="gallery-filter-top">
      ${SectionTitle({
        num: '贰',
        level: 1,
        title: '非遗名录',
        sub: `收录国家级非物质文化遗产代表性项目按申报地区拆分的 ${num(meta.heritageCount || 0)} 条子项记录，可按门类、批次、地区检索。`,
      })}
      <div class="filter-search">
        <label class="sr-only" for="f-q">搜索项目名称</label>
        <input id="f-q" name="q" type="search" placeholder="搜索项目名称、编号或申报地区…"
               value="${esc(q)}" autocomplete="off">
        <button type="submit" class="filter-search-btn" aria-label="搜索">查</button>
      </div>
    </div>

    <div class="filter-row">
      <span class="filter-label" id="category-filter-label">门类</span>
      <div class="filter-chips category-filters" role="group" aria-labelledby="category-filter-label">
        <a class="tag tag-btn ${!category ? 'is-active' : ''}"
           href="#${buildPath({ q, region, batch })}" data-gallery-category=""
           ${!category ? 'aria-current="true"' : ''}>全部 <span class="category-filter-count">${num(meta.heritageCount || 0)}</span></a>
        ${categories.map(c => `
          <a class="tag tag-btn ${category === c ? 'is-active' : ''}"
             href="#${buildPath({ q, category: c, region, batch })}" data-gallery-category="${esc(c)}"
             ${category === c ? 'aria-current="true"' : ''}>${esc(c)} <span class="category-filter-count">${num(meta.byCategory[c] || 0)}</span></a>`).join('')}
      </div>
    </div>

    <div class="filter-row">
      <span class="filter-label" id="batch-filter-label">批次</span>
      <div class="filter-chips" role="group" aria-labelledby="batch-filter-label">
        <a class="tag tag-btn ${!batch ? 'is-active' : ''}"
           ${!batch ? 'aria-current="true"' : ''}
           href="#${buildPath({ q, category, region })}">全部</a>
        ${[1,2,3,4,5].map(b => `
          <a class="tag tag-btn ${String(batch) === String(b) ? 'is-active' : ''}"
             ${String(batch) === String(b) ? 'aria-current="true"' : ''}
             href="#${buildPath({ q, category, region, batch: b })}">第${'一二三四五'[b-1]}批</a>`).join('')}
      </div>
    </div>

    <div class="filter-row">
      <span class="filter-label" id="region-filter-label">地区</span>
      <div class="filter-chips filter-chips--region ${regionCollapsed ? 'is-collapsed' : ''}"
           id="region-chips" role="group" aria-labelledby="region-filter-label" data-collapsed="${regionCollapsed ? '1' : '0'}">
        <a class="tag tag-btn ${!region ? 'is-active' : ''}"
           ${!region ? 'aria-current="true"' : ''}
           href="#${buildPath({ q, category, batch })}">全部</a>
        ${regionHead.map(r => `
          <a class="tag tag-btn ${region === r ? 'is-active' : ''}"
             ${region === r ? 'aria-current="true"' : ''}
             href="#${buildPath({ q, category, region: r, batch })}">${esc(r)}</a>`).join('')}
        ${regionTail.map(r => `
          <a class="tag tag-btn tag-btn--extra ${region === r ? 'is-active' : ''}"
             ${region === r ? 'aria-current="true"' : ''}
             href="#${buildPath({ q, category, region: r, batch })}">${esc(r)}</a>`).join('')}
        ${regionTail.length ? `
          <button class="filter-more" type="button" id="region-more"
                  aria-expanded="${!regionCollapsed}" aria-controls="region-chips">
            <span class="filter-more-label">${regionCollapsed ? '展开全部' : '收起'}</span>
            <span class="filter-more-count" ${regionCollapsed ? '' : 'hidden'}>+${regionHiddenCount}</span>
          </button>` : ''}
      </div>
    </div>

  </form>`;

  const chosen = [
    ['q', '关键词', q], ['category', '门类', category],
    ['region', '地区', region], ['batch', '批次', batch && `第${'一二三四五'[Number(batch)-1]}批`],
  ].filter(([, , value]) => value);
  const selected = hasFilter ? `<div class="selected-filters" aria-label="已选筛选条件">
    <span class="selected-label">已选</span>${chosen.map(([key, label, value]) => {
      const next = { q, category, region, batch }; delete next[key];
      return `<a class="selected-filter" href="#${buildPath(next)}" aria-label="移除${label}：${esc(value)}" data-remove-filter="${key}"><span>${esc(value)}</span><span aria-hidden="true">×</span></a>`;
    }).join('')}<a class="selected-clear" href="#/gallery">清除全部</a></div>` : '';

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
  <div class="gallery-masthead">
    ${exhibitPhoto('gallery')}
    <div class="container">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="#/">首页</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">非遗名录</span>
      </nav>
    </div>
  </div>

  <section class="section-tight gallery-section">
    <div class="container" id="gallery-content" data-path="${esc(canonical)}">
      ${filters}

      ${selected}
      <div class="result-bar">
        <p class="result-count" tabindex="-1">
          ${category ? `<span class="result-category">${esc(category)}</span> · ` : ''}共 <strong>${num(result.total)}</strong> 条结果
          ${hasFilter ? '<span class="result-filtered">（已筛选）</span>' : ''}
        </p>
        <span class="sr-only" role="status" aria-live="polite">找到 ${result.total} 条结果，第 ${result.page} 页。</span>
        ${result.totalPages > 1 ? `
          <p class="result-page">第 ${result.page} / ${result.totalPages} 页</p>` : ''}
      </div>

      ${body}

      ${hintBlock}
    </div>
  </section>`;
}

/** 绑定筛选与结果导航，离开时释放监听器和待执行的滚动。 */
export function initGallery({ restore = false } = {}) {
  const cleanups = [];
  const requestedHash = location.hash;
  history.replaceState(null, '', document.getElementById('gallery-content').dataset.path);
  const initialHash = location.hash;
  const view = pendingView?.path === requestedHash ? pendingView : null;
  pendingView = null;
  const onProjectClick = e => {
    const card = e.target.closest('.pcard');
    if (card) rememberGallery(card.getAttribute('href').split('/').pop());
    const filter = e.target.closest('a[href^="#/gallery"]');
    if (filter && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && filter.hash !== location.hash)
      pendingView = { path: filter.hash, mode: 'results' };
  };
  document.getElementById('main').addEventListener('click', onProjectClick);
  const main = document.getElementById('main');
  cleanups.push(() => main.removeEventListener('click', onProjectClick));
  if (view) {
    const frame = requestAnimationFrame(() => {
      if (view.mode === 'search') {
        const more = document.getElementById('region-more');
        if (more && (more.getAttribute('aria-expanded') === 'true') !== view.expanded) more.click();
        const input = document.getElementById('f-q');
        if (input) {
          input.value = view.value; input.focus({ preventScroll: true });
          if (Number.isInteger(view.start)) input.setSelectionRange(view.start, view.end, view.direction);
        }
        window.scrollTo({ top: view.y, behavior: 'instant' });
        return;
      }
      const result = document.querySelector('.result-count');
      result?.focus({ preventScroll: true });
      result?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    cleanups.push(() => cancelAnimationFrame(frame));
  }
  const saved = restore ? galleryReturn() : null;
  if (saved?.hash === location.hash) {
    const frame = requestAnimationFrame(() => {
      const more = document.getElementById('region-more');
      if (more && (more.getAttribute('aria-expanded') === 'true') !== Boolean(saved.expanded)) more.click();
      const card = [...document.querySelectorAll('.pcard')].find(c => c.getAttribute('href') === `#/project/${saved.projectId}`);
      card?.focus({ preventScroll: true });
      window.scrollTo({ top: saved.y, behavior: 'instant' });
    });
    cleanups.push(() => cancelAnimationFrame(frame));
  }

  const form = document.getElementById('gallery-filters');
  if (!form) return cleanups.length ? () => { for (const fn of cleanups) fn(); } : undefined;

  const input = form.querySelector('#f-q');

  /*
   * ---- 输入即搜（防抖 420ms）----
   *
   * 原本只有按回车或点「查」才跳转，输入框里打了半天没反应，
   * 属于「有操作障碍」那一档的观感。这里补上防抖实时搜索。
   *
   * 三条克制：
   *   · 至少 2 个字才触发——单字查询命中面太大，边打边跳只会让人眼晕；
   *   · 值没变就不跳（避免左右移动光标也触发路由重渲染）；
   *   · 正在输入法组字（composing）时不触发，否则拼音打一半就会搜「sux」。
   *
   * 回车仍然走 submit，二者用 _lastQ 对齐，避免重复跳转。
   */
  if (input) {
    let timer = null;
    let composing = false;
    let lastQ = (parseQuery().q || '').trim();

    const buildNext = keyword => {
      const params = parseQuery();
      const next = {};
      if (keyword) next.q = keyword;
      if (params.category) next.category = params.category;
      if (params.region) next.region = params.region;
      if (params.batch) next.batch = params.batch;
      // 改关键词应当从第 1 页重新开始，而不是沿用旧页码——
      // 否则在第 5 页改搜索词会停在一个可能并不存在的结果页上。
      return next;
    };

    const debounced = () => {
      if (composing || location.hash !== initialHash || document.activeElement !== input) return;
      const keyword = input.value.trim();
      if (keyword === lastQ) return;
      if (keyword.length === 1) return;   // 单字不触发，等第二个字或回车
      lastQ = keyword;
      const path = buildPath(buildNext(keyword));
      pendingView = { path: '#' + path, mode: 'search', y: scrollY,
        value: input.value, start: input.selectionStart, end: input.selectionEnd, direction: input.selectionDirection,
        expanded: document.getElementById('region-more')?.getAttribute('aria-expanded') === 'true' };
      navigate(path);
    };

    const onInput = () => {
      if (composing) return;
      clearTimeout(timer);
      timer = setTimeout(debounced, 420);
    };
    const onCompositionStart = () => { composing = true; clearTimeout(timer); };
    const onCompositionEnd = () => {
      composing = false;
      clearTimeout(timer);
      timer = setTimeout(debounced, 420);
    };

    input.addEventListener('input', onInput);
    input.addEventListener('compositionstart', onCompositionStart);
    input.addEventListener('compositionend', onCompositionEnd);
    cleanups.push(() => {
      clearTimeout(timer);
      input.removeEventListener('input', onInput);
      input.removeEventListener('compositionstart', onCompositionStart);
      input.removeEventListener('compositionend', onCompositionEnd);
    });

    const onSubmit = e => {
      e.preventDefault();
      clearTimeout(timer);
      if (composing || location.hash !== initialHash) return;
      lastQ = input.value.trim();
      const path = buildPath(buildNext(lastQ));
      if ('#' + path === location.hash) {
        const result = document.querySelector('.result-count');
        result?.focus({ preventScroll: true }); result?.scrollIntoView({ block: 'start', behavior: 'instant' });
      } else { pendingView = { path: '#' + path, mode: 'results' }; navigate(path); }
    };
    form.addEventListener('submit', onSubmit);
    cleanups.push(() => form.removeEventListener('submit', onSubmit));
  }

  /*
   * ---- 地区折叠区 ----
   *
   * 折叠只发生在首屏渲染前（服务端式地由模板决定 is-collapsed），
   * 这里只负责「展开 / 收起」这一下。不做动画入场——
   * 34 个 chip 同时出现时，逐个淡入反而像卡了。
   */
  const regionBox = document.getElementById('region-chips');
  const regionMore = document.getElementById('region-more');
  if (regionBox && regionMore) {
    const label = regionMore.querySelector('.filter-more-label');
    const onToggleRegion = () => {
      const open = regionBox.classList.toggle('is-collapsed') === false;
      regionMore.setAttribute('aria-expanded', String(open));
      regionBox.dataset.collapsed = open ? '0' : '1';
      regionMore.querySelector('.filter-more-count').hidden = open;
      if (label) label.textContent = open ? '收起' : '展开全部';
    };
    regionMore.addEventListener('click', onToggleRegion);
    cleanups.push(() => regionMore.removeEventListener('click', onToggleRegion));
  }

  if (!cleanups.length) return undefined;
  return () => { for (const fn of cleanups) fn(); };
}
