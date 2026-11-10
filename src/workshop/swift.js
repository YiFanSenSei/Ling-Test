export const palette = [
  ['靛青', '#335c71'], ['朱红', '#a93d39'], ['竹绿', '#497150'], ['蜜金', '#9b6e2f'],
  ['月白', '#d9d7c1'], ['烟灰', '#6a6c75'],
];
export const legacyPattern = [
  [20, 47, 42, 52], [22, 37, 47, 50], [28, 27, 53, 48],
  [38, 18, 57, 46], [51, 22, 61, 46], [62, 32, 65, 47],
  [84, 35, 67, 51], [87, 48, 64, 55], [78, 61, 59, 57],
  [66, 71, 53, 59], [49, 80, 46, 60], [34, 77, 39, 59],
];

export const swiftParts = [
  { name:'近翅', points:[[163,125],[143,92],[109,66],[70,47],[40,37],[16,43],[41,54],[64,75],[95,108],[123,128],[149,144]],
    guide:[[55,61],[127,109]], center:[98,87], tint:'#9aa9a2', tip:'沿翅根到翼尖的长向走针。套针可以让羽片一层压着一层。' },
  { name:'远翅', points:[[161,126],[186,94],[227,73],[272,62],[296,63],[309,69],[282,76],[257,94],[231,118],[198,132],[178,146]],
    guide:[[191,119],[266,85]], center:[232,100], tint:'#a1aaa5', tip:'从翅根沿斜向展开。可以换一色叠在边缘，试试深浅的变化。' },
  { name:'燕身', points:[[126,158],[146,137],[170,127],[194,126],[207,132],[215,142],[231,147],[211,151],[198,160],[174,169],[146,172]],
    guide:[[151,153],[198,142]], center:[174,149], tint:'#c3ad87', tip:'用齐针铺出胸腹，顺着身形从后往前走。细丝适合补边。' },
  { name:'叉尾', points:[[138,155],[161,166],[130,181],[90,208],[107,186],[69,198],[102,174]],
    guide:[[140,166],[102,184]], center:[116,180], tint:'#a2a5a5', tip:'尾尖分成两股。用接针走短一些，观察针脚能不能留在各自的轮廓里。' },
];

export const swiftMethods = [
  { name:'齐针', hint:'一排平行线，适合铺满一小段。' },
  { name:'套针', hint:'长短针错开交叠，可以换色盖出一层羽片。' },
  { name:'接针', hint:'小针脚首尾相接，可以沿着窄边走。' },
];
const zoomLevels = [1, 1.6, 2.3];
const width = 320, height = 240;
export const swiftLimit = 72;

export function freshSwiftDraft() {
  return { marks: [], part: 0, method: 1, color: 0, weight: 0, zoom: 0, light: 1, guide: true, cursor: [...swiftParts[0].center], start: null, note: '' };
}

function inside([x,y], points) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax,ay] = points[i], [bx,by] = points[j];
    if ((ay > y) !== (by > y) && x < (bx-ax)*(y-ay)/(by-ay)+ax) hit = !hit;
  }
  return hit;
}

export const onSwiftPart = (point, part) => inside(point, swiftParts[part].points);
const mix = (a, b, t) => [a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t];
const distance = (a,b) => Math.hypot(b[0]-a[0], b[1]-a[1]);
const fixed = point => point.map(n => Math.round(n*10)/10);
const validIndex = (value, length) => Number.isInteger(value) && value >= 0 && value < length;
const validPoint = point => Array.isArray(point) && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]);

export function swiftOutline({points}) {
  const corner = (p,next) => fixed(mix(p,next,.16)).join(' ');
  return 'M'+corner(points[0],points.at(-1)) + points.map((p,i) => {
    const previous = points[(i+points.length-1)%points.length], next = points[(i+1)%points.length];
    return `L${corner(p,previous)}Q${p.join(' ')} ${corner(p,next)}`;
  }).join('')+'Z';
}

