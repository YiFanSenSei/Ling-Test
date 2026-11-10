import { esc } from '../data.js';
import { exhibitHeading } from '../components/exhibit-photo.js';
import { online, worksRequest } from '../works-api.js';
import { CRAFTS } from '../crafts.js';
import { currentQuery, navigate } from '../router.js';

const craftName = key => CRAFTS.find(c => c.key === key)?.name || '';
const worksPath = (craft, page = 1) => {
  const params = new URLSearchParams();
  if (craft) params.set('craft', craft);
  if (page > 1) params.set('page', page);
  return '#/works' + (params.size ? `?${params}` : '');
};
function validPage(data) {
  return data && Number.isSafeInteger(data.total) && data.total >= 0 &&
    Number.isSafeInteger(data.pages) && data.pages >= 1 && Number.isSafeInteger(data.page) &&
    data.page >= 1 && data.page <= data.pages && Array.isArray(data.items) && data.items.length <= 12 &&
    data.items.every(work => work && typeof work.id === 'string' && /^[a-f0-9-]{36}$/.test(work.id) &&
      work.image === `/api/works/${work.id}/image` && work.status === 'approved' && craftName(work.craft) &&
      ['title', 'nickname', 'metrics', 'createdAt'].every(key => typeof work[key] === 'string') &&
      Number.isFinite(Date.parse(work.createdAt)));
}
const viewer = () => `<dialog class="work-viewer" id="work-viewer" aria-labelledby="work-viewer-title">
  <div class="work-viewer-head"><h2 id="work-viewer-title"></h2><button class="btn btn-ghost btn-sm" id="close-work-viewer" type="button" autofocus>关闭</button></div>
  <p id="work-viewer-meta"></p><p id="work-viewer-status" role="status"></p>
  <div class="work-viewer-media"><img id="work-viewer-image" alt=""></div>
  <div class="work-viewer-actions"><button class="btn btn-ghost btn-sm" id="zoom-work-viewer" type="button" aria-pressed="false">查看实际尺寸</button>
  <a class="btn btn-primary btn-sm" id="download-viewer-work" download>保存原图</a></div>
  <p class="work-viewer-note">实际尺寸模式可在图片区域横向、纵向滚动查看细节。</p>
</dialog>`;

export async function WorksPage() {
  const query = currentQuery();
  const craft = craftName(query.craft) ? query.craft : '';
  const requested = Number(query.page);
  const page = Number.isFinite(requested) ? Math.max(1, Math.min(100000, Math.floor(requested))) : 1;
  let data = null, message = '';
  if (online()) {
    try {
      data = await worksRequest(`/api/works?craft=${encodeURIComponent(craft)}&page=${page}`);
      if (!validPage(data)) throw new Error('作品列表暂时无法读取，请重新加载。');
    } catch (error) { message = error.name === 'TimeoutError' ? '连接较慢，请稍后重试。' : error.message; }
  } else message = '你正在浏览离线作品。作品投稿和作品墙需要从在线展馆访问，本地保存仍可正常使用。';
  const canonical = worksPath(craft, message ? page : data.page);
  const destination = craft ? `#/simulator?tool=${craft}` : '#/simulator';
  return `${exhibitHeading('works', '作品墙', `
    <h1 class="page-title">手上留痕</h1>
    <p class="page-lede">来自访客的技艺练习。每件作品经审核后公开，练习评价不代表真实工艺水平。点击作品可查看原图与针脚、纤维或接缝细节。</p>
  `)}
    <section class="section-tight"><div class="container" id="works-content" data-path="${esc(canonical)}">
    <nav class="works-filters" aria-label="按技艺筛选作品">${[{key:'',name:'全部'}, ...CRAFTS].map(c => `<a class="tag ${craft === c.key ? 'is-active' : ''}" ${craft === c.key ? 'aria-current="page"' : ''} href="${worksPath(c.key)}">${c.name}</a>`).join('')}</nav>
    ${message ? `<p class="works-message" role="status">${esc(message)}</p>${online() ? '<button class="btn btn-ghost" id="retry-works">重新读取</button>' : ''}` : `<p>共 ${data.total} 件已审核作品</p>
    <div class="works-grid">${data.items.map(work => `<article class="visitor-work">
      <button class="visitor-work-preview" type="button" data-view-work aria-label="查看作品：${esc(work.title)}" data-title="${esc(work.title)}" data-meta="${esc(`${craftName(work.craft)} · ${work.nickname || '匿名访客'} · ${work.metrics}`)}" data-image="${esc(work.image)}">
        <img src="${esc(work.image)}" alt="${esc(work.title)}" loading="lazy" data-work-thumbnail><span>查看原图 ↗</span></button>
      <p class="work-image-error" hidden>图片暂不可用，仍可阅读作品信息。<button type="button" class="btn btn-ghost btn-sm" data-retry-work-image>重新加载图片</button></p>
      <div><h2>${esc(work.title)}</h2><p>${esc(craftName(work.craft))} · ${esc(work.nickname || '匿名访客')}</p><p>${esc(work.metrics)}</p><p>${esc(new Date(work.createdAt).toLocaleDateString('zh-CN'))}</p></div></article>`).join('') || `<p class="works-message">这里还没有${esc(craftName(craft))}作品。去完成一次技艺练习，留下你的第一件作品。</p>`}</div>
    <nav class="works-pages" aria-label="作品分页">${data.page > 1 ? `<a class="btn btn-ghost" href="${worksPath(craft, data.page - 1)}">上一页</a>` : ''}<span>第 ${data.page} / ${data.pages} 页</span>${data.page < data.pages ? `<a class="btn btn-ghost" href="${worksPath(craft, data.page + 1)}">下一页</a>` : ''}</nav>`}
    <p class="section-more"><a class="btn btn-primary" href="${destination}">去体验${esc(craftName(craft))}，做一件自己的作品</a></p></div></section>${viewer()}`;
}

