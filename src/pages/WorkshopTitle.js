import { makeScenery } from '../workshop/scenery.js';
import { workshopSoundSettings } from '../workshop/sound.js';
import { formatWorkshopSaveTime, readWorkshopAutosave, readWorkshopSlot, workshopSaveChanged, workshopSaveProgress, workshopSlots } from '../workshop/saves.js';

const swift = `<svg viewBox="0 0 48 36" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5c10 0 15 5 21 13l4 2c4-4 9-5 16-5l-5 4-2 4-7 2-8 8 2-9C14 23 8 15 3 5Z"/><path d="M8 8c7 3 11 8 15 13m11 1 3-2" stroke-dasharray="2 2"/></svg>`;
const buttonIcon = {
  new: '<path d="M4 16 16 4m-3 1 2-2 2 2-2 2M4 16l-1 4 4-1m5-5c4 4 6-2 8 0s-1 5-4 6"/>',
  load: '<path d="M4 6h6l2 2h8v11H4zM7 5h11v3m-7 5 2 2 3-3"/>',
};

function menuButton(action, label, detail) {
  return `<button class="ws-menu-choice" type="button" data-title-action="${action}">
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">${buttonIcon[action]}</svg>
    <span><strong>${label}</strong><small>${detail}</small></span><span aria-hidden="true">→</span>
  </button>`;
}

function readSaves() {
  return [
    { id: 'auto', label: '自动存档', ...readWorkshopAutosave() },
    ...workshopSlots.map(number => ({ id: String(number), label: `存档 ${number}`, ...readWorkshopSlot(number) })),
  ];
}

export function mountWorkshopTitle(host, play) {
  host.innerHTML = `<section class="ws-title-screen" aria-labelledby="ws-menu-title">
    <header class="ws-title-header"><span>${swift} 匠作 · 苏绣工坊</span>
      <div class="ws-title-header-actions">${workshopSoundSettings}<a href="#/">← 返回展馆</a></div></header>
    <div class="ws-title-layout">
      <div class="ws-title-copy">
        <p class="ws-title-kicker">燕子过河 <span aria-hidden="true"></span></p>
        <h1 id="ws-menu-title" tabindex="-1">工坊还有<br><em>三十天</em></h1>
        <p class="ws-title-story">春汛过后，老街的绣坊重新开了门。<br>你手上有三十六元，还有一张雨燕底稿。</p>
        <div class="ws-title-actions">
          ${menuButton('new', '新的开始', '从第一天接手青梧绣坊')}
          ${menuButton('load', '读取存档', '')}
        </div>
        <p class="ws-title-note">本机存档 · 保存在当前浏览器</p>
      </div>
      <figure class="ws-title-art">
        <div class="ws-title-picture"></div>
        <figcaption><span>春汛老街 · 河畔展场</span><span aria-hidden="true">青梧绣坊</span></figcaption>
      </figure>
    </div>
    <dialog class="ws-title-dialog" aria-labelledby="ws-title-dialog-heading"></dialog>
  </section>`;
  const root = host.firstElementChild;
  const title = root.querySelector('h1');
  const load = root.querySelector('[data-title-action="load"]');
  const dialog = root.querySelector('dialog');
  load.setAttribute('aria-haspopup', 'dialog');
  const { image, props } = makeScenery('river');
  const context = image.getContext('2d');
  for (const prop of [...props].sort((a, b) => a.depth - b.depth)) context.drawImage(prop.image, prop.x, prop.y, prop.w, prop.h);
  image.setAttribute('aria-hidden', 'true');
  root.querySelector('.ws-title-picture').append(image);

  let listedSaves = [], confirmedAutosave;

  function updateMenu(saves = readSaves()) {
    const [auto] = saves;
    const count = saves.filter(save => save.game).length;
    load.disabled = count === 0;
    load.querySelector('small').textContent = auto.game ? `自动存档 · ${workshopSaveProgress(auto)}` :
      count ? `${count} 个手动存档可读取` : saves.some(save => save.kind === 'unavailable') ? '本地存储不可用' : '暂无可读取的存档';
  }

  function openDialog(heading, content, focus = 'h2') {
    dialog.innerHTML = `<div class="ws-title-dialog-top"><h2 id="ws-title-dialog-heading" tabindex="-1">${heading}</h2>
      <button type="button" data-title-action="cancel" aria-label="关闭">×</button></div>${content}`;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector(focus)?.focus();
  }

  function showSaves(notice = '') {
    listedSaves = readSaves();
    updateMenu(listedSaves);
    openDialog('读取存档', `<p>${notice || '选择一个档位继续游戏。读取后会更新自动存档。'}</p>
      <ul class="ws-title-saves">${listedSaves.map(save => `<li>
        <button type="button" data-title-save="${save.id}" ${save.game ? '' : 'disabled'}>
          <span><strong>${save.label}</strong><small>${workshopSaveProgress(save)}</small></span>
          ${save.savedAt ? `<time datetime="${new Date(save.savedAt).toISOString()}">${formatWorkshopSaveTime(save.savedAt)}</time>` : ''}
          <span aria-hidden="true">${save.game ? '→' : '–'}</span>
        </button>
      </li>`).join('')}</ul>`);
  }

  function showNew(auto) {
    confirmedAutosave = auto.raw;
    openDialog('开始新的一局？', `<p>当前自动存档在${workshopSaveProgress(auto)}。开新局会更新自动存档，五个手动档位会保留。</p>
      <div class="ws-title-confirm"><button type="button" data-title-action="cancel">取消</button>
        <button type="button" data-title-action="confirm-new">从第一天开始</button></div>`, '.ws-title-confirm [data-title-action="cancel"]');
  }

  function onClick(event) {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    switch (button.dataset.titleAction) {
      case 'new': case 'confirm-new': {
        const auto = readWorkshopAutosave();
        if (auto.game && (button.dataset.titleAction === 'new' || auto.raw !== confirmedAutosave)) showNew(auto);
        else play();
        break;
      }
      case 'load': showSaves(); break;
      case 'cancel': dialog.close(); break;
    }
    const id = button.dataset.titleSave;
    if (id) {
      const selected = listedSaves.find(save => save.id === id);
      const current = id === 'auto' ? readWorkshopAutosave() : readWorkshopSlot(Number(id));
      if (current.game && current.raw === selected?.raw) play(current);
      else showSaves('存档已变化，请重新选择。');
    }
  }

  function onStorage(event) {
    if (workshopSaveChanged(event.key)) updateMenu();
  }

  root.addEventListener('click', onClick);
  window.addEventListener('storage', onStorage);
  updateMenu();
  title.focus({ preventScroll: true });
  return () => {
    if (dialog.open) dialog.close();
    root.removeEventListener('click', onClick);
    window.removeEventListener('storage', onStorage);
  };
}
