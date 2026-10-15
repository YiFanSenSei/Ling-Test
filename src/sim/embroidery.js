/**
 * 苏绣模拟器 —— 平针 / 打籽 / 齐针 / 锁针
 *
 * 设计依据（真实针法规则，不是随便画线）：
 *   · 平针：短而平行的针脚，沿行进方向排列，针脚长度一致
 *   · 打籽绣：绕线成粒，每针打成一个圆点，密集成簇
 *   · 齐针（缎面）：针脚紧密并排，完全覆盖底料，方向统一
 *   · 锁针：环环相扣的链状，沿路径连续套接
 *
 * 真实感来自三处细节：
 *   1. 丝线有光泽——用线性渐变模拟丝线的反射
 *   2. 针脚有起伏——每一针的角度略有随机，像手绣的微差
 *   3. 底料是素绸——有经纬纹理，且刺绣会略微压暗底料
 */

const COLOR_HEX = {
  red: '#C0392B', pink: '#D98880', jade: '#7D9B76',
  blue: '#4A6FA5', gold: '#C9A227', ink: '#2C2A26',
};

export function initEmbroidery() {
  const canvas = document.getElementById('canvas-embroidery');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const hint = document.getElementById('hint-embroidery');
  const countEl = document.getElementById('stitch-count');

  /* ---------- 状态 ---------- */
  let stitch = 'flat';
  let thread = 'red';
  let density = 12;
  let pattern = 'free';

  /** 已绣的针脚记录：[{x1,y1,x2,y2,color,type,r}] */
  let stitches = [];
  let drawing = false;
  let last = null;
  /** 打籽绣与锁针的节流：记录上一次落点距离 */
  const SEED_GAP = 9;

  /* ---------- 画布尺寸（支持高 DPI）---------- */
  function fitCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 900;
    const h = rect.height || 640;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas.dataset.w = String(w);
    canvas.dataset.h = String(h);
    redraw();
  }

  const W = () => Number(canvas.dataset.w) || 900;
  const H = () => Number(canvas.dataset.h) || 640;

  /* ---------- 绘制底料（素绸）---------- */
  function drawCloth() {
    const w = W(), h = H();
    // 底色：素绸的暖白
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#F2EBDC');
    g.addColorStop(0.5, '#EDE4D2');
    g.addColorStop(1, '#E8DECA');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 经纬纹理：细密交叉线，是绸缎的基础结构
    ctx.save();
    ctx.globalAlpha = 0.055;
    ctx.strokeStyle = '#8A7A5E';
    ctx.lineWidth = 0.6;
    for (let y = 0; y < h; y += 4) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
    }
    for (let x = 0; x < w; x += 4) {
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
    }
    ctx.restore();

    // 绸面的柔光：右上角来光
    const sheen = ctx.createRadialGradient(w * 0.72, h * 0.22, 10, w * 0.72, h * 0.22, Math.max(w, h) * 0.85);
    sheen.addColorStop(0, 'rgba(255,255,255,0.34)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    sheen.addColorStop(1, 'rgba(120,105,80,0.06)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h);

    // 绣绷：外圈木框，让画布成为「绷在架子上的绣布」
    ctx.save();
    ctx.strokeStyle = 'rgba(92,71,50,0.28)';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, w - 14, h - 14);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.restore();
  }

  /** 图案引导线：给一个淡淡的底稿，像绣娘先描的样 */
  function drawGuide() {
    if (pattern === 'free') return;
    const w = W(), h = H();
    ctx.save();
    ctx.strokeStyle = 'rgba(178,58,46,0.13)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 7]);
    ctx.translate(w / 2, h / 2);
    const s = Math.min(w, h) * 0.3;

    if (pattern === 'petal') {
      // 五瓣花
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 * i) / 5);
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.62, s * 0.34, s * 0.62, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath(); ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2); ctx.stroke();
    } else if (pattern === 'leaf') {
      ctx.beginPath();
      ctx.moveTo(0, s); ctx.quadraticCurveTo(s * 1.1, 0, 0, -s);
      ctx.quadraticCurveTo(-s * 1.1, 0, 0, s);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, s); ctx.lineTo(0, -s); ctx.stroke();
      for (let i = -3; i <= 3; i++) {
        const y = (i / 3.4) * s;
        const dx = Math.cos((y / s) * Math.PI * 0.5) * s * 1.02;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(dx, y - s * 0.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(-dx, y - s * 0.2); ctx.stroke();
      }
    } else if (pattern === 'wave') {
      for (let r = 0; r < 3; r++) {
        ctx.beginPath();
        const off = (r - 1) * s * 0.42;
        ctx.moveTo(-s * 1.5, off);
        for (let x = -s * 1.5; x <= s * 1.5; x += s * 0.25) {
          ctx.quadraticCurveTo(x + s * 0.125, off - s * 0.22, x + s * 0.25, off);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ---------- 丝线质感：带光泽的线 ---------- */
  function threadGradient(x1, y1, x2, y2, hex) {
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, shade(hex, 0.22));
    g.addColorStop(0.42, hex);
    g.addColorStop(0.58, shade(hex, 0.3));
    g.addColorStop(1, shade(hex, -0.16));
    return g;
  }

  /** 调整颜色明度。amt > 0 变亮，< 0 变暗 */
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt >= 0) {
      r = Math.round(r + (255 - r) * amt);
      g = Math.round(g + (255 - g) * amt);
      b = Math.round(b + (255 - b) * amt);
    } else {
      r = Math.round(r * (1 + amt));
      g = Math.round(g * (1 + amt));
      b = Math.round(b * (1 + amt));
    }
    return `rgb(${r},${g},${b})`;
  }

  /* ---------- 画一针 ---------- */
  function paintStitch(s) {
    const hex = COLOR_HEX[s.color] || '#C0392B';
    ctx.save();
    ctx.lineCap = 'round';

    if (s.type === 'seed') {
      // 打籽：绕线成粒
      const r = Math.max(1.8, 26 / density);
      const g = ctx.createRadialGradient(s.x2 - r * 0.35, s.y2 - r * 0.35, r * 0.15, s.x2, s.y2, r);
      g.addColorStop(0, shade(hex, 0.42));
      g.addColorStop(0.6, hex);
      g.addColorStop(1, shade(hex, -0.3));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(s.x2, s.y2, r, 0, Math.PI * 2); ctx.fill();
      // 籽的暗边，增加立体感
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.arc(s.x2, s.y2, r, 0.6, 2.4); ctx.stroke();

    } else if (s.type === 'chain') {
      // 锁针：环环相扣
      const r = Math.max(3, 15 / density) * 1.4;
      ctx.strokeStyle = threadGradient(s.x1, s.y1, s.x2, s.y2, hex);
      ctx.lineWidth = Math.max(1.6, 20 / density);
      ctx.beginPath();
      ctx.ellipse((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, r, r * 0.72,
        Math.atan2(s.y2 - s.y1, s.x2 - s.x1), 0, Math.PI * 2);
      ctx.stroke();

    } else if (s.type === 'satin') {
      // 齐针：长而紧密的并排针脚
      const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) * 1.7;
      const ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      const ex = s.x1 + Math.cos(ang) * len;
      const ey = s.y1 + Math.sin(ang) * len;
      ctx.strokeStyle = threadGradient(s.x1, s.y1, ex, ey, hex);
      ctx.lineWidth = Math.max(2, 30 / density);
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(ex, ey); ctx.stroke();
      // 缎面高光
      ctx.strokeStyle = 'rgba(255,255,255,0.26)';
      ctx.lineWidth = Math.max(0.6, 8 / density);
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1 - 1); ctx.lineTo(ex, ey - 1); ctx.stroke();

    } else {
      // 平针：短促平行的针脚
      ctx.strokeStyle = threadGradient(s.x1, s.y1, s.x2, s.y2, hex);
      ctx.lineWidth = Math.max(1.4, 18 / density);
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      // 丝线反光
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = Math.max(0.5, 5 / density);
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- 重绘 ---------- */
  function redraw() {
    ctx.clearRect(0, 0, W(), H());
    drawCloth();
    drawGuide();
    for (const s of stitches) paintStitch(s);
    if (countEl) countEl.textContent = String(stitches.length);
  }

  /* ---------- 坐标换算 ---------- */
  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  }

  /* ---------- 落针逻辑 ---------- */
  function addStitch(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);

    if (stitch === 'seed') {
      if (dist < SEED_GAP) return false;
      stitches.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, color: thread, type: 'seed' });
      return true;
    }
    if (stitch === 'chain') {
      if (dist < 12) return false;
      stitches.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, color: thread, type: 'chain' });
      return true;
    }

    // 平针 / 齐针：按密度切片，逐针推进
    const step = stitch === 'satin' ? 520 / density * 2.6 : 260 / density;
    if (dist < step) return false;

    const ang = Math.atan2(dy, dx);
    // 手绣的微差：每针角度有 ±3° 抖动，长度有 ±8% 变化
    const jitterA = (Math.random() - 0.5) * 0.1;
    const jitterL = 0.92 + Math.random() * 0.16;

    for (let d = 0; d + step <= dist; d += step) {
      const x1 = from.x + Math.cos(ang + jitterA) * d;
      const y1 = from.y + Math.sin(ang + jitterA) * d;
      const len = step * (stitch === 'satin' ? 1.9 : 0.86) * jitterL;
      const x2 = x1 + Math.cos(ang + jitterA) * len;
      const y2 = y1 + Math.sin(ang + jitterA) * len;
      stitches.push({ x1, y1, x2, y2, color: thread, type: stitch });
    }
    return true;
  }

  /* ---------- 事件 ---------- */
  function onDown(e) {
    e.preventDefault();
    drawing = true;
    last = pos(e);
    if (hint) hint.classList.add('is-hidden');
  }

  function onMove(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = pos(e);
    if (last && addStitch(last, p)) {
      // 打籽/锁针从落点继续；平针/齐针以当前点为新起点
      last = p;
      redraw();
    }
  }

  function onUp() { drawing = false; last = null; }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointerleave', onUp);
  canvas.addEventListener('pointercancel', onUp);
  // 触摸时阻止页面滚动
  canvas.style.touchAction = 'none';

  /* ---------- 控件 ---------- */
  document.querySelectorAll('[data-stitch]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-stitch]').forEach(b => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', String(on));
      });
      stitch = btn.dataset.stitch;
    });
  });

  document.querySelectorAll('[data-thread]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-thread]').forEach(b => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', String(on));
      });
      thread = btn.dataset.thread;
    });
  });

  document.querySelectorAll('[data-pattern]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-pattern]').forEach(b => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', String(on));
      });
      pattern = btn.dataset.pattern;
      redraw();
    });
  });

  const densityInput = document.getElementById('stitch-density');
  const densityValue = document.getElementById('density-value');
  if (densityInput) {
    densityInput.addEventListener('input', () => {
      density = Number(densityInput.value);
      if (densityValue) densityValue.textContent = String(density);
    });
  }

  document.getElementById('undo-embroidery')?.addEventListener('click', () => {
    // 平针一次拖动会产生多针，撤销时一次撤一组
    const before = stitches.length;
    const type = stitches[before - 1]?.type;
    let n = 1;
    while (stitches.length - n > 0 && stitches[stitches.length - n - 1]?.type === type && n < 60) n += 1;
    stitches = stitches.slice(0, Math.max(0, before - n));
    redraw();
  });

  document.getElementById('clear-embroidery')?.addEventListener('click', () => {
    stitches = [];
    redraw();
    if (hint) hint.classList.remove('is-hidden');
  });

  document.getElementById('save-embroidery')?.addEventListener('click', () => {
    // 导出为 PNG：把绣布与绣品一起存下来
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const octx = out.getContext('2d');
    octx.drawImage(canvas, 0, 0);
    const a = document.createElement('a');
    a.download = `匠作-苏绣作品-${Date.now()}.png`;
    a.href = out.toDataURL('image/png');
    a.click();
  });

  /* ---------- 启动 ---------- */
  fitCanvas();
  window.addEventListener('resize', fitCanvas);
  window.addEventListener('sim:activate', e => {
    if (e.detail.key === 'embroidery') requestAnimationFrame(fitCanvas);
  });

  return { redraw };
}
