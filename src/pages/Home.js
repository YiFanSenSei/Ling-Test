/**
 * 首页
 *
 * 评分细则「跳转与导航」：只有主页0 分——所以首页不能是全部，
 * 但首页必须足够吸引人，并明确导向其他页面。
 *
 * 结构：
 *   一、序（Hero）—— 竖排标题 + 数据摘要
 *   二、技艺体验 —— 三门手艺的直达入口
 *   三、数据看板 —— 用真实数据建立可信度
 *   四、门类十方 —— 十大门类入口
 *   五、精选馆藏 —— 有详情页的核心项目
 *   六、批次年表 —— 五批时间轴
 */

import { getMeta, getFeatured, getProjects, getInheritorStats, num, esc } from '../data.js';
import { ProjectCard, SectionTitle } from '../components/ui.js';
import { CATEGORY_ORDER } from '../icons.js';
import { catalogCover } from '../components/catalog-art.js';
import { CRAFTS } from '../crafts.js';
import { CURATION } from '../curation.js';
import { exhibitPhoto } from '../components/exhibit-photo.js';

export async function HomePage() {
  const [meta, featured, inhStats] = await Promise.all([
    getMeta(), getFeatured(), getInheritorStats(),
  ]);
  const projects = await getProjects();
  const official = meta.official || {};
  const byCategory = meta.byCategory || {};
  const byBatch = meta.byBatch || {};
  const byRegion = meta.byRegion || [];

  /* ---- 门类十方 ---- */
  const catOrder = CATEGORY_ORDER;
  // 分类入口与馆藏卡片共用插画；计数及分类筛选仍取自完整名录。
  const catCards = catOrder.map((name, i) => {
    const cover = catalogCover({ category: name });
    return `
    <a class="cat-card" href="#/gallery?category=${encodeURIComponent(name)}" style="${cover.style}">
      <div class="pcard-media" aria-hidden="true">
        <span class="cat-idx">${String(i + 1).padStart(2, '0')}</span>
        ${cover.svg}<span class="pcard-caption">${cover.caption}</span>
      </div>
      <div class="cat-copy">
        <span class="cat-name">${esc(name)}</span>
        <div class="cat-bottom"><span class="cat-count">${num(byCategory[name] || 0)} <em>项</em></span><span class="pcard-arrow" aria-hidden="true">↗</span></div>
      </div>
    </a>`;
  }).join('');

  /* ---- 精选馆藏（8 个）----
   * 不再覆写 region：卡片现在优先显示申报地区或单位（精确到市/县），
   * 比省级更能说明这一件是「谁家的」。
   */
  const featuredCards = featured.slice(0, 8)
    .map(p => ProjectCard(p, { curation: CURATION[p.id] }))
    .join('');

  /* ---- 批次年表 ---- */
  const batchYears = { 1: 2006, 2: 2008, 3: 2011, 4: 2014, 5: 2021 };
  const batchNodes = [1, 2, 3, 4, 5].map(b => `
    <li class="tl-node">
      <span class="tl-dot" aria-hidden="true"></span>
      <span class="tl-year">${batchYears[b]}</span>
      <span class="tl-label">第${'一二三四五'[b - 1]}批</span>
      <span class="tl-count">${num(byBatch[b] || 0)} 项</span>
    </li>`).join('');

  /* ---- 地域分布 Top 12 ----
   * 柱状图只画省级行政区：中直单位及机构（78 条）不属于任何省，
   * 混进来会挤掉一个省份的展示位。它在下方 data-note 里单独说明。
   *
   * 注意过滤写在这里、不写在 fetch-data.mjs 产 byRegion 的地方。
   * 那份数据同时是名录页地区筛选的选项来源，在源头过滤会连带把
   * 中直类从筛选里删掉，京剧昆曲古琴艺术就再也筛不出来了。
   */
  const regionSorted = byRegion
    .filter(r => r.region !== '中直单位及机构')
    .sort((a, b) => b.count - a.count);
  const maxRegion = regionSorted[0]?.count || 1;
  const regionBars = regionSorted.slice(0, 12).map(r => `
    <li class="region-row">
      <span class="region-name">${esc(r.region)}</span>
      <span class="region-bar" aria-hidden="true">
        <span style="width:${Math.round((r.count / maxRegion) * 100)}%"></span>
      </span>
      <span class="region-count">${num(r.count)}</span>
    </li>`).join('');

  return `
  <!-- ══════════ 一、序 ══════════ -->
  <section class="hero hero--exhibit">
    ${exhibitPhoto('home')}
    <span class="hero-border" aria-hidden="true"></span>
    <div class="container hero-inner">
      <div class="hero-copy">
        <p class="hero-eyebrow">
          <span class="hero-line" aria-hidden="true"></span>
          国家级非物质文化遗产 · 数字展馆
        </p>

        <h1 class="hero-title">
          <span class="hero-title-main">匠作</span>
          <span class="hero-title-sub">一针一线，一刀一刻</span>
        </h1>

        <p class="hero-lede">
          从苏绣的针脚、宣纸的帘纹，到榫卯的咬合。沿着馆藏寻访匠人，也亲手做一遍手艺。
        </p>

        <div class="hero-actions">
          <a class="btn btn-primary btn-lg" href="#/simulator?tool=embroidery">亲手绣一朵花</a>
          <a class="btn btn-ghost btn-lg" href="#/inheritors">寻访匠人</a>
          <a class="btn btn-ghost btn-lg" href="#/gallery">进入名录</a>
        </div>

        <dl class="hero-facts">
          <div>
            <dt>代表性项目</dt>
            <dd>${num(official.totalProjects || 1557)}<em>项</em></dd>
          </div>
          <div>
            <dt>代表性传承人</dt>
            <dd>${num(official.totalArtisans || 3998)}<em>位</em></dd>
          </div>
          <div>
            <dt>人类非遗名录</dt>
            <dd>${num(official.unescoItems || 45)}<em>项</em></dd>
          </div>
        </dl>
      </div>

    </div>

    <button type="button" class="hero-scroll" aria-controls="home-experiences">
      <span>向下看展</span>
      <span class="scroll-line" aria-hidden="true"></span>
    </button>
  </section>

  <!-- ══════════ 五、技艺体验 ══════════ -->
  <section class="section section-dark" id="home-experiences" tabindex="-1" aria-label="技艺互动体验">
    <div class="container sim-promo">
      <div class="sim-promo-copy">
        <p class="sim-promo-eyebrow">技艺互动体验</p>
        <h2>让手艺在屏幕上动起来</h2>
        <p>
          名录能告诉你有多少种手艺，却说不清一门手艺究竟难在哪里。<br>
          这里有三样可以亲手试的：<strong>苏绣</strong>的针法、
          <strong>宣纸</strong>的帘纹、<strong>榫卯</strong>的咬合——
          用鼠标或手指，体验经过简化的工序与结构。
        </p>
        <a class="btn btn-primary btn-lg" href="#/simulator">开始体验</a>
      </div>
      <ul class="sim-promo-list">
        ${CRAFTS.map((c, i) => `<li><a class="craft-entry" href="#/simulator?tool=${c.key}">
          <span class="sim-promo-idx">0${i + 1}</span>
          <span class="sim-promo-glyph" aria-hidden="true">${c.glyph}</span>
          <span><strong class="sim-promo-name">${c.name} · ${c.action}</strong><span class="craft-entry-desc">${c.description}</span></span>
          <span class="craft-entry-arrow" aria-hidden="true">↗</span>
        </a></li>`).join('')}
      </ul>
    </div>
  </section>

  <!-- ══════════ 二、数据看板 ══════════ -->
  <section class="section" id="data">
    <div class="container">
      ${SectionTitle({ num: '壹', title: '这座展馆里有什么', sub: '全部数据来自中国非物质文化遗产网公开信息，按官方口径统计。' })}

      <div class="stats">
        <div class="stat">
          <div class="stat-num">${num(official.totalProjects || 1557)}<em>项</em></div>
          <div class="stat-label">国家级代表性项目</div>
          <div class="stat-note">五批累计公布</div>
        </div>
        <div class="stat">
          <div class="stat-num">${num(projects.length)}<em>条</em></div>
          <div class="stat-label">按申报地区的子项</div>
          <div class="stat-note">本站可检索的数据量</div>
        </div>
        <div class="stat">
          <div class="stat-num">10<em>类</em></div>
          <div class="stat-label">十大门类</div>
          <div class="stat-note">文学至民俗</div>
        </div>
        <div class="stat">
          <div class="stat-num">${num(regionSorted.length)}<em>区</em></div>
          <div class="stat-label">覆盖省级行政区</div>
          <div class="stat-note">另列中直单位及机构</div>
        </div>
        <div class="stat">
          <div class="stat-num">${num(official.totalArtisans || 3998)}<em>位</em></div>
          <div class="stat-label">国家级代表性传承人</div>
          <div class="stat-note">含已认定批次</div>
        </div>
        <div class="stat stat-link">
          <a href="#/inheritors">
            <div class="stat-num">${num(inhStats.total)}<em>条</em></div>
            <div class="stat-label">本站传承人档案记录</div>
            <div class="stat-note">可逐人查阅 →</div>
          </a>
        </div>
      </div>

      <p class="data-note">
        数据说明：官方公布「国家级代表性项目 1557 项」，本站收录的
        <strong>${num(projects.length)} 条</strong>为按申报地区拆分后的子项记录——
        同一个项目由多省共同申报时会拆为多行。两者是不同层级的统计口径，
        本站检索使用子项数据，展示项目总数时使用官方口径。
      </p>
    </div>
  </section>

  <!-- ══════════ 三、门类十方 ══════════ -->
  <section class="section section-paper-deep">
    <div class="container">
      ${SectionTitle({ num: '贰', title: '门类十方', sub: '国家级非遗名录将项目分为十大门类，每一类都是一套完整的技艺体系。' })}
      <div class="cat-grid">${catCards}</div>
    </div>
  </section>

  <!-- ══════════ 四、精选馆藏 ══════════ -->
  <section class="section">
    <div class="container">
      ${SectionTitle({ num: '叁', title: '精选馆藏', sub: '从一根丝、一张纸到一座屋，循着材料与生活认识八项非遗。打开档案，继续寻访守护它们的人。' })}
      <div class="card-grid">${featuredCards}</div>
      <div class="section-more">
        <a class="btn btn-ghost" href="#/gallery">查看全部 ${num(projects.length)} 条子项 →</a>
      </div>
    </div>
  </section>

  <!-- ══════════ 六、批次年表 ══════════ -->
  <section class="section">
    <div class="container">
      ${SectionTitle({ num: '肆', title: '五批年表', sub: '国家级非遗名录自 2006 年起公布五批，本站完整收录。' })}
      <ol class="timeline">${batchNodes}</ol>

      <div class="divider"><span class="divider-mark">地域分布</span></div>

      <p class="region-lede">按申报地区统计，前十二位如下（含各省、自治区、直辖市）：</p>
      <ul class="region-list">${regionBars}</ul>
      <p class="data-note">
        数据统计口径：同一项目由多省共同申报时，本站按归一化后的省级行政区计入各自省份。
        机构类申报单位（如中国艺术研究院）单列为「中直单位及机构」，共
        ${num(meta.institutionCount || 0)} 条。
      </p>
    </div>
  </section>

  <!-- ══════════ 尾声 ══════════ -->
  <section class="closing">
    <div class="container closing-inner">
      <p class="closing-quote">
        「技艺的传承，从来不是把某样东西原封不动地保存下来，<br>
        而是让它继续被人使用、被人需要。」
      </p>
      <a class="btn btn-primary btn-lg" href="#/gallery">走进名录</a>
    </div>
  </section>`;
}

