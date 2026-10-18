/**
 * 传承人年龄结构页
 *
 * 为什么单独建这一页：
 *   名录 3,614 条、传承人 4,032 位，数字本身不会说话。真正让人心里一沉的是
 *   「有出生日期的 1,981 人中，1,608 位在 70 岁以上」——这不是我们从别处抄来的
 *   结论，是把自己的数据摊开算出来的，每一步都可复算。
 *
 * 三条必须守住的口径（写进页面文案，不只写在注释里）：
 *   1. **基准年是 2026，不是「当年公布时」。** 官方名单只公布出生年份、不公布
 *      生卒，所以 1908 年出生的第一批传承人在这里显示 118 岁。那是他「若在世」
 *      的年龄，不是宣称他仍在世。页面必须明说。
 *   2. **只统计 birth 非空的记录，空缺不推测。** 第四、五批官网这两栏整体空白，
 *      覆盖率会直接暴露在表格里。
 *   3. **媒体口径与本站口径不同，要并排摆出来。** 媒体算的多是「在世 + 当年」，
 *      本站算「全部记录 + 2026」，所以我们的均值天然偏高。不解释这一点，
 *      读者会以为要么媒体错、要么我们错。
 *
 * 数据来自构建期算好的 inheritor-stats.json（见 scripts/split-details.mjs），
 * 本页不加载 1.5 MB 的传承人索引。
 */

import { getInheritorStats, batchLabel, num, esc } from '../data.js';

const BATCH_ORDER = ['1', '2', '3', '4', '5'];

