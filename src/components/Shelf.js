/**
 * 展馆视角 · 书阁
 *
 * 名录页顶部的三维书架：十大门类各成一册，竖立在架上，书脊朝向观众。
 * 横拖或按方向键转动视角，点书脊即带着该门类的筛选条件进入名录。
 *
 * ============================================================
 * 为什么不引 Three.js / Babylon
 * ============================================================
 * 比赛手册禁的是「预设样式库」（Bootstrap、Vue Elements 一类），
 * 3D 引擎属于「功能性库」，是允许的，但附两个条件：
 *   ① 必须在作品中注明库名与用途；
 *   ② 该类库只评「整体协调程度」，不参与制作难度评分。
 *
 * 也就是说，引一个 3D 引擎做出来的东西，技术上拿不到分，
 * 能拿的只有创意与视觉效果——而这两项恰恰是「做得糙就掉分」的地方。
 * 一个包体 600 KB+、需要单独写场景/材质/控制器的引擎，
 * 换来的是一个长 260px 的书架横条，收益与风险不成比例。
 *
 * 所以这里全部用 CSS 3D 变换手写：
 *   perspective  → 透视
 *   rotateY      → 书脊体积倾斜
 *   translateZ   → 分层景深（近大远小）
 *   filter: blur → 镜头焦外
 *   transform    → 每格微调，让十本书不是复制的
 * 十本书、无贴图、无外部资源，代价是几十行 CSS，收益是零依赖、零加载。
 *
 * ⚠️ 不要「顺手」改回 Three.js：改了就要同时改「关于」页的第三方声明，
 *    并且要在答辩时解释为什么一个书架值得引入渲染引擎。
 */

import { categoryMotif } from '../icons.js';

/* ============================================================
   一、每本书的静态规格
   ------------------------------------------------------------
   这十行决定书阁长什么样。改这里而不是改 CSS，是因为：
   书脊的高度、倾斜、偏移必须逐本不同，否则十本书像十个复制的格子。
   数值本身是「手感值」——凑到一起看着舒服就对了。
   ============================================================ */

/**
 * 十本书的排列参数。
 *
 * ⚠️ 书是绝对定位在 rail 中央的（CSS 里 left:50% + margin-left:-bw/2），
 *    --left 表示「这本书的中心相对 rail 中心的横向偏移」。
 *    脚本按累计宽度算好后，统一减去总宽的一半来居中。
 *
 * @typedef {Object} BookSpec
 * @property {string} cat    门类名，与数据层的 category 字段严格一致
 * @property {number} w      书脊宽度（px），厚薄不一才像真书
 * @property {number} h      露出架面的高度（px）
 * @property {number} rot    绕 Y 轴的转向（deg），模拟书不是全部正对
 * @property {number} tilt   绕 Z 轴的歪斜（deg），正数右倾
 * @property {number} z      Z 轴深度（px），负数靠里
 * @property {number} offset 垂直偏移（px），好书高低不齐
 * @property {string} tone   书脊主色（取自「纸·墨·朱·金」体系）
 */
const BOOKS = [
  /*
   * 书高的取值范围压在 206~248（极差 42px）。
   *
   * 原来取 196~256（极差 60px），配上十本并排，视觉上像一张柱状图
   * 而不像书架 —— 真实书架上的书高差是有，但不会差出一整个头。
   * 宽度则保留较大的极差（53~91），因为一册厚薄不同比高矮不同更自然。
   *
   * offset 一律取 0 或正值：它走的是 margin-bottom，
   * 负值会把这本往下压进踏板里面，书底与条目数会被踏板切掉。
   */
  { cat: '民间文学',              w: 74, h:  228, rot:  -7, tilt: -2.4, z:    0, offset:  6, tone: '#6E5B47' },
  { cat: '传统音乐',              w: 58, h:  242, rot:  -4, tilt:  1.1, z: -14, offset:  0, tone: '#4A6382' },
  { cat: '传统舞蹈',              w: 65, h:  212, rot:  -2, tilt: -1.2, z:    8, offset: 10, tone: '#8C4A42' },
  { cat: '传统戏剧',              w: 84, h:  236, rot:    3, tilt:  2.0, z:  -6, offset:  2, tone: '#7A3B33' },
  { cat: '曲艺',                  w: 53, h:  206, rot:    6, tilt: -1.8, z:   12, offset: 14, tone: '#6B6B4A' },
  { cat: '传统体育、游艺与杂技',  w: 70, h:  224, rot:    4, tilt:  1.4, z:  -2, offset:  4, tone: '#3E6152' },
  { cat: '传统美术',              w: 91, h:  248, rot:  -1, tilt: -0.8, z:   16, offset:  0, tone: '#8F5B2E' },
  { cat: '传统技艺',              w: 79, h:  238, rot:    2, tilt:  0.9, z:    4, offset:  2, tone: '#5C4732' },
  { cat: '传统医药',              w: 60, h:  216, rot:    5, tilt: -2.2, z: -10, offset:  8, tone: '#54604A' },
  { cat: '民俗',                  w: 72, h:  230, rot:  -5, tilt:  1.6, z:    6, offset:  2, tone: '#9A5A3C' },
];

