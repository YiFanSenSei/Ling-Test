const memory = new Map();
export function readLocal(key) {
  if (memory.has(key)) return memory.get(key);
  try { return localStorage.getItem(key) ?? memory.get(key) ?? null; }
  catch { return memory.get(key) ?? null; }
}
export function writeLocal(key, value) {
  memory.set(key, value);
  try { localStorage.setItem(key, value); return true; }
  catch { return false; }
}
