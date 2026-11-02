/** 三门体验与对应馆藏共用同一份导览，保持入口、说明与项目关联一致。 */
export const CRAFTS = [
  { key: 'embroidery', name: '苏绣', glyph: '绣', projectId: '13978', projectName: '苏绣',
    action: '落下一针', description: '顺着图纸铺满花瓣，用针脚留下丝线的光泽。',
    steps: ['选择一幅图纸，查看格子提示的针法。', '选好针法，按住鼠标或手指沿图纸落针。', '绣满图纸后查看覆盖与针法评价，保存作品。'],
    principle: '齐针铺出连续的光泽，打籽表现颗粒般的花蕊。留意针法变化如何改变同一幅图案的质感。' },
  { key: 'paper', name: '宣纸', glyph: '纸', projectId: '14376', projectName: '宣纸制作技艺',
    action: '捞起一张纸', description: '让纸浆随帘流动，在均匀与轻薄之间找到平衡。',
    steps: ['按住画布，让纸帘入槽。', '左右平稳荡帘，让纸浆均匀附着。', '向上拖动提帘，等待覆帘完成，再查看评价与保存。'],
    principle: '荡帘影响纤维的分布。试着比较急促与平稳的动作，观察纸面均匀度和帘纹的变化。' },
  { key: 'mortise', name: '榫卯', glyph: '卯', projectId: '14306', projectName: '香山帮传统建筑营造技艺',
    action: '合上一道榫', description: '沿着构件的方向推进，感受木与木之间的咬合。',
    steps: ['选择一种榫卯，转动视角观察榫头与卯口。', '抓住活动构件，沿提示的轴向缓慢推进。', '咬合后观察接缝；燕尾榫可试着向上提拉，再保存作品。'],
    principle: '燕尾形状限制了构件的脱出方向。拼合后试提，观察结构如何依靠形状而保持连接。' },
];

export function craftGuide(key) {
  const c = CRAFTS.find(c => c.key === key);
  return `<details class="craft-guide">
    <summary><span>上手三步</span><span>${c.action} · 查看操作提示</span></summary>
    <ol>${c.steps.map(s => `<li>${s}</li>`).join('')}</ol>
    <p>${c.principle}</p>
    <a href="#/project/${c.projectId}">走进馆藏：${c.projectName}，了解相关传承人 →</a>
  </details>`;
}
