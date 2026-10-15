/**
 * 宣纸模拟器 —— 捞纸与帘纹
 *
 * 真实工序（四步，UI 中逐步引导）：
 *   一、入帘：纸帘浸入纸浆槽
 *   二、荡帘：左右摇荡，纤维均匀沉积
 *   三、出水：缓缓提起，沥去水分
 *   四、覆帘：湿纸揭下叠放
 *
 * 物理简化但不失真：
 *   · 纤维沉积量 = 浆液浓度 × 停留时间 × 帘面朝向
 *   · 荡动速度影响匀度（太快纤维冲散，太慢沉积不均）
 *   · 帘纹由竹丝间距决定，会在纸面留下平行细纹
 */

export function initPaper() {
  const canvas = document.getElementById('canvas-paper');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const hint = document.getElementById('hint-paper');

  let barkRatio = 60;      // 青檀皮比例
  let lineCount = 20;      // 帘纹密度
  let step = 'dip';        // 当前工序
  let swinging = false;
  let swingPhase = 0;

  /** 沉积网格：记录帘面上每个格子的纤维量 */
  const COLS = 60, ROWS = 42;
  let deposit = [];
  let swingHistory = [];   // 荡帘速度记录，用于评价匀度
  let liftProgress = 0;    // 出水进度 0–1

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
    resetDeposit();
    redraw();
  }

  const W = () => Number(canvas.dataset.w) || 900;
  const H = () => Number(canvas.dataset.h) || 640;

  function resetDeposit() {
    deposit = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    swingHistory = [];
    liftProgress = 0;
  }

  /* ---------- 纸浆槽 ---------- */
  function drawVat() {
    const w = W(), h = H();
    // 槽体
    ctx.fillStyle = '#3A3630';
    ctx.fillRect(0, 0, w, h);

    // 浆液：青檀皮比例越高，浆色越偏米黄
    const t = barkRatio / 100;
    const r = Math.round(214 + t * 26);
    const g = Math.round(224 + t * 10);
    const b = Math.round(232 - t * 42);

    const vatY = h * 0.3, vatH = h * 0.55;
    const vg = ctx.createLinearGradient(0, vatY, 0, vatY + vatH);
    vg.addColorStop(0, `rgb(${r - 12},${g - 10},${b - 6})`);
    vg.addColorStop(0.45, `rgb(${r},${g},${b})`);
    vg.addColorStop(1, `rgb(${r - 30},${g - 28},${b - 22})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, vatY, w, vatH);

    // 水面波纹
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) {
      const y = vatY + 14 + i * 13;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 24) {
        ctx.quadraticCurveTo(x + 12, y - 3.5 + Math.sin((x / w) * 8 + swingPhase + i) * 2.4, x + 24, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- 纸帘 ---------- */
  function drawScreen() {
    const w = W(), h = H();
    const isIn = step === 'dip' || step === 'swing';
    const swing = Math.sin(swingPhase) * (isIn ? 26 : 0);
    const lift = liftProgress * h * 0.3;

    const sw = Math.min(w * 0.72, 640);
    const sh = Math.min(h * 0.5, 340);
    const sx = (w - sw) / 2 + swing;
    const sy = isIn ? h * 0.36 - lift : h * 0.2 - lift;

    // 帘框（木制）
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#6B5236';
    ctx.fillRect(sx - 10, sy - 10, sw + 20, sh + 20);
    ctx.restore();

    ctx.fillStyle = '#8B6F47';
    ctx.fillRect(sx - 10, sy - 10, sw + 20, 10);
    ctx.fillRect(sx - 10, sy + sh, sw + 20, 10);
    ctx.fillRect(sx - 10, sy - 10, 10, sh + 20);
    ctx.fillRect(sx + sw, sy - 10, 10, sh + 20);

    // 帘面：半透明的网，能看见下面的浆液
    ctx.fillStyle = isIn ? 'rgba(238,232,214,0.42)' : 'rgba(240,235,220,0.9)';
    ctx.fillRect(sx, sy, sw, sh);

    // 已沉积的纤维层
    drawFibers(sx, sy, sw, sh, isIn);

    // 竹丝（帘纹来源）
    ctx.save();
    ctx.strokeStyle = 'rgba(139,111,71,0.5)';
    ctx.lineWidth = 0.9;
    const gap = sw / lineCount;
    for (let i = 1; i < lineCount; i++) {
      ctx.beginPath();
      ctx.moveTo(sx + i * gap, sy);
      ctx.lineTo(sx + i * gap, sy + sh);
      ctx.stroke();
    }
    // 横向支撑丝，间距大得多
    ctx.strokeStyle = 'rgba(139,111,71,0.32)';
    for (let j = 1; j < 10; j++) {
      ctx.beginPath();
      ctx.moveTo(sx, sy + (sh / 10) * j);
      ctx.lineTo(sx + sw, sy + (sh / 10) * j);
      ctx.stroke();
    }
    ctx.restore();

    // 水珠滴落（出水阶段）
    if (step === 'lift' || step === 'press') {
      ctx.save();
      ctx.fillStyle = 'rgba(200,220,230,0.6)';
      for (let i = 0; i < 16; i++) {
        const dx = sx + ((i * 71) % sw);
        const dy = sy + sh + 12 + (i % 5) * 26;
        ctx.beginPath();
        ctx.ellipse(dx, dy, 1.6, 3.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 入水处的涟漪
    if (isIn) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(sx + sw / 2, sy + sh, sw * 0.52, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** 把沉积网格画成纤维层 */
  function drawFibers(sx, sy, sw, sh, isIn) {
    const cw = sw / COLS, ch = sh / ROWS;
    ctx.save();
    ctx.globalAlpha = isIn ? 0.85 : 0.95;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const d = deposit[r][c];
        if (d <= 0.02) continue;
        const t = Math.min(1, d);
        // 纤维色随厚度变化：薄处透，厚处实
        const l = 96 - t * 10;
        ctx.fillStyle = `hsl(42, ${28 + barkRatio * 0.12}%, ${l}%)`;
        ctx.fillRect(sx + c * cw, sy + r * ch, cw + 0.6, ch + 0.6);
      }
    }
    ctx.restore();
  }

  /* ---------- 沉积计算 ---------- */
  /** 按停留时间与荡动速度沉积纤维 */
  function depositFibers(dt) {
    if (step !== 'dip' && step !== 'swing') return;

    // 浆液浓度由青檀皮比例决定（皮多则浆稠）
    const conc = 0.5 + (barkRatio / 100) * 0.9;
    // 荡帘：速度适中时沉积最均匀
    const speed = swingHistory.length > 1
      ? Math.abs(swingHistory[swingHistory.length - 1] - swingHistory[swingHistory.length - 2])
      : 0;
    const evenness = step === 'swing'
      ? Math.max(0.25, 1 - Math.abs(speed - 26) / 60)   // 偏离理想速度则不均
      : 0.55;

    // 中心沉积多、边缘少的天然倾向（真实捞纸也如此，靠荡帘补偿）
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const nx = (c / COLS - 0.5) * 2;
        const ny = (r / ROWS - 0.5) * 2;
        const center = 1 - 0.42 * (nx * nx * 0.7 + ny * ny * 0.5);
        const noise = 0.86 + Math.random() * 0.28;
        const add = conc * evenness * center * noise * dt * 0.9;
        deposit[r][c] = Math.min(1.15, deposit[r][c] + add);
      }
    }
  }

  /* ---------- 评价 ---------- */
  function evaluate() {
    let sum = 0, min = 2, max = 0, n = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const d = deposit[r][c];
        sum += d; n += 1;
        if (d < min) min = d;
        if (d > max) max = d;
      }
    }
    const avg = sum / n;
    const variance = (() => {
      let v = 0;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) v += (deposit[r][c] - avg) ** 2;
      }
      return v / n;
    })();
    const sd = Math.sqrt(variance);

    // 匀度：标准差越小越好
    const evenScore = Math.max(0, 100 - (sd / Math.max(avg, 0.01)) * 175);
    const thickScore = Math.min(100, (avg / 0.92) * 100);

    const evenEl = document.getElementById('grade-even');
    const thickEl = document.getElementById('grade-thick');
    const rankEl = document.getElementById('grade-rank');

    if (evenEl) evenEl.textContent = avg > 0.02 ? `${evenScore.toFixed(0)} 分` : '—';
    if (thickEl) thickEl.textContent = avg > 0.02 ? `${(avg * 100).toFixed(0)} 分` : '—';

    if (rankEl) {
      if (avg < 0.25) { rankEl.textContent = '浆太薄，揭不起来'; rankEl.className = ''; }
      else if (evenScore < 45) { rankEl.textContent = '厚度不均，晾干会破'; rankEl.className = 'rank-bad'; }
      else if (evenScore < 68) { rankEl.textContent = '尚可 · 普通书画纸'; rankEl.className = 'rank-ok'; }
      else if (evenScore < 85) { rankEl.textContent = '匀净 · 可作书画'; rankEl.className = 'rank-good'; }
      else { rankEl.textContent = '匀净绵韧 · 上等宣纸'; rankEl.className = 'rank-best'; }
    }
  }

  /* ---------- 主绘制 ---------- */
  function redraw() {
    ctx.clearRect(0, 0, W(), H());
    drawVat();
    drawScreen();
    updateStepUI();
    if (step === 'press') drawSheetPreview();
  }

  /** 覆帘后展示揭下来的湿纸 */
  function drawSheetPreview() {
    const w = W(), h = H();
    const sw = Math.min(w * 0.66, 580);
    const sh = sw * 0.66;
    const sx = (w - sw) / 2, sy = h * 0.34;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#F2EDE0';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.restore();

    // 帘纹
    ctx.save();
    ctx.strokeStyle = 'rgba(150,132,100,0.24)';
    ctx.lineWidth = 0.8;
    const gap = sw / lineCount;
    for (let i = 1; i < lineCount; i++) {
      ctx.beginPath();
      ctx.moveTo(sx + i * gap, sy);
      ctx.lineTo(sx + i * gap, sy + sh);
      ctx.stroke();
    }
    ctx.restore();

    // 纤维的可视纹理
    ctx.save();
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 340; i++) {
      const x = sx + Math.random() * sw;
      const y = sy + Math.random() * sh;
      const len = 4 + Math.random() * 16;
      const a = Math.random() * Math.PI;
      ctx.strokeStyle = Math.random() > 0.5 ? '#B8A67C' : '#D6CBAE';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.restore();

    // 纸边微微卷起
    ctx.save();
    ctx.strokeStyle = 'rgba(140,124,96,0.35)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(sx, sy); ctx.lineTo(sx + sw, sy);
    ctx.moveTo(sx, sy + sh); ctx.lineTo(sx + sw, sy + sh);
    ctx.stroke();
    ctx.restore();
  }

  function updateStepUI() {
    document.querySelectorAll('#paper-steps .step').forEach(el => {
      el.classList.toggle('is-active', el.dataset.step === step);
      const order = ['dip', 'swing', 'lift', 'press'];
      el.classList.toggle('is-done', order.indexOf(el.dataset.step) < order.indexOf(step));
    });
    if (hint) {
      const texts = {
        dip: '按住鼠标并拖动，把纸帘浸入浆槽',
        swing: '左右匀速荡动，让纤维均匀沉积',
        lift: '向上拖动，缓缓提起纸帘沥水',
        press: '湿纸已成形，点击「保存纸张」留存',
      };
      hint.querySelector('span:last-child').textContent = texts[step];
      hint.classList.remove('is-hidden');
    }
  }

  /* ---------- 交互 ---------- */
  let dragging = false;
  let lastX = null;
  let lastY = null;

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  }

  function advance(to) {
    const order = ['dip', 'swing', 'lift', 'press'];
    if (order.indexOf(to) > order.indexOf(step)) step = to;
  }

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    dragging = true;
    const p = pos(e);
    lastX = p.x; lastY = p.y;
    swinging = true;
    if (step === 'dip') advance('swing');
  });

  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    e.preventDefault();
    const p = pos(e);
    const dx = p.x - lastX;
    const dy = p.y - lastY;

    if (step === 'swing') {
      swingHistory.push(p.x);
      if (swingHistory.length > 40) swingHistory.shift();
    }
    // 快速上提进入出水阶段
    if (dy < -7 && step === 'swing') advance('lift');

    lastX = p.x; lastY = p.y;
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    swinging = false;
    if (step === 'lift' && liftProgress > 0.5) advance('press');
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointerleave', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.style.touchAction = 'none';

  /* ---------- 动画循环 ---------- */
  let lastT = performance.now();
  function loop(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;

    if (swinging) swingPhase += dt * 5.2;
    else swingPhase += dt * 1.1;   // 静止时水面仍有微动

    if (step === 'dip' || step === 'swing') {
      depositFibers(dt);
      evaluate();
    }
    if (step === 'lift') {
      liftProgress = Math.min(1, liftProgress + dt * 0.42);
      if (liftProgress >= 1) advance('press');
    }

    redraw();
    requestAnimationFrame(loop);
  }

  /* ---------- 控件 ---------- */
  const barkInput = document.getElementById('paper-bark');
  const barkValue = document.getElementById('bark-value');
  barkInput?.addEventListener('input', () => {
    barkRatio = Number(barkInput.value);
    if (barkValue) barkValue.textContent = `${barkRatio}%`;
  });

  const linesInput = document.getElementById('paper-lines');
  const linesValue = document.getElementById('lines-value');
  linesInput?.addEventListener('input', () => {
    lineCount = Number(linesInput.value);
    if (linesValue) linesValue.textContent = String(lineCount);
  });

  document.getElementById('reset-paper')?.addEventListener('click', () => {
    step = 'dip';
    resetDeposit();
    evaluate();
    redraw();
    if (hint) hint.classList.remove('is-hidden');
  });

  document.getElementById('save-paper')?.addEventListener('click', () => {
    const out = document.createElement('canvas');
    out.width = canvas.width; out.height = canvas.height;
    out.getContext('2d').drawImage(canvas, 0, 0);
    const a = document.createElement('a');
    a.download = `匠作-宣纸成品-${Date.now()}.png`;
    a.href = out.toDataURL('image/png');
    a.click();
  });

  /* ---------- 启动 ---------- */
  fitCanvas();
  window.addEventListener('resize', fitCanvas);
  window.addEventListener('sim:activate', e => {
    if (e.detail.key === 'paper') requestAnimationFrame(fitCanvas);
  });
  requestAnimationFrame(loop);

  return { redraw };
}
