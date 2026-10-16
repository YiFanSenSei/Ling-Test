/**
 * 榫卯模拟器 —— 燕尾榫 / 直榫 / 格肩榫
 *
 * ⚠️ 这一版是**重写**，不是修补。旧版有两个硬伤：
 *
 *   ① 落位是「突变」的。松手时 snapIfClose() 把 pos 直接置零并翻 seated，
 *      木块在某一帧凭空跳到目标位。根因是渲染基准点 baseX 会随 seated 在
 *      restX 与咬合位之间跳变，而判定读的是 pos 本身——两者原点不一致，
 *      视觉与逻辑永远对不上，最后只能靠瞬移收场。
 *
 *   ② 固定二维侧视看不出榫卯的原理。榫头是立体的、卯眼是腔体，咬合发生在
 *      三维空间里；二维侧视只能看到一个矩形轮廓，梯形斜面怎么卡住、
 *      榫头推进去多少，全都看不见。
 *
 * 现在改成：**等轴测三维 + 可旋转视角 + 母件剖切 + 沿轴连续滑入**。
 *   · 构件是真的三维挤出体，按面法线做明暗，按深度排序绘制。
 *   · 母件沿 y 剖开，露出卯眼腔体——梯形剖面直接看得见。
 *   · 子件只有一个自由度：沿榫卯轴向滑动。拖动位移会被投影到轴线上，
 *     垂直于轴的分量不产生推进——这正是榫卯的「方向性」。
 *   · 松手不回弹、不瞬移。推到哪就是哪，seated 只是标签。
 */

import { downloadWork } from './export.js';

/* ══════════════ 1. 三维基础 ══════════════ */

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function unit(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/** 正交等轴测相机：yaw 绕 z 轴旋转，pitch 为仰角 */
function makeCam(yawDeg, pitchDeg, scale) {
  const y = (yawDeg * Math.PI) / 180;
  const p = (pitchDeg * Math.PI) / 180;
  const cy = Math.cos(y), sy = Math.sin(y);
  const cp = Math.cos(p), sp = Math.sin(p);
  return {
    cx: 0, cy: 0, scale,
    dir: [cp * cy, cp * sy, sp],            // 原点 → 相机（单位向量）
    right: [-sy, cy, 0],
    up: [-cy * sp, -sy * sp, cp],
    fwd: [-cp * cy, -cp * sy, -sp],         // 相机 → 场景
  };
}

/** 世界点 → [屏幕 x, 屏幕 y, 深度]；深度越大越远，排序时先画大的 */
function proj(pt, cam) {
  return [
    cam.cx + (pt[0] * cam.right[0] + pt[1] * cam.right[1]) * cam.scale,
    cam.cy - (pt[0] * cam.up[0] + pt[1] * cam.up[1] + pt[2] * cam.up[2]) * cam.scale,
    pt[0] * cam.fwd[0] + pt[1] * cam.fwd[1] + pt[2] * cam.fwd[2],
  ];
}

/** Newell 法求多边形法线；顶点按外法线右手序给出时结果即为外法线 */
function faceNormal(pts) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

/* ══════════════ 2. 挤出体 ══════════════ */
/**
 * 所有实体都是「二维截面 + 挤出」。约定：截面必须按右手定则给成朝向正确的
 * 环形（extrudeX 用 y-z 截面、extrudeZ 用 x-y 截面），这样每个侧面的外法线
 * 可以直接由顶点顺序定出来。
 *
 * ⚠️ 不要改用「质心法」去翻面——母件带卯眼凹槽，是非凸体，质心法会把
 *    凹槽内壁的法线翻到错误的一侧，凹槽会看起来像凸起。
 */

function extrudeX(section, x0, x1, opt = {}) {
  const out = [];
  const P = (x, s) => [x, s[0], s[1]];
  const n = section.length;
  const cut = opt.cutEdges || [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    out.push({
      pts: [P(x0, section[i]), P(x0, section[j]), P(x1, section[j]), P(x1, section[i])],
      kind: cut.includes(i) ? 'cut' : 'wood',
      tone: opt.tone, grain: opt.grain || [1, 0, 0], mov: opt.mov,
    });
  }
  out.push({ pts: section.map(s => P(x0, s)).reverse(), kind: 'wood', tone: opt.tone, mov: opt.mov });
  out.push({ pts: section.map(s => P(x1, s)), kind: 'wood', tone: opt.tone, mov: opt.mov });
  return out;
}

function extrudeZ(section, z0, z1, opt = {}) {
  const out = [];
  const P = (s, z) => [s[0], s[1], z];
  const n = section.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    out.push({
      pts: [P(section[i], z0), P(section[j], z0), P(section[j], z1), P(section[i], z1)],
      kind: 'wood', tone: opt.tone, grain: opt.grain || [1, 0, 0], mov: opt.mov,
    });
  }
  out.push({ pts: section.map(s => P(s, z0)).reverse(), kind: 'wood', tone: opt.tone, mov: opt.mov });
  out.push({ pts: section.map(s => P(s, z1)), kind: opt.cutTop === false ? 'wood' : 'cut', tone: opt.tone, mov: opt.mov });
  return out;
}

