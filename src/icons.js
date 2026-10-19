/**
 * 门类纹样：十大门类各一张程序化 SVG 线描图
 *
 * 为什么自己画：官方数据源没有任何配图（mediaStats 里 withImage 为 0），
 * 而评分表「素材质量」一栏上世纪的档位就是「马赛克 2 分 / 表情包 4 分」。
 * 网上随便抓的图既涉及版权，也撑不起「高质量 8 分」。
 * 程序化绘制的好处是：无版权风险、任意缩放不失真、每个门类都有专属图形，
 * 而不是十个方框里塞同一个「文」字。
 *
 * 每张图都是 120×120 的 viewBox，统一用 stroke="currentColor"，
 * 颜色由外层 CSS 控制，因此深浅两套底都能用同一份代码。
 */

/* 卷云纹——传统纹样的基本构件，用于收边与点缀 */
const cloud = (cx, cy, s = 1) =>
  `<path d="M${cx - 14 * s} ${cy} q0 -7 ${7 * s} -7 q0 -7 ${7 * s} 0 q7 0 7 7"
     fill="none" stroke-width="1.1"/>`;

/* 回纹带——青铜与织物上最常见的连续边饰 */
function fretBand(y, w = 120, step = 12) {
  let d = '';
  for (let x = 0; x + step <= w; x += step) {
    d += `M${x} ${y + step} V${y} H${x + step} V${y + step}`;
  }
  return `<path d="${d}" fill="none" stroke-width="1"/>`;
}

