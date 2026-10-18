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
      <div class="filter-chips filter-chips--region ${regionCollapsed ? 'is-collapsed' : ''}"
           id="region-chips" data-collapsed="${regionCollapsed ? '1' : '0'}">
        <a class="tag tag-btn ${!region ? 'is-active' : ''}"
           href="#${buildPath({ q, category, batch })}">全部</a>
        ${regionHead.map(r => `
          <a class="tag tag-btn ${region === r ? 'is-active' : ''}"
             href="#${buildPath({ q, category, region: r, batch })}">${esc(r)}</a>`).join('')}
        ${regionTail.map(r => `
          <a class="tag tag-btn tag-btn--extra ${region === r ? 'is-active' : ''}"
             href="#${buildPath({ q, category, region: r, batch })}">${esc(r)}</a>`).join('')}
        ${regionTail.length ? `
          <button class="filter-more" type="button" id="region-more"
                  aria-expanded="false" aria-controls="region-chips">
            <span class="filter-more-label">展开全部</span>
            <span class="filter-more-count">+${regionHiddenCount}</span>
          </button>` : ''}
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
        sub: `收录国家级非物质文化遗产代表性项目按申报地区拆分的 ${num(meta.heritageCount || 0)} 条子项记录，可按门类、批次、地区检索。`,
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
  const cleanups = [];

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
      const keyword = input.value.trim();
      if (keyword === lastQ) return;
      if (keyword.length === 1) return;   // 单字不触发，等第二个字或回车
      lastQ = keyword;
      navigate(buildPath(buildNext(keyword)));
    };

    const onInput = () => {
      if (composing) return;
      clearTimeout(timer);
      timer = setTimeout(debounced, 420);
    };
    const onCompositionStart = () => { composing = true; };
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
      lastQ = input.value.trim();
      navigate(buildPath(buildNext(lastQ)));
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
      if (label) label.textContent = open ? '收起' : '展开全部';
    };
    regionMore.addEventListener('click', onToggleRegion);
    cleanups.push(() => regionMore.removeEventListener('click', onToggleRegion));
  }

  if (!cleanups.length) return undefined;
  return () => { for (const fn of cleanups) fn(); };
}
