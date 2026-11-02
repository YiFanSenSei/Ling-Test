let saved = null;
export function rememberGallery(projectId) {
  saved = { hash: location.hash, y: scrollY, projectId,
    expanded: document.getElementById('region-more')?.getAttribute('aria-expanded') === 'true' };
  try { sessionStorage.setItem('jz-gallery-return', JSON.stringify(saved)); } catch { /* 内存兜底 */ }
}
export function galleryReturn() {
  try { saved ||= JSON.parse(sessionStorage.getItem('jz-gallery-return')); } catch { /* 存储不可用 */ }
  return saved && /^#\/gallery(?:\?|$)/.test(saved.hash) && Number.isFinite(saved.y) ? saved : null;
}
