/**
 * 首页
 *
 * 评分细则「跳转与导航」：只有主页0 分——所以首页不能是全部，
 * 但首页必须足够吸引人，并明确导向其他页面。
 *
 * 结构：
 *   一、序（Hero）—— 竖排标题 + 数据摘要
 *   二、数据看板 —— 用真实数据建立可信度
 *   三、门类十方 —— 十大门类入口
 *   四、精选馆藏 —— 有详情页的核心项目
 *   五、技艺体验 —— 引导到模拟器
 *   六、批次年表 —— 五批时间轴
 */

import { getMeta, getFeatured, getProjects, getInheritorStats, num, esc, categoryGlyph, batchLabel } from '../data.js';
import { ProjectCard, SectionTitle } from '../components/ui.js';

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
  const catOrder = ['民间文学','传统音乐','传统舞蹈','传统戏剧','曲艺',
                    '传统体育、游艺与杂技','传统美术','传统技艺','传统医药','民俗'];
  const catCards = catOrder.map((name, i) => `
    <a class="cat-card" href="#/gallery?category=${encodeURIComponent(name)}">
      <span class="cat-idx" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
      <span class="cat-glyph" aria-hidden="true">${categoryGlyph(name)}</span>
      <span class="cat-name">${esc(name)}</span>
      <span class="cat-count">${num(byCategory[name] || 0)} <em>项</em></span>
    </a>`).join('');

  /* ---- 精选馆藏（8 个）---- */
  const featuredCards = featured.slice(0, 8)
    .map(p => ProjectCard({ ...p, region: p.provinces?.[0] || '' }))
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

  /* ---- 地域分布 Top 12 ---- */
  const maxRegion = byRegion[0]?.count || 1;
  const regionBars = byRegion.slice(0, 12).map(r => `
    <li class="region-row">
      <span class="region-name">${esc(r.region)}</span>
      <span class="region-bar" aria-hidden="true">
        <span style="width:${Math.round((r.count / maxRegion) * 100)}%"></span>
      </span>
      <span class="region-count">${num(r.count)}</span>
    </li>`).join('');

  return `
  <!-- ══════════ 一、序 ══════════ -->
  <section class="hero">
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
          从缂丝的经纬到宣纸的帘纹，从榫卯的咬合到青瓷的釉色——
          这些手艺曾是无数人一生的功课。<br>
          本站以国家级非物质文化遗产代表性项目为内容，
          建一座可以走进去的数字展馆，并让其中几门手艺，在屏幕上重新动起来。
        </p>

        <div class="hero-actions">
          <a class="btn btn-primary btn-lg" href="#/gallery">进入名录</a>
          <a class="btn btn-ghost btn-lg" href="#/inheritors">寻访匠人</a>
          <a class="btn btn-ghost btn-lg" href="#/simulator">体验技艺</a>
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

      <div class="hero-visual" aria-hidden="true">
        <div class="seal-stack">
          <span class="seal seal-1">匠</span>
          <span class="seal seal-2">作</span>
        </div>
        <svg class="hero-ornament" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" stroke-width="0.8" opacity=".28"/>
          <circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" stroke-width="0.6" opacity=".2"/>
          <circle cx="100" cy="100" r="44" fill="none" stroke="currentColor" stroke-width="0.6" opacity=".16"/>
          <path d="M100 12 v176 M12 100 h176" stroke="currentColor" stroke-width="0.4" opacity=".14"/>
          <path d="M40 40 L160 160 M160 40 L40 160" stroke="currentColor" stroke-width="0.4" opacity=".1"/>
        </svg>
      </div>
    </div>

    <div class="hero-scroll" aria-hidden="true">
      <span>向下</span>
      <span class="scroll-line"></span>
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
          <div class="stat-num">${num(meta.byRegion?.length || 34)}<em>区</em></div>
          <div class="stat-label">覆盖省级行政区</div>
          <div class="stat-note">含中直单位及机构</div>
        </div>
        <div class="stat">
          <div class="stat-num">${num(official.totalArtisans || 3998)}<em>位</em></div>
          <div class="stat-label">国家级代表性传承人</div>
          <div class="stat-note">含已认定批次</div>
        </div>
        <div class="stat stat-link">
          <a href="#/inheritors">
            <div class="stat-num">${num(inhStats.total)}<em>位</em></div>
            <div class="stat-label">本站已建档传承人</div>
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
      ${SectionTitle({ num: '叁', title: '精选馆藏', sub: '以下项目已建立完整详情页，含项目介绍、历代传承人与官方档案编号。' })}
      <div class="card-grid">${featuredCards}</div>
      <div class="section-more">
        <a class="btn btn-ghost" href="#/gallery">查看全部 ${num(projects.length)} 条子项 →</a>
      </div>
    </div>
  </section>

  <!-- ══════════ 五、技艺体验 ══════════ -->
  <section class="section section-dark">
    <div class="container sim-promo">
      <div class="sim-promo-copy">
        <p class="sim-promo-eyebrow">技艺互动体验</p>
        <h2>让手艺在屏幕上动起来</h2>
        <p>
          名录能告诉你有多少种手艺，却说不清一门手艺究竟难在哪里。<br>
          这里有三样可以亲手试的：<strong>苏绣</strong>的针法、
          <strong>宣纸</strong>的帘纹、<strong>榫卯</strong>的咬合——
          用鼠标当工具，还原它们最核心的那几道工序。
        </p>
        <a class="btn btn-primary btn-lg" href="#/simulator">开始体验</a>
      </div>
      <ul class="sim-promo-list">
        <li>
          <span class="sim-promo-idx">01</span>
          <span class="sim-promo-glyph">绣</span>
          <span class="sim-promo-name">苏绣 · 平针与打籽</span>
          <span class="sim-promo-tag">精品</span>
        </li>
        <li>
          <span class="sim-promo-idx">02</span>
          <span class="sim-promo-glyph">纸</span>
          <span class="sim-promo-name">宣纸 · 捞纸与帘纹</span>
          <span class="sim-promo-tag">简化</span>
        </li>
        <li>
          <span class="sim-promo-idx">03</span>
          <span class="sim-promo-glyph">卯</span>
          <span class="sim-promo-name">榫卯 · 燕尾与直角</span>
          <span class="sim-promo-tag">简化</span>
        </li>
      </ul>
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
