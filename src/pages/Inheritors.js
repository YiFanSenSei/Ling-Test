/**
 * 传承人名录页 + 传承人档案页
 *
 * 为什么值得单独建页：
 *   主题二点名要求「匠人故事专题」。「匠」不在项目编号里，在人身上。
 *   详情页里那些传承人记录如果只作为项目页的附属表格存在，
 *   读者永远无法「按人」去逛这座展馆——而人恰恰是非遗最要紧的部分。
 *   传承人索引由 scripts/split-details.mjs 扁平化生成，本页按需加载（见 data.js）。
 *
 * 数据诚实原则：
 *   所属项目为第五批（2021）的部分传承人表格没有编号与出生日期。
 *   缺失字段照实标注为「未详」或「—」，不做任何推测性填充。
 */

import {
  queryInheritors, getInheritor, getInheritorSiblings, getInheritorStats,
  esc, num, batchLabel, birthYear,
} from '../data.js';
import { navigate, currentQuery } from '../router.js';
import { catalogCover } from '../components/catalog-art.js';
import { rememberInheritors, inheritorsReturn } from '../browse-state.js';

const PAGE_SIZE = 24;

/** 门类列表（与名录页保持一致） */
const CATEGORIES = [
  '民间文学', '传统音乐', '传统舞蹈', '传统戏剧', '曲艺',
  '传统体育、游艺与杂技', '传统美术', '传统技艺', '传统医药', '民俗',
];

function listQuery() {
  const params = new URLSearchParams(currentQuery());
  const page = Number(params.get('page'));
  return { q: (params.get('q') || '').trim(), category: CATEGORIES.includes(params.get('category')) ? params.get('category') : '',
    sort: ['birth', 'name', 'default'].includes(params.get('sort')) ? params.get('sort') : 'birth',
    page: Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1 };
}
function listPath(state) {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.category) params.set('category', state.category);
  if (state.sort !== 'birth') params.set('sort', state.sort);
  if (state.page > 1) params.set('page', state.page);
  return '#/inheritors' + (params.size ? `?${params}` : '');
}

/* ============================================================
 * 传承人名录页
 * ============================================================ */

