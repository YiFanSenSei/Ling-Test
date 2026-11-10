/** /ages 保留原链接，内容改为档案出生年代分布。 */
import { getInheritorStats, batchLabel, num, esc } from '../data.js';

export async function AgesPage() {
  const stats = await getInheritorStats();
  const birth = stats.birth || {};
  const counted = birth.counted || 0;
  const histogram = birth.histogram || [];
  const max = Math.max(1, ...histogram.map(h => h.count));
  const coverage = stats.total ? Math.round(counted / stats.total * 1000) / 10 : 0;
  const bars = histogram.map(h => {
    const pct = counted ? Math.round(h.count / counted * 1000) / 10 : 0;
    return `<li class="birth-row">
      <span class="birth-label">${h.start}–${h.end} 年</span>
      <span class="birth-track" aria-hidden="true"><span style="width:${h.count / max * 100}%"></span></span>
      <span>${num(h.count)} 条 <small>（${pct}%）</small></span>
    </li>`;
  }).join('');
  const rows = (birth.byBatch || []).map(r => `<tr>
    <th scope="row">${esc(batchLabel(Number(r.batch)))}</th>
    <td data-label="记录数">${num(r.total)}</td><td data-label="有出生年份">${num(r.born)}</td><td data-label="覆盖率">${r.coverage}%</td>
    <td data-label="出生年份中位数">${r.median === null ? '—' : `${r.median} 年`}</td>
  </tr>`).join('');
  const html = `
  <section class="page-head"><div class="container">
    <nav class="breadcrumb" aria-label="面包屑导航"><a href="#/">首页</a><span aria-hidden="true">/</span>
      <a href="#/inheritors">传承人</a><span aria-hidden="true">/</span><span aria-current="page">出生年代分布</span></nav>
    <h1 class="page-title">档案里的出生年代</h1>
    <p class="page-lede">从出生年份认识档案所记录的年代。本站 ${num(stats.total)} 条传承人档案中，
      ${num(counted)} 条有可用出生年份，占 ${coverage}%；其余 ${num(birth.missing || 0)} 条未纳入分布统计。</p>
  </div></section>
  <div class="container">
    <div class="age-hero">
      <div class="age-figure"><span class="age-figure-num">${num(counted)}</span><span>条 · 有出生年份的记录</span></div>
      <div class="age-figure"><span class="age-figure-num">${coverage}<em>%</em></span><span>出生年份覆盖率</span></div>
      <div class="age-figure"><span class="age-figure-num">${birth.earliest ?? '—'}</span><span>年 · 样本中最早出生年份</span></div>
      <div class="age-figure"><span class="age-figure-num">${birth.latest ?? '—'}</span><span>年 · 样本中最晚出生年份</span></div>
    </div>
    <aside class="about-callout age-caveat"><h2>这张图能说明什么</h2>
      <p>图中每一条都对应一份有出生年份的档案；同一传承人可能关联多个项目，因此记录数不等于去重人数。
      百分比的分母为 ${num(counted)} 条有效记录，未填写的年份照实留空。</p>
      <p><strong>这不是在世传承人的年龄分布。</strong>数据没有完整的生卒状态，也有出生年份缺失，
      不能用它推算当前年龄、在世人数，或代表全部传承人的人口结构。</p>
    </aside>
    <section class="age-section" aria-labelledby="birth-chart-title">
      <h2 class="ps-title" id="birth-chart-title">按出生年代看档案</h2>
      <p class="age-note">每十年一档，横条长度按记录数最多的一档归一化。数字与百分比一并列出，零记录年代也保留。</p>
      <ul class="birth-chart">${bars || '<li>当前没有可用的出生年份记录。</li>'}</ul>
    </section>
    <section class="age-section" aria-labelledby="birth-coverage-title">
      <h2 class="ps-title" id="birth-coverage-title">按项目公布批次归集的信息覆盖率</h2>
      <p class="age-note">下表按传承人所属项目的公布批次归集，并非传承人的认定批次。缺失数据分布不均，阅读上方图表时需同时参考覆盖率。</p>
      <div class="about-table-wrap"><table class="about-table age-table">
        <caption>按所属项目公布批次归集的出生年份覆盖率</caption>
        <thead><tr><th scope="col">项目公布批次</th><th scope="col">记录数</th><th scope="col">有出生年份</th><th scope="col">覆盖率</th><th scope="col">出生年份中位数</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="result-note">中位数为「—」表示没有可用出生年份。偶数条样本取中间两年的平均值，因此可能出现半年的数值。</p>
    </section>
    <div class="age-actions"><a class="btn btn-primary" href="#/inheritors?sort=birth">按出生年份查阅档案 →</a>
      <a class="btn btn-ghost" href="#/about">数据来源与统计口径</a></div>
  </div>`;
  return { html, title: '传承人档案出生年代分布' };
}