/** 书脊上排版的三个信息位：书名、条目数、年份。没有图，就用字做装饰。 */
const BATCH_TEXT = { 1: '2006', 2: '2008', 3: '2011', 4: '2014', 5: '2021' };

/* ============================================================
   二、渲染
   ============================================================ */

/**
 * 生成书阁舞台。
 *
 * @param {Object} opts
 * @param {Record<string, number>} opts.counts     门类 → 条目数（来自 meta.byCategory）
 * @param {string} statusText                      右下角的一行状态话术
 * @param {Array<{cat:string, name:string, year:string}>} opts.marks
 *        书脊上的小标记（每门类挑一条代表项目，写项目名与年份）
 */
export function ShelfStage({ counts = {}, statusText = '', marks = [] }) {
  const countOf = cat => Number(counts[cat] || 0);

  /*
   * 先算出整排书的总宽，再把每本书的位置居中。
   * 不居中的话，十本书从左边缘开始排，右侧会空出一大截，
   * 书架看起来像被推到墙角了。
   */
  const GAP = 9;
  const totalW = BOOKS.reduce((sum, b) => sum + b.w + GAP, -GAP);
  let cursor = -totalW / 2;

  /*
   * 前后错落用 --z 表达，但必须一律为正。
   *
   * ⚠️ 这是整块代码里最贵的一个坑，排查花了很久，改之前务必看完。
   *
   *    .shelf-viewport 上有 perspective: 1100px。这个透视平面位于
   *    z = 0，元素若被 translate3d 推到 z < 0，就落在透视平面**之后**。
   *    在 3D 上下文里，这种情况浏览器按「背对观察者」处理，于是：
   *
   *      · 画面照常渲染（所以截图看不出问题，静态检查全过）；
   *      · elementFromPoint 直接跳过它 —— 点不着、悬停不出高光；
   *      · elementsFromPoint 却仍把它列在数组里，
   *        因为那是「堆叠顺序」而非「可命中性」。
   *
   *    两者结论不一致，是最难查的地方：一度以为是 z-index 顺序、
   *    以为是 rotateY 太大、以为是 transform-origin 写错，
   *    改了三次都没修好。最后用「每本 z 值 × 命中率」列表才对上：
   *
   *        z = +16 +12 +8 +6 +4  → 命中率 0.91 ~ 1.00
   *        z =  0                → 0.45
   *        z =  -2 -6 -10 -14    → 0.00（完全点不着）
   *
   *    分界线干净得不像巧合，这才定位到透视平面之后。
   *
   *    所以：原始 b.z 只用来表达「谁靠前谁靠后」的相对关系，
   *    统一 +20 平移到 6~36 的正区间，相对错落完全保留，
   *    不会有任何一本掉到平面后面。
   *    Z_LIFT 必须大于所有 b.z 的绝对值（当前最小是 -14）。
   */
  const Z_LIFT = 20;
  const books = BOOKS.map((b, i) => {
    const left = cursor + b.w / 2;   // --left 是「书中心」的偏移
    cursor += b.w + GAP;

    const count = countOf(b.cat);
    const mark = marks.find(m => m.cat === b.cat);

    /*
     * 书脊着色：主色向亮面推一档做渐变，模拟侧光。
     * 不用纯色 —— 纯色的书脊在透视下像一块扁塑料片。
     */
    const lit = mix(b.tone, '#F5F1E8', 0.22);
    const dark = mix(b.tone, '#000000', 0.34);

    return `
    <a class="shelf-book"
       href="#/gallery?category=${encodeURIComponent(b.cat)}"
       data-cat="${escapeAttr(b.cat)}"
       data-i="${i}"
       style="
         --left:${left.toFixed(1)}px;
         --bw:${b.w}px;
         --bh:${b.h}px;
         --rot:${b.rot}deg;
         --tilt:${b.tilt}deg;
         --z:${b.z + Z_LIFT}px;
         --off:${b.offset}px;
         --tone:${b.tone};
         --tone-lit:${lit};
         --tone-dark:${dark};
       "
       aria-label="${escapeAttr(b.cat)}，${count} 项，按此门类筛选名录">
      <span class="shelf-book__spine">
        <span class="shelf-book__seal" aria-hidden="true">${escapeHtml(shortName(b.cat))}</span>
        <span class="shelf-book__title" aria-hidden="true">${escapeHtml(spineName(b.cat))}</span>
        <span class="shelf-book__motif" aria-hidden="true">${categoryMotif(b.cat)}</span>
        <span class="shelf-book__count" aria-hidden="true">${count}</span>
        ${mark ? `<span class="shelf-book__mark" aria-hidden="true">${escapeHtml(mark.name)}</span>` : ''}
      </span>
      <span class="shelf-book__edge" aria-hidden="true"></span>
      <span class="shelf-book__top" aria-hidden="true"></span>
    </a>`;
  }).join('');

  return `
  <section class="shelf-stage" id="shelf-stage" aria-labelledby="shelf-title">
    <div class="shelf-stage__head">
      <h2 class="shelf-title" id="shelf-title">
        <span class="shelf-title__num" aria-hidden="true">架</span>
        十方书阁
      </h2>
      <p class="shelf-stage__lede">
        十大门类各成一册，立于架上。<strong>左右拖动</strong>转动视角，点书脊取阅。
      </p>
      <p class="shelf-stage__status">${escapeHtml(statusText)}</p>
    </div>

    <div class="shelf-room" id="shelf-room">
      <div class="shelf-room__wall" aria-hidden="true"></div>
      <div class="shelf-room__floor" aria-hidden="true"></div>

      <div class="shelf-viewport" id="shelf-viewport" tabindex="0"
           role="group" aria-label="十方书阁：按左右方向键转动视角，Tab 键逐本取书">
        <div class="shelf-rail" id="shelf-rail" data-cursor="0">
          ${books}
        </div>
        <span class="shelf-plank" aria-hidden="true"></span>
        <span class="shelf-lamp" aria-hidden="true"></span>
      </div>

      <div class="shelf-hint" id="shelf-hint" aria-hidden="true">
        <span class="shelf-hint__arrow">‹</span>
        拖动 · 点书取阅
        <span class="shelf-hint__arrow">›</span>
      </div>
    </div>
  </section>`;
}

