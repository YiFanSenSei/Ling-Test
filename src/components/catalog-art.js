/** 馆藏图录封面：原创意象插画，内联 SVG 可离线使用，不作实物照片。 */
const line = (x1,y1,x2,y2,extra='') => `<path d="M${x1} ${y1}L${x2} ${y2}" ${extra}/>`;
const repeat = (n,fn) => Array.from({length:n},(_,i)=>fn(i)).join('');
const art = {
  story: `<g transform="rotate(-7 160 120)"><path d="M65 81Q108 62 157 82V174Q111 155 65 173Z" fill="var(--pcard-sheet)"/><path d="M157 82Q204 63 247 81V173Q204 155 157 174Z" fill="var(--pcard-sheet)"/><path d="M60 89V180Q111 161 157 181Q202 161 252 180V89M157 85V174"/>${repeat(5,i=>`<path d="M80 ${99+i*12}q27-8 61 0M175 ${99+i*12}q28-8 55 0" opacity=".32"/>`)}<path d="M192 74V111l10-8 10 8V72" fill="var(--pcard-accent)" stroke="none" opacity=".75"/></g><g stroke="var(--pcard-accent)"><path d="M103 57q19-18 34 0t34 0t34 0M122 42q13-12 25 0t26 0t26 0"/><path d="m221 40 4 6 7 1-5 5 1 7-7-4-6 3 1-7-4-5 7-1Z" fill="var(--pcard-accent)" stroke="none"/></g>`,
  butterfly: `<path d="M75 156q43-17 84 0q43-17 84 0v18q-43-16-84 1q-41-17-84-1Z" fill="var(--pcard-sheet)"/><path d="M159 157v18M84 166q31-10 61 0M173 165q27-10 58 0" opacity=".5"/><g transform="translate(158 95) rotate(-15)"><path d="M0 9C-69-62-89 7-16 29C-52 44-17 73 0 17C17 73 52 44 16 29C89 7 69-62 0 9Z" fill="var(--pcard-wash)"/><path d="M0 4v25M0 5-9-9M0 5 9-9M-7 15Q-49-17-50 0M7 15Q49-17 50 0"/><path d="M-13 34q-12 8-9 15M13 34q12 8 9 15" stroke="var(--pcard-accent)"/></g><path d="M55 118q-3-23 15-39M250 84q21 21 11 47" stroke-dasharray="2 5" opacity=".35"/>`,
  embroidery: `<circle cx="156" cy="113" r="73" fill="var(--pcard-sheet)"/><circle cx="156" cy="113" r="67"/><path d="M145 39V29h23v10M150 24v8m12-8v8"/><path d="M126 164q8-31 29-53t28-56M149 121q-27-1-39-20M160 101q25 4 40-11"/><g fill="var(--pcard-wash)" stroke="var(--pcard-accent)">${[[153,108],[177,77],[119,99]].map(([x,y])=>`<g transform="translate(${x} ${y})">${repeat(5,i=>`<ellipse cx="0" cy="-10" rx="7" ry="11" transform="rotate(${i*72})"/>`)}<circle r="4" fill="var(--pcard-accent)"/></g>`).join('')}</g><path d="m207 157 35-54M235 113l6-9M221 137q46 24 27 44q-11 9-20-2" stroke="var(--pcard-accent)"/><path d="M102 135q10-15 29-7q-5 17-29 7Z" fill="var(--pcard-wash)"/>`,
  paper: `<g transform="translate(157 114) rotate(-12)"><path d="M-91-56H91V63H-91Z" fill="var(--pcard-wash)"/><path d="M-83-48H83V55H-83Z" fill="var(--pcard-sheet)"/>${repeat(22,i=>line(-77+i*7,-43,-77+i*7,50,'opacity=".23"'))}${repeat(7,i=>line(-78,-37+i*13,78,-37+i*13,'opacity=".16"'))}<path d="M-60-30Q-9-37 62-26L57 36Q7 30-61 39Z" fill="#faf8ee" stroke="var(--pcard-accent)"/><path d="M-47-12q24-7 43-2m-28 32 36-4m5-35 35 4M20 16l26 3" opacity=".22"/></g><path d="M74 187q13-6 26 0t26 0m59 0q13-6 26 0t26 0" stroke="var(--pcard-accent)"/>`,
  wood: `<g stroke-linejoin="round"><path d="m65 111 59-32 51 30-60 33Z" fill="var(--pcard-wash)"/><path d="M65 111v46l50 30v-45Z" fill="var(--pcard-sheet)"/><path d="m115 142 60-33v46l-60 32Z" fill="var(--pcard-wash)"/><path d="m142 67 49-28 58 34-20 11v31l-28 16V100Z" fill="var(--pcard-sheet)"/><path d="m142 67 59 33v31l-59-33Z" fill="var(--pcard-wash)"/><path d="m201 100 48-27v31l-20 11V84"/><path d="m122 108 21 12-24 14-21-12Z" fill="var(--pcard-accent)" opacity=".64"/><path d="m179 133-24 14m6-13-6 13 14-1" stroke="var(--pcard-accent)" stroke-dasharray="3 4"/>${repeat(4,i=>`<path d="m74 ${124+i*7} 31 18m20 ${11+i*7} 39-22" opacity=".25"/>`)}</g>`,
  opera: `<path d="M111 99Q81 118 67 169q27-3 47-22M211 99q30 19 44 70-27-3-47-22" fill="var(--pcard-wash)"/><path d="M117 80q-9 40 5 66l38 27 38-27q14-26 5-66" fill="var(--pcard-sheet)"/><path d="M114 85q4-34 46-35 42 1 46 35"/><path d="M108 85h104l-9 14h-86Z" fill="var(--pcard-wash)"/><path d="M125 76q-7-19 6-22m14 19q-7-25 6-31m25 31q7-25-6-31m24 34q7-19-6-22"/><g fill="var(--pcard-accent)" stroke="none"><circle cx="131" cy="51" r="4"/><circle cx="151" cy="39" r="4"/><circle cx="170" cy="39" r="4"/><circle cx="188" cy="51" r="4"/></g><path d="M129 114q11-7 20 1m22 0q10-8 20-1M160 117l-4 18h8M146 146q14 8 28 0" stroke="var(--pcard-accent)"/><path d="M125 101q11 0 23 8m24 0q11-8 23-8"/>`,
  qin: `<g transform="translate(160 115) rotate(-22)"><path d="M-102-18Q-69-24-62-19L56-18q16-13 41-8l12 9V17l-12 9q-25 5-41-8H-62q-7 5-40 0Z" fill="var(--pcard-wash)"/><path d="M-101-13H97V13H-101Z" fill="var(--pcard-sheet)" stroke="none"/>${repeat(7,i=>line(-100,-10+i*3.4,97,-10+i*3.4,'opacity=".55"'))}${repeat(9,i=>`<circle cx="${-64+i*16}" cy="-16" r="1.5" fill="var(--pcard-accent)" stroke="none"/>`)}<path d="M-86-19v38M82-23v46" stroke="var(--pcard-accent)"/></g><path d="M63 164q15 12 30 0M54 172q24 20 48 0M224 51q15-12 30 0M215 43q24-20 48 0" opacity=".3"/>`,
  fan: `<path d="M160 177 64 77Q160-1 256 77Z" fill="var(--pcard-sheet)"/>${repeat(9,i=>{const a=(-135+i*11.25)*Math.PI/180;return line(160,177,160+136*Math.cos(a),177+136*Math.sin(a),'opacity=".38"')})}<path d="M74 90Q160 18 246 90" stroke="var(--pcard-accent)"/><path d="M102 101q34-34 66-3t49-4M116 117q20-25 40-14t40 5" opacity=".4"/><path d="M156 176v15q12 9 8 21m0-16 6 12" stroke="var(--pcard-accent)"/><circle cx="160" cy="178" r="4" fill="var(--pcard-accent)"/>`,
  tai: `<circle cx="162" cy="108" r="74" stroke-dasharray="2 6" opacity=".28"/><path d="M94 124q-15-65 52-89M222 77q27 62-27 96" stroke="var(--pcard-accent)" opacity=".5"/><circle cx="168" cy="63" r="12" fill="var(--pcard-sheet)"/><path d="m165 78-12 36 30 19-14 42M155 113l-28 26-37 12m73-62-32 9-29-19m63 10 26 15 37-17" stroke-width="7" stroke="var(--pcard-wash)"/><path d="m165 78-12 36 30 19-14 42M155 113l-28 26-37 12m73-62-32 9-29-19m63 10 26 15 37-17" stroke-width="2.4"/><path d="M157 181h23M80 155l15-1" stroke-width="2"/>`,
  season: `<circle cx="160" cy="109" r="73"/><circle cx="160" cy="109" r="64" opacity=".4"/>${repeat(24,i=>{const a=i*Math.PI/12;return line(160+68*Math.cos(a),109+68*Math.sin(a),160+73*Math.cos(a),109+73*Math.sin(a),'opacity=".7"')})}<path d="M117 146q22-49 53-75M143 112q-26-3-28-23 26 0 28 23Zm18-24q4-26 27-29-1 23-27 29Zm-36 46q32 2 42-19-29-8-42 19Z" fill="var(--pcard-wash)"/><circle cx="196" cy="116" r="14" fill="var(--pcard-accent)" stroke="none" opacity=".7"/><path d="M97 161q22 16 43 19m63-125q16 7 26 23" stroke="var(--pcard-accent)" stroke-width="2"/>`,
  dance: `<circle cx="161" cy="59" r="11" fill="var(--pcard-sheet)"/><path d="M154 73q-13 24-7 43l-31 53q47-6 80 8l-30-60 3-41" fill="var(--pcard-wash)"/><path d="M149 85q-43-30-65-3t30 26q28-1 21 16M171 87q48 27 68-6t-21-32" stroke="var(--pcard-accent)" stroke-width="3"/><path d="M149 84l-25 3-19-12m66 6 25-14 13 5M147 116l19 1m-36 59-4 16m53-12 14 9"/><path d="M109 55q-27 5-37 26m142 40q26-7 32-27" opacity=".3"/>`,
  medicine: `<path d="M94 115h128q0 61-64 61t-64-61Z" fill="var(--pcard-wash)"/><ellipse cx="158" cy="115" rx="64" ry="14" fill="var(--pcard-sheet)"/><path d="m145 115 45-66q6-8 15-1t1 14l-46 57" fill="var(--pcard-sheet)"/><path d="M103 141q11 19 31 23M139 177v7h38v-7"/><path d="M105 102q4-33-22-48-8 29 22 48Zm0 0Q73 93 66 72q31 1 39 30Z" fill="var(--pcard-wash)"/><path d="M105 102 85 61"/><path d="M219 142q17-4 26 8-15 11-26-8Zm9 18q17-4 26 8-15 11-26-8Z" fill="var(--pcard-accent)" stroke="none" opacity=".6"/>`,
};
const categories = {
  '民间文学': { art: 'story', accent: '#925b44', wash: '#e7d8c8' },
  '传统音乐': { art: 'qin', accent: '#536e73', wash: '#d5dfda' },
  '传统舞蹈': { art: 'dance', accent: '#956057', wash: '#ead7d0' },
  '传统戏剧': { art: 'opera', accent: '#9d473e', wash: '#ead4cb' },
  '曲艺': { art: 'fan', accent: '#7c6551', wash: '#e3d9c8' },
  '传统体育、游艺与杂技': { art: 'tai', accent: '#566d61', wash: '#d8e0d3' },
  '传统美术': { art: 'embroidery', accent: '#9b4f48', wash: '#e9d5cc' },
  '传统技艺': { art: 'wood', accent: '#8d6b3d', wash: '#e5d8bd' },
  '传统医药': { art: 'medicine', accent: '#5e7459', wash: '#dce2cc' },
  '民俗': { art: 'season', accent: '#7a7044', wash: '#e7dfc4' },
};
const captions = {story:'口传 · 故事 · 记忆',butterfly:'书页 · 蝶影 · 传说',embroidery:'绷 · 针 · 丝',paper:'帘 · 纤维 · 纸',wood:'榫 · 卯 · 构',opera:'冠 · 袖 · 曲',qin:'琴 · 弦 · 韵',fan:'扇 · 说 · 唱',tai:'动 · 静 · 势',season:'天时 · 草木 · 生活',dance:'步 · 袖 · 身',medicine:'草木 · 杵 · 臼'};

