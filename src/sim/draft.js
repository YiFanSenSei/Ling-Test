import { readLocal, writeLocal } from '../storage.js';

/** 写入节流，持续操作时也定期保存；离页前同步落盘。 */
export function createDraft({ key, statusId, snapshot, restore }) {
  const status = document.getElementById(statusId);
  let timer = null, dirty = false, active = true;
  const tell = text => { if (status) status.textContent = text; };
  const flush = () => {
    clearTimeout(timer); timer = null;
    if (!dirty || !active) return;
    const local = writeLocal(key, JSON.stringify(snapshot()));
    dirty = false;
    tell(local ? '进度已保存到此浏览器，刷新或离开后可继续。' : '进度仅在本次浏览中暂存；浏览器未允许本地保存，请及时导出。');
  };
  const onVisibility = () => { if (document.hidden) flush(); };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', onVisibility);
  try {
    const value = JSON.parse(readLocal(key));
    if (value && restore(value)) tell('已恢复上次进度，可以接着体验。');
  } catch { /* 损坏或旧版草稿不影响新体验 */ }
  return {
    schedule() {
      if (!active) return;
      dirty = true;
      if (timer === null) { tell('正在保存进度…'); timer = setTimeout(flush, 600); }
    },
    flush,
    dispose() {
      flush(); active = false;
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
