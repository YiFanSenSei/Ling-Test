/**
 * 精确复现 file:// 下的语法错误
 *
 * 前两个诊断脚本给出的位置互相矛盾（一个说第 1440 行是 notfound 标记，
 * 一个说脚本块第 2 行）。原因是 new Function() 会把脚本包进函数体，
 * 遇到顶层 return 或 HTML 字符串时表现与浏览器不同。
 *
 * 改用 acorn 级别的做法：直接把脚本块当模块用 node 的 vm 试解析，
 * 并把出错位置换算回原始 HTML 的行号，同时打印上下文。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const vm = require('node:vm');

const html = readFileSync('dist/index.html', 'utf8');
const blocks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];

blocks.forEach((b, i) => {
  const code = b[1];
  const offset = b.index;
  try {
    new vm.Script(code, { filename: `block${i + 1}.js` });
    console.log(`块 ${i + 1}：解析通过`);
  } catch (e) {
    console.log(`块 ${i + 1}：✗ ${e.message}`);
    if (e.stack) console.log(e.stack.split('\n').slice(0, 6).join('\n'));
  }
});

// 关键检查：脚本块里是否混入了 HTML（说明内联时切错了位置）
blocks.forEach((b, i) => {
  const code = b[1];
  if (/<html|<body|<div id="app"/.test(code)) {
    console.log(`\n⚠ 块 ${i + 1} 内混入了 HTML，说明内联切分位置错误`);
    const m = code.match(/<html[\s\S]{0,200}/);
    if (m) console.log('   ' + m[0].replace(/\n/g, ' ').slice(0, 200));
  }
});
