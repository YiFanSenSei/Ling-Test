/**
 * 榫卯模拟器 —— 燕尾榫 / 直榫 / 格肩榫
 *
 * 三种榫卯各有不同的几何规则，判定逻辑也各不相同：
 *   · 燕尾榫：梯形互锁，必须沿轴向滑入才能咬合，有方向性
 *   · 直榫：方榫穿卯，只需位置与角度对齐
 *   · 格肩榫：45 度斜接，要求两个斜面完全贴合
 *
 * 木纹是程序化生成的：用正弦扰动 + 随机偏移画出年轮线条，
 * 比贴图更轻，也比纯色更真实。
 */

import { downloadWork } from './export.js';

const JOINT_SPEC = {
  dovetail: {
    name: '燕尾榫',
    // 榫头梯形：内窄外宽，因此只能从一侧滑入
    tipW: 0.46, baseW: 0.72, depth: 0.4,
    tolerance: 26,
    requireAngle: false,
    hint: '燕尾榫只能从一个方向滑入——顺着木纹推过去，它会自己咬住。',
  },
  mortise: {
    name: '直榫',
    tipW: 0.4, baseW: 0.4, depth: 0.42,
    tolerance: 30,
    requireAngle: false,
    hint: '方榫对准方卯，推到底即可。这是最简单也最广泛使用的榫卯。',
  },
  miter: {
    name: '格肩榫',
    tipW: 0.6, baseW: 0.6, depth: 0.34,
    tolerance: 22,
    requireAngle: true,
    hint: '格肩榫要两个 45 度斜面严丝合缝，先旋转构件对齐角度。',
  },
};