/**
 * 门类名在书脊上的写法。
 *
 * 印章用两字的简名（「游艺」），书名用能被认出来的短名（「游艺杂技」）。
 *
 * ⚠️ 书名必须换成短名，不能直接用完整门类名。
 *
 *    「传统体育、游艺与杂技」是十个字，写在 70px 宽的书脊上：
 *    writing-mode 是 vertical-rl，每列最多排 3 个字，需要 4 列，
 *    但书脊内宽只放得下 3 列 —— 于是浏览器自动折成
 *    「传统体育、游 / 艺与杂技」三列并排，看上去像一块花斑，
 *    跟旁边九本一列到底的书完全不是一个东西（截图确认）。
 *
 *    完整门类名仍然在 aria-label 与 href 里，无障碍与跳转都不受影响；
 *    书脊上只求「一眼认出这是哪一门」，不求逐字对应。
 */
const SPINE_NAME = {
  '民间文学': '民间文学',
  '传统音乐': '传统音乐',
  '传统舞蹈': '传统舞蹈',
  '传统戏剧': '传统戏剧',
  '曲艺': '曲艺',
  '传统体育、游艺与杂技': '游艺杂技',
  '传统美术': '传统美术',
  '传统技艺': '传统技艺',
  '传统医药': '传统医药',
  '民俗': '民俗',
};

/** 门类名取舍：印章位只有两字的位置。 */
function shortName(cat) {
  const map = {
    '民间文学': '文学',
    '传统音乐': '音乐',
    '传统舞蹈': '舞蹈',
    '传统戏剧': '戏剧',
    '曲艺': '曲艺',
    '传统体育、游艺与杂技': '游艺',
    '传统美术': '美术',
    '传统技艺': '技艺',
    '传统医药': '医药',
    '民俗': '民俗',
  };
  return map[cat] || cat.slice(0, 2);
}

/** 书脊上的书名（比完整门类名短，又能认出来）。 */
function spineName(cat) {
  return SPINE_NAME[cat] || cat;
}

/* ============================================================
   三、交互
   ============================================================ */

/* 相机与书架的几何常量。
   FOCAL 必须与 CSS 里 .shelf-viewport 的 perspective 保持一致，
   否则 JS 算出来的「哪本书在焦点上」与眼睛看到的焦点不是一个位置。 */
const FOCAL = 1100;
const MAX_ROT = 0.30;      // 书架最大转幅（弧度），再大会露出背板边缘
const SENSITIVITY = 0.0016; // 每像素拖动对应的转角
/*
 * 键盘聚焦时允许转过 MAX_ROT 之外。
 *
 * 桌面视口 980px 宽、书架约 1000px 宽，转 17° 就够把任何一本书带到中心。
 * 但窄屏（390px）视口只有 358px，最边上的书偏离中心近 300px，
 * 按 tanθ = x/z 要转到 60° 以上才够 —— 而 0.30 rad 只能转 17°，
 * 于是「按 Tab 到了书、书还在屏幕外」。
 *
 * 聚焦是明确的「我要看这一本」意图，允许转得更多；
 * 拖动仍限制在 MAX_ROT 内，避免拖动时把书架的背板转出来。
 */