export async function InheritorsPage() {
  const stats = await getInheritorStats();
  const { items, total, page, totalPages } = await queryInheritors({
    ...listQuery(), pageSize: PAGE_SIZE,
  });

  const html = `
  <div class="page-head">
    <div class="container">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="#/">首页</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">传承人</span>
      </nav>
      <p class="page-idx" aria-hidden="true">叁</p>
      <h1 class="page-title">传承人</h1>
      <p class="page-lede">
        一门手艺的存续，最后落在具体的人身上。这里是本站收录的
        <strong>${num(stats.total)}</strong> 条国家级代表性传承人档案记录（同一人可能关联多个项目），
        分布在 <strong>${num(stats.projects)}</strong> 个项目、
        <strong>${stats.categories}</strong> 个门类之中。
      </p>
    </div>
  </div>

  <div class="container">
    <!-- 统计条 -->
    <div class="inh-stats">
      <div class="inh-stat">
        <span class="inh-stat-num">${num(stats.total)}</span>
        <span class="inh-stat-label">条传承人档案</span>
      </div>
      <div class="inh-stat">
        <span class="inh-stat-num">${num(stats.withBirth)}</span>
        <span class="inh-stat-label">条有明确出生年份</span>
      </div>
      <div class="inh-stat">
        <span class="inh-stat-num">${num(stats.withCode)}</span>
        <span class="inh-stat-label">条有官方编号</span>
      </div>
      <div class="inh-stat">
        <span class="inh-stat-num">${stats.ethnicities}</span>
        <span class="inh-stat-label">个民族</span>
      </div>
      <a class="inh-stat inh-stat-link" href="#/ages">
        <span class="inh-stat-num">${stats.birth?.median ?? '—'}<em>年</em></span>
        <span class="inh-stat-label">出生年份中位数 · 看年代分布 →</span>
      </a>
    </div>

    <!-- 筛选区 -->
    <form class="filters" id="inh-filters" role="search" aria-label="传承人检索">
      <div class="filter-search">
        <label class="sr-only" for="inh-q">搜索传承人姓名、项目或编号</label>
        <input type="search" id="inh-q" name="q" placeholder="搜索姓名、所属项目或编号…"
               autocomplete="off" />
        <button type="submit" class="filter-search-btn">查</button>
      </div>

      <div class="filter-row">
        <span class="filter-label">门类</span>
        <div class="filter-chips" id="inh-category">
          <button type="button" class="tag tag-btn is-active" data-category="">全部</button>
          ${CATEGORIES.map(c => `
            <button type="button" class="tag tag-btn" data-category="${esc(c)}">${esc(c)}</button>
          `).join('')}
        </div>
      </div>

      <div class="filter-row">
        <span class="filter-label">排序</span>
        <div class="filter-chips" id="inh-sort">
          <button type="button" class="tag tag-btn is-active" data-sort="birth">按出生年份</button>
          <button type="button" class="tag tag-btn" data-sort="name">按姓氏</button>
          <button type="button" class="tag tag-btn" data-sort="default">按项目归集</button>
        </div>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" id="inh-reset">清除筛选</button>
    </form>

    <!-- 结果 -->
    <div class="result-bar">
      <p class="result-count" id="inh-count" role="status" tabindex="-1">共 <strong>${num(total)}</strong> 条传承人档案</p>
      <p class="result-page" id="inh-page">第 ${page} / ${totalPages} 页</p>
    </div>

    <div id="inh-list" class="inh-grid">
      ${items.map(renderInheritorCard).join('') || '<p class="empty-note">没有符合条件的传承人，请换个关键词或清除门类筛选。</p>'}
    </div>

    <nav class="pager" id="inh-pager" aria-label="分页">
      ${renderPager(page, totalPages)}
    </nav>

    <p class="result-note">
      说明：本站传承人数据取自中国非物质文化遗产网各项目详情页的公开表格。
      列表按所属项目的公布批次归集；该批次并非传承人的认定批次。
      公开表格未标注的编号与出生年份照实标注为「未详」，不作推测填补。
      <a class="result-more" href="#/ages">查看档案的出生年代分布 →</a>
    </p>
  </div>`;

  return { html, title: '传承人', init: initInheritors };
}

/** 单个传承人卡片 */
function renderInheritorCard(p) {
  const yr = birthYear(p.birth);
  return `
  <a class="inh-card" href="#/inheritor/${esc(p.id)}">
    <span class="inh-card-top">
      <span class="inh-cat">${esc(p.projectCategory || '门类未详')}</span>
      <span class="inh-code">${p.code ? `<span class="sr-only">官方编号：</span>${esc(p.code)}` : '编号未详'}</span>
    </span>
    <span class="inh-main">
      <strong class="inh-name">${esc(p.name || '—')}</strong>
      <span class="inh-meta">
        ${p.gender ? `<span class="inh-gender">${esc(p.gender)}</span>` : ''}
        ${yr ? `<span class="inh-birth">${esc(yr)} 年生</span>` : '<span class="inh-birth is-unknown">生年未详</span>'}
        ${p.ethnicity ? `<span>${esc(p.ethnicity)}</span>` : ''}
      </span>
      <span class="inh-project-label">传承项目</span>
      <span class="inh-project">${esc(p.projectTitle || '—')}</span>
    </span>
    <span class="inh-card-foot">
      <span class="inh-unit"><span class="sr-only">项目申报地区或单位：</span>${esc(p.declareUnit || '申报地区或单位未详')}</span>
      <span class="inh-card-arrow" aria-hidden="true">↗</span>
    </span>
  </a>`;
}

/** 分页条 */
function renderPager(page, totalPages) {
  if (totalPages <= 1) return '';
  const win = 2;
  const from = Math.max(1, page - win);
  const to = Math.min(totalPages, page + win);
  const btn = (p, label, opts = {}) => `
    <button type="button" class="pager-btn${opts.active ? ' is-active' : ''}"
      data-page="${p}"${opts.active ? ' aria-current="page"' : ''}
      ${opts.disabled ? 'disabled' : ''}>${label}</button>`;

  const parts = [];
  parts.push(btn(1, '首页', { disabled: page === 1 }));
  parts.push(btn(page - 1, '←', { disabled: page === 1 }));
  if (from > 1) parts.push('<span class="pager-gap">…</span>');
  for (let p = from; p <= to; p++) parts.push(btn(p, String(p), { active: p === page }));
  if (to < totalPages) parts.push('<span class="pager-gap">…</span>');
  parts.push(btn(page + 1, '→', { disabled: page === totalPages }));
  parts.push(btn(totalPages, '末页', { disabled: page === totalPages }));
  return parts.join('');
}

