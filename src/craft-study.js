import { embroideryGlossary } from './embroidery-terms.js';

/** 原创原理图，采用简化几何解释操作，不充当实物照片或结构施工图。 */
const threadLines = Array.from({ length: 17 }, (_, i) => `<path d="M${46 + i * 5} 26V96"/>`).join('');
const fiberLines = Array.from({ length: 22 }, (_, i) => {
  const x = 28 + (i * 37) % 125, y = 28 + (i * 23) % 65;
  return `<path d="M${x} ${y}l18 -7"/>`;
}).join('');
const studies = {
  '13978': { title: '一片光，从针脚的方向开始', intro: '把细线排成连续的面，再用不同针法表现花蕊与轮廓。下面对照的是针脚组织方式；真实苏绣还需要处理丝线粗细、张力和层次。',
    steps: [
      ['铺面', '平行针脚形成连续的面，留意光泽的方向。', `<g stroke="#9E3B32" stroke-width="3">${threadLines}</g><path d="M36 60h108" stroke="#C9A961" stroke-width="2" stroke-dasharray="4 4"/>`],
      ['点蕊', '打籽形成颗粒，与铺面的连续感作对照。', Array.from({ length: 15 }, (_, i) => `<circle cx="${53 + i % 5 * 19}" cy="${40 + Math.floor(i / 5) * 20}" r="5" fill="#B8934E"/>`).join('')],
      ['勾边', '链状针脚沿轮廓排列，观察线与面的关系。', `<path d="M35 88Q80 10 146 68" fill="none" stroke="#6B8672" stroke-width="2"/>${Array.from({ length: 7 }, (_, i) => `<ellipse cx="${46 + i * 14}" cy="${70 - Math.sin(i / 6 * Math.PI) * 24}" rx="9" ry="5" transform="rotate(-12 ${46 + i * 14} ${70 - Math.sin(i / 6 * Math.PI) * 24})" fill="none" stroke="#6B8672" stroke-width="2"/>`).join('')}`],
    ] },
  '14376': { title: '从流动的纸浆，到一张湿纸', intro: '捞纸是宣纸制作中的一个环节。纸帘托住纤维，荡动影响纤维分布，沥水后留下湿纸；完整制作还包括原料处理、压榨与干燥等工序。',
    steps: [
      ['入帘', '帘面进入纸浆，开始托住分散的纤维。', `<rect x="24" y="38" width="132" height="62" rx="3" fill="#DCE1CF"/><path d="M24 51Q60 40 90 51T156 51" stroke="#718A85" fill="none"/><path d="M42 25h98v54H42Z" fill="none" stroke="#8B6F47" stroke-width="5"/>`],
      ['荡帘', '左右荡动，观察纤维是否均匀铺开。', `<g stroke="#A38C65" stroke-width="1.5">${fiberLines}</g><path d="M28 105h125m-117-7-8 7 8 7m109-14 8 7-8 7" fill="none" stroke="#B23A2E" stroke-width="2"/>`],
      ['沥水', '水分透过帘面，纤维留在上面形成湿纸。', `<path d="M25 32h130v42H25Z" fill="#EBE4D1" stroke="#8B6F47" stroke-width="4"/><g stroke="#718A85" stroke-width="2"><path d="M50 84v17m40-17v17m40-17v17"/></g>`],
    ] },
  '14306': { title: '能推进去，为什么不容易直接提出来？', intro: '以体验中的燕尾榫为例：构件沿槽的方向滑入，梯形剖面限制了另一方向的脱出。这是木构连接的简化示意，不能概括所有榫卯，也不是建筑施工依据。',
    steps: [
      ['看剖面', '对照上窄下宽的梯形榫舌与卯口。', `<path d="M30 24h120v80H30Z" fill="#B69B6D"/><path d="M68 24h44l19 55H49Z" fill="#F5F1E8" stroke="#6E5737" stroke-width="2"/>`],
      ['沿轴滑入', '顺着槽的方向推进，让对应的面贴合。', `<path d="M26 60h130m-12-9 12 9-12 9" fill="none" stroke="#B23A2E" stroke-width="2"/><path d="M60 25h43l16 27H44Z" fill="#B69B6D" stroke="#6E5737" stroke-width="2"/><path d="M60 75h43l16 27H44Z" fill="none" stroke="#6E5737" stroke-width="2"/>`],
      ['试着提拉', '提拉方向受到斜面约束，和滑入方向不同。', `<path d="M30 43h120v64H30Z" fill="#B69B6D"/><path d="M69 43h42l18 48H51Z" fill="#8F7149" stroke="#6E5737" stroke-width="2"/><path d="M90 36V12m-8 8 8-8 8 8" fill="none" stroke="#B23A2E" stroke-width="2"/><path d="m78 30 24 0" stroke="#B23A2E" stroke-width="3"/>`],
    ] },
};
export function craftStudy(id) {
  const study = studies[id];
  if (!study) return '';
  return `<section class="craft-study" aria-labelledby="study-title-${id}">
    <p class="curation-label">工艺观察 · 从原理到动手</p><h2 id="study-title-${id}">${study.title}</h2>
    <p class="craft-study-intro">${study.intro}</p>
    <ol class="craft-study-steps">${study.steps.map(([title, description, svg], i) => `<li>
      <svg viewBox="0 0 180 120" fill="none" aria-hidden="true">${svg}</svg>
      <h3><span>0${i + 1}</span>${title}</h3><p>${description}</p>
    </li>`).join('')}</ol><p class="craft-study-note">本站绘制的原理示意，非真实比例。项目资料见下方官方介绍。</p>
    ${id === '13978' ? embroideryGlossary() : ''}
  </section>`;
}