const PATTERNS = {
  /* 民间文学：翻开的手抄书页，页上是竖排的文字格 */
  '民间文学': () => `
    <path d="M60 26 C46 20 30 20 20 24 V96 C30 92 46 92 60 98
             C74 92 90 92 100 96 V24 C90 20 74 20 60 26 Z"
          fill="none" stroke-width="1.4"/>
    <path d="M60 26 V98" stroke-width="1"/>
    ${[0, 1, 2, 3].map(i => `
      <path d="M26 ${40 + i * 13} H52" stroke-width="1" opacity=".75"/>
      <path d="M68 ${40 + i * 13} H94" stroke-width="1" opacity=".75"/>`).join('')}
    ${cloud(60, 16, 0.8)}`,

  /* 传统音乐：编钟一排，长短依次递减 */
  '传统音乐': () => `
    <path d="M14 18 H106" stroke-width="1.4"/>
    <path d="M18 18 V30" stroke-width="1"/><path d="M102 18 V30" stroke-width="1"/>
    ${[0, 1, 2, 3, 4].map(i => {
      const x = 22 + i * 17;
      const h = 44 - i * 5;
      return `<path d="M${x} 30 h12 v${h} h-12 Z" fill="none" stroke-width="1.3"/>
              <path d="M${x + 2} ${30 + h} q4 6 8 0" fill="none" stroke-width=".9"/>`;
    }).join('')}
    <path d="M14 104 H106" stroke-width="1"/>
    ${cloud(60, 112, 0.7)}`,

  /* 传统舞蹈：水袖翻卷的弧线 */
  '传统舞蹈': () => `
    <path d="M22 98 C34 62 52 42 72 40 C92 38 104 52 100 66"
          fill="none" stroke-width="1.5"/>
    <path d="M26 100 C40 70 56 52 76 50 C94 48 104 58 100 70"
          fill="none" stroke-width="1" opacity=".7"/>
    <path d="M100 66 C96 78 84 84 72 82" fill="none" stroke-width="1.2"/>
    <circle cx="72" cy="40" r="3.4" fill="none" stroke-width="1.3"/>
    <path d="M14 104 C40 96 60 108 84 100 C96 96 104 100 106 104"
          fill="none" stroke-width="1" opacity=".6"/>`,

  /* 传统戏剧：脸谱的对称轮廓 */
  '传统戏剧': () => `
    <path d="M60 14 C84 14 96 34 96 58 C96 84 78 106 60 106
             C42 106 24 84 24 58 C24 34 36 14 60 14 Z"
          fill="none" stroke-width="1.5"/>
    <path d="M60 20 V100" stroke-width=".8" opacity=".5"/>
    <path d="M34 44 q12 -8 20 0 q-10 6 -20 0 Z" fill="none" stroke-width="1.2"/>
    <path d="M86 44 q-12 -8 -20 0 q10 6 20 0 Z" fill="none" stroke-width="1.2"/>
    <path d="M44 46 q4 4 10 0" fill="none" stroke-width="1"/>
    <path d="M76 46 q-4 4 -10 0" fill="none" stroke-width="1"/>
    <path d="M60 60 q-6 12 0 18 q6 -6 0 -18 Z" fill="none" stroke-width="1"/>
    <path d="M46 88 q14 8 28 0" fill="none" stroke-width="1.2"/>`,

  /* 曲艺：鼓与板 */
  '曲艺': () => `
    <ellipse cx="60" cy="46" rx="34" ry="14" fill="none" stroke-width="1.4"/>
    <path d="M26 46 V72 C26 80 41 86 60 86 C79 86 94 80 94 72 V46"
          fill="none" stroke-width="1.4"/>
    <path d="M38 50 V78 M60 52 V86 M82 50 V78" stroke-width=".9" opacity=".55"/>
    <path d="M20 100 H100" stroke-width="1"/>
    <path d="M86 96 L104 74" stroke-width="1.6"/>
    <path d="M92 90 L98 96" stroke-width="1.2"/>`,

  /* 传统体育、游艺与杂技：同心圆靶与弓 */
  '传统体育、游艺与杂技': () => `
    <circle cx="60" cy="60" r="42" fill="none" stroke-width="1.5"/>
    <circle cx="60" cy="60" r="28" fill="none" stroke-width="1.1" opacity=".8"/>
    <circle cx="60" cy="60" r="14" fill="none" stroke-width="1.1" opacity=".6"/>
    <circle cx="60" cy="60" r="3.2" fill="currentColor" opacity=".8"/>
    <path d="M14 14 L106 106" stroke-width="1.2"/>
    <path d="M14 14 L26 20 M14 14 L20 26" stroke-width="1.2"/>
    <path d="M96 96 L104 104" stroke-width="2"/>`,

  /* 传统美术：一支笔与一道墨痕 */
  '传统美术': () => `
    <path d="M86 18 L104 36 L50 90 L30 96 L36 76 Z" fill="none" stroke-width="1.4"/>
    <path d="M76 28 L94 46" stroke-width="1"/>
    <path d="M30 96 L20 104" stroke-width="1.4"/>
    <path d="M16 70 C28 56 40 74 50 62 C58 52 70 62 76 56"
          fill="none" stroke-width="1.6" opacity=".72"/>
    <path d="M18 84 C32 72 44 86 58 76" fill="none" stroke-width="1" opacity=".45"/>`,

  /* 传统技艺：榫卯的燕尾榫 */
  '传统技艺': () => `
    <path d="M18 40 H50 L58 52 H78 L86 40 H102 V80 H86 L78 68 H58 L50 80 H18 Z"
          fill="none" stroke-width="1.5"/>
    <path d="M50 40 V80" stroke-width=".8" opacity=".45"/>
    <path d="M78 40 V80" stroke-width=".8" opacity=".45"/>
    <path d="M18 26 H102" stroke-width="1" opacity=".6"/>
    <path d="M18 94 H102" stroke-width="1" opacity=".6"/>
    ${cloud(60, 108, 0.72)}`,

  /* 传统医药：药碾与草药叶 */
  '传统医药': () => `
    <ellipse cx="60" cy="76" rx="38" ry="12" fill="none" stroke-width="1.4"/>
    <path d="M22 76 C22 86 39 92 60 92 C81 92 98 86 98 76"
          fill="none" stroke-width="1.4"/>
    <path d="M60 64 V30" stroke-width="1.4"/>
    <path d="M42 30 H78" stroke-width="1.4"/>
    <path d="M42 30 q-8 -14 0 -18 q8 4 0 18 Z" fill="none" stroke-width="1.1"/>
    <path d="M78 30 q8 -14 0 -18 q-8 4 0 18 Z" fill="none" stroke-width="1.1"/>
    <path d="M60 84 h0" stroke-width="1"/>`,

  /* 民俗：灯笼与流苏 */
  '民俗': () => `
    <path d="M60 12 V22" stroke-width="1.2"/>
    <path d="M34 22 H86" stroke-width="1.4"/>
    <path d="M36 22 C20 40 20 66 36 80 H84 C100 66 100 40 84 22"
          fill="none" stroke-width="1.5"/>
    <path d="M46 24 C40 40 40 62 46 78" fill="none" stroke-width=".9" opacity=".6"/>
    <path d="M74 24 C80 40 80 62 74 78" fill="none" stroke-width=".9" opacity=".6"/>
    <path d="M34 80 H86" stroke-width="1.4"/>
    <path d="M60 80 V108" stroke-width="1.1"/>
    <path d="M52 100 H68" stroke-width="1"/>
    <path d="M54 108 H66" stroke-width="1"/>`,
};

/** 取某个门类的纹样 SVG（内联，不含 <svg> 外层标签） */
export function categoryMotif(cat) {
  const draw = PATTERNS[cat];
  if (!draw) return '';
  return `<svg class="cat-motif" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
    <g stroke="currentColor" stroke-linejoin="round" stroke-linecap="round" fill="none">${draw()}</g>
  </svg>`;
}

export const hasMotif = cat => Boolean(PATTERNS[cat]);

/** 十大门类在首页的排列顺序 */
export const CATEGORY_ORDER = [
  '民间文学', '传统音乐', '传统舞蹈', '传统戏剧', '曲艺',
  '传统体育、游艺与杂技', '传统美术', '传统技艺', '传统医药', '民俗',
];
