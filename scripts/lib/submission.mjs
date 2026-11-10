import { EXHIBIT_PHOTOS, exhibitPhotoPath } from '../../src/components/exhibit-photo.js';

const workshopPortraits = ['apprentice', 'master', 'merchant', 'player', 'scholar', 'shop', 'teaSeller', 'visitor'];

/** 匿名化必须确实找到成员章节，匹配失败时不能悄悄输出原文。 */
export function anonymizeReadme(text) {
  const section = /^## 二、组内成员与分工[^\r\n]*\r?\n[\s\S]*?(?=^## |^---\s*$|(?![\s\S]))/m;
  if (!section.test(text)) throw new Error('README 缺少可识别的成员与分工章节，无法安全生成匿名版');
  return text.replace(section,
    '## 二、组内成员与分工\n\n> 本版本为初赛评选用**匿名版本**，不包含个人信息。\n> 队员名单与分工见完整版。\n\n');
}

/** 根据当前分片索引检查提交产物，避免只带首页或部分详情。 */
export function requiredBuildFiles(index) {
  if (!Number.isInteger(index.shardCount) || index.shardCount < 1) {
    throw new Error('详情分片索引无效，请重新构建');
  }
  return ['index.html', 'data/inheritors.js',
    ...Array.from({ length: index.shardCount }, (_, i) => `data/detail-${i}.js`),
    ...Object.keys(EXHIBIT_PHOTOS).map(exhibitPhotoPath),
    ...workshopPortraits.map(id => `workshop/portrait-${id}-v2.png`)];
}
