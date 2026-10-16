/**
 * 苏绣模拟器 —— 图纸跟随（成品模板）与自由绣
 *
 * 两种模式：
 *   · 图纸模式（默认）：挑一幅成品图纸（梅花 / 荷叶 / 蝴蝶 / 竹子），
 *     按格子落针。每格标出该用的线色与推荐针法，绣满后按
 *     「覆盖度 + 针法契合度」给出品级。
 *   · 自由绣：没有图纸，随手绣，针脚疏密由密度滑块控制。
 *
 * ⚠️ 图纸模式是这一版的重点。早先的版本里 `pattern` 只影响 `drawGuide()`，
 *    落针逻辑完全不理会底稿——于是底稿只是一层背景装饰，用户随便画什么线都行，
 *    整体手感更像「画板」而不是「刺绣」。现在图纸真正参与落针：
 *    拖过的格子会吸附取色，绣对一格才实色，绣满即成作品。
 *
 * 设计依据（真实针法规则，不是随便画线）：
 *   · 平针：短而平行的针脚，沿行进方向排列，针脚长度一致
 *   · 打籽绣：绕线成粒，每针打成一个圆点，密集成簇
 *   · 齐针（缎面）：针脚紧密并排，完全覆盖底料，方向统一
 *   · 锁针：环环相扣的链状，沿路径连续套接
 *
 * 真实感来自四处细节：
 *   1. 丝线有光泽——用线性渐变模拟丝线的反射
 *   2. 针脚有起伏——每一针的角度略有随机，像手绣的微差
 *   3. 底料是素绸——有经纬纹理，且刺绣会略微压暗底料
 *   4. 针法有别——四种针法在画面上留下四种不同的痕迹
 */

import { downloadWork } from './export.js';

const COLOR_HEX = {
  red: '#C0392B', pink: '#D98880', jade: '#7D9B76',
  blue: '#4A6FA5', gold: '#C9A227', ink: '#2C2A26',
};

/** 图纸边框的线型按推荐针法区分：实线铺面、点线成粒、长虚成链 */
const DASH_OF = {
  satin: [],
  flat: [3, 3],
  seed: [1, 3],
  chain: [6, 4],
};

/**
 * 成品图纸。
 *
 * 每格一个字符：'.' 表示留白；其余字符查 `legend` 得线色、查 `stitches` 得推荐针法。
 * 所有行必须等宽（本组均为 16 列），行数 12 —— `parseTemplate()` 里有校验兜底，
 * 改坏会直接抛错，而不是默默画出一幅残缺的图。
 */
const TEMPLATES = {
  plum: {
    label: '梅花',
    note: '五瓣梅花：花瓣用齐针铺满，花心打籽成蕊',
    legend: { r: 'red', p: 'pink' },
    stitches: { r: 'satin', p: 'seed' },
    rows: [
      '................',
      '.....rrrrrr.....',
      '...rrrrrrrrrr...',
      '..rrrrrrrrrrrr..',
      '.rrrrr....rrrrr.',
      'rrrrrr.pp.rrrrrr',
      'rrrrr.pppp.rrrrr',
      'rrrrrr.pp.rrrrrr',
      '.rrrrr....rrrrr.',
      '..rrrrrrrrrrrr..',
      '...rrrrrrrrrr...',
      '.....rrrrrr.....',
    ],
  },
  lotus: {
    label: '莲花',
    note: '莲花：花瓣用齐针铺满，荷叶用平针铺陈',
    legend: { p: 'pink', g: 'jade' },
    stitches: { p: 'satin', g: 'flat' },
    rows: [
      '................',
      '.......pp.......',
      '......pppp......',
      '...pp.pppp.pp...',
      '...pppppppppp...',
      '..pppppppppppp..',
      '..pppppppppppp..',
      '...pppppppppp...',
      '....gggggggg....',
      '..gggggggggggg..',
      '.gggggggggggggg.',
      '..gggggggggggg..',
    ],
  },
  butterfly: {
    label: '蝴蝶',
    note: '翅面用平针，翅斑打籽，中轴锁针',
    legend: { k: 'ink', p: 'pink' },
    stitches: { k: 'flat', p: 'seed' },
    rows: [
      '................',
      '..kk........kk..',
      '.kkkk......kkkk.',
      'kkkkkk....kkkkkk',
      'kkkkkkk..kkkkkkk',
      'kkkkkkkkkkkkkkkk',
      '.kkkkkkkkkkkkkk.',
      '..kkkkkppkkkkk..',
      '...kkkkkkkkkk...',
      '.....kkkkkk.....',
      '......kkkk......',
      '.......kk.......',
    ],
  },
  bamboo: {
    label: '竹子',
    note: '竹竿用平针，竹节以锁针点出',
    legend: { g: 'jade', l: 'jade' },
    stitches: { g: 'flat', l: 'chain' },
    rows: [
      '................',
      '..gg...gg...gg..',
      '..gg...gg...gg..',
      '..ll...ll...ll..',
      '..gg...gg...gg..',
      '..gg...gg...gg..',
      '..ll...ll...ll..',
      '..gg...gg...gg..',
      '..gg...gg...gg..',
      '..ll...ll...ll..',
      '..gg...gg...gg..',
      '..gg...gg...gg..',
    ],
  },
};

