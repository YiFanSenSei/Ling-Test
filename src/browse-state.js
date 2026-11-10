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

let inheritorsSaved = null;
export function rememberInheritors(personId) {
  inheritorsSaved = { hash: location.hash, y: scrollY, personId };
  try { sessionStorage.setItem('jz-inheritors-return', JSON.stringify(inheritorsSaved)); } catch { /* 内存兜底 */ }
}
export function inheritorsReturn() {
  try { inheritorsSaved ||= JSON.parse(sessionStorage.getItem('jz-inheritors-return')); } catch { /* 存储不可用 */ }
  return inheritorsSaved && /^#\/inheritors(?:\?|$)/.test(inheritorsSaved.hash) &&
    /^\d+-\d+$/.test(inheritorsSaved.personId) && Number.isFinite(inheritorsSaved.y) ? inheritorsSaved : null;
}
