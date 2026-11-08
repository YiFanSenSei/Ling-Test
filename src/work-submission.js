import { CRAFTS } from './crafts.js';
import { composeWork, captureWork } from './sim/export.js';
import { online, worksRequest } from './works-api.js';

export function submissionDialog() {
  return `<dialog class="work-dialog" id="work-dialog" aria-labelledby="work-dialog-title"><form id="work-submit-form">
    <h2 id="work-dialog-title">把这次练习留在作品墙</h2><p>提交后先进入待审核区，通过后会公开展示。请勿在图片或文字中包含联系方式等个人信息。</p>
    <img id="work-preview" alt="准备投稿的作品预览"><p>本页内关闭弹窗会保留填写内容与这张预览。继续创作后，可更新为最新画布；离开体验页后需重新填写。</p>
    <button class="btn btn-ghost btn-sm" id="work-refresh-preview" type="button">使用最新画布</button><label for="work-title">作品标题</label><input id="work-title" maxlength="80" required>
    <label for="work-nickname">昵称（选填）</label><input id="work-nickname" maxlength="32" autocomplete="off"><p id="work-submit-status" role="status"></p>
    <div class="work-dialog-actions"><button class="btn btn-primary" id="work-submit-button">提交审核</button><button class="btn btn-ghost" id="work-dialog-close" type="button">关闭</button></div></form></dialog>`;
}
export function initSubmission() {
  const main = document.getElementById('main'), dialog = document.getElementById('work-dialog');
  if (!dialog) return () => {};
  const form = document.getElementById('work-submit-form'), status = document.getElementById('work-submit-status');
  const submit = document.getElementById('work-submit-button');
  const titleInput = document.getElementById('work-title');
  const nicknameInput = document.getElementById('work-nickname');
  const preview = document.getElementById('work-preview');
  const refresh = document.getElementById('work-refresh-preview');
  const closeButton = document.getElementById('work-dialog-close');
  const drafts = new Map();
  let active, opener, disposed = false;
  const rememberFields = () => {
    if (!active || active.busy || active.submitted) return;
    active.title = titleInput.value; active.nickname = nicknameInput.value;
  };
  const sync = () => {
    if (disposed || !active) return;
    status.textContent = active.message;
    submit.hidden = active.submitted;
    submit.disabled = active.busy || active.submitted || !online();
    refresh.disabled = active.busy;
    titleInput.disabled = nicknameInput.disabled = active.busy || active.submitted;
    form.setAttribute('aria-busy', String(active.busy));
  };
  const renderPreview = () => {
    const { captured } = active;
    const title = titleInput.value.trim() || captured.meta.title;
    if (title !== active.previewTitle || !active.image) {
      active.image = composeWork(captured.canvas, { title, note: captured.meta.note }).toDataURL('image/png');
      active.previewTitle = title;
    }
    preview.src = active.image;
  };
  const editTitle = () => { titleInput.setCustomValidity(''); rememberFields(); renderPreview(); };
  const capture = craft => {
    const canvas = document.getElementById(`canvas-${craft.key}`);
    const captured = captureWork(canvas, { title: `${craft.name} · 我的练习` });
    const metrics = document.querySelector(`#craft-result-${craft.key} .craft-result-metrics`)?.textContent || '';
    return { craft: craft.key, captured, metrics, title: captured.meta.title, nickname: '', busy: false, submitted: false,
      message: online() ? '' : '投稿需要在线展馆。请先保存作品，再从在线展馆投稿。' };
  };
  const open = event => {
    const button = event.target.closest('[data-submit-work]');
    const key = button?.dataset.submitWork;
    const craft = CRAFTS.find(c => c.key === key);
    if (!craft) return;
    rememberFields(); opener = button;
    active = drafts.get(key) || capture(craft); drafts.set(key, active);
    titleInput.value = active.title; nicknameInput.value = active.nickname;
    titleInput.setCustomValidity('');
    renderPreview(); sync();
    document.body.classList.add('work-submit-open'); dialog.showModal();
  };
  const updateCapture = () => {
    if (!active || active.busy) return;
    rememberFields();
    const previous = active;
    active = capture(CRAFTS.find(craft => craft.key === previous.craft));
    active.title = previous.title; active.nickname = previous.nickname;
    drafts.set(active.craft, active);
    active.message ||= '已更新为当前画布，请核对预览后提交。';
    titleInput.setCustomValidity(''); renderPreview(); sync();
  };
  const send = async event => {
    event.preventDefault(); if (!active || active.busy || active.submitted || !online()) return;
    if (!titleInput.value.trim()) { titleInput.setCustomValidity('请填写作品标题，不能只输入空格。'); titleInput.reportValidity(); return; }
    rememberFields();
    const draft = active;
    draft.busy = true; draft.message = '正在提交，请稍候…'; sync();
    try {
      renderPreview();
      const payload = { craft: draft.craft, metrics: draft.metrics, image: draft.image, title: draft.title.trim(), nickname: draft.nickname.trim() };
      const serialized = JSON.stringify(payload);
      if (serialized !== draft.previousPayload) {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
        const hex = Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
        draft.requestId = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
        draft.previousPayload = serialized;
      }
      const value = await worksRequest('/api/works', { method: 'POST', body: JSON.stringify({ ...payload, requestId: draft.requestId }) });
      if (typeof value?.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value.id))
        throw new Error('暂未收到有效的保存回执，可重试确认；同一投稿不会重复保存。');
      draft.submitted = true; draft.message = `投稿已保存，编号 ${value.id}。审核通过后会显示在作品墙。`;
    } catch (error) { draft.message = `${error.name === 'TimeoutError' ? '提交等待超时，可重试；同一投稿不会重复保存。' : error.message} 本地作品仍保留。`; }
    finally { draft.busy = false; if (active === draft) sync(); }
  };
  const close = () => dialog.close();
  const onClose = () => {
    // close 事件异步派发；快速重新打开时不清除新弹窗的滚动锁。
    if (dialog.open) return;
    rememberFields(); document.body.classList.remove('work-submit-open');
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    opener = null;
  };
  main.addEventListener('click', open); form.addEventListener('submit', send);
  titleInput.addEventListener('input', editTitle);
  nicknameInput.addEventListener('input', rememberFields);
  refresh.addEventListener('click', updateCapture); closeButton.addEventListener('click', close); dialog.addEventListener('close', onClose);
  return () => {
    disposed = true; opener = null; dialog.close(); document.body.classList.remove('work-submit-open');
    main.removeEventListener('click', open); form.removeEventListener('submit', send); titleInput.removeEventListener('input', editTitle);
    nicknameInput.removeEventListener('input', rememberFields); refresh.removeEventListener('click', updateCapture);
    closeButton.removeEventListener('click', close); dialog.removeEventListener('close', onClose); drafts.clear(); active = null;
  };
}