export function planSwiftStitch(draft, start, end) {
  if (!onSwiftPart(start,draft.part)) return { note: '起针要落在选中的部位里。可以用部位按钮切换。' };
  const length = distance(start,end);
  const target = mix(start,end,Math.min(1,84/Math.max(length,1)));
  let tip = start;
  for (let i = 1; i <= 48; i++) {
    const next = mix(start,target,i/48);
    if (!onSwiftPart(next,draft.part)) break;
    tip = next;
  }
  if (distance(start,tip) < 5) return { note: '这组针太短了。把落针点再拉开一点。' };
  const mark = { part:draft.part, method:draft.method, color:draft.color, weight:draft.weight, a:fixed(start), b:fixed(tip) };
  // Round only after clipping so a saved needle point stays within its selected patch.
  if (!onSwiftPart(mark.a,draft.part)) mark.a = start;
  if (!onSwiftPart(mark.b,draft.part)) mark.b = tip;
  return { mark, note: distance(tip,end) > 2 ? '这组针在轮廓内收住了。' : '' };
}

export function swiftCounts(marks) {
  const counts = [0,0,0,0];
  for (const mark of marks) counts[mark.part]++;
  return counts;
}

export function readySwift(marks) {
  return swiftCounts(marks).every(count => count >= 2);
}

export function validSwift(marks) {
  return Array.isArray(marks) && marks.length <= swiftLimit && Array.from(marks).every(mark =>
    mark && validIndex(mark.part,swiftParts.length) && validIndex(mark.method,swiftMethods.length) &&
    validIndex(mark.color,palette.length) && validIndex(mark.weight,2) && validPoint(mark.a) && validPoint(mark.b) &&
    onSwiftPart(mark.a,mark.part) && onSwiftPart(mark.b,mark.part) &&
    distance(mark.a,mark.b) >= 4.8 && distance(mark.a,mark.b) <= 84.2 &&
    [0.25,0.5,0.75].every(t => onSwiftPart(mix(mark.a,mark.b,t),mark.part)));
}

export const hasSwift = state => Boolean(state.swift?.length || state.stitches.length);

function alongGuide({part,a,b}) {
  const [from,to] = swiftParts[part].guide;
  return Math.abs((b[0]-a[0])*(to[0]-from[0])+(b[1]-a[1])*(to[1]-from[1])) / (distance(a,b)*distance(from,to)) > .8;
}

export function swiftReview(marks, part) {
  if (!marks.length) return '';
  const relevant = part === undefined ? marks : marks.filter(mark => mark.part === part);
  if (!relevant.length) return '这处还没有落针，可以先顺着参考的丝理试一组。';
  if (relevant.filter(alongGuide).length / relevant.length < .65) return '有些针脚横过了羽毛的走势。放大看看，试试顺着羽缘转一下方向。';
  if (relevant.some(mark => mark.method === 1) && new Set(relevant.map(mark => mark.color)).size > 1) {
    return '羽毛的走势接上了，套针之间透出两种线色，有一层压着一层的样子。';
  }
  return '多数针脚顺着羽毛或身形。可以用细丝补边，也可以换线叠出深浅。';
}

export function swiftSegments(mark) {
  const {a,b,method} = mark;
  const length = distance(a,b);
  if (method === 2) {
    const pieces = Math.max(2,Math.ceil(length/10));
    return Array.from({length:pieces},(_,i) => [mix(a,b,i/pieces),mix(a,b,(i+.91)/pieces)]);
  }
  const across = [(a[1]-b[1])/length,(b[0]-a[0])/length];
  const shift = (point, offset) => [point[0]+across[0]*offset,point[1]+across[1]*offset];
  return Array.from({length:method === 0 ? 5 : 7},(_,i) => {
    const offset = (i-(method === 0 ? 2 : 3))*(mark.weight ? 2.8 : 2.05);
    if (method === 0) return [shift(a,offset),shift(b,offset)];
    const from = .28*(i%3), to = Math.min(1,from+.56+.05*(i%2));
    return [shift(mix(a,b,from),offset),shift(mix(a,b,to),offset)];
  });
}

