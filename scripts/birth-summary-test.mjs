import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeBirths } from './lib/birth-summary.mjs';

test('缺失、无效和未来年份不进入样本', () => {
  const result = summarizeBirths(['1908.03', '', '未公布', '2030', '0000', '1979'].map(birth => ({ birth, batch: 1 })));
  assert.equal(result.counted, 2);
  assert.equal(result.missing, 4);
  assert.equal(result.median, 1943.5);
  assert.equal(result.byBatch[0].coverage, 33.3);
  assert.deepEqual(result.histogram.map(h => h.count), [1, 0, 0, 0, 0, 0, 0, 1]);
});
test('空样本不生成假年份', () => {
  const result = summarizeBirths([{ batch: 5 }]);
  assert.equal(result.earliest, null);
  assert.equal(result.latest, null);
  assert.equal(result.median, null);
  assert.deepEqual(result.histogram, []);
  assert.equal(result.byBatch[0].median, null);
});
test('按档案记录计数，同人跨项目记录不会静默去重', () => {
  const result = summarizeBirths([{ name: '档案示例', birth: '1940', batch: 1 }, { name: '档案示例', birth: '1940', batch: 2 }]);
  assert.equal(result.counted, 2);
  assert.equal(result.histogram[0].count, 2);
  assert.equal(result.byBatch.length, 2);
});