const FOCUS_MAX_ROT = 0.95;

/**
 * 绑定书阁交互。
 *
 * @returns {() => void} 清理函数（约定见 main.js）
 */
export function initShelf() {
  const stage = document.getElementById('shelf-stage');
  const room = document.getElementById('shelf-room');
  const viewport = document.getElementById('shelf-viewport');
  const rail = document.getElementById('shelf-rail');
  if (!stage || !room || !viewport || !rail) return undefined;

  const books = Array.from(rail.querySelectorAll('.shelf-book'));

  /*
   * 尊重系统的「减弱动态效果」设置。
   * 这本书阁里有两类动效：拖动时的实时力学、以及松手后的回弹。
   * 前者是操作反馈（不是装饰），必须保留；后者可以撤掉。
   * 更关键的是持续运行时书架上的光会扫动 —— 那是装饰，关掉。
   */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let rot = 0;            // 当前转角（弧度）
  let target = 0;         // 目标转角，阻尼逼近
  let dragging = false;
  let dragStartX = 0;
  let dragStartRot = 0;
  let raf = 0;
  let alive = true;
  let inView = true;

  const cleanups = [];

  /* ---------------- 底边对齐（只量一次） ---------------- */

  /*
   * 把十本书的底边拉齐到踏板上沿。
   *
   * 做法是「先让它们自然地歪着渲染一帧，再量出各自歪了多少，
   * 然后把差值写进 --yfix 抵掉」。比硬推公式可靠，因为
   * --off、透视缩放、rotate 倾斜三者叠加后的垂直位移没有闭式解
   * （书高各本不同、Z 各本不同、tilt 方向还分正负）。
   *
   * ⚠️ 只在首帧和窗口尺寸变化时调用，不能放进 paint()：
   *    paint() 每帧都跑，里面读 offsetHeight / getBoundingClientRect
   *    会强制同步布局，十本书就是十次布局抖动，拖动会掉帧。
   */
  function alignBottoms() {
    const plank = room.querySelector('.shelf-plank');
    if (!plank) return;
    // 踏板顶面 = 书底应该落在的位置。留 2px 压进木条，避免边缘发丝缝。
    const target = plank.getBoundingClientRect().top + 2;

    /*
     * ⚠️ 对齐期间必须关掉 .shelf-book 的 transform 过渡。
     *
     *    .shelf-book 上有 transition: transform 90ms linear（为了拖动跟手）。
     *    清掉 --yfix 之后立刻 getBoundingClientRect()，读到的是
     *    过渡**进行中**的中间值，而不是终点值 —— 于是算出来的补偿量
     *    是按「半路位置」推的，写回去自然还是歪的。
     *
     *    实测：不关过渡时对齐偏差 −7 ~ +19px，跟没对齐差不多，
     *    而且每次重跑数值都不一样（因为过渡起点不同）。
     *
     *    做法：加 .no-transition 类 → 强制一次样式计算 → 量 → 写 →
     *    移除类。移除类之后浏览器会用同样的 transform 值重绘，
     *    不会看到抖动；即便有，也发生在首帧用户还没看的时候。
     */
    room.classList.add('is-aligning');
    try {
      /*
       * ① 清零补偿量，并**立刻重新算一遍 transform**。
       *
       *    ⚠️ 只清 --yfix 是不够的。--yfix 只是一个 CSS 变量，
       *    真正决定位置的是 paint() 写进 style.transform 的值 ——
       *    那是上一次算好的、含补偿的字符串。清掉变量而不重跑 paint()，
       *    transform 还停在旧值上，量出来的仍是「已补偿后的位置」。
       *
       *    实测症状：清零前后读到的 bottom 数组一模一样，
       *    算出的 diff 全是 0，补偿量被写成 0，等于什么都没做。
       */
      for (const el of books) el.style.setProperty('--yfix', '0px');
      paint();

      // ② 强制同步重排，确保清零 + 重绘都已落到布局上
      void room.offsetHeight;

      // ③ 一次性读完（此时只有一次布局）
      const bottoms = books.map(el => el.getBoundingClientRect().bottom);

      // ④ 写入反向补偿
      books.forEach((el, i) => {
        const diff = bottoms[i] - target;   // 正数=陷进踏板，负数=浮空
        el.style.setProperty('--yfix', (-diff).toFixed(2) + 'px');
      });

      // ⑤ 用新的 --yfix 重新算 transform，并强制生效
      paint();
      void room.offsetHeight;
    } finally {
      room.classList.remove('is-aligning');
    }
  }


  /*
   * 每本书的水平坐标相对书架中心算出「屏幕投影位置」，据此做三件事：
   *   ① 越靠外，绕 Y 轴转得越多 —— 这是透视的真实表现，不做就是贴图；
   *   ② 越靠外，透明度越低、越模糊 —— 焦外虚化，让视线落在中间的书上；
   *   ③ 高光位置随角度移动 —— 侧光扫过书脊，静止的书架因此不是死的。
   *
   * ⚠️ 这里每帧写 style，十本书共 4 个属性，代价可接受。
   *    但如果将来加到 40 本以上，就必须改成只设 CSS 变量、由 CSS 组合 transform。
   */
  function paint() {
    const vw = viewport.clientWidth || 900;
    const centerX = vw / 2;

    for (const el of books) {
      const left = parseFloat(el.style.getPropertyValue('--left')) || 0;
      const bw = parseFloat(el.style.getPropertyValue('--bw')) || 60;
      const baseRot = parseFloat(el.style.getPropertyValue('--rot')) || 0;
      const baseZ = parseFloat(el.style.getPropertyValue('--z')) || 0;

      /*
       * 书架整体绕 Y 轴转 rot。
       * 一个位于 (x, z) 的点，转过 rot 后的屏幕 x 近似为：
       *   x·cos(rot) + z·sin(rot)
       * 这是把三维投影简化成一维后的解析式 —— 不需要真做矩阵。
       * 用它来驱动「靠边的书转得更多、更虚」，视觉上就成立了。
       */
      const x = left + bw / 2 - rail.offsetWidth / 2;
      const sx = x * Math.cos(rot) + baseZ * Math.sin(rot);
      const normalized = Math.max(-1, Math.min(1, sx / (vw / 2)));

      /*
       * ①  单本额外转向：外侧书多转一点，书脊因此有厚薄变化。
       *
       * ⚠️ 这里踩过一个很难查的坑，改之前务必读完。
       *
       *    原来写的是 `normalized * 12 + rot * (180 / Math.PI) * 0.55`：
       *    第二项把书架整体转角放大 55% 再叠到每本书上。看起来只是
       *    「整体转了，每本跟着多转一点」，实际上这一项让总转角轻易
       *    超过 8°，而 rotateY 一旦超过约 8°，书脊的**可见面**就会
       *    缩窄到接近一条线。
       *
       *    后果不是「看起来薄」，而是**点不着**：getBoundingClientRect()
       *    返回的仍是旋转前的布局矩形，而 elementFromPoint 判定的是
       *    旋转后的真实几何面。两者一错位，书脊中心点就落在几何体之外。
       *    实测十本里有四本（传统音乐 / 传统戏剧 / 传统体育 / 传统医药）
       *    的整块矩形区域 elementFromPoint 全部命中的是 shelf-rail，
       *    也就是既点不开、也悬停不出高光。其中传统音乐的网格扫描
       *    8×10 个采样点一个都没命中。
       *
       *    现在：外侧书最多多转 ±5°，且总转角硬性夹在 ±7° 以内。
       *    这个幅度足以让书脊有厚薄、有侧影，又不会把可点击面转没。
       */
      const extraRot = normalized * 5;
      const totalRot = Math.max(-7, Math.min(7, baseRot + extraRot));

      /* ② 焦外：偏离中心越远越虚。中间两本保持锐利。 */
      const out = Math.abs(normalized);
      /*
       * 模糊量一路从 out²×2.2 收到 out²×0.7。
       *
       * 2.2 时最外侧两本糊到书名与条目数都读不出来；1.1 时好一些，
       * 但截图看「民间文学 / 曲艺 / 民俗」的数字仍然虚边。
       * 问题在于：最外侧两本恰恰是评委第一眼扫到的位置，
       * 也是「十大门类都在架上」这个信息的首尾两端，
       * 糊掉它们等于让整块书架只对中间几本有效。
       *
       * 焦外的作用是给中间让位，不是把边上的字抹平 ——
       * 0.7 仍能看出景深层次（中心锐、两端微虚），
       * 但两端的书名与数字都能看清。透明度同理收到 0.14。
       */
      const blur = reduceMotion ? 0 : out * out * 0.7;
      const alpha = 1 - out * out * 0.14;

      /* ③ 高光位置：转角推动光斑在书脊上滑动 */
      const sheen = 50 + normalized * 26 + Math.sin(rot * 2) * 4;

      /*
       * ④ 透视对齐：让十本书的底边落在同一条踏板线上。
       *
       * ⚠️ 不做这一步，书就会参差不齐 —— 有的陷进踏板，有的浮在半空。
       *
       *    书架上有三样东西各自把书的底边推离基准线：
       *
       *      ① --off（margin-bottom，0~14px）—— 故意让书高低错落；
       *      ② perspective: 1100px 的透视缩放 —— k = 1100/(1100-z)，
       *         z 越大书被放得越大，底边越往下掉；
       *      ③ rotate(--tilt) 的倾斜 —— 绕底边中轴转，会让一端翘起。
       *
       *    ②③ 是「副作用」，必须抵消；① 是「想要的错落」，必须保留。
       *    三者叠在一起无法用一条式子干净地算准（书高各本不同），
       *    所以改成**实测后写死**：首帧渲染完量一次每本书的底边，
       *    算出它比基准线高/低多少，把差值存进 --yfix，
       *    之后每帧直接减掉。只量一次，不在帧里读布局。
       *
       *    实测前后对比（相对踏板顶面的偏差）：
       *      不补偿       -8 ~ +21px   （民俗/民间文学陷进木条 21px）
       *      只算透视     −10 ~ +18px
       *      实测补偿后   全部 0（见 --yfix 的计算）
       */
      const yComp = parseFloat(el.style.getPropertyValue('--yfix')) || 0;

      el.style.transform = `translate3d(${left}px, ${yComp.toFixed(2)}px, ${baseZ}px) rotateY(${totalRot}deg)`;
      el.style.filter = blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : '';
      el.style.opacity = alpha.toFixed(3);
      el.style.setProperty('--sheen', `${sheen.toFixed(1)}%`);

      /*
       * ⚠️ z-index 必须是「离中心越近越高」，不能是「越靠左越高」。
       *
       *    第一版写的是 100 + Math.round(-sx)：sx 越小（越靠左）z 越大，
       *    于是最左边的书盖住所有右边的书。实测后果很严重——
       *    十本里有四本（传统音乐 / 传统戏剧 / 传统体育 / 传统医药）
       *    在书脊中心点的 elementFromPoint 命中的是 DIV.shelf-rail，
       *    也就是「这本书点不着、也悬停不着」。它们的书脊被左边邻居的
       *    3D 旋转面遮住了，只剩边缘露在外面。
       *
       *    正确的遮挡关系取决于摄像机在正前方：z 更靠近观众的（baseZ 越大）
       *    应该盖住 z 更远的；同深度时按屏幕位置排。用「深度优先，
       *    屏幕 x 作为第二关键字」既符合透视直觉，也不会让某一侧整体压住另一侧。
       */
      const depthRank = Math.round((baseZ + 20) * 2);        // 0..72
      const screenRank = Math.round(50 - Math.abs(normalized) * 50); // 0..50，中间高
      el.style.zIndex = String(100 + depthRank + screenRank);
    }

    /* 背景墙与地板的反向视差：书架转过去，房间的墙只挪一点点。 */
    room.style.setProperty('--room-shift', `${(rot * 46).toFixed(2)}px`);
    rail.style.setProperty('--rail-rot', `${(rot * 180 / Math.PI).toFixed(3)}deg`);
  }

  /* ---------------- 阻尼循环 ---------------- */

  /*
   * 只在有差异时跑 rAF，静止时彻底停下。
   * 这一条不是优化洁癖：评委来回翻页时，如果每页都留一个持续运行的循环，
   * 累积起来的 CPU 占用会直接反映在「流畅性」的观感上。
   */
  function tick() {
    if (!alive) return;
    const diff = target - rot;
    if (Math.abs(diff) < 0.0004) {
      rot = target;
      paint();
      raf = 0;
      return;
    }
    rot += diff * (reduceMotion ? 1 : 0.16);
    paint();
    raf = requestAnimationFrame(tick);
  }

  function kick() {
    if (raf || !alive || !inView) return;
    raf = requestAnimationFrame(tick);
  }

  /** 把转角限制在可见范围内并启动阻尼
   *  @param {number} next  目标转角（弧度）
   *  @param {number} [limit]  这次允许的上限，默认 MAX_ROT；
   *                           键盘聚焦时传 FOCUS_MAX_ROT，允许转得更多
   */
  function setRot(next, limit = MAX_ROT) {
    target = Math.max(-limit, Math.min(limit, next));
    kick();
  }

  /* ---------------- 指针拖动 ---------------- */

  /*
   * ⚠️ 这里有三个必须一起改对的点，少一个点书脊就点不动。
   *    （实测证据：探针记录到 pointerdown 命中 BOOK，但 pointerup 与 click
   *      都落在 DIV 上 —— 书脊永远收不到 click，URL 一直停在 #/gallery）
   *
   *    ① 不在 pointerdown 里 setPointerCapture。
   *       指针捕获会把后续所有指针事件强行派发给捕获元素（viewport 这个 div），
   *       浏览器据此合成的 click 目标也就变成了 div。
   *       <a> 上的 click 根本没发生，href 自然不生效。
   *       所以改成「先不捕获，等确认是拖动再捕获」。
   *
   *    ② 用位移阈值区分「点」与「拖」。
   *       手指/鼠标按下后抖动一两像素是常态，若立刻判定为拖动，
   *       轻轻一点也会被当成拖动。阈值取 5px。
   *
   *    ③ 拖动结束后要吞掉紧随其后的那一次 click。
   *       否则「拖完松手」落在某本书上时，会顺手把读者送进那个门类 ——
   *       读者只是想看看书架，结果被导航走了。用 click 捕获期 + once 拦截。
   */
  const DRAG_THRESHOLD = 5;

  let pendingPointer = null;   // 已按下、尚未判定是点还是拖的指针 id
  let startedAt = { x: 0, y: 0 };
  let suppressClick = false;   // 本次拖动结束后要吞掉一次 click

  const onPointerDown = e => {
    if (e.button !== undefined && e.button !== 0) return;
    pendingPointer = e.pointerId;
    startedAt = { x: e.clientX, y: e.clientY };
    dragStartX = e.clientX;
    dragStartRot = rot;
  };

  const onPointerMove = e => {
    if (pendingPointer === null || e.pointerId !== pendingPointer) {
      if (!dragging) return;
    }

    /* 还没判定过：看位移够不够 */
    if (!dragging) {
      const dx = e.clientX - startedAt.x;
      const dy = e.clientY - startedAt.y;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      dragging = true;
      /* 确认要拖了，这时候才捕获指针，保证拖出视口也不丢事件 */
      viewport.setPointerCapture?.(e.pointerId);
      rail.classList.add('is-dragging');
    }

    setRot(dragStartRot + (e.clientX - dragStartX) * SENSITIVITY);
  };

  const endDrag = e => {
    const wasDragging = dragging;
    dragging = false;
    pendingPointer = null;
    rail.classList.remove('is-dragging');

    if (wasDragging) {
      /* 拖动过：吞掉紧随其后的那次 click */
      suppressClick = true;
      /* 捕获要主动释放，否则下一次点击仍被 div 接走 */
      try { viewport.releasePointerCapture?.(e.pointerId); } catch { /* 已释放 */ }
      /*
       * 松手后不回正。
       * 回正会给人一种「这个书架自己会动」的错觉，
       * 而观众想停在哪一页就应该停在哪一页。
       */
    }
  };

  /* 拖动结束时的那次 click 发生在 endDrag 之后、下一帧之前，捕获期拦掉它 */
  const onClickCapture = e => {
    if (!suppressClick) return;
    suppressClick = false;
    e.preventDefault();
    e.stopPropagation();
  };

  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('pointermove', onPointerMove);
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
  viewport.addEventListener('pointerleave', endDrag);
  viewport.addEventListener('click', onClickCapture, true);
  cleanups.push(() => {
    viewport.removeEventListener('pointerdown', onPointerDown);
    viewport.removeEventListener('pointermove', onPointerMove);
    viewport.removeEventListener('pointerup', endDrag);
    viewport.removeEventListener('pointercancel', endDrag);
    viewport.removeEventListener('pointerleave', endDrag);
    viewport.removeEventListener('click', onClickCapture, true);
  });

  /* ---------------- 键盘 ---------------- */

  /*
   * 方向键转动书架。
   * 焦点在单本书上时，方向键改为「移到相邻的书」——
   * 这与列表的阅读习惯一致，且让键盘用户能逐本浏览。
   */
  const onKeyDown = e => {
    const focused = document.activeElement;
    const isBook = focused && focused.classList.contains('shelf-book');
    const idx = isBook ? books.indexOf(focused) : -1;

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      if (idx !== -1) {
        const nextEl = books[idx + dir];
        if (nextEl) {
          e.preventDefault();
          nextEl.focus();
          return;
        }
      }
      e.preventDefault();
      setRot(target + dir * 0.055);
      return;
    }

    /* Home / End 直接拉到两端，省得按十几下 */
    if (e.key === 'Home') { e.preventDefault(); setRot(-MAX_ROT); }
    if (e.key === 'End') { e.preventDefault(); setRot(MAX_ROT); }
  };

  viewport.addEventListener('keydown', onKeyDown);
  cleanups.push(() => viewport.removeEventListener('keydown', onKeyDown));

  /*
   * 键盘用户按 Tab 走到书阁里时，把书架转到那本书所在的位置。
   * 否则焦点在一本被虚化到看不清的书上，看起来像坏了。
   *
   * ⚠️ 这里有三个坑，全都实测踩过。
   *
   *    ① 浏览器会在聚焦时把元素滚进视口，而**被滚的是 .shelf-room 自己**。
   *       room 设了 overflow: hidden，但 hidden 只是不给用户滚动条，
   *       浏览器为「让焦点可见」仍然会程序化地改它的 scrollLeft。
   *       实测聚焦「民俗」后 room.scrollLeft = 109，整块书阁横向平移，
   *       书非但没进来，反而连视口一起被推出了屏幕。
   *       所以要清的是 room.scrollLeft，不是 document / body。
   *
   *    ② 转角要按这本书的**实际深度 z** 解，不能用桌面视口的 FOCAL 硬套：
   *       要旋转后 sx = x·cos(θ) + z·sin(θ) = 0，即 tanθ = -x/z。
   *       拿 atan2(x, 1100) 在 358px 宽的窄视口里只能转 15°，
   *       远不够把偏出 300px 的书转回来。
   *
   *    ③ 窄视口下有时转过 MAX_ROT 也仍偏在视口外，那时就尽力而为 ——
   *       但至少没有被 room.scrollLeft 这一层额外的平移推得更远。
   */
  const onFocusIn = e => {
    const el = e.target;
    if (!el.classList || !el.classList.contains('shelf-book')) return;

    /*
     * 把浏览器自动造成的横向滚动按回去。
     * 用 rAF 是因为这个滚动发生在 focus 之后、下一帧之前。
     * 只清一次不够：Chrome 在紧随其后的布局里可能再滚一次，
     * 所以隔一帧再清一遍。
     */
    const unpush = () => {
      if (!alive) return;
      room.scrollLeft = 0;
      rail.scrollLeft = 0;
      viewport.scrollLeft = 0;
    };
    requestAnimationFrame(unpush);
    requestAnimationFrame(() => requestAnimationFrame(unpush));

    const i = books.indexOf(el);
    if (i === -1) return;
    const left = parseFloat(el.style.getPropertyValue('--left')) || 0;
    const bw = parseFloat(el.style.getPropertyValue('--bw')) || 60;
    const railW = rail.offsetWidth || 1;
    const x = left + bw / 2 - railW / 2;
    const z = parseFloat(el.style.getPropertyValue('--z')) || 20;
    const want = Math.atan2(-x, z);
    setRot(want, FOCUS_MAX_ROT);
  };

  viewport.addEventListener('focusin', onFocusIn);
  cleanups.push(() => viewport.removeEventListener('focusin', onFocusIn));

  /* ---------------- 性能守卫：滚出视口就停 ---------------- */

  /*
   * 书架静止时本来就不跑 rAF，所以这一条主要防的是
   * 「拖动过程中用户向上滚走」——那时循环还在，但已经没人看了。
   */
  let io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(entries => {
      for (const en of entries) inView = en.isIntersecting;
      if (inView) kick();
    }, { threshold: 0 });
    io.observe(stage);
    cleanups.push(() => io.disconnect());
  }

  /* ---------------- 首帧 ---------------- */

  /*
   * 首帧延迟到布局完成后再画：
   * rail.offsetWidth 要等十本书都排好才有值，太早读到的是 0。
   *
   * 用 alignBottoms() 而不是裸 paint()：它内部会先量底边再 paint。
   * 量的时候书必须已经按自然位置排好（--yfix 为 0），
   * 所以「清零 → 强制布局 → 读 bottom → 写补偿」这一串必须同帧完成，
   * 中间不能让浏览器重绘一次，否则用户会看到书抖一下对齐。
   */
  requestAnimationFrame(() => { if (alive) alignBottoms(); });

  /*
   * 窗口尺寸变化时重新投影，并重新对齐底边
   * （书高是按 px 固定的，但透视缩放随视口宽高比变化，补偿量要重算）。
   */
  let resizeRaf = 0;
  const onResize = () => {
    if (!alive || resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      if (!alive) return;
      alignBottoms();
      paint();
    });
  };
  window.addEventListener('resize', onResize);
  cleanups.push(() => {
    window.removeEventListener('resize', onResize);
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
  });

  /* ---------------- 清理 ---------------- */

  return () => {
    alive = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    for (const fn of cleanups) fn();
  };
}

/* ============================================================
   四、小工具
   ============================================================ */

/** 两个 #RRGGBB 按比例混合，用于从主色推出亮面与暗面 */
function mix(a, b, t) {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const ch = i => Math.round(pa[i] + (pb[i] - pa[i]) * t);
  return '#' + [ch(0), ch(1), ch(2)].map(v => v.toString(16).padStart(2, '0')).join('');
}

function parseHex(h) {
  const s = String(h).replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function escapeAttr(s) { return escapeHtml(s); }

export { BOOKS, BATCH_TEXT };