// 同一项目的不同申报记录共用封面；其余记录使用所属门类的意象。
const projectArt = {
  "Ⅰ-007": "butterfly",
  "Ⅱ-034": "qin",
  "Ⅳ-001": "opera",
  "Ⅴ-001": "fan",
  "Ⅵ-011": "tai",
  "Ⅶ-018": "embroidery",
  "Ⅷ-027": "wood",
  "Ⅷ-065": "paper",
  "Ⅹ-068": "season"
};
let coverSequence = 0;

export function catalogCover(project) {
  const category = Object.hasOwn(categories, project.category) ? categories[project.category] : categories['传统技艺'];
  const prefix = String(project.projectNo || '').split('_')[0];
  const key = Object.hasOwn(projectArt, prefix) ? projectArt[prefix] : category.art;
  const patternId = 'pcard-hatch-' + ++coverSequence;
  const svg = `<svg viewBox="0 0 320 220" fill="none" stroke="var(--pcard-drawing)" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" data-cover="${key}"><defs><pattern id="${patternId}" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 5 5 0" stroke="var(--pcard-accent)" stroke-width=".5" opacity=".09"/></pattern></defs><circle cx="160" cy="110" r="88" fill="url(#${patternId})" stroke="none"/><path d="M38 35h12m-6-6v12M270 184h12m-6-6v12" opacity=".24"/>${art[key]}</svg>`;
  return { svg, caption: captions[key], style: `--pcard-accent:${category.accent};--pcard-wash:${category.wash}` };
}
