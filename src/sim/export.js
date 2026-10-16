/**
 * 作品导出 —— 把画布存成带信息的 PNG
 *
 * 三个模拟器共用。早先各自 `toDataURL` 直接导出裸画布，
 * 存下来的图既看不出是什么、也看不出从哪来。
 * 这里统一加一圈纸色留白与底部信息条：作品名、站点署名、日期，加一方朱印。
 *
 * 用设备像素比对齐字号，避免在高 DPI 屏上导出的小字糊成一团。
 */

const PAPER = '#F5F1E8';
const INK = '#3A342C';
const INK_FAINT = '#8A8279';
const CINNABAR = '#B23A2E';
const SERIF = '"Songti SC", "SimSun", "Noto Serif CJK SC", serif';

function today(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 给画布套上纸底与信息条，返回新画布（不改动原画布）。
 *
 * @param {HTMLCanvasElement} canvas 源画布
 * @param {{ title: string, note?: string }} meta 作品名与副行说明
 */
export function composeWork(canvas, { title, note }) {
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const px = n => Math.round(n * scale);
  const pad = px(26);
  const bar = px(78);

  const out = document.createElement('canvas');
  out.width = canvas.width + pad * 2;
  out.height = canvas.height + pad + bar;
  const ctx = out.getContext('2d');

  // 纸底
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, out.width, out.height);

  // 作品本体
  ctx.drawImage(canvas, pad, pad);
  ctx.strokeStyle = 'rgba(92,71,50,0.28)';
  ctx.lineWidth = Math.max(1, scale);
  ctx.strokeRect(pad + 0.5, pad + 0.5, canvas.width - 1, canvas.height - 1);

  // 底部信息条
  const baseY = pad + canvas.height + px(24);
  ctx.textBaseline = 'alphabetic';

  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = `${px(19)}px ${SERIF}`;
  ctx.fillText(title, pad, baseY);

  ctx.fillStyle = INK_FAINT;
  ctx.font = `${px(12)}px ${SERIF}`;
  ctx.fillText(note || '匠作 · 非物质文化遗产数字展馆', pad, baseY + px(21));

  // 右侧日期
  ctx.textAlign = 'right';
  ctx.fillStyle = INK_FAINT;
  ctx.font = `${px(12)}px ${SERIF}`;
  ctx.fillText(today(), out.width - pad, baseY + px(21));

  // 朱印：方印「匠」，与站点的图标一致
  const s = px(22);
  const sx = out.width - pad - s;
  const sy = baseY - px(18);
  ctx.fillStyle = CINNABAR;
  ctx.fillRect(sx, sy, s, s);
  ctx.fillStyle = PAPER;
  ctx.font = `${px(13)}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.fillText('匠', sx + s / 2, sy + px(16));

  return out;
}

/** 组合并触发下载 */
export function downloadWork(canvas, { title, note, filename }) {
  const out = composeWork(canvas, { title, note });
  const a = document.createElement('a');
  a.download = filename || `匠作-${title}-${today()}.png`;
  a.href = out.toDataURL('image/png');
  a.click();
}