const linePath = segments => segments.map(([a,b]) => `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`).join('');
const featherLines = [
  'M42 43Q90 59 137 107 M52 56Q101 78 143 118 M65 73Q112 94 149 129 M80 91Q122 111 149 135',
  'M181 123Q221 80 282 68 M187 128Q230 94 278 76 M196 131Q230 110 256 93',
  'M145 152Q166 139 194 139 M151 159Q176 147 199 149 M159 163Q180 155 190 156',
  'M146 163Q125 174 93 186 M139 170Q119 182 99 198',
];

function svgMark(mark, light=1) {
  const path = linePath(swiftSegments(mark)), size = mark.weight ? 2.4 : 1.45;
  const angle=[-.75,0,.75][light], length=distance(mark.a,mark.b);
  const shine=.12+.74*Math.pow(Math.abs((Math.cos(angle)*(mark.b[0]-mark.a[0])+Math.sin(angle)*(mark.b[1]-mark.a[1]))/length),5);
  return `<g fill="none" stroke-linecap="round"><path d="${path}" stroke="#41352e" stroke-width="${size+.85}" opacity=".28" transform="translate(.25 .58)"/>
    <path d="${path}" stroke="${palette[mark.color][1]}" stroke-width="${size}"/>
    <path d="${path}" stroke="#fff4d0" stroke-width=".65" opacity="${shine.toFixed(2)}" transform="translate(0 -.38)"/></g>`;
}

function viewBox(draft) {
  if (!draft || !draft.zoom) return `0 0 ${width} ${height}`;
  const ratio = zoomLevels[draft.zoom], w = width/ratio, h = height/ratio;
  const [x,y] = swiftParts[draft.part].center;
  return `${Math.max(0,Math.min(width-w,x-w/2))} ${Math.max(0,Math.min(height-h,y-h/2))} ${w} ${h}`;
}

function swiftCloth(marks, draft, {prefix='ws-swift', close=false, light=draft?.light ?? 1}={}) {
  return `<svg viewBox="${close ? '27 37 140 105' : viewBox(draft)}" ${draft ? 'data-swift-board tabindex="0" aria-label="雨燕绣布。方向键移动，空格定针。"' :
    'class="ws-swift-piece" role="img" aria-label="绣好的雨燕样片"'}>
    <defs>
      <pattern id="${prefix}-weave" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#e0caa3"/>
        <path d="M0 .5H5M.5 0V5" stroke="#917854" stroke-opacity=".18" stroke-width=".45"/></pattern>
      ${swiftParts.map((part,i) => `<clipPath id="${prefix}-patch-${i}"><path d="${swiftOutline(part)}"/></clipPath>`).join('')}
    </defs>
    <rect x="2" y="2" width="316" height="236" rx="21" fill="#996c48" stroke="#543b2e" stroke-width="2"/>
    <rect x="8" y="8" width="304" height="224" rx="16" fill="url(#${prefix}-weave)" stroke="#edcc95" stroke-width="2.3"/>
    <path d="M22 220Q91 203 143 218T293 212M36 32Q88 17 153 30T279 31" fill="none" stroke="#a5926c" stroke-width=".6" opacity=".6"/>
    ${swiftParts.map((part,i) => `<g><path d="${swiftOutline(part)}" fill="${part.tint}" fill-opacity="${i === draft?.part ? '.38' : '.22'}"
        stroke="${i === draft?.part ? '#776337' : '#83765f'}" stroke-width="${i === draft?.part ? '1.1' : '.65'}" stroke-linejoin="round"/>
      <g clip-path="url(#${prefix}-patch-${i})">${marks.filter(mark => mark.part === i).map(mark=>svgMark(mark,light)).join('')}</g></g>`).join('')}
    ${draft?.guide ? featherLines.map((path,i) => `<path d="${path}" clip-path="url(#${prefix}-patch-${i})" fill="none" stroke="#797b66" opacity=".46" stroke-width=".6"/>`).join('') : ''}
    <path d="M208 144Q216 148 227 147" fill="none" stroke="#69583c" stroke-width=".75"/>
    <circle cx="204" cy="138" r="1.9" fill="#44382d"/><circle cx="204.5" cy="137.5" r=".48" fill="#e9d7aa"/>
    ${draft?.guide ? swiftParts.map(({guide:[a,b]},i) => `<path d="${linePath([[a,b]])}" fill="none" stroke="${i === draft.part ? '#fff0bd' : '#877758'}" stroke-width="1.15" stroke-dasharray="4 4" stroke-linecap="round"/>`).join('') : ''}
    ${draft ? '<g data-swift-preview pointer-events="none"></g>' : ''}
  </svg>`;
}