/* ══════════════ 3. 场景：三种榫卯 ══════════════ */

const TONE_A = [176, 143, 98];   // 母件：略深
const TONE_B = [198, 166, 118];  // 子件：略浅

/**
 * 燕尾榫 / 直榫：榫条沿槽滑入。
 *
 * 母件顶面开一条沿 x 的槽，子件是一条带榫舌的木条，从 +x 端滑入。
 * 剖切面取 y = 槽底前沿，正好把槽的前壁整片切掉，于是槽腔敞开、
 * 梯形剖面一览无余。
 *
 *   燕尾：槽口窄（±20）、槽底宽（±30）——梯形，提起会被卡住。
 *   直榫：槽壁垂直（±24）——方形，提起来就能脱开。
 */
function buildGrooveJoint(kind) {
  const faces = [];
  const dove = kind === 'dovetail';
  const hwTop = dove ? 20 : 24;    // 槽口半宽
  const hwBot = dove ? 30 : 24;    // 槽底半宽
  const CUT = -hwBot;              // 剖切面：切掉槽的前壁
  const BACK = 36;                 // 母件背面（剖切后剩余的进深）
  const zBot = -20;                // 槽底
  const BL = 140, GL = 120;        // 母件长 / 槽深（盲槽，到 x=-120 为止）

  // 母件：未开槽的实心段（x ∈ [-140,-120]）
  const solid = [[CUT, -36], [BACK, -36], [BACK, 0], [CUT, 0]];
  faces.push(...extrudeX(solid, -BL, -GL, { tone: TONE_A, cutEdges: [3] }));
  // 母件：开槽段（x ∈ [-120,0]）
  const grooved = [[CUT, -36], [BACK, -36], [BACK, 0], [hwTop, 0], [hwBot, zBot], [CUT, zBot]];
  faces.push(...extrudeX(grooved, -GL, 0, { tone: TONE_A, cutEdges: [5] }));

  // 子件：榫条（整块，不剖）。榫舌比槽略小 0.8，避免共面闪烁。
  // ⚠️ 条身刻意做得窄（±13）——太宽的话插进去会把槽口整个盖住，
  //    就看不见「榫舌在槽里」这件事了，而这正是要给人看的东西。
  const c = 0.8;
  const rail = [
    [CUT, zBot + c], [hwBot - c, zBot + c], [hwTop - c, 0], [13, 0],
    [13, 40], [-13, 40], [-13, 0], [-hwTop + c, 0],
  ];
  const TRAVEL = 190;
  faces.push(...extrudeX(rail, -GL + TRAVEL, TRAVEL, { tone: TONE_B, mov: true }));

  return {
    faces,
    labels: [
      { p: [-88, 4, 18], text: dove ? '卯眼 · 梯形槽' : '卯眼 · 方槽' },
      { p: [TRAVEL - 52, 0, 54], text: '榫条', mov: true },
    ],
    travel: TRAVEL,
    // 提拉上限：燕尾被梯形锁住，只抬得起一点点（约 4 个单位，肉眼近乎不动）；
    // 直榫要抬过槽口（槽底 z = -20）才算真的脱出，所以给到 30。
    liftMax: dove ? 4 : 30,
    retains: dove,          // 燕尾防脱，直榫不防脱
    view: { yaw: -45, pitch: 30 },
    hint: dove
      ? '燕尾榫的槽口窄、槽底宽，只能沿槽的轴向滑进去；插到底以后往上提是提不动的——梯形把它锁住了。'
      : '直榫的槽壁是垂直的：能滑进去，也能直接提出来。它不防脱，靠的是胶与木材的摩擦。',
  };
}

