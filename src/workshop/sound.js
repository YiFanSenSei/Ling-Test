import { readLocal, writeLocal } from '../storage.js';

const preferenceKey = 'jz-workshop-sound-v1';
const asset = name => `${import.meta.env.BASE_URL}workshop/audio/${name}.mp3`;
const fadeLength = 800;
const quietTopics = new Set(['verifySource', 'terms', 'checkGoods', 'confess', 'bridge', 'closing', 'showBird']);

export const workshopSoundSettings = `<details class="ws-sound-settings">
  <summary>声音</summary>
  <fieldset><legend class="sr-only">工坊声音</legend>
    <label><input type="checkbox" data-ws-sound="music"> 背景音乐</label>
    <label><input type="checkbox" data-ws-sound="effects"> 环境声和音效</label>
  </fieldset>
</details>`;

export const workshopSoundCredits = `<p><strong>配乐与声音</strong><br>
  <a href="https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100691" target="_blank" rel="noopener noreferrer">Ripples</a> 和
  <a href="https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN2100001" target="_blank" rel="noopener noreferrer">Guzheng City</a> · Kevin MacLeod（Incompetech），
  <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a><br>
  <a href="https://freesound.org/people/JK_Wango/sounds/783998/" target="_blank" rel="noopener noreferrer">RIVER</a> · JK_Wango，CC0<br>
  <a href="https://freesound.org/people/jimmefer/sounds/698233/" target="_blank" rel="noopener noreferrer">Book Closing</a> · jimmefer，CC0</p>`;

export function workshopSoundLevels({ scene, day, view, topic } = {}) {
  if (!scene) return { ripples: .32, 'guzheng-city': 0, river: 0 };
  if (view === 'summary') return { ripples: .22, 'guzheng-city': 0, river: 0 };
  const quiet = quietTopics.has(topic) || scene === 'archive' || view === 'archive-notes';
  const byRiver = scene === 'river';
  const fair = byRiver && day === 13;
  return {
    ripples: byRiver ? 0 : quiet ? .07 : topic || day === 14 ? .13 : .22,
    'guzheng-city': fair ? (topic || view === 'chapter' ? .11 : .26) : 0,
    river: byRiver ? (fair ? .20 : quiet ? .24 : .38) : 0,
  };
}

function preferences() {
  try {
    const saved = JSON.parse(readLocal(preferenceKey));
    return { music: saved?.music !== false, effects: saved?.effects !== false };
  } catch {
    return { music: true, effects: true };
  }
}

export function createWorkshopSound(host) {
  const settings = preferences();
  const layers = new Map();
  let levels = {}, frame = 0, book;
  let activated = navigator.userActivation?.hasBeenActive ?? false;

  function tryPlay(audio) {
    if (audio.paused && !audio.error) audio.play().catch(() => {});
  }

  function target(name) {
    return settings[name === 'river' ? 'effects' : 'music'] ? (levels[name] || 0) : 0;
  }

  function mix(fade = true) {
    if (!activated) return;
    cancelAnimationFrame(frame);
    const changes = [];
    for (const name of Object.keys(levels)) {
      const volume = target(name);
      if (volume > 0 && !layers.has(name)) {
        const audio = new Audio(asset(name));
        audio.loop = true;
        audio.volume = 0;
        layers.set(name, audio);
      }
      const audio = layers.get(name);
      if (!audio) continue;
      if (volume > 0) tryPlay(audio);
      if (!fade || audio.paused || audio.volume === volume) {
        audio.volume = volume;
        if (!volume) audio.pause();
      } else {
        changes.push({ audio, from: audio.volume, volume });
      }
    }
    if (!changes.length) return;
    const start = performance.now();
    function step(now) {
      const progress = Math.max(0, Math.min(1, (now - start) / fadeLength));
      for (const { audio, from, volume } of changes) {
        audio.volume = from + (volume - from) * progress;
        if (progress === 1 && !volume) audio.pause();
      }
      if (progress < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
  }

  function onGesture(event) {
    if (!event.isTrusted) return;
    if (!activated) { activated = true; mix(); return; }
    for (const [name, audio] of layers) if (target(name) > 0) tryPlay(audio);
  }

  function onSetting(event) {
    const name = event.target.dataset.wsSound;
    if (!Object.hasOwn(settings, name)) return;
    settings[name] = event.target.checked;
    writeLocal(preferenceKey, JSON.stringify(settings));
    if (!settings.effects) book?.pause();
    mix(false);
  }

  host.addEventListener('click', onGesture, true);
  host.addEventListener('keydown', onGesture, true);
  host.addEventListener('change', onSetting);
  return {
    setScene(context) {
      const next = workshopSoundLevels(context);
      if (Object.keys(next).every(name => next[name] === levels[name])) return;
      levels = next;
      mix();
    },
    syncControls() {
      for (const input of host.querySelectorAll('[data-ws-sound]')) input.checked = settings[input.dataset.wsSound];
    },
    closeLedger() {
      if (!activated || !settings.effects) return;
      book ??= new Audio(asset('ledger-close'));
      book.volume = .28;
      book.currentTime = 0;
      tryPlay(book);
    },
    dispose() {
      cancelAnimationFrame(frame);
      for (const audio of layers.values()) audio.pause();
      book?.pause();
      host.removeEventListener('click', onGesture, true);
      host.removeEventListener('keydown', onGesture, true);
      host.removeEventListener('change', onSetting);
    },
  };
}