export function swiftPreview(draft, end, cursor = false) {
  const mark = draft.start && end ? planSwiftStitch(draft,draft.start,end).mark : null;
  const reticle = cursor && end ? `<circle cx="${end[0]}" cy="${end[1]}" r="3" fill="none" stroke="#493e30" stroke-width="1.1"/>` : '';
  const pin = draft.start ? `<circle cx="${draft.start[0]}" cy="${draft.start[1]}" r="2.4" fill="#ffe3a0" stroke="#655537" stroke-width="1"/>` : '';
  return `${mark ? `<g clip-path="url(#ws-swift-patch-${mark.part})" opacity=".65">${svgMark(mark,draft.light)}</g>` : ''}${pin}${reticle}`;
}

export function swiftPiece(state) {
  if (state.swift?.length) return swiftCloth(state.swift);
  const colors = state.stitches;
  return `<svg viewBox="0 0 100 100" class="ws-hoop" role="img" aria-label="雨燕试绣样片">
    <circle cx="50" cy="50" r="47" fill="#aa7547"/><circle cx="50" cy="50" r="43" fill="#eedfbd"/>
    <path d="M47 10h6M42 92h16" stroke="#806040" stroke-width="2"/>
    ${legacyPattern.map(([x1,y1,x2,y2],i) => `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${palette[colors[i]][1]}" stroke-width="2.8" stroke-linecap="round"/>`).join('')}
    <path d="M36 56Q55 60 68 46L80 44L69 50Q57 65 33 58Z" fill="${palette[colors[0]][1]}" opacity=".8"/>
  </svg>`;
}

function lightButtons(light) {
  return `<div class="ws-swift-group" role="group" aria-label="移灯看丝光"><span>照光</span>${['左侧光','正面光','右侧光'].map((label,i)=>
    `<button type="button" data-swift-light="${i}" aria-pressed="${light===i}">${label}</button>`).join('')}</div>`;
}

export function swiftComparison(state,light) {
  return `<p class="ws-kicker">原样与复样</p><h2>同一只翅膀，绣两遍</h2>
    <p>把两块布放在同一束光下。看轮廓是不是仍认得出，也看看哪几根针先亮起来。</p>
    ${lightButtons(light)}
    <div class="ws-chapter-compare"><figure>${state.swift.length ? swiftCloth(state.swift,null,{prefix:'ws-original',close:true,light}) : swiftPiece(state)}<figcaption>原样</figcaption></figure>
    <figure>${swiftCloth(state.chapter.replica,null,{prefix:'ws-replica',close:true,light})}<figcaption>近翅复样</figcaption></figure></div>
    <p>${swiftReview(state.chapter.replica,0)}</p>
    <button type="button" data-command="chapter-back">回到原处</button>`;
}

export function swiftWorkbench(draft, mode, reference) {
  const counts = swiftCounts(draft.marks), part = swiftParts[draft.part];
  const replica=mode==='replica', practice=mode==='practice';
  return `<p class="ws-kicker">青梧绣坊 · ${practice ? '边角布练习' : replica ? '复样' : '雨燕试绣'}</p><h2>${replica ? '复绣一段近翅' : '绣一只雨燕'}</h2>
    <div class="ws-swift-layout"><div>
      <div class="ws-swift-group" role="group" aria-label="绣布倍率">${zoomLevels.map((zoom,i) =>
        `<button type="button" data-swift-zoom="${i}" aria-pressed="${draft.zoom === i}">${Math.round(zoom*100)}%</button>`).join('')}
        <button type="button" data-swift-guide aria-pressed="${draft.guide}">丝理参考</button>
      </div>
      ${swiftCloth(draft.marks,draft)}
      <p class="ws-swift-hint">在绣布上拖动，或点两下定起针和收针。键盘可用方向键移针、空格落点。</p>
    </div><div class="ws-swift-tools">
      ${replica ? `<div class="ws-swift-reference">${reference.swift.length ? swiftCloth(reference.swift,null,{prefix:'ws-replica-source',close:true,light:draft.light}) : swiftPiece(reference)}<small>原样 · 照着轮廓复绣，也可以保留丝光上的差别</small></div>` :
        `<div class="ws-swift-group" role="group" aria-label="雨燕部位">${swiftParts.map(({name},i) =>
        `<button type="button" data-swift-part="${i}" aria-pressed="${draft.part === i}">${name} <small>${counts[i] >= 2 ? '✓' : counts[i]+'/2'}</small></button>`).join('')}</div>`}
      <p>${part.tip}</p>
      ${lightButtons(draft.light)}
      <div class="ws-swift-group" role="group" aria-label="针法">${swiftMethods.map(({name},i) =>
        `<button type="button" data-swift-method="${i}" aria-pressed="${draft.method === i}">${name}</button>`).join('')}</div>
      <p>${swiftMethods[draft.method].hint}</p>
      <div class="ws-swift-group ws-swift-colors" role="group" aria-label="丝线">${palette.map(([name,color],i) =>
        `<button type="button" data-swift-color="${i}" aria-pressed="${draft.color === i}" style="--silk:${color}">${name}</button>`).join('')}</div>
      <div class="ws-swift-group" role="group" aria-label="丝线粗细">${['细丝','并股'].map((name,i) =>
        `<button type="button" data-swift-weight="${i}" aria-pressed="${draft.weight === i}">${name}</button>`).join('')}</div>
      <p class="ws-swift-note" role="status">${draft.note || (draft.start ? '已起针。再选一个落针点。' : swiftReview(draft.marks,draft.part) || (practice ? '可以在这块布头上随意试针。' : replica ? '在近翅复绣至少两组针，再用不同方向的光对照。' : '四处各试两组针，就可以收下样片。'))}</p>
      <div class="ws-actions">
        <button type="button" data-command="swift-undo" ${draft.start || draft.marks.length ? '' : 'disabled'}>${draft.start ? '撤去当前起针' : '拆掉上一组针'}</button>
        ${practice ? '' : replica ? `<button type="button" data-command="finish-replica" ${draft.marks.length>=2 ? '' : 'disabled'}>收下近翅复样</button>` :
        `<button type="button" data-command="finish-stitch" ${readySwift(draft.marks) ? '' : 'disabled'}>收下样片 · 3 小时、12 元</button>`}
        <button type="button" data-command="swift-back">放回工作台</button>
      </div>
    </div></div>
    <p class="ws-swift-credit">针法为游戏中的简化演示。<a href="https://www.ihchina.cn/art/detail/id/24990.html" target="_blank" rel="noopener noreferrer">看真实苏绣针法的运用 ↗</a></p>`;
}