export function initWorks() {
  const main = document.getElementById('main');
  const dialog = document.getElementById('work-viewer');
  const image = document.getElementById('work-viewer-image');
  const zoom = document.getElementById('zoom-work-viewer');
  const download = document.getElementById('download-viewer-work');
  const status = document.getElementById('work-viewer-status');
  let opener = null;
  let viewVersion = 0;
  history.replaceState(null, '', document.getElementById('works-content').dataset.path);
  const resetZoom = () => { dialog.classList.remove('is-zoomed'); zoom.setAttribute('aria-pressed', 'false'); zoom.textContent = '查看实际尺寸'; };
  const onClose = () => {
    document.body.classList.remove('work-viewer-open');
    image.removeAttribute('src'); download.removeAttribute('href');
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    opener = null;
  };
  const onImageError = event => {
    const img = event.target;
    if (!img.matches?.('[data-work-thumbnail]')) return;
    img.hidden = true;
    img.closest('.visitor-work').querySelector('.work-image-error').hidden = false;
  };
  const onClick = event => {
    if (event.target.closest('#retry-works')) navigate(location.hash.slice(1), { replace: true });
    const retry = event.target.closest('[data-retry-work-image]');
    if (retry) {
      const article = retry.closest('.visitor-work');
      const img = article.querySelector('img');
      article.querySelector('.work-image-error').hidden = true; img.hidden = false;
      img.src = article.querySelector('[data-view-work]').dataset.image + `?retry=${Date.now()}`;
    }
    const button = event.target.closest('[data-view-work]');
    if (!button) return;
    opener = button; resetZoom();
    document.getElementById('work-viewer-title').textContent = button.dataset.title;
    document.getElementById('work-viewer-meta').textContent = button.dataset.meta;
    status.textContent = '正在读取原图…';
    image.hidden = false; image.alt = button.dataset.title;
    zoom.disabled = true; download.hidden = true; download.removeAttribute('href');
    download.download = `匠作-${button.dataset.title.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')}.png`;
    // 再次核对图片可用性，避免复用缩略图的已解码缓存而漏掉下架状态。
    image.src = button.dataset.image + `?view=${Date.now()}-${++viewVersion}`;
    document.body.classList.add('work-viewer-open'); dialog.showModal();
  };
  const onLoad = () => {
    if (!dialog.open) return;
    status.textContent = ''; zoom.disabled = false; download.hidden = false;
    download.href = image.getAttribute('src');
  };
  const onFailure = () => { if (!dialog.open) return; image.hidden = true; status.textContent = '原图暂时无法读取，作品可能已下架或服务暂不可用。请关闭后重试。'; zoom.disabled = true; download.hidden = true; };
  const onZoom = () => {
    const expanded = dialog.classList.toggle('is-zoomed');
    zoom.setAttribute('aria-pressed', String(expanded)); zoom.textContent = expanded ? '适应窗口' : '查看实际尺寸';
    const media = dialog.querySelector('.work-viewer-media'); media.scrollTop = 0; media.scrollLeft = 0;
  };
  const close = () => dialog.close();
  main.addEventListener('click', onClick); main.addEventListener('error', onImageError, true);
  dialog.addEventListener('close', onClose); image.addEventListener('load', onLoad); image.addEventListener('error', onFailure);
  zoom.addEventListener('click', onZoom); document.getElementById('close-work-viewer').addEventListener('click', close);
  main.querySelectorAll('[data-work-thumbnail]').forEach(img => { if (img.complete && !img.naturalWidth) onImageError({ target: img }); });
  return () => {
    opener = null; dialog.close(); onClose();
    main.removeEventListener('click', onClick); main.removeEventListener('error', onImageError, true);
    dialog.removeEventListener('close', onClose); image.removeEventListener('load', onLoad); image.removeEventListener('error', onFailure);
    zoom.removeEventListener('click', onZoom); document.getElementById('close-work-viewer')?.removeEventListener('click', close);
  };
}
