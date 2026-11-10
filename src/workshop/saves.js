import { loadWorkshop } from './rules.js';

export const workshopSlots = [1, 2, 3, 4, 5];
const slotKey = number => `jz-workshop-slot-v1-${number}`;

export function readWorkshopSlot(number) {
  let raw;
  try { raw = localStorage.getItem(slotKey(number)); }
  catch { return { kind: 'unavailable' }; }
  if (raw === null) return { kind: 'empty', raw };

  try {
    const { state, savedAt, spot } = JSON.parse(raw);
    const game = loadWorkshop(JSON.stringify(state));
    if (game && typeof savedAt === 'string' && Number.isFinite(Date.parse(savedAt))) {
      return { kind: 'saved', raw, game, savedAt, spot };
    }
  } catch { /* A damaged slot can still be replaced. */ }
  return { kind: 'damaged', raw };
}

export function writeWorkshopSlot(number, state, spot) {
  try {
    localStorage.setItem(slotKey(number), JSON.stringify({ state, spot, savedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}
