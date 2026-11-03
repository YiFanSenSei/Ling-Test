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

/** 先稳定模拟器，再冻结画布；预览期间编辑标题不会改变作品本体。 */
export function captureWork(canvas, fallback = {}) {
  const meta = { ...fallback, ...canvas.prepareWork?.() };
  const frozen = document.createElement('canvas');
  frozen.width = canvas.width; frozen.height = canvas.height;
  frozen.dataset.w = canvas.dataset.w || String(canvas.width / Math.min(window.devicePixelRatio || 1, 2));
  frozen.getContext('2d').drawImage(canvas, 0, 0);
  return { canvas: frozen, meta };
}

function wrapText(ctx, text, width, limit) {
  const lines = []; let line = '';
  for (const character of String(text || '')) {
    if (character === '\n' || (line && ctx.measureText(line + character).width > width)) {
      lines.push(line); line = character === '\n' ? '' : character;
    } else line += character;
  }
  if (line) lines.push(line);
  if (lines.length > limit) {
    lines.length = limit;
    while (ctx.measureText(lines[limit - 1] + '…').width > width) lines[limit - 1] = lines[limit - 1].slice(0, -1);
    lines[limit - 1] += '…';
  }
  return lines;
}

/**
 * 给画布套上纸底与信息条，返回新画布（不改动原画布）。
 *
 * @param {HTMLCanvasElement} canvas 源画布
 * @param {{ title: string, note?: string }} meta 作品名与副行说明
 */
export function composeWork(canvas, { title, note }) {
  const scale = canvas.width / (Number(canvas.dataset.w) || canvas.width / Math.min(window.devicePixelRatio || 1, 2));
  const px = n => Math.round(n * scale);
  const pad = px(26);

  const out = document.createElement('canvas');
  out.width = canvas.width + pad * 2;
  const ctx = out.getContext('2d');
  const available = canvas.width;
  ctx.font = `${px(19)}px ${SERIF}`;
  const titles = wrapText(ctx, title || '我的练习', Math.max(px(25), available - px(36)), 8);
  ctx.font = `${px(12)}px ${SERIF}`;
  const notes = wrapText(ctx, note || '匠作 · 非物质文化遗产数字展馆', available, 8);
  out.height = canvas.height + pad + px(24 + titles.length * 27 + notes.length * 19 + 32);

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
  titles.forEach((line, i) => ctx.fillText(line, pad, baseY + px(i * 27)));

  ctx.fillStyle = INK_FAINT;
  ctx.font = `${px(12)}px ${SERIF}`;
  const noteY = baseY + px(titles.length * 27);
  notes.forEach((line, i) => ctx.fillText(line, pad, noteY + px(i * 19)));

  // 右侧日期
  ctx.textAlign = 'right';
  ctx.fillStyle = INK_FAINT;
  ctx.font = `${px(12)}px ${SERIF}`;
  ctx.fillText(today(), out.width - pad, noteY + px(notes.length * 19 + 4));

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
  const captured = captureWork(canvas, { title, note });
  const out = composeWork(captured.canvas, captured.meta);
  const a = document.createElement('a');
  a.download = filename || `匠作-${captured.meta.title}-${today()}.png`;
  a.href = out.toDataURL('image/png');
  a.click();
}
