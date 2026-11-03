const $ = selector => document.querySelector(selector);
let page = 1, totalPages = 1, version = 0;
const names = { embroidery: '苏绣', paper: '宣纸', mortise: '榫卯' };
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) { $('#login').hidden = false; $('#dashboard').hidden = true; }
    throw new Error(data.error || '请求失败');
  }
  return data;
}
const notice = text => { $('#notice').textContent = text; };
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
async function load() {
  const token = ++version; notice('正在读取作品…');
  const data = await api(`/api/admin/works?status=${$('#status').value}&page=${page}`);
  if (token !== version) return;
  $('#works').replaceChildren(); totalPages = data.pages;
  $('#count').textContent = `共 ${data.total} 件作品`;
  $('#page').textContent = `${data.page} / ${data.pages}`;
  $('#prev').disabled = page <= 1; $('#next').disabled = page >= totalPages;
  for (const work of data.items) {
    const article = element('article', ''); article.className = 'work';
    const image = document.createElement('img'); image.src = work.image; image.alt = work.title; image.loading = 'lazy';
    article.append(image, element('h2', work.title), element('p', `${names[work.craft]} · ${work.nickname || '匿名访客'}`), element('p', work.metrics || '未附练习指标'), element('p', `投稿时间：${new Date(work.createdAt).toLocaleString('zh-CN')}`));
    if (work.status === 'pending') {
      for (const [status, label] of [['approved', '通过并公开'], ['rejected', '驳回']]) {
        const button = element('button', label);
        button.onclick = async () => {
          article.querySelectorAll('button').forEach(b => { b.disabled = true; });
          try { await api(`/api/admin/works/${work.id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await load(); notice('审核已保存。'); }
          catch (error) { notice(error.message); article.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
        };
        article.append(button);
      }
    }
    $('#works').append(article);
  }
  notice(data.total ? '' : '当前状态没有作品。');
}
$('#login').onsubmit = async event => {
  event.preventDefault(); const button = $('#login button'); button.disabled = true;
  try { await api('/api/admin/session', { method: 'POST', body: JSON.stringify({ password: $('#password').value }) }); $('#password').value = ''; $('#login').hidden = true; $('#dashboard').hidden = false; page = 1; await load(); }
  catch (error) { notice(error.message); } finally { button.disabled = false; }
};
$('#status').onchange = () => { page = 1; load().catch(e => notice(e.message)); };
$('#refresh').onclick = () => load().catch(e => notice(e.message));
$('#prev').onclick = () => { page = Math.max(1, page - 1); load().catch(e => notice(e.message)); };
$('#next').onclick = () => { page = Math.min(totalPages, page + 1); load().catch(e => notice(e.message)); };
$('#logout').onclick = async () => { try { await api('/api/admin/session', { method: 'DELETE' }); version++; $('#works').replaceChildren(); $('#dashboard').hidden = true; $('#login').hidden = false; notice('已退出。'); } catch (error) { notice(error.message); } };
api('/api/admin/session').then(session => {
  if (!session.authenticated) { notice('请登录后查看审核列表。'); return; }
  $('#login').hidden = true; $('#dashboard').hidden = false; return load();
}).catch(() => notice('暂时无法连接服务，请刷新重试。'));
