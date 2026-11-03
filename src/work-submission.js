import { CRAFTS } from './crafts.js';
import { composeWork, captureWork } from './sim/export.js';
import { online, worksRequest } from './works-api.js';

export function submissionDialog() {
  return `<dialog class="work-dialog" id="work-dialog" aria-labelledby="work-dialog-title"><form id="work-submit-form">
    <h2 id="work-dialog-title">把这次练习留在作品墙</h2><p>提交后先进入待审核区，通过后会公开展示。请勿在图片或文字中包含联系方式等个人信息。</p>
    <img id="work-preview" alt="准备投稿的作品预览"><label for="work-title">作品标题</label><input id="work-title" maxlength="80" required>
    <label for="work-nickname">昵称（选填）</label><input id="work-nickname" maxlength="32" autocomplete="off"><p id="work-submit-status" role="status"></p>
    <div class="work-dialog-actions"><button class="btn btn-primary" id="work-submit-button">提交审核</button><button class="btn btn-ghost" id="work-dialog-close" type="button">关闭</button></div></form></dialog>`;
}
export function initSubmission() {
  const main = document.getElementById('main'), dialog = document.getElementById('work-dialog');
  if (!dialog) return () => {};
  const form = document.getElementById('work-submit-form'), status = document.getElementById('work-submit-status');
  const submit = document.getElementById('work-submit-button');
  const titleInput = document.getElementById('work-title');
  let snapshot, captured, busy = false, submitted = false, disposed = false, previousPayload, requestId;
  const renderPreview = () => {
    if (!captured) return;
    snapshot.image = composeWork(captured.canvas, { title: titleInput.value.trim() || captured.meta.title, note: captured.meta.note }).toDataURL('image/png');
    document.getElementById('work-preview').src = snapshot.image;
  };
  const editTitle = () => { titleInput.setCustomValidity(''); renderPreview(); };
  const open = event => {
    if (busy) return;
    const key = event.target.closest('[data-submit-work]')?.dataset.submitWork;
    const craft = CRAFTS.find(c => c.key === key);
    if (!craft) return;
    submitted = false;
    form.querySelectorAll('input').forEach(input => { input.disabled = false; });
    status.textContent = ''; submit.hidden = false; submit.disabled = false;
    const canvas = document.getElementById(`canvas-${key}`);
    captured = captureWork(canvas, { title: `${craft.name} · 我的练习` });
    const metrics = document.querySelector(`#craft-result-${key} .craft-result-metrics`)?.textContent || '';
    snapshot = { craft: key, metrics };
    titleInput.value = captured.meta.title;
    titleInput.setCustomValidity('');
    renderPreview();
    document.getElementById('work-nickname').value = '';
    dialog.showModal();
    if (!online()) { status.textContent = '投稿需要在线展馆。请先保存作品，再从在线展馆投稿。'; submit.disabled = true; }
  };
  const send = async event => {
    event.preventDefault(); if (busy || submitted || !snapshot || !online()) return;
    if (!titleInput.value.trim()) { titleInput.setCustomValidity('请填写作品标题，不能只输入空格。'); titleInput.reportValidity(); return; }
    busy = true; submit.disabled = true;
    form.querySelectorAll('input').forEach(input => { input.disabled = true; });
    status.textContent = '正在提交，请稍候…';
    try {
      renderPreview();
      const payload = { ...snapshot, title: titleInput.value.trim(), nickname: document.getElementById('work-nickname').value.trim() };
      const serialized = JSON.stringify(payload);
      if (serialized !== previousPayload) {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
        const hex = Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
        requestId = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
        previousPayload = serialized;
      }
      const value = await worksRequest('/api/works', { method: 'POST', body: JSON.stringify({ ...payload, requestId }) });
      if (!disposed) { submitted = true; status.textContent = `投稿已保存，编号 ${value.id}。审核通过后会显示在作品墙。`; submit.hidden = true; }
    } catch (error) { if (!disposed) status.textContent = `${error.name === 'TimeoutError' ? '提交等待超时，可重试；同一投稿不会重复保存。' : error.message} 本地作品仍保留。`; }
    finally { busy = false; if (!disposed) { submit.disabled = submitted; form.querySelectorAll('input').forEach(input => { input.disabled = submitted; }); } }
  };
  const close = () => dialog.close();
  main.addEventListener('click', open); form.addEventListener('submit', send);
  titleInput.addEventListener('input', editTitle);
  document.getElementById('work-dialog-close').addEventListener('click', close);
  return () => { disposed = true; dialog.close(); main.removeEventListener('click', open); form.removeEventListener('submit', send); titleInput.removeEventListener('input', editTitle); captured = null; };
}