export function initEmbroidery() {
  const canvas = document.getElementById('canvas-embroidery');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const hint = document.getElementById('hint-embroidery');
  const countEl = document.getElementById('stitch-count');
  const unitEl = document.getElementById('stitch-unit');
  const noteEl = document.getElementById('template-note');

  /* ---------- 状态 ---------- */
  let mode = 'template';          // 'template' | 'free'
  let templateKey = 'plum';
  let stitch = 'satin';           // 当前针法（图纸模式下会与每格的推荐值比对）
  let thread = 'red';             // 自由绣的线色（图纸模式下由图纸决定）
  let density = 12;

  /** 已绣针脚：[{x1,y1,x2,y2,color,type,...}] */
  let stitches = [];
  /** 已绣格子，键为 'cx,cy' */
  let filled = new Set();

  /** 解析后的图纸：grid[cy][cx] = {color, stitch} | null */
  let grid = [];
  let cols = 0;
  let rows = 0;
  let targetCount = 0;

  /**
   * 针脚数上限。
   *
   * 自由绣密度拉满（22）时 step 只有 11.8px，一次长拖拽就能落上千针；
   * 而撤销只允许退回 60 针，两者不对称会导致内存只增不减。
   * 这里给一个远高于正常手绣量的上限，达到后停止累加——
   * 画面已经密到看不出差别，继续记录只会拖慢重绘。
   */
  const MAX_STITCHES = 4000;
  let drawing = false;
  let last = null;
  let lastCell = null;
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

  /* ---------- 图纸解析与网格几何 ---------- */

  /** 把图纸的字符行解析成二维数组；行宽不一致或出现未定义字符即抛错 */
  function parseTemplate(key) {
    const t = TEMPLATES[key];
    if (!t) throw new Error(`未知图纸：${key}`);
    const width = t.rows[0].length;
    t.rows.forEach((r, i) => {
      if (r.length !== width) {
        throw new Error(`图纸 ${key} 第 ${i + 1} 行宽 ${r.length}，与首行 ${width} 不一致`);
      }
    });
    const g = t.rows.map(row => [...row].map(ch => {
      if (ch === '.') return null;
      const color = t.legend[ch];
      const st = t.stitches[ch];
      if (!color || !st) throw new Error(`图纸 ${key} 出现未定义的字符「${ch}」`);
      return { color, stitch: st };
    }));
    return { grid: g, cols: width, rows: t.rows.length };
  }

  /** 网格几何：格子取正方形，整幅居中，四周留出绣绷的边 */
  function geom() {
    const w = W(), h = H();
    const pad = Math.max(26, Math.min(w, h) * 0.08);
    const size = Math.min((w - pad * 2) / cols, (h - pad * 2) / rows);
    const ox = (w - cols * size) / 2;
    const oy = (h - rows * size) / 2;
    return { size, ox, oy };
  }

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

  /**
   * 图纸底稿。
   *
   * 每一格画出该处的目标线色（淡填），边框线型表示推荐针法——
   * 用户照着格子绣，不必猜。已绣的格子跳过，把画面让给针脚。
   */
  function drawPlan() {
    if (mode !== 'template') return;
    const { size, ox, oy } = geom();
    ctx.save();
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const x = ox + cx * size;
        const y = oy + cy * size;
        const cell = grid[cy][cx];

        if (!cell) {
          // 留白格：只画极淡的格线，让人看清网格边界
          ctx.strokeStyle = 'rgba(138,122,94,0.10)';
          ctx.lineWidth = 0.5;
          ctx.setLineDash([]);
          ctx.strokeRect(x + 0.25, y + 0.25, size - 0.5, size - 0.5);
          continue;
        }
        if (filled.has(`${cx},${cy}`)) continue;

        const hex = COLOR_HEX[cell.color] || '#C0392B';
        ctx.fillStyle = withAlpha(hex, 0.14);
        ctx.fillRect(x, y, size, size);
        ctx.strokeStyle = withAlpha(hex, 0.55);
        ctx.lineWidth = 1;
        ctx.setLineDash(DASH_OF[cell.stitch] || []);
        ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
      }
    }
    ctx.setLineDash([]);
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

  function withAlpha(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* ---------- 画一针 ---------- */
  function paintStitch(s) {
    const hex = COLOR_HEX[s.color] || '#C0392B';
    const ex = !!s.exact;          // 图纸绣：几何已经定好，不再按密度缩放
    ctx.save();
    ctx.lineCap = 'round';

    if (s.type === 'seed') {
      // 打籽：绕线成粒
      const r = ex ? (s.r || 4) : Math.max(1.8, 26 / density);
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
      const r = ex ? Math.max(2.5, (s.w || 2) * 1.7) : Math.max(3, 15 / density) * 1.4;
      ctx.strokeStyle = threadGradient(s.x1, s.y1, s.x2, s.y2, hex);
      ctx.lineWidth = ex ? Math.max(1.2, (s.w || 2) * 0.7) : Math.max(1.6, 20 / density);
      ctx.beginPath();
      ctx.ellipse((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, r, r * 0.72,
        Math.atan2(s.y2 - s.y1, s.x2 - s.x1), 0, Math.PI * 2);
      ctx.stroke();

    } else if (s.type === 'satin') {
      // 齐针：长而紧密的并排针脚
      const k = ex ? 1 : 1.7;
      const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) * k;
      const ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      const ex2 = s.x1 + Math.cos(ang) * len;
      const ey2 = s.y1 + Math.sin(ang) * len;
      const lw = ex ? (s.w || 6) : Math.max(2, 30 / density);
      ctx.strokeStyle = threadGradient(s.x1, s.y1, ex2, ey2, hex);
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(ex2, ey2); ctx.stroke();
      // 缎面高光
      ctx.strokeStyle = 'rgba(255,255,255,0.26)';
      ctx.lineWidth = Math.max(0.6, lw * 0.22);
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1 - 1); ctx.lineTo(ex2, ey2 - 1); ctx.stroke();

    } else {
      // 平针：短促平行的针脚
      const lw = ex ? (s.w || 3) : Math.max(1.4, 18 / density);
      ctx.strokeStyle = threadGradient(s.x1, s.y1, s.x2, s.y2, hex);
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      // 丝线反光
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = Math.max(0.5, lw * 0.3);
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- 重绘 ---------- */
  function redraw() {
    ctx.clearRect(0, 0, W(), H());
    drawCloth();
    drawPlan();
    for (const s of stitches) paintStitch(s);
    if (countEl) {
      countEl.textContent = String(mode === 'template' ? filled.size : stitches.length);
    }
    updateProgress();
  }

  /* ---------- 坐标换算 ---------- */
  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  }

  /** 落点所在的格子；越界返回 null */
  function cellAt(p) {
    if (mode !== 'template') return null;
    const { size, ox, oy } = geom();
    const cx = Math.floor((p.x - ox) / size);
    const cy = Math.floor((p.y - oy) / size);
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return null;
    return { cx, cy };
  }

  /**
   * 两个格子之间的连线（Bresenham）。
   *
   * 快速拖动时 pointermove 的采样点可能跳过好几格，只处理当前格会留下断口。
   * 把两点之间的格子全部补上，绣出来才是连贯的一笔。
   */
  function lineCells(a, b) {
    const out = [];
    let x0 = a.cx, y0 = a.cy;
    const x1 = b.cx, y1 = b.cy;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (let guard = 0; guard < 1024; guard++) {
      out.push([x0, y0]);
      if (x0 === x1 && y0 === y1) break;
      const e2 = err * 2;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
    return out;
  }

  /**
   * 按图纸绣一格。
   *
   * 线色取图纸定的目标色（用户不必逐格换线），针法用当前选中的针法——
   * 与图纸推荐一致才计入「针法契合度」，这是评价里唯一由用户决定的变量。
   */
  function stitchCell(cx, cy) {
    if (mode !== 'template') return false;
    const key = `${cx},${cy}`;
    if (filled.has(key)) return false;
    const cell = grid[cy]?.[cx];
    if (!cell) return false;
    if (stitches.length >= MAX_STITCHES) return false;

    const { size, ox, oy } = geom();
    const x = ox + cx * size;
    const y = oy + cy * size;
    const midX = x + size / 2;
    const midY = y + size / 2;
    const inset = size * 0.12;

    let segs;
    if (stitch === 'seed') {
      segs = [{ x1: midX, y1: midY, x2: midX, y2: midY, r: size * 0.3 }];
    } else if (stitch === 'satin') {
      // 齐针要在格内并排两针，单根粗线会失去针脚感
      const w = size * 0.42;
      const off = size * 0.23;
      segs = [
        { x1: midX - off, y1: y + inset, x2: midX - off, y2: y + size - inset, w },
        { x1: midX + off, y1: y + inset, x2: midX + off, y2: y + size - inset, w },
      ];
    } else if (stitch === 'chain') {
      segs = [{ x1: x + inset, y1: midY, x2: x + size - inset, y2: midY, w: Math.max(1.6, size * 0.12) }];
    } else {
      segs = [{ x1: x + inset, y1: y + size - inset, x2: x + size - inset, y2: y + inset, w: Math.max(1.5, size * 0.16) }];
    }

    const fit = cell.stitch === stitch;
    for (const sg of segs) {
      stitches.push({ ...sg, color: cell.color, type: stitch, exact: true, fit, cell: key });
    }
    filled.add(key);
    return true;
  }

  /* ---------- 自由绣的落针逻辑 ---------- */
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
      if (stitches.length >= MAX_STITCHES) break;   // 保护：见 MAX_STITCHES 注释
      const x1 = from.x + Math.cos(ang + jitterA) * d;
      const y1 = from.y + Math.sin(ang + jitterA) * d;
      const len = step * (stitch === 'satin' ? 1.9 : 0.86) * jitterL;
      const x2 = x1 + Math.cos(ang + jitterA) * len;
      const y2 = y1 + Math.sin(ang + jitterA) * len;
      stitches.push({ x1, y1, x2, y2, color: thread, type: stitch });
    }
    return true;
  }

  /* ---------- 进度与评价 ---------- */
  function rankOf(coverPct, fitPct) {
    if (coverPct < 0.999) return coverPct >= 0.6 ? '绣制中' : '未完成';
    if (fitPct >= 0.99) return '上品 · 针针合谱';
    if (fitPct >= 0.85) return '中品 · 略有出入';
    return '下品 · 针法多误';
  }

  function updateProgress() {
    const bar = document.getElementById('emb-progress');
    const wrap = document.getElementById('emb-progress-bar');
    const covered = document.getElementById('emb-covered');
    const fitEl = document.getElementById('emb-stitchfit');
    const rankEl = document.getElementById('emb-rank');
    if (unitEl) unitEl.textContent = mode === 'template' ? '格' : '针';

    if (mode !== 'template') {
      if (bar) bar.style.width = '0%';
      if (wrap) wrap.setAttribute('aria-valuenow', '0');
      if (covered) covered.textContent = '自由创作';
      if (fitEl) fitEl.textContent = '—';
      if (rankEl) rankEl.textContent = '不限针法';
      return;
    }

    const done = filled.size;
    const coverPct = targetCount ? done / targetCount : 0;
    // 一格可能落了不止一针（齐针是并排两针），所以按「格子」统计而不是按针脚，
    // 否则契合度会算成 190% 这种荒唐值
    const fitCells = new Set(
      stitches.filter(s => s.exact && s.fit).map(s => s.cell),
    ).size;
    const fitPct = done ? fitCells / done : 0;

    if (bar) bar.style.width = `${Math.round(coverPct * 100)}%`;
    if (wrap) wrap.setAttribute('aria-valuenow', String(Math.round(coverPct * 100)));
    if (covered) covered.textContent = `${done} / ${targetCount} 格`;
    if (fitEl) fitEl.textContent = done ? `${Math.round(fitPct * 100)}%` : '—';
    if (rankEl) rankEl.textContent = rankOf(coverPct, fitPct);
  }

  /* ---------- 模式与图纸切换 ---------- */

  function syncLocks() {
    document.querySelectorAll('[data-lock="template"]').forEach(el => {
      const locked = mode === 'template';
      el.classList.toggle('is-locked', locked);
      el.querySelectorAll('button, input').forEach(c => { c.disabled = locked; });
    });
  }

  function setStitch(type) {
    stitch = type;
    document.querySelectorAll('[data-stitch]').forEach(b => {
      const on = b.dataset.stitch === type;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', String(on));
    });
  }

  function setTemplate(key) {
    mode = key === 'free' ? 'free' : 'template';
    templateKey = key;
    stitches = [];
    filled = new Set();
    last = null;
    lastCell = null;

    if (mode === 'template') {
      const parsed = parseTemplate(key);
      grid = parsed.grid;
      cols = parsed.cols;
      rows = parsed.rows;
      targetCount = grid.reduce((n, row) => n + row.filter(Boolean).length, 0);
      // 针法自动跟随图纸的第一格，用户不必先去猜该用哪种
      const first = grid.flat().find(Boolean);
      if (first) setStitch(first.stitch);
      if (noteEl) noteEl.textContent = TEMPLATES[key].note;
    } else {
      grid = [];
      cols = 0;
      rows = 0;
      targetCount = 0;
      if (noteEl) noteEl.textContent = '自由绣：没有图纸，按住拖动随手绣，疏密由密度控制';
    }

    syncLocks();
    redraw();
    if (hint) hint.classList.remove('is-hidden');
  }

  /* ---------- 事件 ---------- */
  function onDown(e) {
    e.preventDefault();
    drawing = true;
    if (hint) hint.classList.add('is-hidden');
    const p = pos(e);
    last = p;

    if (mode === 'template') {
      const c = cellAt(p);
      lastCell = c;
      if (c && stitchCell(c.cx, c.cy)) redraw();
      return;
    }
    lastCell = null;
  }

  function onMove(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = pos(e);

    if (mode === 'template') {
      const c = cellAt(p);
      if (!c) return;
      let changed = false;
      // 补上两点之间被采样跳过的格子，绣出来才是连贯的一笔
      for (const [cx, cy] of lineCells(lastCell || c, c)) {
        if (stitchCell(cx, cy)) changed = true;
      }
      lastCell = c;
      if (changed) redraw();
      return;
    }

    if (last && addStitch(last, p)) {
      // 打籽/锁针从落点继续；平针/齐针以当前点为新起点
      last = p;
      redraw();
    }
  }

  function onUp() { drawing = false; last = null; lastCell = null; }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointerleave', onUp);
  canvas.addEventListener('pointercancel', onUp);
  // 触摸时阻止页面滚动
  canvas.style.touchAction = 'none';

  /* ---------- 控件 ---------- */
  document.querySelectorAll('[data-template]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-template]').forEach(b => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', String(on));
      });
      setTemplate(btn.dataset.template);
    });
  });

  document.querySelectorAll('[data-stitch]').forEach(btn => {
    btn.addEventListener('click', () => setStitch(btn.dataset.stitch));
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

  const densityInput = document.getElementById('stitch-density');
  const densityValue = document.getElementById('density-value');
  if (densityInput) {
    densityInput.addEventListener('input', () => {
      density = Number(densityInput.value);
      if (densityValue) densityValue.textContent = String(density);
    });
  }

  document.getElementById('undo-embroidery')?.addEventListener('click', () => {
    if (!stitches.length) return;
    if (mode === 'template') {
      // 图纸模式下一格可能落了不止一针（齐针是并排两针），要整格退回
      const cell = stitches[stitches.length - 1].cell;
      stitches = stitches.filter(s => s.cell !== cell);
      if (cell) filled.delete(cell);
    } else {
      // 自由绣：一次拖动会产生多针，撤销时一次撤一组
      const before = stitches.length;
      const type = stitches[before - 1]?.type;
      let n = 1;
      while (stitches.length - n > 0 && stitches[stitches.length - n - 1]?.type === type && n < 60) n += 1;
      stitches = stitches.slice(0, Math.max(0, before - n));
    }
    redraw();
  });

  document.getElementById('clear-embroidery')?.addEventListener('click', () => {
    stitches = [];
    filled = new Set();
    redraw();
    if (hint) hint.classList.remove('is-hidden');
  });

  document.getElementById('save-embroidery')?.addEventListener('click', () => {
    // 导出为 PNG：绣布、绣品与作品信息一起存下来
    const label = mode === 'template' ? TEMPLATES[templateKey].label : '自由绣';
    const progress = mode === 'template'
      ? `已绣 ${filled.size} / ${targetCount} 格`
      : `已绣 ${stitches.length} 针`;
    downloadWork(canvas, {
      title: `苏绣 · ${label}`,
      note: `匠作 · 非物质文化遗产数字展馆　${progress}`,
    });
  });

  /* ---------- 启动 ---------- */
  setTemplate(templateKey);
  fitCanvas();
  const onActivate = e => {
    if (e.detail.key === 'embroidery') requestAnimationFrame(fitCanvas);
  };
  window.addEventListener('resize', fitCanvas);
  window.addEventListener('sim:activate', onActivate);

  // 本模拟器没有常驻动画循环（只在交互时重绘），
  // 但 window 上的监听器仍须摘掉——否则每访问一次就多留一份。
  return {
    redraw,
    dispose() {
      window.removeEventListener('resize', fitCanvas);
      window.removeEventListener('sim:activate', onActivate);
    },
  };
}
