import { esc } from '../data.js';
import { online, worksRequest } from '../works-api.js';
import { CRAFTS } from '../crafts.js';
import { currentQuery } from '../router.js';

export async function WorksPage() {
  const { craft = '', page = '1' } = currentQuery();
  let data = null, message = '';
  if (online()) {
    try { data = await worksRequest(`/api/works?craft=${encodeURIComponent(craft)}&page=${encodeURIComponent(page)}`); }
    catch (error) { message = error.name === 'TimeoutError' ? '连接较慢，请稍后重试。' : error.message; }
  } else message = '你正在浏览离线作品。作品投稿和作品墙需要从在线展馆访问，本地保存仍可正常使用。';
  return `<section class="page-head"><div class="container"><nav class="breadcrumb" aria-label="面包屑导航"><a href="#/">首页</a><span>/</span><span aria-current="page">作品墙</span></nav>
    <h1 class="page-title">手上留痕</h1><p class="page-lede">来自访客的技艺练习。每件作品经审核后公开，练习评价不代表真实工艺水平。</p></div></section>
    <section class="section-tight"><div class="container">
    <nav class="works-filters" aria-label="按技艺筛选作品"><a class="tag ${!craft ? 'is-active' : ''}" href="#/works">全部</a>${CRAFTS.map(c => `<a class="tag ${craft === c.key ? 'is-active' : ''}" href="#/works?craft=${c.key}">${c.name}</a>`).join('')}</nav>
    ${message ? `<p class="works-message" role="status">${esc(message)}</p>${online() ? '<button class="btn btn-ghost" id="retry-works">重新读取</button>' : ''}` : `<p>共 ${data.total} 件已审核作品</p>
    <div class="works-grid">${data.items.map(work => `<article class="visitor-work"><img src="${esc(work.image)}" alt="${esc(work.title)}" loading="lazy"><div><h2>${esc(work.title)}</h2><p>${esc(CRAFTS.find(c => c.key === work.craft)?.name || '')} · ${esc(work.nickname || '匿名访客')}</p><p>${esc(work.metrics)}</p><p>${esc(new Date(work.createdAt).toLocaleDateString('zh-CN'))}</p></div></article>`).join('') || '<p class="works-message">这里还没有作品。去完成一次技艺练习，留下你的第一件作品。</p>'}</div>
    <nav class="works-pages" aria-label="作品分页">${data.page > 1 ? `<a class="btn btn-ghost" href="#/works?craft=${encodeURIComponent(craft)}&page=${data.page - 1}">上一页</a>` : ''}<span>第 ${data.page} / ${data.pages} 页</span>${data.page < data.pages ? `<a class="btn btn-ghost" href="#/works?craft=${encodeURIComponent(craft)}&page=${data.page + 1}">下一页</a>` : ''}</nav>`}
    <p class="section-more"><a class="btn btn-primary" href="#/simulator">去体验，做一件自己的作品</a></p></div></section>`;
}