/** 名录页交互：检索、筛选、排序、分页 */
export function initInheritors({ restore = false } = {}) {
  const state = listQuery();
  let alive = true, version = 0, restoreFrame = 0;

  const listEl = document.getElementById('inh-list');
  const countEl = document.getElementById('inh-count');
  const pageEl = document.getElementById('inh-page');
  const pagerEl = document.getElementById('inh-pager');
  const formEl = document.getElementById('inh-filters');
  if (!listEl) return;
  // 这几个控件在列表页里总是存在（由 InheritorsPage 渲染），
  // 但取不到时直接跳过绑定，避免再次出现「无守卫即解引用」。
  const catEl = document.getElementById('inh-category');
  const sortEl = document.getElementById('inh-sort');
  const syncControls = () => {
    document.getElementById('inh-reset').hidden = !state.q && !state.category && state.sort === 'birth' && state.page === 1;
    catEl?.querySelectorAll('[data-category]').forEach(button => {
      const active = button.dataset.category === state.category;
      button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
    });
    sortEl?.querySelectorAll('[data-sort]').forEach(button => {
      const active = button.dataset.sort === state.sort;
      button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
    });
  };

  async function refresh() {
    const token = ++version;
    const hashAtStart = location.hash;
    listEl.setAttribute('aria-busy', 'true');
    try {
      const res = await queryInheritors({ ...state, pageSize: PAGE_SIZE });
      if (!alive || token !== version || location.hash !== hashAtStart) return;
      state.page = res.page;

      listEl.innerHTML = res.items.length
        ? res.items.map(renderInheritorCard).join('')
        : `<p class="empty-note">没有符合条件的传承人。请换个关键词，或点击「清除筛选」。</p>`;

      if (countEl) {
        const filtered = state.q || state.category;
        countEl.innerHTML = filtered
          ? `共 <strong>${num(res.total)}</strong> 条传承人档案 <span class="result-filtered">（已筛选）</span>`
          : `共 <strong>${num(res.total)}</strong> 条传承人档案`;
      }
      if (pageEl) pageEl.textContent = `第 ${res.page} / ${res.totalPages} 页`;
      if (pagerEl) pagerEl.innerHTML = renderPager(res.page, res.totalPages);
      listEl.removeAttribute('aria-busy'); syncControls();

      // 把状态同步进地址栏，使结果可分享、可回退
      const target = listPath(state);
      if (window.location.hash !== target) {
        window.history.replaceState(null, '', target);
      }
    } catch {
      if (!alive || token !== version || location.hash !== hashAtStart) return;
      listEl.removeAttribute('aria-busy');
      countEl.textContent = '列表暂时无法更新，请重新搜索或选择筛选。';
    }
  }

  // 监听器在文件末尾统一绑定（具名函数，便于 dispose 时摘除）

  // 从 URL 恢复筛选状态（支持直接分享带筛选的链接）
  const renderedPage = Number(pagerEl?.querySelector('[aria-current]')?.dataset.page) || 1;
  state.page = renderedPage;
  document.getElementById('inh-q').value = state.q;
  history.replaceState(null, '', listPath(state));
  syncControls();
  const remember = event => {
    const card = event.target.closest('.inh-card');
    if (card) rememberInheritors(card.getAttribute('href').split('/').pop());
  };
  listEl.addEventListener('click', remember);
  const saved = restore ? inheritorsReturn() : null;
  if (saved?.hash === location.hash) restoreFrame = requestAnimationFrame(() => {
    listEl.querySelector(`[href="#/inheritor/${saved.personId}"]`)?.focus({ preventScroll: true });
    window.scrollTo({ top: saved.y, behavior: 'instant' });
  });

  // 返回清理函数（约定见 main.js）。
  // 这些监听器都挂在本次渲染出来的元素上，会随 innerHTML 替换而消失，
  // 但显式摘除可保证将来把它们挪到 document/window 上时不会悄悄泄漏。
  const onFormSubmit = /** @type {EventListener} */ (e) => {
    e.preventDefault();
    const input = document.getElementById('inh-q');
    state.q = input ? input.value.trim() : '';
    state.page = 1;
    refresh();
  };
  const onCatClick = e => {
    const btn = e.target.closest('[data-category]');
    if (!btn) return;
    catEl.querySelectorAll('[data-category]').forEach(c => c.classList.remove('is-active'));
    btn.classList.add('is-active');
    state.category = btn.dataset.category;
    state.page = 1;
    refresh();
  };
  const onSortClick = e => {
    const btn = e.target.closest('[data-sort]');
    if (!btn) return;
    sortEl.querySelectorAll('[data-sort]').forEach(c => c.classList.remove('is-active'));
    btn.classList.add('is-active');
    state.sort = btn.dataset.sort;
    state.page = 1;
    refresh();
  };
  const onPagerClick = e => {
    const btn = e.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    state.page = Number(btn.dataset.page);
    refresh();
    countEl.focus({ preventScroll: true });
    countEl.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  };
  const reset = document.getElementById('inh-reset');
  const onReset = () => {
    Object.assign(state, { q: '', category: '', sort: 'birth', page: 1 });
    document.getElementById('inh-q').value = ''; refresh();
    countEl.focus({ preventScroll: true });
  };
  reset.addEventListener('click', onReset);

  if (formEl) { formEl.removeEventListener('submit', onFormSubmit); formEl.addEventListener('submit', onFormSubmit); }
  if (catEl) { catEl.removeEventListener('click', onCatClick); catEl.addEventListener('click', onCatClick); }
  if (sortEl) { sortEl.removeEventListener('click', onSortClick); sortEl.addEventListener('click', onSortClick); }
  if (pagerEl) { pagerEl.removeEventListener('click', onPagerClick); pagerEl.addEventListener('click', onPagerClick); }

  return () => {
    alive = false; version++; cancelAnimationFrame(restoreFrame);
    listEl.removeEventListener('click', remember);
    reset.removeEventListener('click', onReset);
    if (formEl) formEl.removeEventListener('submit', onFormSubmit);
    if (catEl) catEl.removeEventListener('click', onCatClick);
    if (sortEl) sortEl.removeEventListener('click', onSortClick);
    if (pagerEl) pagerEl.removeEventListener('click', onPagerClick);
  };
}

