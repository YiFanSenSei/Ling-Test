export const zones = [
  { name: '耳根', x: 69, y: 49, flow: 2 },
  { name: '脸颊', x: 117, y: 71, flow: 1 },
  { name: '下颌', x: 163, y: 92, flow: 0 },
];
const angles = [-29, 0, 29];
const arrows = ['↗', '→', '↘'];
const lengths = [9, 15, 22];
const counts = [9, 17, 27];
const furChoices = [
  ['方向', arrows],
  ['针脚', ['短', '中', '长']],
  ['疏密', ['疏', '中', '密']],
];

export const blankFur = () => Array(6).fill(null);
export const baselineFur = zones.map(() => [1, 1, 1]).concat([null, null, null]);
export const exampleFur = zones.map(({flow}) => [flow, 1, 2])
  .concat(zones.map(({flow}, i) => [flow, i === 1 ? 2 : 0, 0]));

const validFurGroup = stitch => Array.isArray(stitch) && stitch.length === 3 &&
  Array.from(stitch).every(value => Number.isInteger(value) && value >= 0 && value < 3);

export function validFur(sample) {
  return Array.isArray(sample) && sample.length === 6 && Array.from(sample).every(validFurGroup);
}

export function loadFurDraft(sample) {
  const groups = blankFur().map((_, index) => validFurGroup(sample?.[index]) ? sample[index] : null);
  const index = Math.max(0, groups.indexOf(null));
  const layer = Math.floor(index / 3);
  return { sample: groups, zone: index % 3, layer, values: groups[index]?.slice() ?? [1, 1, layer ? 0 : 1], guide: true };
}

export function loadFur(saved) {
  const sample = validFur(saved?.sample) ? saved.sample : null;
  return {
    studied: saved?.studied === true || Boolean(sample),
    sample,
    shared: sample && ['flow', 'layer'].includes(saved?.shared) ? saved.shared : '',
    shown: Boolean(sample && saved?.shown === true),
  };
}

export function furReview(sample) {
  const broken = zones.filter(({flow}, i) => sample[i][0] !== flow || sample[i + 3][0] !== flow);
  if (broken.length) return `${broken.map(zone => zone.name).join('和')}的线有些逆着毛势。看一看底层和上层接在一起的地方。`;
  if (zones.some((_, i) => sample[i + 3][2] >= sample[i][2] || sample[i + 3][1] === sample[i][1])) {
    return '毛势已经接上了。上面一层可以放疏一点，换个针脚长度，让底下的线透出来。';
  }
  return '毛势接上了，底下的丝线也透得出来。拿到光下看，上层的几针像浮在绒毛表面。';
}

export function sharedFur(sample, focus) {
  return sample.map(([direction, length, density], i) => {
    if (focus === 'flow') return [zones[i % 3].flow, length, density];
    return i < 3 ? [direction, length, Math.max(density, 1)]
      : [direction, (sample[i - 3][1] + 1) % 3, 0];
  });
}

export function furSources() {
  return `<div class="ws-fur-source"><p class="ws-kicker">作品资料 · 苏绣</p>
    <h3>《白猫戏螳螂》</h3>
    <p>展览资料记载，1956 年展品的猫毛用施针、虚实针逐层绣出。请留意猫脸上毛势的转折，以及边缘露出的细毛。下面的绣片是工坊练习示意。</p>
    <div class="ws-fur-links"><a href="https://gmfyg.org.cn/Attachments/TmpFile/20231222/495ca2cc-9689-4370-b353-4b16b4ac291b.jpg" target="_blank" rel="noopener noreferrer">看馆方展品照片 ↗</a>
    <a href="https://www.ihchina.cn/project_details/28855.html" target="_blank" rel="noopener noreferrer">读针法与展览资料 ↗</a></div>
  </div>`;
}