export function initHome() {
  const main = document.getElementById('main');
  const jump = main.querySelector('.hero-scroll');
  const experiences = main.querySelector('#home-experiences');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const goDown = () => {
    experiences.focus({ preventScroll: true });
    experiences.scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth' });
  };
  jump.addEventListener('click', goDown);

  const observers = [];
  if ('IntersectionObserver' in window && !motion.matches) {
    const reveal = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.08) {
          entry.target.classList.replace('reveal-pending', 'reveal-shown');
        }
      }
    }, { threshold: 0.08 });
    // 留出超过入场位移的缓冲，避免元素在视口边缘被自己的动画反复触发。
    const rearm = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) entry.target.classList.replace('reveal-shown', 'reveal-pending');
      }
    }, { rootMargin: '56px 0px' });
    observers.push(reveal, rearm);
    const targets = main.querySelectorAll('.section-title, .sim-promo-copy, .sim-promo-list li, .stat, .cat-card, .pcard, .timeline, .region-list, .closing-inner');
    for (const target of targets) {
      target.classList.add('home-reveal', 'reveal-pending');
      reveal.observe(target);
      rearm.observe(target);
    }
  }
  return () => {
    jump.removeEventListener('click', goDown);
    for (const observer of observers) observer.disconnect();
  };
}