/* ============================================================
 * 传承人档案页
 * ============================================================ */

export async function InheritorPage(id) {
  const person = await getInheritor(id);
  if (!person) return { notFound: true };

  const { sameProject, sameCategory, sameCategoryLabel } = await getInheritorSiblings(person);
  const yr = birthYear(person.birth);
  const cover = catalogCover({ category: person.projectCategory, projectNo: person.projectNo });

  // 档案字段——空值一律显示「—」，不隐藏行（隐藏会让人以为是漏抓）
  const rows = [
    ['官方编号', person.code || '—'],
    ['性别', person.gender || '—'],
    ['出生日期', person.birth ? `${person.birth}${yr ? `（${yr} 年）` : ''}` : '官网未标注'],
    ['民族', person.ethnicity || '—'],
    ['所属门类', person.projectCategory || '—'],
    ['申报地区或单位', person.declareUnit || '—'],
    ['所属项目公布批次', person.batch ? batchLabel(person.batch) : '—'],
  ];

  // 项目链接：优先用项目编号找详情页
  const projectHref = `#/project/${esc(person.projectId)}`;

  const html = `
  <div class="page-head page-head-tight">
    <div class="container">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="#/">首页</a>
        <span aria-hidden="true">/</span>
        <a href="${esc(inheritorsReturn()?.hash || '#/inheritors')}">返回传承人列表</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">${esc(person.name)}</span>
      </nav>
    </div>
  </div>

  <div class="container inh-detail">
    <header class="inh-hero" style="${cover.style}">
      <div class="inh-hero-main">
        <p class="inh-hero-cat">传承人档案 <span class="inh-code">${person.code ? `编号 ${esc(person.code)}` : '编号未详'}</span></p>
        <h1 class="inh-hero-name">${esc(person.name)}</h1>
        <p class="inh-hero-sub">
          ${person.gender ? `<span>${esc(person.gender)}</span>` : ''}
          ${yr ? `<span>${esc(yr)} 年生</span>` : '<span>生年未详</span>'}
          ${person.ethnicity ? `<span>${esc(person.ethnicity)}</span>` : ''}
        </p>
        <p class="inh-hero-project">
          代表性项目：<a href="${projectHref}">${esc(person.projectTitle)}</a>
        </p>
      </div>
      <div class="inh-hero-art">
        ${cover.svg}
        <p>技艺意象 · ${esc(person.projectCategory || '传统技艺')}</p>
      </div>
    </header>

    <div class="inh-detail-layout">
      <div class="inh-detail-main">
        <section class="project-section">
          <h2 class="ps-title"><span class="ps-mark">人物档案</span></h2>
          <p class="project-text">
            这是中国非物质文化遗产网公开收录的国家级代表性传承人
            <strong>${esc(person.name)}</strong>，
            ${person.gender ? `${esc(person.gender)}性，` : ''}${yr
              ? `出生于 ${esc(yr)} 年，`
              : '出生年份官网未标注，'}所传承的是
            <strong>${esc(person.projectTitle)}</strong>（${esc(person.projectCategory || '未分类')}）。
            ${person.declareUnit ? `该项目的申报地区或单位为 ${esc(person.declareUnit)}。` : ''}
          </p>
          <p class="project-text">
            本页依据所属项目官方页面公开列出的传承人字段整理，
            未收录其完整生平、从艺经历或近况；相关认定信息以官方档案为准。
          </p>
          ${!person.birth || !person.code ? `
          <div class="about-callout">
            <h3>为什么有些字段是空的？</h3>
            <p>
              这条公开档案未完整标注编号或出生日期，本站按原始记录留空。
              侧栏批次取自所属项目的公布信息，不代表这位传承人的认定批次。
            </p>
          </div>` : ''}
        </section>

        ${sameProject.length ? `
        <section class="project-section">
          <h2 class="ps-title">
            <span class="ps-mark">同一门手艺的其他传承人</span>
            <span class="ps-count">${sameProject.length} 位</span>
          </h2>
          <div class="inh-grid inh-grid-compact">
            ${sameProject.map(renderInheritorCard).join('')}
          </div>
        </section>` : ''}

        ${sameCategory.length ? `
        <section class="project-section">
          <h2 class="ps-title">
            <span class="ps-mark">${esc(sameCategoryLabel || '同门类其他传承人')}</span>
            <span class="ps-count">${sameCategory.length} 位</span>
          </h2>
          <div class="inh-grid inh-grid-compact">
            ${sameCategory.map(renderInheritorCard).join('')}
          </div>
        </section>` : ''}
      </div>

      <aside class="project-aside">
        <div class="archive-card">
          <h2 class="archive-title">传承人档案</h2>
          <dl class="archive-list">
            ${rows.map(([k, v]) => `
              <div class="archive-row">
                <dt>${esc(k)}</dt>
                <dd>${esc(v)}</dd>
              </div>`).join('')}
          </dl>
          <p class="archive-source">
            数据来源：<a href="https://www.ihchina.cn/project_details/${esc(person.projectId)}.html" target="_blank" rel="noopener noreferrer">所属项目官方档案 ↗</a>
          </p>
        </div>

        <div class="aside-links">
          <a class="aside-link" href="${projectHref}">
            <span>查看所属项目</span>
            <span class="aside-arrow">→</span>
          </a>
          <a class="aside-link" href="#/inheritors?category=${encodeURIComponent(person.projectCategory || '')}">
            <span>同门类传承人</span>
            <span class="aside-arrow">→</span>
          </a>
          <a class="aside-link" href="#/simulator">
            <span>技艺互动体验</span>
            <span class="aside-arrow">→</span>
          </a>
        </div>
      </aside>
    </div>
  </div>`;

  return { html, title: `${person.name} · 传承人` };
}