function stitches(sample) {
  return sample.map((settings, i) => {
    if (!settings) return '';
    const [direction, length, density] = settings;
    const { x, y } = zones[i % zones.length];
    const top = i >= zones.length;
    const angle = angles[direction] * Math.PI / 180;
    const columns = density + 4;
    const rows = Math.ceil(counts[density] / columns);
    return Array.from({ length: counts[density] }, (_, j) => {
      const col = j % columns, row = Math.floor(j / columns);
      const ax = x - 27 + col * 44 / (columns - 1) + Math.sin(j * 7.4 + i) * 3 + (top ? 4 : 0);
      const ay = y - 14 + row * 25 / (rows - 1) + (col - 2) * .9 + Math.cos(j * 4.3 + i) * 3 + (top ? 5 : 0);
      const span = lengths[length] * (top ? .72 + (j % 5) * .12 : 1);
      const bx = ax + span * Math.cos(angle), by = ay + span * Math.sin(angle);
      const shade = (top ? ['#fff6db', '#e7d8b6', '#fcf0d1'] : ['#cabb9a', '#e5d6b5', '#a99d83'])[j % 3];
      return `<path d="M${ax.toFixed(1)} ${ay.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}" stroke="${shade}" stroke-width="${top ? 1.05 : 1.8}" stroke-linecap="round"/>`;
    }).join('');
  }).join('');
}

function fabric(sample, selected, guide) {
  return `<svg viewBox="0 0 238 140" aria-hidden="true">
    <rect x="1" y="1" width="236" height="138" rx="11" fill="#9e704b"/>
    <rect x="7" y="7" width="224" height="126" rx="6" fill="#4d6358" stroke="#d8aa74" stroke-width="2"/>
    ${Array.from({length: 24}, (_, i) => `<path d="M12 ${12 + i * 5}H226 M${13 + i * 9} 12V128" stroke="#e7dfb5" opacity=".07" stroke-width=".5"/>`).join('')}
    <path d="M28 106Q24 75 49 61L55 20Q59 16 81 44Q108 38 132 53L161 42Q167 49 162 69Q171 83 199 90Q204 98 192 104Q181 117 145 117L112 124Q65 129 28 106Z" fill="#b5b49a" fill-opacity=".1" stroke="#bcbda0" stroke-width=".8" stroke-dasharray="3 3"/>
    ${stitches(sample)}
    ${zones.map(({x,y,flow}, i) => guide || i === selected ? `<g>
      <ellipse cx="${x + 1}" cy="${y + 3}" rx="32" ry="23" fill="none" stroke="${i === selected ? '#efd39a' : '#aab9a3'}" stroke-width="${i === selected ? 1.5 : .8}" stroke-dasharray="3 3"/>
      ${guide ? `<text x="${x - 21}" y="${y - 18}" fill="#fff0bd" font-size="13">${arrows[flow]}</text>` : ''}
    </g>` : '').join('')}
  </svg>`;
}

export function compareFur(sample, label = '你的试布', selected = -1, guide = false) {
  return `<div class="ws-fur-compare">
    <figure>${fabric(baselineFur, -1, false)}<figcaption>等长同向的对照布</figcaption></figure>
    <figure>${fabric(sample, selected, guide)}<figcaption>${label}</figcaption></figure>
  </div>`;
}

export function furWorkbench(draft) {
  const { sample, zone, layer, values, guide } = draft;
  const ready = sample.every(Boolean);
  const baseReady = sample.slice(0, 3).every(Boolean);
  const current = sample[layer * 3 + zone];
  return `<p class="ws-kicker">青梧绣坊 · 白猫毛试绣</p><h2>绣出一撮有层次的猫毛</h2>
    <p>${layer ? '上层留一点空隙，让下面的线露出来。试试换个针脚长度。' : '先铺底层。布上的箭头示意耳根、脸颊和下颌的毛势。'}</p>
    ${compareFur(sample, '你的试布', zone, guide)}
    <div class="ws-fur-tools">
      <div class="ws-fur-control" role="group" aria-label="绣制层次">
        <button type="button" data-fur-layer="0" aria-pressed="${layer === 0}">底层</button>
        <button type="button" data-fur-layer="1" aria-pressed="${layer === 1}" ${baseReady ? '' : 'disabled'}>上层</button>
        <button type="button" data-fur-guide aria-pressed="${guide}">毛势参考</button>
      </div>
      <div class="ws-fur-control" role="group" aria-label="布面位置">${zones.map(({name}, i) =>
        `<button type="button" data-fur-zone="${i}" aria-pressed="${zone === i}">${name}${sample[layer * 3 + i] ? ' ✓' : ''}</button>`).join('')}</div>
      ${furChoices.map(([name, options], i) => `<div class="ws-fur-control" role="group" aria-label="${name}">
        <span>${name}</span>${options.map((option, j) => `<button type="button" data-fur-setting="${i}" data-fur-value="${j}" aria-label="${name} ${option}" aria-pressed="${values[i] === j}">${option}</button>`).join('')}</div>`).join('')}
    </div>
    <p class="ws-fur-note" role="status">${ready ? furReview(sample) : baseReady ? '底层齐了，可以换到上层继续。' : '先在三个位置各绣一组底针。'}</p>
    <div class="ws-actions">
      <button type="button" data-command="fur-place">${current ? '重绣' : '落针'} · ${zones[zone].name}${layer ? '上层' : '底层'}</button>
      <button type="button" data-command="fur-finish" ${ready ? '' : 'disabled'}>收下两块对照试布</button>
      <button type="button" data-command="fur-back">回到工作台</button>
    </div>`;
}

