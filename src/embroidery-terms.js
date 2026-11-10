const museum = 'https://www.ihchina.cn/project_details/13978/';
const overview = 'https://jh.gov.cn/jh/kpjh/202305/7e93b1b8ff9e4196a542534713155c48.shtml';

export const EMBROIDERY_TERMS = [
  {
    id: 'eight-words', title: '八字诀',
    summary: '平、齐、细、密、匀、顺、和、光，从针脚到丝光，八个字帮你读懂一幅绣品。',
    description: '从近处看针脚是否平整、边缘是否整齐、疏密是否均匀，再从侧面观察丝线走向与光泽。色线衔接自然时，色彩和明暗也会过渡得更柔和。',
    source: overview, credit: '苏绣技艺科普',
  },
  {
    id: 'split-silk', title: '劈丝',
    summary: '把一根丝线分成更细的丝束，用来绣毛发、轮廓和细微的明暗变化。',
    description: '线束越细，绣工越能在小范围内安排细密针脚和不同颜色的丝线。无锡精微绣的官方档案记录了在精细局部使用八十分之一丝线的做法。实际用线随题材与技法而变。',
    source: 'https://www.ihchina.cn/project_details/13979.html', credit: '无锡精微绣官方档案',
  },
  {
    id: 'double-sided', title: '双面绣',
    summary: '在同一底料上组织正反两面的针脚，让一件绣品可以从两面观赏。',
    description: '双面绣需要把起针、收针和线头藏在绣面中。正反图案可以相同。进一步发展出的异色、异形等技法，还能让两面呈现不同的色彩或图案。',
    source: museum, credit: '苏绣官方档案',
  },
  {
    id: 'stitch-families', title: '针法谱系',
    summary: '齐针、散套针、施针、乱针等针法各有作用，常在一幅作品里配合使用。',
    description: '观察花瓣时，可以看针脚怎样并排铺出光泽；看毛发时，留意长短针脚怎样交叠。苏绣在长期传承中形成多种技法，仿真绣和乱针绣也带来了不同的造型方式。',
    source: museum, credit: '苏绣官方档案',
  },
];

export function embroideryGlossary() {
  return `<div class="craft-glossary">
    <h3>苏绣词条</h3>
    ${EMBROIDERY_TERMS.map(term => `<details data-embroidery-term="${term.id}">
      <summary>${term.title}</summary>
      <p>${term.description}</p>
      <p><a href="${term.source}" target="_blank" rel="noopener noreferrer">${term.credit} ↗</a></p>
    </details>`).join('')}
    <a href="#/simulator?tool=embroidery">返回苏绣体验 →</a>
  </div>`;
}