/**
 * 格肩榫：45 度格肩的转角。
 *
 * 横枨（子件，沿 x）插入立柱（母件，沿 y）。接缝由「外角的 45 度格肩 +
 * 内段的垂直肩」组成，内部还有一根暗榫。
 * 剖切面取 z = -22，把上半层切掉，暗榫与卯眼正好露在剖面上。
 */
function buildMiterJoint() {
  const faces = [];
  const Z0 = -46, Z1 = -22;      // 板厚（已剖）
  const RAIL = [
    [-140, -56], [56, -56], [46, -46], [50, -46],
    [50, -14], [14, -14], [0, 0], [-140, 0],
  ];
  const STILE = [
    [0, -140], [60, -140], [60, -56], [56, -56],
    [46, -46], [50, -46], [50, -14], [14, -14], [0, 0],
  ];
  const TRAVEL = 140;
  // 子件建在「退出位」（整体右移 TRAVEL），渲染时按 -t*TRAVEL 滑回
  const RETRACTED = RAIL.map(([x, y]) => [x + TRAVEL, y]);
  faces.push(...extrudeZ(RETRACTED, Z0, Z1, { tone: TONE_B, mov: true, grain: [1, 0, 0] }));
  faces.push(...extrudeZ(STILE, Z0, Z1, { tone: TONE_A, grain: [0, 1, 0] }));

  return {
    faces,
    labels: [
      { p: [22, -24, Z1 + 4], text: '45° 格肩' },
      { p: [52, -62, Z1 + 4], text: '暗榫 · 卯眼' },
    ],
    travel: TRAVEL,
    liftMax: 3,
    retains: true,          // 暗榫插到底，提不动
    view: { yaw: -54, pitch: 44 },
    hint: '格肩榫要沿构件轴向推入。45 度格肩让转角从外面看是一条斜缝，内部那根暗榫才是受力件。',
  };
}

/* 场景缓存：每种榫卯只构建一次，切换时直接取 */
const sceneCache = new Map();
function sceneOf(joint) {
  if (!sceneCache.has(joint)) {
    const s = joint === 'miter' ? buildMiterJoint() : buildGrooveJoint(joint);
    // 预算面法线 + 包围球（构建在「退出位」，已覆盖全部行程）
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const f of s.faces) {
      f.normal = faceNormal(f.pts);
      for (const p of f.pts) {
        for (let k = 0; k < 3; k++) {
          if (p[k] < min[k]) min[k] = p[k];
          if (p[k] > max[k]) max[k] = p[k];
        }
      }
    }
    s.center = [0, 1, 2].map(k => (min[k] + max[k]) / 2);

    // 取景用「默认视角下的投影半宽/半高」。
    // ⚠️ 不要用包围球：球是按三维对角线算的，而这两个榫卯都是扁长的，
    //    用球会让画面缩成中间一小坨，四周全是空。
    const cam0 = makeCam(s.view.yaw, s.view.pitch, 1);
    const c0 = proj(s.center, cam0);
    let hw = 1, hh = 1;
    for (const f of s.faces) {
      for (const p of f.pts) {
        const q = proj(p, cam0);
        hw = Math.max(hw, Math.abs(q[0] - c0[0]));
        hh = Math.max(hh, Math.abs(q[1] - c0[1]));
      }
    }
    s.halfW = hw;
    s.halfH = hh;
    sceneCache.set(joint, s);
  }
  return sceneCache.get(joint);
}

