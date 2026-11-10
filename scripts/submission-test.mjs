import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anonymizeReadme, requiredBuildFiles } from './lib/submission.mjs';

for (const newline of ['\n', '\r\n']) {
  for (const boundary of ['---', '## 三、技术说明']) {
    test(`匿名化支持 ${JSON.stringify(newline)} 与 ${boundary}`, () => {
      const source = ['# 作品', '## 二、组内成员与分工', '| 示例队员甲 | 示例编号 |', boundary, '保留的项目说明'].join(newline);
      const result = anonymizeReadme(source);
      assert(!result.includes('示例队员甲'));
      assert(!result.includes('示例编号'));
      assert(result.includes('保留的项目说明'));
      assert(result.includes('匿名版本'));
    });
  }
}
test('成员章节缺失时拒绝打包', () => assert.throws(() => anonymizeReadme('# 文档\n个人资料'), /无法安全生成/));
test('成员章节位于文末时仍能删除', () => assert(!anonymizeReadme('## 二、组内成员与分工\n示例队员乙').includes('示例队员乙')));
test('必须带齐全部分片、传承人索引、离线栏目图片和工坊立绘', () => {
  assert.deepEqual(requiredBuildFiles({ shardCount: 2 }), [
    'index.html', 'data/inheritors.js', 'data/detail-0.js', 'data/detail-1.js',
    ...['home', 'gallery', 'inheritors', 'simulator', 'works', 'about'].map(key => `media/exhibit-${key}.webp`),
    ...['apprentice', 'master', 'merchant', 'player', 'scholar', 'shop', 'teaSeller', 'visitor'].map(id => `workshop/portrait-${id}-v2.png`),
  ]);
  for (const shardCount of [0, -1, 1.5, undefined]) assert.throws(() => requiredBuildFiles({ shardCount }));
});