export function initMortise() {
  const canvas = document.getElementById('canvas-mortise');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const hint = document.getElementById('hint-mortise');

  let joint = 'dovetail';
  let rotation = 0;              // 可动构件的旋转量（90 度步进）
  let dragging = false;
  let dragOffset = { x: 0, y: 0 };
  /** 可动构件的位置（相对于目标位） */
  let pos = { x: 0, y: 0 };
  let seated = false;
  let showSolution = false;
  let placed = false;   // 是否已初始化过位置（区分首次布局与 resize）
  let lastW = 0;        // 上一次布局的尺寸，用于按比例缩放位置
  let lastH = 0;
  let alive = true;     // 页面是否还在（离开后定时器不应再改状态）
  let autoTimer = 0;    // 「自动演示」的 900ms 定时器 id

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
    repinToCanvas();
    redraw();
  }

  const W = () => Number(canvas.dataset.w) || 900;
  const H = () => Number(canvas.dataset.h) || 640;

  /**
   * 依据当前画布尺寸把构件重新摆放。
   *
   * ⚠️ 这里刻意**不**调 resetPos()：resize 只应改变画面尺寸，不该抹掉
   *    用户已经拖好甚至已经咬合的状态。移动端地址栏收起/展开、
   *    窗口拉伸都会触发 resize，用户只是滚动了一下，成果就没了。
   *    只有「重新开始」按钮与首次布局才应当调用 resetPos()。
   */
  function repinToCanvas() {
    if (seated) {
      // 已咬合的构件跟着目标位走，保持「装好了」的状态
      pos = { x: 0, y: 0 };
      rotation = 0;
      return;
    }
    if (!placed) return;      // 还没初始化过，交给 resetPos()
    // 按尺寸比例缩放偏移量，保持相对位置不变
    const kx = W() / (lastW || W());
    const ky = H() / (lastH || H());
    pos = { x: pos.x * kx, y: pos.y * ky };
    lastW = W();
    lastH = H();
  }

  function resetPos() {
    pos = { x: W() * 0.3, y: H() * 0.06 };
    rotation = 0;
    seated = false;
    showSolution = false;
    placed = true;
    lastW = W();
    lastH = H();
  }

  /* ---------- 木纹绘制 ---------- */
  /**
   * 在指定矩形内画木纹。
   * 原理：多条正弦曲线叠加随机相位，再叠加若干「年轮」弧。
   */
  function drawWood(x, y, w, h) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#B08D5E');
    g.addColorStop(0.45, '#9C7A4E');
    g.addColorStop(1, '#8B6F47');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    // 顺纹（水平）的细线
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < h; i += 5) {
      const phase = i * 0.3 + (x + y) * 0.01;
      ctx.strokeStyle = i % 15 === 0 ? '#6B5236' : '#5C4732';
      ctx.lineWidth = i % 15 === 0 ? 1.1 : 0.55;
      ctx.beginPath();
      ctx.moveTo(x, y + i);
      for (let px = 0; px <= w; px += 18) {
        ctx.lineTo(x + px, y + i + Math.sin(px * 0.022 + phase) * 2.4);
      }
      ctx.stroke();
    }

    // 年轮弧：不规则椭圆，模拟木材切面的生长纹
    ctx.globalAlpha = 0.11;
    const rings = 4;
    for (let i = 0; i < rings; i++) {
      const cx = x + w * 0.18;
      const cy = y + h * (0.3 + i * 0.16);
      ctx.strokeStyle = '#4A3826';
      ctx.lineWidth = 1.4 + i * 0.3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * (0.5 + i * 0.22), h * (0.12 + i * 0.05), 0.12, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // 边缘的倒角高光与暗面，让木块有厚度
    ctx.save();
    ctx.strokeStyle = 'rgba(255,235,200,0.3)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,28,16,0.35)';
    ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.stroke();
    ctx.restore();
  }

  /* ---------- 几何：构件的榫头轮廓 ---------- */
  /**
   * 返回榫头的多边形顶点（以构件右上角为原点，向右延伸）。
   */
  function tenonPath(baseX, baseY, h, spec) {
    const d = h * spec.depth * 2;
    const tip = h * spec.tipW;
    const base = h * spec.baseW;
    return [
      [baseX, baseY],
      [baseX + d, baseY + (h - tip) / 2],
      [baseX + d, baseY + (h + tip) / 2],
      [baseX, baseY + h],
      [baseX, baseY + (h + base) / 2 + h * 0.06],
      [baseX, baseY + (h - base) / 2 - h * 0.06],
    ];
  }

  /** 卯眼（凹槽）轮廓 */
  function mortisePath(baseX, baseY, h, spec) {
    const d = h * spec.depth * 2;
    const tip = h * spec.tipW;
    const base = h * spec.baseW;
    // 卯眼与榫头形状一致，略大一点点（真实的间隙）
    const pad = h * 0.012;
    return [
      [baseX, baseY],
      [baseX + d, baseY + (h - tip) / 2 - pad],
      [baseX + d, baseY + (h + tip) / 2 + pad],
      [baseX, baseY + h],
      [baseX, baseY + (h + base) / 2 + h * 0.06],
      [baseX, baseY + (h - base) / 2 - h * 0.06],
    ];
  }

  function poly(c, pts) {
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
  }

  /* ---------- 绘制场景 ---------- */
  function redraw() {
    const w = W(), h = H();
    // 工作台背景
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#2E2A24');
    bg.addColorStop(1, '#1F1C18');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // 台面
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#6B5236';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.restore();

    const spec = JOINT_SPEC[joint];

    /* ---- 左侧固定构件 ---- */
    const fixedW = Math.min(w * 0.34, 300);
    const fixedH = Math.min(h * 0.5, 300);
    const fixedX = w * 0.12;
    const fixedY = (h - fixedH) / 2;

    drawWood(fixedX, fixedY, fixedW, fixedH);

    // 卯眼：从构件右边缘往回挖
    const mPath = mortisePath(fixedX + fixedW, fixedY, fixedH, spec).map(([px, py]) => [
      // 镜像：卯眼向左凹入
      fixedX + fixedW - (px - (fixedX + fixedW)),
      py,
    ]);
    ctx.save();
    ctx.fillStyle = 'rgba(30,22,14,0.82)';
    poly(ctx, mPath);
    ctx.fill();
    // 卯眼内壁的暗部
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    /* ---- 右侧可动构件 ---- */
    const movW = Math.min(w * 0.34, 300);
    const movH = Math.min(h * 0.5, 300);
    const targetX = fixedX + fixedW - (movW - fixedW) + 0;
    // 目标位置：榫头正好插入卯眼
    const tD = fixedH * spec.depth * 2;
    const targetPos = {
      x: fixedX + fixedW - tD - movW + (movW - fixedW) * 0 + 0,
      y: (h - movH) / 2,
    };
    const targetXReal = fixedX + fixedW - (movW - fixedW) * 0 - 0;
    // 简化：可动构件左边缘 = 固定构件右边缘 - 插入深度
    const idealX = fixedX + fixedW - tD * (seated ? 1 : 0) - 0;
    const restX = fixedX + fixedW + w * 0.16;
    const baseX = seated ? fixedX + fixedW - tD : restX;

    const movX = baseX + pos.x;
    const movY = (h - movH) / 2 + pos.y;

    ctx.save();
    // 旋转：绕构件左边缘中点
    ctx.translate(movX, movY + movH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-movX, -(movY + movH / 2));

    const tPath = tenonPath(movX, movY, movH, spec);
    drawWood(movX, movY, movW, movH);
    // 榫头部分也画木纹
    ctx.save();
    poly(ctx, tPath);
    ctx.clip();
    drawWood(movX, movY, tD + 4, movH);
    ctx.restore();

    // 榫头轮廓
    ctx.save();
    ctx.strokeStyle = 'rgba(40,28,16,0.5)';
    ctx.lineWidth = 1.6;
    poly(ctx, tPath);
    ctx.stroke();
    ctx.restore();

    // 格肩榫的 45 度斜面标记
    if (joint === 'miter') {
      ctx.save();
      ctx.strokeStyle = 'rgba(178,58,46,0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(movX, movY + movH * 0.5);
      ctx.lineTo(movX + tD * 0.7, movY + movH * 0.5 - tD * 0.7);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    /* ---- 正确接法的虚影提示 ---- */
    if (showSolution && !seated) {
      ctx.save();
      ctx.globalAlpha = 0.32;
      ctx.strokeStyle = '#C9A961';
      ctx.lineWidth = 2.4;
      ctx.setLineDash([9, 7]);
      const solX = fixedX + fixedW - tD;
      const solPath = tenonPath(solX, (h - movH) / 2, movH, spec);
      poly(ctx, solPath);
      ctx.stroke();
      ctx.restore();
    }

    /* ---- 俯视示意小图 ---- */
    drawMiniDiagram(spec);
  }

  /** 右下角的俯视示意图，说明咬合关系 */
  function drawMiniDiagram(spec) {
    const w = W(), h = H();
    const dw = 168, dh = 96;
    const dx = w - dw - 28, dy = h - dh - 28;

    ctx.save();
    ctx.fillStyle = 'rgba(245,241,232,0.94)';
    ctx.fillRect(dx, dy, dw, dh);
    ctx.strokeStyle = 'rgba(28,26,23,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(dx, dy, dw, dh);

    const cy = dy + dh / 2;
    const bw = 54, bh = 42;
    // 左块
    ctx.fillStyle = '#8B6F47';
    ctx.fillRect(dx + 16, cy - bh / 2, bw, bh);
    // 右块 + 榫头
    const tD = bh * spec.depth * 2 * 0.9;
    ctx.fillStyle = '#B08D5E';
    ctx.fillRect(dx + 16 + bw + tD, cy - bh / 2, bw, bh);
    ctx.beginPath();
    ctx.moveTo(dx + 16 + bw, cy - bh / 2);
    ctx.lineTo(dx + 16 + bw + tD, cy - bh * spec.tipW / 2);
    ctx.lineTo(dx + 16 + bw + tD, cy + bh * spec.tipW / 2);
    ctx.lineTo(dx + 16 + bw, cy + bh / 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#4A453D';
    ctx.font = '11px "Songti SC", serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${spec.name} · 俯视`, dx + dw / 2, dy + dh - 9);
    ctx.restore();
  }

  /* ---------- 咬合判定 ---------- */
  function checkSeat() {
    const spec = JOINT_SPEC[joint];
    const w = W(), h = H();
    const fixedW = Math.min(w * 0.34, 300);
    const movW = Math.min(w * 0.34, 300);
    const fixedX = w * 0.12;
    const restX = fixedX + fixedW + w * 0.16;
    const idealX = fixedX + (movW - fixedW) * 0;   // 目标位移为零点

    // 位置容差
    const dx = Math.abs(pos.x);
    const dy = Math.abs(pos.y);
    const posOK = dx < spec.tolerance && dy < spec.tolerance * 0.8;

    // 角度要求
    const norm = ((rotation % 360) + 360) % 360;
    const angleOK = spec.requireAngle ? (norm === 0 || norm === 360) : true;

    const ok = posOK && angleOK;

    seated = ok;
    const progress = Math.max(0, 100 - (dx / 3.2 + dy / 2.6)) * (angleOK ? 1 : 0.45);

    const stateEl = document.getElementById('joint-state');
    const tipEl = document.getElementById('joint-tip');
    const barEl = document.getElementById('joint-progress');
    const barWrap = document.getElementById('joint-progress-bar');

    if (stateEl) {
      stateEl.textContent = ok ? '已咬合 · 严丝合缝' : (posOK && !angleOK ? '角度未对齐' : '未咬合');
      stateEl.className = `joint-state ${ok ? 'is-ok' : (posOK ? 'is-near' : '')}`;
    }
    if (barEl) barEl.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    if (barWrap) barWrap.setAttribute('aria-valuenow', String(Math.round(Math.max(0, Math.min(100, progress)))));

    if (tipEl) {
      if (ok) {
        tipEl.textContent = spec.hint;
      } else if (posOK && !angleOK) {
        tipEl.textContent = '位置对了，但格肩榫需要 45 度斜面相对——试试旋转构件。';
      } else if (dx < spec.tolerance * 2.2 && dy < spec.tolerance * 1.8) {
        tipEl.textContent = '很接近了，继续微调位置。';
      } else {
        tipEl.textContent = '拖动木块靠近，观察榫头与卯眼是否对齐。';
      }
    }

    // 吸附反馈：接近时轻微吸住
    if (posOK && !ok && angleOK) {
      // 提示可吸附，但不强制，保留操作感
    }
    return ok;
  }

  /** 触觉式吸附：松手时若足够接近，自动对位 */
  function snapIfClose() {
    const spec = JOINT_SPEC[joint];
    if (Math.abs(pos.x) < spec.tolerance * 1.5 && Math.abs(pos.y) < spec.tolerance * 1.3) {
      const norm = ((rotation % 360) + 360) % 360;
      if (!spec.requireAngle || norm === 0 || norm === 360) {
        pos = { x: 0, y: 0 };
        seated = true;
      }
    }
    checkSeat();
    redraw();
  }

  /* ---------- 交互 ---------- */
  function posOf(e) {
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  }

  let start = null;
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (seated) { // 已咬合则允许重新拆开
      seated = false;
      pos = { x: 0, y: 0 };
    }
    dragging = true;
    start = { ...posOf(e), base: { ...pos } };
    if (hint) hint.classList.add('is-hidden');
  });

  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    e.preventDefault();
    const p = posOf(e);
    pos = {
      x: start.base.x + (p.x - start.x),
      y: start.base.y + (p.y - start.y),
    };
    // 限制在画布内
    pos.x = Math.max(-W() * 0.36, Math.min(W() * 0.36, pos.x));
    pos.y = Math.max(-H() * 0.24, Math.min(H() * 0.24, pos.y));
    checkSeat();
    redraw();
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    snapIfClose();
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointerleave', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.style.touchAction = 'none';

  /* ---------- 控件 ---------- */
  document.querySelectorAll('[data-joint]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-joint]').forEach(b => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', String(on));
      });
      joint = btn.dataset.joint;
      resetPos();
      checkSeat();
      redraw();
      if (hint) hint.classList.remove('is-hidden');
    });
  });

  document.getElementById('rotate-mortise')?.addEventListener('click', () => {
    rotation = (rotation + 90) % 360;
    checkSeat();
    redraw();
  });

  document.getElementById('reset-mortise')?.addEventListener('click', () => {
    resetPos();
    checkSeat();
    redraw();
    if (hint) hint.classList.remove('is-hidden');
  });

  document.getElementById('save-mortise')?.addEventListener('click', () => {
    // 导出为 PNG：带上当前榫卯类型与咬合状态
    const label = document.querySelector('[data-joint].is-active .tool-opt-name')
      ?.textContent.trim() || '榫卯';
    const state = document.getElementById('joint-state')?.textContent.trim() || '';
    downloadWork(canvas, {
      title: `榫卯 · ${label}`,
      note: `匠作 · 非物质文化遗产数字展馆${state ? `　${state}` : ''}`,
    });
  });

  document.getElementById('auto-mortise')?.addEventListener('click', () => {
    // 演示正确接法：先显示虚影，再自动对位
    showSolution = true;
    rotation = 0;
    redraw();
    // 存下 id：这个定时器会在页面被清掉之后才触发，
    // 届时它操作的是一张已经脱离文档的 canvas，且会把用户
    // 离开前的工作状态改掉。dispose() 里必须能取消它。
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      autoTimer = 0;
      if (!alive) return;
      pos = { x: 0, y: 0 };
      showSolution = false;
      checkSeat();
      redraw();
    }, 900);
  });

  /* ---------- 启动 ---------- */
  fitCanvas();
  // 首次布局必须摆放构件：fitCanvas 走 repinToCanvas，
  // 而初次 placed 为 false，那里会直接返回。
  resetPos();
  redraw();
  const onActivate = e => {
    if (e.detail.key === 'mortise') requestAnimationFrame(fitCanvas);
  };
  window.addEventListener('resize', fitCanvas);
  window.addEventListener('sim:activate', onActivate);

  return {
    redraw,
    dispose() {
      alive = false;
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = 0;
      window.removeEventListener('resize', fitCanvas);
      window.removeEventListener('sim:activate', onActivate);
    },
  };
}