export async function AgesPage() {
  const stats = await getInheritorStats();
  const age = stats.age || {};
  const histogram = age.histogram || [];
  const byBatch = age.byBatch || [];

  const counted = age.counted || 0;
  const maxCount = Math.max(1, ...histogram.map(h => h.count));
  const over70Pct = counted ? Math.round((age.over70 / counted) * 1000) / 10 : 0;
  const over80Pct = counted ? Math.round((age.over80 / counted) * 1000) / 10 : 0;

  /* 柱状图：纯 CSS 高度百分比，不引任何图表库（比赛禁止预设样式库）
   *
   * 高度按「最大柱 = 100%」归一化，但容器顶部要留出数字标签的位置，
   * 否则最高那根柱子的数字会被裁掉（第一版就是这个问题）。
   * 计数为 0 的档位没有柱子，看起来像页面坏了，所以补一个最小可见的底座。
   */
  const bars = histogram.map(h => {
    const pct = counted ? Math.round((h.count / counted) * 1000) / 10 : 0;
    const hPx = Math.round((h.count / maxCount) * 100);
    const zero = h.count === 0;
    return `
      <li class="age-bar${zero ? ' is-zero' : ''}"
          aria-label="${esc(h.label)}：${num(h.count)} 人，占 ${pct}%">
        <span class="age-bar-fill" style="height:${zero ? 0 : hPx}%" aria-hidden="true"></span>
        <span class="age-bar-count">${num(h.count)}</span>
        <span class="age-bar-label">${esc(h.label)}</span>
        <span class="age-bar-pct">${pct}%</span>
      </li>`;
  }).join('');

  /* 分批次覆盖率表：缺口本身就是内容 */
  const batchRows = BATCH_ORDER.map(b => {
    const row = byBatch.find(r => r.batch === b);
    if (!row) return '';
    const empty = row.born === 0;
    return `
      <tr class="${empty ? 'is-empty' : ''}">
        <th scope="row">${esc(batchLabel(Number(b)))}</th>
        <td>${num(row.total)}</td>
        <td>${num(row.born)}</td>
        <td>
          <span class="cov-bar" aria-hidden="true">
            <span style="width:${row.coverage}%"></span>
          </span>
          <span class="cov-num">${row.coverage}%</span>
        </td>
        <td>${row.median === null ? '—' : `${row.median} 岁`}</td>
      </tr>`;
  }).join('');

  const blankBatches = byBatch.filter(r => r.born === 0).map(r => batchLabel(Number(r.batch)));
  const blankText = blankBatches.length
    ? `${blankBatches.join('、')}的官网表格未填写出生日期`
    : '各批次均有一部分记录未填写出生日期';

  /* 媒体口径对照。数字来自公开报道，注明出处与年份，不作二次加工。 */
  const externalRows = [
    { source: '《中国人才》杂志', claim: '国家级传承人平均年龄 63.29 岁，70 岁及以上占 31.79%',
      href: 'https://www.zuzhirenshi.com/magazine/detail/9629be29-377a-44c4-97f6-bb5b1ace412f' },
    { source: '光明网（2025-02）', claim: '各批国家级传承人平均年龄均在 65 岁以上，其中半数在 70 岁以上',
      href: 'https://news.gmw.cn/2025-02/26/content_37871048.htm' },
    { source: '中国非物质文化遗产网', claim: '首批 226 人中 60 岁以上约占 91%，第二批约 71%，第三批约 78%',
      href: 'https://www.ihchina.cn/project_details/10569.html' },
  ].map(r => `
      <li class="ext-row">
        <span class="ext-source">${esc(r.source)}</span>
        <span class="ext-claim">${esc(r.claim)}</span>
        <a class="ext-link" href="${esc(r.href)}" target="_blank" rel="noopener noreferrer">原文 ↗</a>
      </li>`).join('');

  const html = `
  <div class="page-head">
    <div class="container">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="#/">首页</a>
        <span aria-hidden="true">/</span>
        <a href="#/inheritors">传承人</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">年龄结构</span>
      </nav>
      <p class="page-idx" aria-hidden="true">叁</p>
      <h1 class="page-title">传承人，有多老</h1>
      <p class="page-lede">
        这个问题不需要形容词。本站收录的 <strong>${num(stats.total)}</strong> 位
        国家级代表性传承人里，有 <strong>${num(counted)}</strong> 位标注了出生年份——
        把它们按 <strong>${age.year}</strong> 年折算成年龄，就是一整代人的年轮。
      </p>
    </div>
  </div>

  <div class="container">
    <div class="age-hero">
      <div class="age-figure">
        <span class="age-figure-num">${age.median}</span>
        <span class="age-figure-label">岁 · 中位年龄</span>
      </div>
      <div class="age-figure">
        <span class="age-figure-num">${over70Pct}<em>%</em></span>
        <span class="age-figure-label">70 岁及以上（${num(age.over70)} 人）</span>
      </div>
      <div class="age-figure">
        <span class="age-figure-num">${over80Pct}<em>%</em></span>
        <span class="age-figure-label">80 岁及以上（${num(age.over80)} 人）</span>
      </div>
      <div class="age-figure">
        <span class="age-figure-num">${age.min}<em>–</em>${age.max}</span>
        <span class="age-figure-label">岁 · 最年轻到最年长</span>
      </div>
    </div>

    <div class="about-callout age-caveat">
      <h3>先说要紧的三件事</h3>
      <p>
        <strong>一、基准年是 ${age.year}。</strong>
        官方名单只公布出生年份与出生日期，<strong>不公布生卒</strong>。
        因此 1908 年出生的第一批传承人在此显示为 ${age.year - 1908} 岁——
        那是他「若在世」的年龄，本站并未据此宣称其仍在世。
        真实在世人数需要另行核对，官网未提供这一字段。
      </p>
      <p>
        <strong>二、只算有出生日期的，空缺不补。</strong>
        ${num(counted)} 位有出生年份，占全部的
        ${Math.round((counted / (stats.total || 1)) * 1000) / 10}%。
        剩下的 ${num((stats.total || 0) - counted)} 位照实留空，
        本站不做任何推测性填补——<strong>填一个假年份比留白恶劣得多</strong>。
      </p>
      <p>
        <strong>三、我们的数字和媒体对不上，这是口径差异，不是谁错了。</strong>
        媒体统计的多是「在世传承人 + 当年年龄」，本站统计「全部记录 + ${age.year} 年」，
        已故者与高年龄端被一并计入，因此本站均值天然偏高。见下方对照表。
      </p>
    </div>

    <section class="age-section" aria-labelledby="age-dist">
      <h2 class="ps-title" id="age-dist"><span class="ps-mark">年龄分布</span></h2>
      <p class="age-note">
        按 ${age.year} 年折算，每 10 岁一档。样本 ${num(counted)} 人，平均 ${age.mean} 岁。
      </p>
      <ul class="age-chart">
        ${bars}
      </ul>
    </section>

    <section class="age-section" aria-labelledby="age-batch">
      <h2 class="ps-title" id="age-batch"><span class="ps-mark">分批次：缺口在哪里</span></h2>
      <p class="age-note">
        ${esc(blankText)}。这一栏本可以留白不提，但<strong>覆盖率本身就是结论</strong>：
        越晚公布的批次，可核对的出生信息越少。
      </p>
      <div class="about-table-wrap">
        <table class="about-table age-table">
          <caption>各批次传承人出生日期覆盖率（数据来自官网公开表格）</caption>
          <thead>
            <tr>
              <th scope="col">批次</th>
              <th scope="col">记录数</th>
              <th scope="col">有出生日期</th>
              <th scope="col">覆盖率</th>
              <th scope="col">中位年龄</th>
            </tr>
          </thead>
          <tbody>${batchRows}</tbody>
        </table>
      </div>
      <p class="result-note">
        中位年龄一栏为「—」表示该批次没有任何可用的出生日期。
        第四批与第五批在官网表格中整栏为空，属官方未公布，非本站抓取遗漏。
      </p>
    </section>

    <section class="age-section" aria-labelledby="age-external">
      <h2 class="ps-title" id="age-external"><span class="ps-mark">别人怎么说</span></h2>
      <p class="age-note">
        以下为公开报道中的说法，原文照录、未作改写。与本站口径的差异见上方第三条。
      </p>
      <ul class="ext-list">${externalRows}</ul>
    </section>

    <div class="age-actions">
      <a class="btn btn-primary" href="#/inheritors?sort=birth">按出生年份看传承人 →</a>
      <a class="btn btn-ghost" href="#/about">数据来源与统计口径</a>
    </div>
  </div>`;

  return { html, title: '传承人年龄结构' };
}