/* ══════════════ 4. 渲染 ══════════════ */

const EDGE = 'rgba(52,38,22,0.5)';
const GRAIN = 'rgba(88,64,36,0.13)';
const CUT_RGB = [218, 199, 160];        // 剖切面：露出的生木色
const LIGHT = unit([-0.42, -0.52, 0.74]);

function shade(base, n) {
  const k = Math.max(0.3, Math.min(1.14, 0.46 + 0.66 * Math.max(0, dot(n, LIGHT))));
  const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(base[0])},${f(base[1])},${f(base[2])})`;
}

const ease = k => 1 - Math.pow(1 - k, 3);

export function initMortise() {
  const canvas = document.getElementById('canvas-mortise');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const hint = document.getElementById('hint-mortise');

  let joint = 'dovetail';
  let scene = sceneOf(joint);
  let t = 0;              // 插入进度 0..1（唯一的自由度）
  let lift = 0;           // 垂直于轴的「提拉」演示位移
  let seated = false;
  let alive = true;
  let raf = 0;
  let dragging = null;    // { mode:'move'|'orbit', ... }
  const view = { yaw: scene.view.yaw, pitch: scene.view.pitch, zoom: 1 };

  const W = () => Number(canvas.dataset.w) || 900;
  const H = () => Number(canvas.dataset.h) || 640;

  /** 相机：比例按默认视角的投影包围盒定，再把场景中心摆到画布正中 */
  function camNow() {
    const w = W(), h = H();
    const scale = Math.min(w * 0.40 / scene.halfW, h * 0.40 / scene.halfH) * view.zoom;
    const cam = makeCam(view.yaw, view.pitch, scale);
    const c = proj(scene.center, cam);
    cam.cx = w / 2 - c[0];
    cam.cy = h / 2 - c[1];
    return cam;
  }

  const offsetOf = () => [-t * scene.travel, 0, lift];
  const movPt = (p, off) => [p[0] + off[0], p[1], p[2] + off[2]];

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
    render();
  }

  /* ---- 4.1 主绘制 ---- */
  function render() {
    const w = W(), h = H();
    const cam = camNow();
    const off = offsetOf();

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#2E2A24');
    bg.addColorStop(1, '#1E1B17');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = '#6B5236';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 34) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.restore();

    // 收集可见面 → 按深度从远到近画（画家算法）
    const items = [];
    for (const f of scene.faces) {
      if (dot(f.normal, cam.dir) <= 0.02) continue;     // 背面剔除
      const pts = f.mov ? f.pts.map(p => movPt(p, off)) : f.pts;
      const sp = new Array(pts.length);
      let d = 0;
      for (let i = 0; i < pts.length; i++) { sp[i] = proj(pts[i], cam); d += sp[i][2]; }
      items.push({ sp, pts, n: f.normal, kind: f.kind, tone: f.tone, grain: f.grain, d: d / pts.length });
    }
    items.sort((a, b) => b.d - a.d);
    for (const it of items) drawFace(it, cam);

    // 标注（画在最上层，保证一定看得见）
    ctx.font = '600 12px "Songti SC", "SimSun", serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const lb of scene.labels) {
      const p = lb.mov ? movPt(lb.p, off) : lb.p;
      const s = proj(p, cam);
      drawLabel(s[0], s[1], lb.text);
    }

    // 左下角操作提示
    ctx.font = '11px "Songti SC", "SimSun", serif';
    ctx.fillStyle = 'rgba(232,220,196,0.42)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('拖动木件 = 推进 / 拉出　·　拖动空白 = 旋转视角　·　滚轮 = 缩放', 20, h - 18);
  }

  function drawFace(it, cam) {
    const sp = it.sp;
    ctx.beginPath();
    for (let i = 0; i < sp.length; i++) {
      if (i) ctx.lineTo(sp[i][0], sp[i][1]);
      else ctx.moveTo(sp[i][0], sp[i][1]);
    }
    ctx.closePath();
    ctx.fillStyle = shade(it.kind === 'cut' ? CUT_RGB : it.tone, it.n);
    ctx.fill();
    if (it.kind !== 'cut') drawGrain(it, cam);
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }

  /**
   * 程序化木纹：把世界木纹方向投到面所在平面，再按等距平行线铺开，
   * 用面多边形做裁剪。面积太小的面直接跳过——画了也看不见，白费性能。
   */
  function drawGrain(it, cam) {
    const sp = it.sp, pts = it.pts, n = it.n;
    let area = 0;
    for (let i = 0; i < sp.length; i++) {
      const a = sp[i], b = sp[(i + 1) % sp.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    if (Math.abs(area) < 2400) return;

    const g = it.grain || [1, 0, 0];
    const gn = dot(g, n);
    let gp = [g[0] - gn * n[0], g[1] - gn * n[1], g[2] - gn * n[2]];
    const gl = Math.hypot(gp[0], gp[1], gp[2]);
    if (gl < 0.25) return;                 // 木纹垂直于这个面（端面），不铺线
    gp = [gp[0] / gl, gp[1] / gl, gp[2] / gl];
    const wv = cross(n, gp);

    let mn = Infinity, mx = -Infinity;
    const c = [0, 0, 0];
    for (const p of pts) {
      const d = dot(p, wv);
      if (d < mn) mn = d;
      if (d > mx) mx = d;
      c[0] += p[0]; c[1] += p[1]; c[2] += p[2];
    }
    c[0] /= pts.length; c[1] /= pts.length; c[2] /= pts.length;
    const span = mx - mn;
    if (span < 9) return;
    const count = Math.max(1, Math.min(18, Math.round(span / 14)));
    const step = span / count;
    const co = dot(c, wv);

    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < sp.length; i++) {
      if (i) ctx.lineTo(sp[i][0], sp[i][1]);
      else ctx.moveTo(sp[i][0], sp[i][1]);
    }
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = GRAIN;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    const K = 500;
    for (let i = 0; i < count; i++) {
      const o = mn + (i + 0.5) * step - co;
      const bx = c[0] + wv[0] * o, by = c[1] + wv[1] * o, bz = c[2] + wv[2] * o;
      const a = proj([bx - gp[0] * K, by - gp[1] * K, bz - gp[2] * K], cam);
      const b = proj([bx + gp[0] * K, by + gp[1] * K, bz + gp[2] * K], cam);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawLabel(x, y, text) {
    const pad = 8;
    const wd = ctx.measureText(text).width;
    ctx.save();
    ctx.beginPath();
    const r = 12, x0 = x - pad, y0 = y - 12, x1 = x + wd + pad, y1 = y + 12;
    ctx.moveTo(x0 + r, y0);
    ctx.lineTo(x1 - r, y0); ctx.arcTo(x1, y0, x1, y0 + r, r);
    ctx.lineTo(x1, y1 - r); ctx.arcTo(x1, y1, x1 - r, y1, r);
    ctx.lineTo(x0 + r, y1); ctx.arcTo(x0, y1, x0, y1 - r, r);
    ctx.lineTo(x0, y0 + r); ctx.arcTo(x0, y0, x0 + r, y0, r);
    ctx.closePath();
    ctx.fillStyle = 'rgba(28,24,19,0.74)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(201,169,97,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#E8DCC4';
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();
  }

  /* ---- 4.2 状态与动画 ---- */
  function updateState() {
    seated = t >= 0.999 && lift < 0.4;
    const pct = Math.round(t * 100);
    const stateEl = document.getElementById('joint-state');
    const tipEl = document.getElementById('joint-tip');
    const barEl = document.getElementById('joint-progress');
    const wrapEl = document.getElementById('joint-progress-bar');

    if (stateEl) {
      stateEl.textContent = seated ? '已咬合 · 严丝合缝'
        : lift > 0.5 ? (scene.retains ? '被卡住 · 提不动' : '提得动 · 不防脱')
        : t < 0.02 ? '未插入'
        : `插入中 ${pct}%`;
      stateEl.className = `joint-state ${seated ? 'is-ok' : (t > 0.02 ? 'is-near' : '')}`;
    }
    if (barEl) barEl.style.width = `${pct}%`;
    if (wrapEl) wrapEl.setAttribute('aria-valuenow', String(pct));

    if (tipEl) {
      if (lift > 0.5) {
        tipEl.textContent = scene.retains
          ? '提不动——榫舌的梯形斜面被槽口卡死了。这就是燕尾榫「越拉越紧」的道理。'
          : '方榫一提就起来。它不防脱，靠的是胶与木材的摩擦。';
      } else if (seated) {
        tipEl.textContent = scene.hint;
      } else if (t < 0.02) {
        tipEl.textContent = '抓住木件，沿榫卯的轴向推进去。拖空白处可以转视角。';
      } else {
        tipEl.textContent = '继续推进——榫舌正在进入卯眼。';
      }
    }
  }

  /** 通用补间：只跑一条动画，新的会顶掉旧的 */
  function tween(dur, apply, done) {
    cancelAnimationFrame(raf);
    const t0 = performance.now();
    const step = now => {
      if (!alive) return;
      const k = Math.min(1, (now - t0) / dur);
      apply(k);
      render();
      if (k < 1) raf = requestAnimationFrame(step);
      else if (done) done();
    };
    raf = requestAnimationFrame(step);
  }

  /* ---- 4.3 交互 ---- */
  function posOf(e) {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  /** 世界方向向量 → 屏幕单位方向 + 每单位世界长度的像素数 */
  function screenDir(v, cam) {
    const a = proj([0, 0, 0], cam);
    const b = proj(v, cam);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    return { x: len ? dx / len : 0, y: len ? dy / len : 0, len };
  }

  function inPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function hitMoving(px, py, cam, off) {
    for (const f of scene.faces) {
      if (!f.mov || dot(f.normal, cam.dir) <= 0.02) continue;
      if (inPoly(px, py, f.pts.map(p => proj(movPt(p, off), cam)))) return true;
    }
    return false;
  }

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* 老浏览器忽略 */ }
    const [x, y] = posOf(e);
    const cam = camNow();
    if (hitMoving(x, y, cam, offsetOf())) {
      dragging = { mode: 'move', x, y, t0: t, lift0: lift };
    } else {
      dragging = { mode: 'orbit', x, y, yaw0: view.yaw, pitch0: view.pitch };
    }
    if (hint) hint.classList.add('is-hidden');
  });

  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    e.preventDefault();
    const [x, y] = posOf(e);
    const dx = x - dragging.x, dy = y - dragging.y;

    if (dragging.mode === 'orbit') {
      view.yaw = dragging.yaw0 + dx * 0.32;
      view.pitch = Math.max(-8, Math.min(86, dragging.pitch0 + dy * 0.22));
      render();
      return;
    }

    // 移动构件：把指针位移投影到轴线上。
    // 垂直于轴的分量不产生推进——这就是榫卯的方向性，不是没接上。
    const cam = camNow();
    const ax = screenDir([1, 0, 0], cam);
    const az = screenDir([0, 0, 1], cam);

    // ⚠️ 守卫不能写成「ax.len > 4」这样的绝对像素值。
    //    ax.len 是「每单位世界长度占多少屏幕像素」，它随画布尺寸与取景走：
    //    882px 画布上约 2.0、356px 画布上约 0.8——都小于 4，整条拖动会被掐死，
    //    构件看着能抓、却怎么推都不动。要判断的是「轴有没有被投影压扁」，
    //    所以除掉 cam.scale 换成一个无量纲的前缩比。
    const axF = ax.len / cam.scale;
    const azF = az.len / cam.scale;

    const along = dx * ax.x + dy * ax.y;               // 屏幕像素
    if (axF > 0.18) {
      t = Math.max(0, Math.min(1, dragging.t0 - (along / ax.len) / scene.travel));
    }

    // ⚠️ 提拉方向取「屏幕上与轴垂直」的方向，而不是世界 z 轴的投影。
    //    正交投影下世界 x 与 z 在屏幕上并不垂直（默认视角夹角约 63°），
    //    若各自用自己的投影，同一段位移会同时改变 t 与 lift——沿轴往里推
    //    会顺手把构件提起来，状态就错报「被卡住 · 提不动」。取垂直方向后
    //    两者天然解耦：推就是推，提就是提。
    if (axF > 0.18 && azF > 0.18) {
      const gain = az.len * ax.x;                      // 世界 z 位移在这个方向上的像素增益
      if (Math.abs(gain) > 1e-6) {
        const across = -(dx * -ax.y + dy * ax.x);
        lift = Math.max(0, Math.min(scene.liftMax, dragging.lift0 + across / gain));
      }
    }
    updateState();
    render();
  });

  function endDrag() {
    if (!dragging) return;
    const wasMove = dragging.mode === 'move';
    dragging = null;
    if (!wasMove) return;
    if (lift > 0.5) {
      const a = lift;
      tween(220, k => { lift = a * (1 - ease(k)); }, updateState);
    } else if (t > 0.94 && t < 1) {
      // 只补最后那几个百分点，肉眼几乎看不出来——不是「瞬移」
      const a = t;
      tween(150, k => { t = a + (1 - a) * ease(k); }, updateState);
    }
    updateState();
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.style.touchAction = 'none';

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    view.zoom = Math.max(0.6, Math.min(2.2, view.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
    render();
  }, { passive: false });

  /* ---- 4.4 控件 ---- */
  //
  // 四个角度各管一件事，都保持可拖动（前缩比 > 0.18）：
  //   iso   等轴测：默认。母件剖切 + 三维关系一次看全。
  //   front 正视　：沿 y 看，构件长度方向的正投影，看榫舌推进了多少。
  //   axis  端视　：几乎顺着榫卯轴向看。梯形剖面在这里最清楚——「为什么锁得住」
  //                全靠这个角度。⚠️ 不能取 yaw = 0：那样轴向被投影成一个点
  //                （前缩比 0），构件就推不动了。偏开 12 度两头兼顾。
  //   high  俯视　：高角度看槽口的平面形状与榫舌的高度。
  //                ⚠️ 不要取 pitch = 84 那种正俯视：正交投影下会压成一块没有
  //                信息的矩形（咬合之后槽口被榫舌填满，什么都看不出来）。
  const VIEWS = {
    iso: null,                          // null = 用当前榫卯的默认视角
    front: { yaw: -90, pitch: 6 },
    axis: { yaw: -12, pitch: 4 },
    high: { yaw: -68, pitch: 56 },
  };
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = VIEWS[btn.dataset.view] || scene.view;
      const y0 = view.yaw, p0 = view.pitch;
      document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('is-active', b === btn));
      tween(340, k => {
        const e2 = ease(k);
        view.yaw = y0 + (v.yaw - y0) * e2;
        view.pitch = p0 + (v.pitch - p0) * e2;
      });
    });
  });

  document.querySelectorAll('[data-joint]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-joint]').forEach(b => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', String(on));
      });
      joint = btn.dataset.joint;
      scene = sceneOf(joint);
      t = 0; lift = 0; seated = false;
      view.yaw = scene.view.yaw;
      view.pitch = scene.view.pitch;
      view.zoom = 1;
      document.querySelectorAll('[data-view]').forEach((b, i) => b.classList.toggle('is-active', i === 0));
      updateState();
      render();
      if (hint) hint.classList.remove('is-hidden');
    });
  });

  document.getElementById('reset-mortise')?.addEventListener('click', () => {
    t = 0; lift = 0; seated = false;
    updateState();
    render();
    if (hint) hint.classList.remove('is-hidden');
  });

  document.getElementById('auto-mortise')?.addEventListener('click', () => {
    t = 0; lift = 0;
    updateState();
    render();
    tween(1200, k => { t = ease(k); }, () => { t = 1; updateState(); render(); });
  });

  document.getElementById('save-mortise')?.addEventListener('click', () => {
    const label = document.querySelector('[data-joint].is-active .tool-opt-name')
      ?.textContent.trim() || '榫卯';
    const state = document.getElementById('joint-state')?.textContent.trim() || '';
    downloadWork(canvas, {
      title: `榫卯 · ${label}`,
      note: `匠作 · 非物质文化遗产数字展馆${state ? `　${state}` : ''}`,
    });
  });

  /* ---- 4.5 测试接缝 ----
   *
   * 这一版榫卯只有一个自由度：抓住构件、沿轴向推。自动化测试要驱动「真实
   * 拖拽」，就必须知道两件事——构件此刻在屏幕上的哪儿、轴指向屏幕的哪个
   * 方向。两者都随 t 与视角变化，所以做成函数而不是快照。
   *
   * 可抓点取自「面积最大且朝向相机」的那个移动面：挤出体的侧面都是平行
   * 四边形，重心必定落在面内，所以按这个点按下一定抓得住构件——不像写死
   * 一个比例坐标，视角或取景一改就悄悄失效。
   */
  canvas.mortiseHandle = () => {
    const cam = camNow();
    const off = offsetOf();
    let best = null;
    for (const f of scene.faces) {
      if (!f.mov || dot(f.normal, cam.dir) <= 0.02) continue;
      const q = f.pts.map(p => proj(movPt(p, off), cam));
      let a2 = 0, sx = 0, sy = 0;
      for (let i = 0; i < q.length; i++) {
        const a = q[i], b = q[(i + 1) % q.length];
        const cr = a[0] * b[1] - b[0] * a[1];
        a2 += cr;
        sx += (a[0] + b[0]) * cr;
        sy += (a[1] + b[1]) * cr;
      }
      if (!a2) continue;
      const area = Math.abs(a2) / 2;
      if (!best || area > best.area) best = { area, x: sx / (3 * a2), y: sy / (3 * a2) };
    }
    const ax = screenDir([1, 0, 0], cam);
    const az = screenDir([0, 0, 1], cam);
    return {
      x: best ? best.x : W() / 2,
      y: best ? best.y : H() / 2,
      ax: ax.x, ay: ax.y, axLen: ax.len,
      azLen: az.len, scale: cam.scale,
      travel: scene.travel, liftMax: scene.liftMax, retains: scene.retains,
      t, lift,
    };
  };

  /* ---- 4.6 启动 ---- */
  fitCanvas();
  updateState();
  const onActivate = e => {
    if (e.detail.key === 'mortise') requestAnimationFrame(fitCanvas);
  };
  window.addEventListener('resize', fitCanvas);
  window.addEventListener('sim:activate', onActivate);

  return {
    redraw: render,
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fitCanvas);
      window.removeEventListener('sim:activate', onActivate);
    },
  };
}