const furBack = '<button type="button" data-command="fur-back">回到原处</button>';

export function furLesson(studied) {
  return `<p class="ws-kicker">陆师傅 · 绣案边</p><h2>先看看猫毛是怎么长的</h2>
    ${furSources()}
    ${compareFur(exampleFur, '陆师傅的两层示意')}
    <p>「拿眼睛顺着毛走一遍。底层先接起耳根、脸颊和下颌的走势。到了表面，针脚放疏一点，底下的丝线才露得出来。」</p>
    <div class="ws-actions">${studied ? '<p>练习布放在刺绣工作台上。</p>' : '<button type="button" data-command="fur-study">记住毛势，去工作台试试</button>'}${furBack}</div>`;
}

export function furTeaching(sample, focus) {
  return `<p class="ws-kicker">阿禾 · 并排的两只绷子</p><h2>阿禾想跟你试一遍</h2>
    <p>「我从这里下针，毛到了脸颊就拐了个弯。你先给我看哪一步？」</p>
    <div class="ws-fur-control ws-fur-teaching" role="group" aria-label="给阿禾示范">
      <button type="button" data-fur-teach="flow" aria-pressed="${focus === 'flow'}">顺着毛势转针</button>
      <button type="button" data-fur-teach="layer" aria-pressed="${focus === 'layer'}">在上层留出空隙</button>
    </div>
    ${compareFur(focus ? sharedFur(sample, focus) : sample, focus ? '阿禾照着做的试布' : '你带来的试布')}
    <p role="status">${focus === 'flow' ? '阿禾把三处针迹沿毛势接起来。「原来是这里转，难怪我刚才绣得像一撮逆毛。」' :
      focus === 'layer' ? '阿禾换了针脚的长度，少落几针。「我看见底下的线了。上面一层不用把它盖住。」' :
      '选一处给她看。阿禾会在自己的布上跟着试。'}</p>
    <div class="ws-actions"><button type="button" data-command="fur-save-teach" ${focus ? '' : 'disabled'}>把阿禾的试布晾在绷架上</button>${furBack}</div>`;
}

export function furDisplay(fur, showingShared) {
  return `<p class="ws-kicker">河畔展台 · 对照试布</p><h2>一撮白猫毛，两块布</h2>
    ${furSources()}
    ${compareFur(showingShared ? sharedFur(fur.sample, fur.shared) : fur.sample, showingShared ? '阿禾的跟练试布' : '工坊试绣')}
    <p>${showingShared ? (fur.shared === 'flow' ? '阿禾在试布上调整了针迹的方向。沿着毛势看，耳根、脸颊和下颌接在了一起。' :
      '阿禾在上层留出了空隙。看看两层线如何在布上错开。') : furReview(fur.sample)}</p>
    <div class="ws-actions">${fur.shared ? `<button type="button" data-command="fur-toggle-display">${showingShared ? '换回工坊试布' : '换看阿禾的跟练试布'}</button>` : ''}${furBack}</div>`;
}
