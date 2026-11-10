import { loadWorkshop } from './rules.js';
import { readLocal, writeLocal } from '../storage.js';

export const workshopSlots = [1, 2, 3, 4, 5];
const autosaveKey = 'jz-workshop-v1';
const slotPrefix = 'jz-workshop-slot-v1-';
const slotKey = number => `${slotPrefix}${number}`;
const saveTime = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' });
let autosaveInMemory = false;

export function workshopSaveChanged(key) {
  return key === null || key === autosaveKey || key.startsWith(slotPrefix);
}

export function readWorkshopAutosave() {
  let raw;
  try { raw = autosaveInMemory ? readLocal(autosaveKey) : localStorage.getItem(autosaveKey); }
  catch {
    raw = readLocal(autosaveKey);
    if (raw === null) return { kind: 'unavailable' };
  }
  if (raw === null) return { kind: 'empty', raw };
  try {
    const { resume, ...state } = JSON.parse(raw);
    const game = loadWorkshop(JSON.stringify(state));
    if (game) return { kind: 'saved', raw, game, spot: resume?.spot, drafts: resume?.drafts };
  } catch { /* A damaged autosave can still be replaced. */ }
  return { kind: 'damaged', raw };
}

export function writeWorkshopAutosave(state, resume) {
  autosaveInMemory = !writeLocal(autosaveKey, JSON.stringify({ ...state, resume }));
}

export function workshopSaveProgress({ game, kind }) {
  if (game) return `第 ${game.day} 天 · ${game.done ? '已结算' : `剩余 ${game.hours} 小时`}`;
  return { empty: '空档位', damaged: '存档损坏', unavailable: '本地存储不可用' }[kind];
}

export function formatWorkshopSaveTime(savedAt) {
  return saveTime.format(new Date(savedAt));
}

export function readWorkshopSlot(number) {
  let raw;
  try { raw = localStorage.getItem(slotKey(number)); }
  catch { return { kind: 'unavailable' }; }
  if (raw === null) return { kind: 'empty', raw };

  try {
    const { state, savedAt, spot, drafts } = JSON.parse(raw);
    const game = loadWorkshop(JSON.stringify(state));
    if (game && typeof savedAt === 'string' && Number.isFinite(Date.parse(savedAt))) {
      return { kind: 'saved', raw, game, savedAt, spot, drafts };
    }
  } catch { /* A damaged slot can still be replaced. */ }
  return { kind: 'damaged', raw };
}

export function writeWorkshopSlot(number, state, { spot, drafts }) {
  try {
    localStorage.setItem(slotKey(number), JSON.stringify({ state, spot, drafts, savedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}
