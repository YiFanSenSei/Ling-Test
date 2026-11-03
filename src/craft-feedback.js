import { CRAFTS } from './crafts.js';

export function craftNext(key) {
  return `<div class="craft-next" role="status" id="craft-next-${key}"><span>现在可以做</span><strong></strong></div>`;
}
export function craftResult(key) {
  const craft = CRAFTS.find(c => c.key === key);
  return `<section class="craft-result" id="craft-result-${key}" hidden aria-labelledby="craft-result-title-${key}">
    <div class="craft-result-seal" aria-hidden="true">${craft.glyph}</div>
    <div><p class="curation-label">体验札记</p><h3 id="craft-result-title-${key}"></h3>
      <p class="craft-result-metrics"></p><p>${craft.principle}</p>
      <div class="craft-result-actions"><button class="btn btn-primary btn-sm" data-export-result="${key}">保存这次作品</button>
      <button class="btn btn-ghost btn-sm" data-submit-work="${key}">投稿到作品墙</button>
      <a class="btn btn-ghost btn-sm" href="#/project/${craft.projectId}">继续了解这门手艺 →</a></div>
      <p class="craft-result-note">评价仅反映本次简化互动，不代表真实工艺水平。</p>
    </div>
  </section>`;
}
export function updateCraftFeedback(key, { hint, complete = false, title = '', metrics = [] }) {
  const next = document.querySelector(`#craft-next-${key} strong`);
  if (next && next.textContent !== hint) next.textContent = hint;
  const result = document.getElementById(`craft-result-${key}`);
  if (!result) return;
  result.hidden = !complete;
  if (!complete) return;
  const heading = result.querySelector('h3');
  if (heading.textContent !== title) heading.textContent = title;
  const values = metrics.join(' · ');
  const metric = result.querySelector('.craft-result-metrics');
  if (metric.textContent !== values) metric.textContent = values;
}

/** 结果卡调用现有导出按钮，保持画布导出逻辑一致。 */
export function initResultActions() {
  const main = document.getElementById('main');
  const handler = event => {
    const key = event.target.closest('[data-export-result]')?.dataset.exportResult;
    if (key && CRAFTS.some(c => c.key === key)) document.getElementById(`save-${key}`)?.click();
  };
  main.addEventListener('click', handler);
  return () => main.removeEventListener('click', handler);
}
