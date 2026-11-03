const $ = selector => document.querySelector(selector);
let page = 1, totalPages = 1, version = 0, loggingOut = false;
const names = { embroidery: '苏绣', paper: '宣纸', mortise: '榫卯' };
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(data.error || '请求失败'), { status: response.status });
  }
  return data;
}
const notice = text => { $('#notice').textContent = text; };
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
async function load() {
  if (loggingOut || $('#dashboard').hidden) return false;
  const token = ++version; notice('正在读取作品…');
  $('#prev').disabled = true; $('#next').disabled = true;
  $('#works').querySelectorAll('button').forEach(b => { b.disabled = true; });
  try {
    const data = await api(`/api/admin/works?status=${$('#status').value}&page=${page}`);
    if (token !== version) return;
    page = data.page;
    $('#works').replaceChildren(); totalPages = data.pages;
    $('#count').textContent = `共 ${data.total} 件作品`;
    $('#page').textContent = `${data.page} / ${data.pages}`;
    $('#prev').disabled = page <= 1; $('#next').disabled = page >= totalPages;
    for (const work of data.items) {
      const article = element('article', ''); article.className = 'work';
      const image = document.createElement('img'); image.src = work.image; image.alt = work.title; image.loading = 'lazy';
      article.append(image, element('h2', work.title), element('p', `${names[work.craft]} · ${work.nickname || '匿名访客'}`), element('p', work.metrics || '未附练习指标'), element('p', `投稿时间：${new Date(work.createdAt).toLocaleString('zh-CN')}`));
      const actions = { pending: [['approved', '通过并公开'], ['rejected', '驳回']], approved: [['rejected', '下架作品']], rejected: [['pending', '重新审核']] };
        for (const [status, label] of actions[work.status] || []) {
          const button = element('button', label);
          button.onclick = async () => {
            article.querySelectorAll('button').forEach(b => { b.disabled = true; });
            const actionVersion = version;
            try {
              await api(`/api/admin/works/${work.id}`, { method: 'PATCH', body: JSON.stringify({ status, expectedStatus: work.status }) });
              if (!loggingOut && !$('#dashboard').hidden && await load()) notice('审核已保存。');
            } catch (error) {
              if (actionVersion !== version || loggingOut) return;
              if (error.status === 401) { version++; $('#works').replaceChildren(); $('#dashboard').hidden = true; $('#login').hidden = false; }
              notice(error.message);
              if (error.status !== 401) article.querySelectorAll('button').forEach(b => { b.disabled = false; });
            }
          };
          article.append(button);
        }
      $('#works').append(article);
    }
    notice(data.total ? '' : '当前状态没有作品。');
    return true;
  } catch (error) {
    if (token !== version) return false;
    if (error.status === 401) { version++; $('#works').replaceChildren(); $('#dashboard').hidden = true; $('#login').hidden = false; }
    notice(error.name === 'TimeoutError' ? '读取超时，请点击刷新重试。' : error.message);
    return false;
  }
}
$('#login').onsubmit = async event => {
  event.preventDefault(); version++; const button = $('#login button'); button.disabled = true;
  try { await api('/api/admin/session', { method: 'POST', body: JSON.stringify({ password: $('#password').value }) }); $('#password').value = ''; $('#login').hidden = true; $('#dashboard').hidden = false; page = 1; await load(); }
  catch (error) { notice(error.message); } finally { button.disabled = false; }
};
$('#status').onchange = () => { page = 1; load().catch(e => notice(e.message)); };
$('#refresh').onclick = () => load().catch(e => notice(e.message));
$('#prev').onclick = () => { page = Math.max(1, page - 1); load().catch(e => notice(e.message)); };
$('#next').onclick = () => { page = Math.min(totalPages, page + 1); load().catch(e => notice(e.message)); };
$('#logout').onclick = async () => {
  if (loggingOut) return;
  loggingOut = true; version++;
  try { await api('/api/admin/session', { method: 'DELETE' }); $('#works').replaceChildren(); $('#dashboard').hidden = true; $('#login').hidden = false; notice('已退出。'); }
  catch (error) { notice(error.message); } finally { loggingOut = false; }
};
const probeVersion = version;
api('/api/admin/session').then(session => {
  if (probeVersion !== version) return;
  if (!session.authenticated) { notice('请登录后查看审核列表。'); return; }
  $('#login').hidden = true; $('#dashboard').hidden = false; return load();
}).catch(() => { if (probeVersion === version) notice('暂时无法连接服务，请刷新重试。'); });
